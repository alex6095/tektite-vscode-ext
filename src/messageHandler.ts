import * as vscode from 'vscode';
import * as path from 'path';
import { runPythonCode } from './pythonRunner';
import { callAI, getEmbedding } from './aiService';

// Message types from webview
export interface WebviewMessage {
    type: string;
    requestId?: string;
    payload?: any;
}

// Response types to webview
export interface ExtensionResponse {
    type: string;
    requestId?: string;
    payload?: any;
    error?: string;
}

export async function handleMessage(
    message: WebviewMessage,
    context: vscode.ExtensionContext
): Promise<ExtensionResponse | null> {
    const { type, requestId, payload } = message;

    try {
        switch (type) {
            case 'getWorkspaceFiles':
                return await handleGetWorkspaceFiles(requestId);

            case 'getFileContent':
                return await handleGetFileContent(requestId, payload.path);

            case 'saveFile':
                return await handleSaveFile(requestId, payload.path, payload.content);

            case 'runPython':
                return await handleRunPython(requestId, payload.code);

            case 'getApiKey':
                return await handleGetApiKey(requestId, context);

            case 'callEmbedding':
                return await handleCallEmbedding(requestId, payload.content, context);

            case 'callAI':
                return await handleCallAI(requestId, payload.prompt, payload.schema, context);

            default:
                console.log('Unknown message type:', type);
                return null;
        }
    } catch (error: any) {
        return {
            type: `${type}Response`,
            requestId,
            error: error.message || 'Unknown error occurred'
        };
    }
}

async function handleGetWorkspaceFiles(requestId?: string): Promise<ExtensionResponse> {
    const workspaceFolders = vscode.workspace.workspaceFolders;

    if (!workspaceFolders) {
        return {
            type: 'getWorkspaceFilesResponse',
            requestId,
            payload: { files: [], tree: [] }
        };
    }

    // Find Python files and common source files
    const pythonFiles = await vscode.workspace.findFiles('**/*.py', '**/node_modules/**', 100);
    const mdFiles = await vscode.workspace.findFiles('**/*.md', '**/node_modules/**', 20);
    const jsonFiles = await vscode.workspace.findFiles('**/*.json', '**/node_modules/**', 10);

    const allFiles = [...pythonFiles, ...mdFiles, ...jsonFiles];

    const fileMap: Record<string, string> = {};
    const fileTree: any[] = [];

    for (const fileUri of allFiles) {
        try {
            const content = await vscode.workspace.fs.readFile(fileUri);
            const relativePath = vscode.workspace.asRelativePath(fileUri);
            const fileName = path.basename(fileUri.fsPath);

            fileMap[fileName] = Buffer.from(content).toString('utf8');

            // Determine language
            let language = 'text';
            if (fileName.endsWith('.py')) language = 'python';
            else if (fileName.endsWith('.md')) language = 'markdown';
            else if (fileName.endsWith('.json')) language = 'json';
            else if (fileName.endsWith('.ts') || fileName.endsWith('.tsx')) language = 'typescript';

            fileTree.push({
                id: `file-${fileName}`,
                name: fileName,
                type: 'file',
                language,
                fullPath: fileUri.fsPath
            });
        } catch (e) {
            console.error(`Failed to read file: ${fileUri.fsPath}`, e);
        }
    }

    return {
        type: 'getWorkspaceFilesResponse',
        requestId,
        payload: { fileMap, fileTree }
    };
}

async function handleGetFileContent(requestId?: string, filePath?: string): Promise<ExtensionResponse> {
    if (!filePath) {
        return {
            type: 'getFileContentResponse',
            requestId,
            error: 'File path is required'
        };
    }

    const uri = vscode.Uri.file(filePath);
    const content = await vscode.workspace.fs.readFile(uri);

    return {
        type: 'getFileContentResponse',
        requestId,
        payload: { content: Buffer.from(content).toString('utf8') }
    };
}

async function handleSaveFile(requestId?: string, filePath?: string, content?: string): Promise<ExtensionResponse> {
    if (!filePath || content === undefined) {
        return {
            type: 'saveFileResponse',
            requestId,
            error: 'File path and content are required'
        };
    }

    const uri = vscode.Uri.file(filePath);
    await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));

    return {
        type: 'saveFileResponse',
        requestId,
        payload: { success: true }
    };
}

async function handleRunPython(requestId?: string, code?: string): Promise<ExtensionResponse> {
    if (!code) {
        return {
            type: 'runPythonResponse',
            requestId,
            error: 'Python code is required'
        };
    }

    const result = await runPythonCode(code);

    return {
        type: 'runPythonResponse',
        requestId,
        payload: { output: result }
    };
}

async function handleGetApiKey(requestId?: string, context?: vscode.ExtensionContext): Promise<ExtensionResponse> {
    const apiKey = await context?.secrets.get('tektite.geminiApiKey');

    return {
        type: 'getApiKeyResponse',
        requestId,
        payload: { hasApiKey: !!apiKey }
    };
}

async function handleCallEmbedding(
    requestId?: string,
    content?: string,
    context?: vscode.ExtensionContext
): Promise<ExtensionResponse> {
    if (!content || !context) {
        return {
            type: 'callEmbeddingResponse',
            requestId,
            error: 'Content and context are required'
        };
    }

    const embedding = await getEmbedding(context.secrets, content);

    return {
        type: 'callEmbeddingResponse',
        requestId,
        payload: { embedding }
    };
}

async function handleCallAI(
    requestId?: string,
    prompt?: string,
    schema?: any,
    context?: vscode.ExtensionContext
): Promise<ExtensionResponse> {
    if (!prompt || !context) {
        return {
            type: 'callAIResponse',
            requestId,
            error: 'Prompt and context are required'
        };
    }

    const result = await callAI(context.secrets, prompt, schema);

    return {
        type: 'callAIResponse',
        requestId,
        payload: { result }
    };
}
