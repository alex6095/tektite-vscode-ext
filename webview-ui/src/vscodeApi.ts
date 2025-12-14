// Type-safe VSCode API wrapper for WebView communication

interface VSCodeApi {
    postMessage(message: any): void;
    getState(): any;
    setState(state: any): void;
}

// Declare the global acquireVsCodeApi function
declare function acquireVsCodeApi(): VSCodeApi;

// Singleton instance
let vscodeApi: VSCodeApi | null = null;

function getVSCodeApi(): VSCodeApi | null {
    if (vscodeApi) {
        return vscodeApi;
    }

    // Check if we're in VSCode WebView context
    if (typeof acquireVsCodeApi === 'function') {
        vscodeApi = acquireVsCodeApi();
        return vscodeApi;
    }

    return null;
}

// Check if running in VSCode WebView
export function isVSCodeEnv(): boolean {
    return typeof acquireVsCodeApi === 'function';
}

// Request ID generator for matching responses
let requestIdCounter = 0;
function getRequestId(): string {
    return `req_${++requestIdCounter}_${Date.now()}`;
}

// Pending request handlers
const pendingRequests = new Map<string, {
    resolve: (value: any) => void;
    reject: (error: any) => void;
}>();

// Set up message listener
if (typeof window !== 'undefined') {
    window.addEventListener('message', (event) => {
        const message = event.data;

        if (message.requestId && pendingRequests.has(message.requestId)) {
            const { resolve, reject } = pendingRequests.get(message.requestId)!;
            pendingRequests.delete(message.requestId);

            if (message.error) {
                reject(new Error(message.error));
            } else {
                resolve(message.payload);
            }
        }
    });
}

// Generic request function
async function sendRequest<T>(type: string, payload?: any, timeout = 30000): Promise<T> {
    const api = getVSCodeApi();

    if (!api) {
        throw new Error('VSCode API not available');
    }

    const requestId = getRequestId();

    return new Promise<T>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            if (pendingRequests.has(requestId)) {
                pendingRequests.delete(requestId);
                reject(new Error(`Request timeout: ${type}`));
            }
        }, timeout);

        pendingRequests.set(requestId, {
            resolve: (value) => {
                clearTimeout(timeoutId);
                resolve(value);
            },
            reject: (error) => {
                clearTimeout(timeoutId);
                reject(error);
            }
        });

        api.postMessage({ type, requestId, payload });
    });
}

// File Operations
export interface WorkspaceFilesResult {
    fileMap: Record<string, string>;
    fileTree: Array<{
        id: string;
        name: string;
        type: 'file' | 'folder';
        language: string;
        fullPath: string;
    }>;
}

export async function getWorkspaceFiles(): Promise<WorkspaceFilesResult> {
    return sendRequest<WorkspaceFilesResult>('getWorkspaceFiles');
}

export async function getFileContent(path: string): Promise<{ content: string }> {
    return sendRequest<{ content: string }>('getFileContent', { path });
}

export async function saveFile(path: string, content: string): Promise<{ success: boolean }> {
    return sendRequest<{ success: boolean }>('saveFile', { path, content });
}

// Python Execution
export async function runPython(code: string): Promise<{ output: string }> {
    return sendRequest<{ output: string }>('runPython', { code });
}

// AI Operations
export async function checkApiKey(): Promise<{ hasApiKey: boolean }> {
    return sendRequest<{ hasApiKey: boolean }>('getApiKey');
}

export async function callEmbedding(content: string): Promise<{ embedding: number[] | null }> {
    return sendRequest<{ embedding: number[] | null }>('callEmbedding', { content }, 60000);
}

export async function callAI(prompt: string, schema?: any): Promise<{ result: any }> {
    return sendRequest<{ result: any }>('callAI', { prompt, schema }, 60000);
}

// Message listener for file changes
type FileChangeCallback = (path: string, content: string) => void;
const fileChangeListeners: FileChangeCallback[] = [];

export function onFileChange(callback: FileChangeCallback): () => void {
    fileChangeListeners.push(callback);

    // Return cleanup function
    return () => {
        const index = fileChangeListeners.indexOf(callback);
        if (index > -1) {
            fileChangeListeners.splice(index, 1);
        }
    };
}

// Set up file change listener
if (typeof window !== 'undefined') {
    window.addEventListener('message', (event) => {
        const message = event.data;

        if (message.type === 'fileChanged' && message.payload) {
            const { path, content } = message.payload;
            fileChangeListeners.forEach(cb => cb(path, content));
        }
    });
}

// State persistence
export function getState<T>(): T | null {
    const api = getVSCodeApi();
    return api ? api.getState() : null;
}

export function setState<T>(state: T): void {
    const api = getVSCodeApi();
    if (api) {
        api.setState(state);
    }
}
