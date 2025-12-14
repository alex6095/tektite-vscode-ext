
import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { GraphCanvas } from './components/GraphCanvas';
import { Toolbar, GraphLayout, ViewMode, EdgeFilters } from './components/Toolbar';
import { RefactorPanel } from './components/RefactorPanel';
import { CodeEditor } from './components/CodeEditor';
import { INITIAL_FILES, INITIAL_FILE_TREE, generateGraphFromFiles } from './constants';
import { NodeData, GraphData, FileMap, FileSystemItem, NodeType, EdgeType } from './types';
import { PanelLeftOpen, Search, UploadCloud, X } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

declare global {
  interface Window {
    loadPyodide: any;
    pyodide: any;
  }
}

// Helper: Cosine Similarity
function cosineSimilarity(vecA: number[], vecB: number[]) {
    const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
    const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
    return (magnitudeA * magnitudeB) === 0 ? 0 : dotProduct / (magnitudeA * magnitudeB);
}

// Helper: Clean code for pure logic embedding
// Removes: Function signatures (names), Docstrings, Comments
function cleanCodeForEmbedding(rawCode: string): string {
    if (!rawCode) return "";
    
    let cleaned = rawCode;

    // 1. Remove Function Definition line (e.g., "def my_func(a, b):")
    // This prevents matching based purely on function names
    cleaned = cleaned.replace(/^def\s+.*?:/gm, '');

    // 2. Remove Docstrings ("""...""" or '''...''')
    // This prevents matching based on English descriptions instead of code logic
    cleaned = cleaned.replace(/("""[\s\S]*?"""|'''[\s\S]*?''')/g, '');

    // 3. Remove single line comments (# ...)
    cleaned = cleaned.replace(/#.*$/gm, '');

    // 4. Remove empty lines and excess whitespace to compact it
    cleaned = cleaned.replace(/^\s*[\r\n]/gm, '').trim();

    return cleaned;
}

/**
 * Replaces the body of a specific function in a full file string.
 * This ensures that edits to a "Block" (Function Node) are reflected in the "File" (Module Node).
 */
function replaceFunctionInCode(fileContent: string, funcName: string, newCode: string): string {
    const lines = fileContent.split('\n');
    const functionRegex = new RegExp(`^def\\s+${funcName}\\s*\\(`);
    
    let startLine = -1;
    let endLine = -1;
    
    for (let i = 0; i < lines.length; i++) {
        if (functionRegex.test(lines[i])) {
            startLine = i;
            // Scan for end of function
            let j = i + 1;
            while (j < lines.length) {
                const line = lines[j];
                // If line is not empty and starts with no indentation (and not a comment), it's the next block.
                // We handle standard top-level functions here.
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
        // Replace lines startLine to endLine with newCode
        const before = lines.slice(0, startLine);
        const after = lines.slice(endLine);
        return [...before, newCode, ...after].join('\n');
    }
    
    return fileContent; 
}

const App: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isRefactorPanelOpen, setIsRefactorPanelOpen] = useState(false);
  
  const [fileMap, setFileMap] = useState<FileMap>(INITIAL_FILES);
  const [skeletonTree, setSkeletonTree] = useState<FileSystemItem[]>(INITIAL_FILE_TREE);
  const [renderedTree, setRenderedTree] = useState<FileSystemItem[]>(INITIAL_FILE_TREE);
  
  const [graphData, setGraphData] = useState<GraphData>(() => generateGraphFromFiles(INITIAL_FILES));
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  
  const [viewMode, setViewMode] = useState<ViewMode>('graph');
  const [graphLayout, setGraphLayout] = useState<GraphLayout>('connection');
  const [edgeFilters, setEdgeFilters] = useState<EdgeFilters>({ showStructure: true, showSemantic: false });

  const [isPythonReady, setIsPythonReady] = useState(false);
  const [outputLog, setOutputLog] = useState<string[]>([]);
  
  // Search state for nodes
  const [nodeSearchQuery, setNodeSearchQuery] = useState('');
  
  const [isCalculatingEmbeddings, setIsCalculatingEmbeddings] = useState(false);
  const [hasInitialEmbedding, setHasInitialEmbedding] = useState(false);

  // 0. Keyboard Shortcut for Sidebar Toggle (Cmd+B)
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

  // 0.5 Layout Defaults Handler
  const handleLayoutChange = (newLayout: GraphLayout) => {
      setGraphLayout(newLayout);
      
      // Auto-configure filters based on layout for better UX
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

  // 1. Generate Graph & Enrich Tree when files change
  useEffect(() => {
    setGraphData(prevGraph => {
        const newStructure = generateGraphFromFiles(fileMap);
        
        // Merge old embeddings into new structure to avoid losing data
        // Logic: If ID matches AND code hasn't changed, keep the embedding and stale state.
        const mergedNodes = newStructure.nodes.map(newNode => {
            const oldNode = prevGraph.nodes.find(old => old.id === newNode.id);
            if (oldNode) {
                if (oldNode.code === newNode.code) {
                    // Code hasn't changed, preserve embedding and state
                    return { ...newNode, embedding: oldNode.embedding, isStale: oldNode.isStale };
                } else {
                    // Code CHANGED. preserve embedding temporarily for visual stability, but mark STALE.
                    // This is key: We don't delete embedding yet, so graph doesn't jump.
                    return { ...newNode, embedding: oldNode.embedding, isStale: true };
                }
            }
            // New node (no old node found) -> Stale by default as it has no embedding
            return { ...newNode, isStale: true };
        });

        // Preserve existing Semantic Edges (only if both nodes still exist)
        // Also preserve their weights
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

  // 1.5 Sync Tree with Graph
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

  // 2. Manual Semantic Calculation Trigger
  const handleRecalculateSemanticGraph = async () => {
        // Filter nodes that need updates:
        // 1. Python Functions
        // 2. AND (Have no embedding OR are marked stale)
        const nodesToUpdate = graphData.nodes.filter(
            n => n.type === NodeType.FUNCTION && n.language === 'python' && n.code && (!n.embedding || n.isStale)
        );

        if (nodesToUpdate.length === 0) return;

        setIsCalculatingEmbeddings(true);
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        let updated = false;
        
        // Clone nodes to mutate
        const newNodes = [...graphData.nodes];

        try {
            await Promise.all(nodesToUpdate.map(async (node) => {
                try {
                    // CRITICAL: Use cleaned code for embedding to capture PURE LOGIC, not names/comments.
                    // Fallback to label if code becomes empty (rare).
                    const pureLogicCode = cleanCodeForEmbedding(node.code || '');
                    const contentToEmbed = pureLogicCode || node.code || node.label;

                    const result = await ai.models.embedContent({
                        model: "text-embedding-004",
                        contents: contentToEmbed,
                    });
                    const embedding = result.embeddings?.[0]?.values;
                    
                    if (embedding) {
                        const idx = newNodes.findIndex(n => n.id === node.id);
                        if (idx !== -1) {
                            // Update embedding and CLEAR stale flag
                            newNodes[idx] = { ...newNodes[idx], embedding, isStale: false };
                            updated = true;
                        }
                    }
                } catch (err) {
                    console.warn(`Failed to embed ${node.label}`, err);
                }
            }));

            if (updated) {
                // Re-calculate ALL Semantic Edges using the updated embeddings
                const structuralLinks = graphData.links.filter(l => l.type !== EdgeType.SEMANTIC);
                const semanticLinks = [];
                const funcNodes = newNodes.filter(n => n.embedding);

                for (let i = 0; i < funcNodes.length; i++) {
                    for (let j = i + 1; j < funcNodes.length; j++) {
                        const score = cosineSimilarity(funcNodes[i].embedding!, funcNodes[j].embedding!);
                        if (score > 0.75) { // Threshold
                             semanticLinks.push({
                                 source: funcNodes[i].id,
                                 target: funcNodes[j].id,
                                 type: EdgeType.SEMANTIC,
                                 weight: score // Store similarity score
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

  // 3. Auto-Run Embeddings ONLY on Initial Load
  useEffect(() => {
     if (!hasInitialEmbedding && graphData.nodes.length > 0) {
         // Run only once at startup
         handleRecalculateSemanticGraph();
         setHasInitialEmbedding(true);
     }
  }, [hasInitialEmbedding]); // Intentionally limited dependencies to run once

  useEffect(() => {
    const initPyodide = async () => {
      try {
        if (!window.loadPyodide) {
           setTimeout(initPyodide, 500);
           return;
        }
        const pyodide = await window.loadPyodide();
        window.pyodide = pyodide;
        pyodide.setStdout({ batched: (msg: string) => {
             setOutputLog(prev => [...prev, msg]);
        }});
        setIsPythonReady(true);
      } catch (e) {
        console.error("Pyodide failed to load", e);
      }
    };
    initPyodide();
  }, []);

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
      if (viewMode === 'editor') {
          // Stay in editor
      }
    }
  };

  const handleCodeChange = (newCode: string) => {
    if (!selectedNodeId) return;

    // 1. Update Graph State (Visual & Transient)
    // Synchronously update graphData to keep UI stable
    // MARK AS STALE: Do not remove embedding yet, just mark isStale = true.
    setGraphData(prev => ({
        ...prev,
        nodes: prev.nodes.map(n => n.id === selectedNodeId ? { ...n, code: newCode, isStale: true } : n)
    }));

    const node = graphData.nodes.find(n => n.id === selectedNodeId);
    if (!node) return;

    // 2. Update File Map (Source of Truth)
    if (node.type === NodeType.MODULE || node.type === NodeType.FILE) {
        const filename = node.label;
        setFileMap(prev => ({ ...prev, [filename]: newCode }));
    } else if (node.type === NodeType.FUNCTION) {
         // If editing a function node, we must update the parent file content.
         // Find parent file via EdgeType.IMPORTS
         const importLink = graphData.links.find(l => 
             l.type === EdgeType.IMPORTS && 
             (l.source && typeof l.source === 'object' ? (l.source as any).id === node.id : l.source === node.id)
         );
         
         if (importLink) {
             // Resolve parent ID whether it's an object or string
             const parentId = importLink.target && typeof importLink.target === 'object' ? (importLink.target as any).id : importLink.target;
             const parentNode = graphData.nodes.find(n => n.id === parentId);
             
             if (parentNode) {
                 const filename = parentNode.label;
                 const currentFileContent = fileMap[filename];
                 
                 // Replace function body in the file content
                 const updatedFileContent = replaceFunctionInCode(currentFileContent, node.label, newCode);
                 
                 // Only update state if content actually changed to avoid unnecessary re-renders
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
         const srcFolder = newTree[0].children?.find(c => c.name === 'src');
         if (srcFolder && srcFolder.children) {
             srcFolder.children = [...srcFolder.children, ...newTreeItems];
         } else if (newTree[0].children) {
             newTree[0].children = [...newTree[0].children, ...newTreeItems];
         }
         return newTree;
     });
     
     setViewMode('graph');
  };

  const handleRunCode = async (code: string) => {
     if (!isPythonReady) {
         setOutputLog(prev => [...prev, "⚠ Python interpreter is still loading..."]);
         if (!isRefactorPanelOpen) setIsRefactorPanelOpen(true);
         return;
     }
     if (!isRefactorPanelOpen) setIsRefactorPanelOpen(true);
     setOutputLog(prev => [...prev, ">>> Running code..."]);
     try {
         for (const [filename, content] of Object.entries(fileMap)) {
            if (filename.endsWith('.py') || filename.endsWith('.json') || filename.endsWith('.txt')) {
                window.pyodide.FS.writeFile(filename, content, { encoding: "utf8" });
            }
         }
         await window.pyodide.runPythonAsync(code);
     } catch (err: any) {
         setOutputLog(prev => [...prev, `Error: ${err.message}`]);
     }
  };

  const selectedNode = graphData.nodes.find(n => n.id === selectedNodeId) || null;
  
  // Calculate pending updates count
  const pendingUpdates = graphData.nodes.filter(n => 
      n.type === NodeType.FUNCTION && n.language === 'python' && (!n.embedding || n.isStale)
  ).length;

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
