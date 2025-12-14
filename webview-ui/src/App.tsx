
import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { GraphCanvas } from './components/GraphCanvas';
import { Toolbar, GraphLayout, ViewMode, EdgeFilters } from './components/Toolbar';
import { RefactorPanel } from './components/RefactorPanel';
import { CodeEditor } from './components/CodeEditor';
import { INITIAL_FILES, INITIAL_FILE_TREE, generateGraphFromFiles } from './constants';
import { NodeData, GraphData, FileMap, FileSystemItem, NodeType, EdgeType } from './types';
import { PanelLeftOpen, Search, X } from 'lucide-react';
import * as vscodeApi from './vscodeApi';

// Helper: Cosine Similarity
function cosineSimilarity(vecA: number[], vecB: number[]) {
    const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
    const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
    return (magnitudeA * magnitudeB) === 0 ? 0 : dotProduct / (magnitudeA * magnitudeB);
}

// Helper: Clean code for pure logic embedding
function cleanCodeForEmbedding(rawCode: string): string {
    if (!rawCode) return "";

    let cleaned = rawCode;
    cleaned = cleaned.replace(/^def\s+.*?:/gm, '');
    cleaned = cleaned.replace(/("""[\s\S]*?"""|'''[\s\S]*?''')/g, '');
    cleaned = cleaned.replace(/#.*$/gm, '');
    cleaned = cleaned.replace(/^\s*[\r\n]/gm, '').trim();

    return cleaned;
}

/**
 * Replaces the body of a specific function in a full file string.
 */
function replaceFunctionInCode(fileContent: string, funcName: string, newCode: string): string {
    const lines = fileContent.split('\n');
    const functionRegex = new RegExp(`^def\\s+${funcName}\\s*\\(`);

    let startLine = -1;
    let endLine = -1;

    for (let i = 0; i < lines.length; i++) {
        if (functionRegex.test(lines[i])) {
            startLine = i;
            let j = i + 1;
            while (j < lines.length) {
                const line = lines[j];
                if (line.trim() !== '' && !line.startsWith(' ') && !line.startsWith('\t') && !line.startsWith('#') && !line.startsWith('@')) {
                    break;
                }
                j++;
            }
            endLine = j;
            break;
        }
    }

    if (startLine !== -1) {
        const before = lines.slice(0, startLine);
        const after = lines.slice(endLine);
        return [...before, newCode, ...after].join('\n');
    }

    return fileContent;
}

const App: React.FC = () => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isRefactorPanelOpen, setIsRefactorPanelOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Use empty initial state when in VSCode, fallback to demo data otherwise
    const isVSCode = vscodeApi.isVSCodeEnv();
    const [fileMap, setFileMap] = useState<FileMap>(isVSCode ? {} : INITIAL_FILES);
    const [skeletonTree, setSkeletonTree] = useState<FileSystemItem[]>(isVSCode ? [] : INITIAL_FILE_TREE);
    const [renderedTree, setRenderedTree] = useState<FileSystemItem[]>(isVSCode ? [] : INITIAL_FILE_TREE);

    const [graphData, setGraphData] = useState<GraphData>(() =>
        isVSCode ? { nodes: [], links: [] } : generateGraphFromFiles(INITIAL_FILES)
    );
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

    const [viewMode, setViewMode] = useState<ViewMode>('graph');
    const [graphLayout, setGraphLayout] = useState<GraphLayout>('connection');
    const [edgeFilters, setEdgeFilters] = useState<EdgeFilters>({ showStructure: true, showSemantic: false });

    // Python is always "ready" in VSCode (uses terminal)
    const [isPythonReady, setIsPythonReady] = useState(isVSCode);
    const [outputLog, setOutputLog] = useState<string[]>([]);

    const [nodeSearchQuery, setNodeSearchQuery] = useState('');
    const [isCalculatingEmbeddings, setIsCalculatingEmbeddings] = useState(false);
    const [hasInitialEmbedding, setHasInitialEmbedding] = useState(false);

    // Load files from VSCode workspace on mount
    useEffect(() => {
        if (!isVSCode) {
            setIsLoading(false);
            return;
        }

        const loadWorkspaceFiles = async () => {
            try {
                const result = await vscodeApi.getWorkspaceFiles();

                if (result.fileMap && Object.keys(result.fileMap).length > 0) {
                    setFileMap(result.fileMap);

                    // Build tree structure
                    const tree: FileSystemItem[] = [{
                        id: 'root',
                        name: 'Workspace',
                        type: 'folder',
                        isOpen: true,
                        children: result.fileTree.map(f => ({
                            id: f.id,
                            name: f.name,
                            type: 'file' as const,
                            language: f.language as any
                        }))
                    }];

                    setSkeletonTree(tree);
                    setRenderedTree(tree);
                } else {
                    // No files found, use demo data
                    setFileMap(INITIAL_FILES);
                    setSkeletonTree(INITIAL_FILE_TREE);
                    setRenderedTree(INITIAL_FILE_TREE);
                }
            } catch (error) {
                console.error('Failed to load workspace files:', error);
                // Fallback to demo data
                setFileMap(INITIAL_FILES);
                setSkeletonTree(INITIAL_FILE_TREE);
                setRenderedTree(INITIAL_FILE_TREE);
            } finally {
                setIsLoading(false);
            }
        };

        loadWorkspaceFiles();

        // Listen for file changes from VSCode
        const cleanup = vscodeApi.onFileChange((path, content) => {
            const filename = path.split('/').pop() || path;
            setFileMap(prev => ({ ...prev, [filename]: content }));
        });

        return cleanup;
    }, [isVSCode]);

    // Keyboard Shortcut for Sidebar Toggle (Cmd+B)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
                e.preventDefault();
                setIsSidebarOpen(prev => !prev);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const handleLayoutChange = (newLayout: GraphLayout) => {
        setGraphLayout(newLayout);
        if (newLayout === 'semantic') {
            setEdgeFilters({ showStructure: true, showSemantic: true });
        } else if (newLayout === 'flow') {
            setEdgeFilters({ showStructure: true, showSemantic: true });
        } else if (newLayout === 'connection') {
            setEdgeFilters({ showStructure: true, showSemantic: false });
        }
    };

    const handleToggleFilter = (filter: keyof EdgeFilters) => {
        setEdgeFilters(prev => ({ ...prev, [filter]: !prev[filter] }));
    };

    // Generate Graph & Enrich Tree when files change
    useEffect(() => {
        if (Object.keys(fileMap).length === 0) return;

        setGraphData(prevGraph => {
            const newStructure = generateGraphFromFiles(fileMap);

            const mergedNodes = newStructure.nodes.map(newNode => {
                const oldNode = prevGraph.nodes.find(old => old.id === newNode.id);
                if (oldNode) {
                    if (oldNode.code === newNode.code) {
                        return { ...newNode, embedding: oldNode.embedding, isStale: oldNode.isStale };
                    } else {
                        return { ...newNode, embedding: oldNode.embedding, isStale: true };
                    }
                }
                return { ...newNode, isStale: true };
            });

            const existingSemanticEdges = prevGraph.links.filter(l => l.type === EdgeType.SEMANTIC);
            const validSemanticEdges = existingSemanticEdges.filter(l =>
                mergedNodes.find(n => n.id === l.source) && mergedNodes.find(n => n.id === l.target)
            );

            return {
                nodes: mergedNodes,
                links: [...newStructure.links, ...validSemanticEdges]
            };
        });

    }, [fileMap]);

    // Sync Tree with Graph
    useEffect(() => {
        const enrichTree = (items: FileSystemItem[]): FileSystemItem[] => {
            return items.map(item => {
                const newItem = { ...item };
                if (newItem.type === 'folder' && newItem.children) {
                    newItem.children = enrichTree(newItem.children);
                }
                if (newItem.type === 'file') {
                    const functionsInFile = graphData.links
                        .filter(l => l.type === EdgeType.IMPORTS && l.target === newItem.id)
                        .map(l => {
                            const funcNode = graphData.nodes.find(n => n.id === l.source);
                            return funcNode;
                        })
                        .filter((n): n is NodeData => !!n)
                        .map(n => ({
                            id: n.id,
                            name: n.label,
                            type: 'function' as const,
                            language: 'python' as const
                        } as any));

                    if (functionsInFile.length > 0) {
                        newItem.children = functionsInFile;
                        newItem.isOpen = true;
                    }
                }
                return newItem;
            });
        };
        setRenderedTree(enrichTree(skeletonTree));
    }, [graphData.nodes.length, graphData.links.length, skeletonTree]);

    // Semantic Calculation using VSCode extension host
    const handleRecalculateSemanticGraph = async () => {
        const nodesToUpdate = graphData.nodes.filter(
            n => n.type === NodeType.FUNCTION && n.language === 'python' && n.code && (!n.embedding || n.isStale)
        );

        if (nodesToUpdate.length === 0) return;

        setIsCalculatingEmbeddings(true);
        let updated = false;
        const newNodes = [...graphData.nodes];

        try {
            // Request embeddings from extension host (secure API key handling)
            await Promise.all(nodesToUpdate.map(async (node) => {
                try {
                    const pureLogicCode = cleanCodeForEmbedding(node.code || '');
                    const contentToEmbed = pureLogicCode || node.code || node.label;

                    const result = await vscodeApi.callEmbedding(contentToEmbed);
                    const embedding = result.embedding;

                    if (embedding) {
                        const idx = newNodes.findIndex(n => n.id === node.id);
                        if (idx !== -1) {
                            newNodes[idx] = { ...newNodes[idx], embedding, isStale: false };
                            updated = true;
                        }
                    }
                } catch (err) {
                    console.warn(`Failed to embed ${node.label}`, err);
                }
            }));

            if (updated) {
                const structuralLinks = graphData.links.filter(l => l.type !== EdgeType.SEMANTIC);
                const semanticLinks: any[] = [];
                const funcNodes = newNodes.filter(n => n.embedding);

                for (let i = 0; i < funcNodes.length; i++) {
                    for (let j = i + 1; j < funcNodes.length; j++) {
                        const score = cosineSimilarity(funcNodes[i].embedding!, funcNodes[j].embedding!);
                        if (score > 0.75) {
                            semanticLinks.push({
                                source: funcNodes[i].id,
                                target: funcNodes[j].id,
                                type: EdgeType.SEMANTIC,
                                weight: score
                            });
                        }
                    }
                }

                setGraphData(prev => ({
                    nodes: newNodes,
                    links: [...structuralLinks, ...semanticLinks]
                }));
            }

        } finally {
            setIsCalculatingEmbeddings(false);
        }
    };

    // Auto-Run Embeddings on Initial Load
    useEffect(() => {
        if (!hasInitialEmbedding && graphData.nodes.length > 0) {
            handleRecalculateSemanticGraph();
            setHasInitialEmbedding(true);
        }
    }, [hasInitialEmbedding, graphData.nodes.length]);

    const handleNodeSelect = (node: NodeData | null) => {
        setSelectedNodeId(node ? node.id : null);
        if (node && !isRefactorPanelOpen && node.complexity && node.complexity > 5) {
            setIsRefactorPanelOpen(true);
        }
    };

    const handleFileSelect = (fileId: string) => {
        let node = graphData.nodes.find(n => n.id === fileId);
        if (!node) {
            const filename = fileId.replace('file-', '');
            node = graphData.nodes.find(n => n.label === filename);
        }

        if (node) {
            setSelectedNodeId(node.id);
        }
    };

    const handleCodeChange = (newCode: string) => {
        if (!selectedNodeId) return;

        setGraphData(prev => ({
            ...prev,
            nodes: prev.nodes.map(n => n.id === selectedNodeId ? { ...n, code: newCode, isStale: true } : n)
        }));

        const node = graphData.nodes.find(n => n.id === selectedNodeId);
        if (!node) return;

        if (node.type === NodeType.MODULE || node.type === NodeType.FILE) {
            const filename = node.label;
            setFileMap(prev => ({ ...prev, [filename]: newCode }));
        } else if (node.type === NodeType.FUNCTION) {
            const importLink = graphData.links.find(l =>
                l.type === EdgeType.IMPORTS &&
                (l.source && typeof l.source === 'object' ? (l.source as any).id === node.id : l.source === node.id)
            );

            if (importLink) {
                const parentId = importLink.target && typeof importLink.target === 'object' ? (importLink.target as any).id : importLink.target;
                const parentNode = graphData.nodes.find(n => n.id === parentId);

                if (parentNode) {
                    const filename = parentNode.label;
                    const currentFileContent = fileMap[filename];
                    const updatedFileContent = replaceFunctionInCode(currentFileContent, node.label, newCode);

                    if (updatedFileContent !== currentFileContent) {
                        setFileMap(prev => ({ ...prev, [filename]: updatedFileContent }));
                    }
                }
            }
        }
    };

    const handleFilesUploaded = async (fileList: FileList) => {
        const newFiles: FileMap = { ...fileMap };
        const newTreeItems: FileSystemItem[] = [];

        for (let i = 0; i < fileList.length; i++) {
            const file = fileList[i];
            const text = await file.text();
            newFiles[file.name] = text;

            let lang: any = 'text';
            if (file.name.endsWith('.py')) lang = 'python';
            if (file.name.endsWith('.ts') || file.name.endsWith('.tsx')) lang = 'typescript';
            if (file.name.endsWith('.json')) lang = 'json';
            if (file.name.endsWith('.md')) lang = 'markdown';

            newTreeItems.push({
                id: `file-${file.name}`,
                name: file.name,
                type: 'file',
                language: lang
            });
        }

        setFileMap(newFiles);

        setSkeletonTree(prev => {
            const newTree = [...prev];
            const srcFolder = newTree[0]?.children?.find(c => c.name === 'src');
            if (srcFolder && srcFolder.children) {
                srcFolder.children = [...srcFolder.children, ...newTreeItems];
            } else if (newTree[0]?.children) {
                newTree[0].children = [...newTree[0].children, ...newTreeItems];
            }
            return newTree;
        });

        setViewMode('graph');
    };

    // Run Python code via VSCode terminal
    const handleRunCode = async (code: string) => {
        if (!isRefactorPanelOpen) setIsRefactorPanelOpen(true);
        setOutputLog(prev => [...prev, ">>> Running code..."]);

        try {
            if (isVSCode) {
                const result = await vscodeApi.runPython(code);
                setOutputLog(prev => [...prev, result.output]);
            } else {
                setOutputLog(prev => [...prev, "⚠ Python execution is only available in VSCode extension mode."]);
            }
        } catch (err: any) {
            setOutputLog(prev => [...prev, `Error: ${err.message}`]);
        }
    };

    const selectedNode = graphData.nodes.find(n => n.id === selectedNodeId) || null;

    const pendingUpdates = graphData.nodes.filter(n =>
        n.type === NodeType.FUNCTION && n.language === 'python' && (!n.embedding || n.isStale)
    ).length;

    if (isLoading) {
        return (
            <div className="flex w-full h-screen bg-background text-text items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-textMuted">Loading workspace...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex w-full h-screen bg-background text-text overflow-hidden relative">
            <div className={`transition-all duration-300 ${isSidebarOpen ? 'w-[18rem]' : 'w-0'} overflow-hidden relative border-r border-border shrink-0`}>
                <Sidebar
                    fileTree={renderedTree}
                    onFileSelect={handleFileSelect}
                    onFilesUploaded={handleFilesUploaded}
                    selectedId={selectedNodeId}
                    onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
                />
            </div>

            {!isSidebarOpen && (
                <button
                    onClick={() => setIsSidebarOpen(true)}
                    className="absolute bottom-4 left-4 z-50 p-2 bg-surface border border-border rounded-lg text-textMuted hover:text-text transition-colors shadow-lg hover:shadow-xl"
                >
                    <PanelLeftOpen size={20} />
                </button>
            )}

            <div className="flex-1 relative h-full flex flex-col min-w-0">
                <Toolbar
                    currentLayout={graphLayout}
                    onLayoutChange={handleLayoutChange}
                    currentView={viewMode}
                    onViewChange={setViewMode}
                    edgeFilters={edgeFilters}
                    onToggleFilter={handleToggleFilter}
                    onRecalculateSemantics={handleRecalculateSemanticGraph}
                    pendingUpdates={pendingUpdates}
                    isLoading={isCalculatingEmbeddings}
                />

                {viewMode === 'graph' && (
                    <>
                        <div className="absolute top-4 left-4 z-40 w-64">
                            <div className="relative group">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 group-focus-within:text-primary transition-colors" size={16} />
                                <input
                                    type="text"
                                    value={nodeSearchQuery}
                                    onChange={(e) => setNodeSearchQuery(e.target.value)}
                                    placeholder="Search nodes..."
                                    className="w-full bg-surface/50 backdrop-blur-md border border-white/10 rounded-full py-2 pl-10 pr-8 text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:bg-surface/80 transition-all shadow-xl"
                                />
                                {nodeSearchQuery && (
                                    <button
                                        onClick={() => setNodeSearchQuery('')}
                                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                                    >
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                        </div>
                        <GraphCanvas
                            data={graphData}
                            layoutMode={graphLayout}
                            onNodeSelect={handleNodeSelect}
                            onRunCode={handleRunCode}
                            selectedNodeId={selectedNodeId}
                            searchQuery={nodeSearchQuery}
                            edgeFilters={edgeFilters}
                        />
                    </>
                )}

                {viewMode === 'editor' && (
                    <CodeEditor
                        key={selectedNodeId}
                        selectedNode={selectedNode}
                        onRun={handleRunCode}
                        onChange={handleCodeChange}
                    />
                )}
            </div>

            <div className={`transition-all duration-300 relative ${isRefactorPanelOpen ? 'w-96' : 'w-0'} shrink-0`}>
                <RefactorPanel
                    isOpen={isRefactorPanelOpen}
                    onClose={() => setIsRefactorPanelOpen(false)}
                    outputLog={outputLog}
                    isPythonReady={isPythonReady}
                    selectedNode={selectedNode}
                    onApplyRefactor={handleCodeChange}
                />
            </div>
        </div>
    );
};

export default App;
