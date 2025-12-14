import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, X, Check, ArrowRight, Activity, GitCommit, Terminal, Loader2, Play } from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";
import { NodeData } from '../types';

interface RefactorPanelProps {
  isOpen: boolean;
  onClose: () => void;
  outputLog: string[];
  isPythonReady: boolean;
  selectedNode: NodeData | null;
  onApplyRefactor: (newCode: string) => void;
}

interface RefactorResult {
    description: string;
    complexityOriginal: number;
    complexityRefactored: number;
    diffOriginalSnippet: string;
    diffNewSnippet: string;
    fullRefactoredCode: string;
}

export const RefactorPanel: React.FC<RefactorPanelProps> = ({ 
    isOpen, 
    onClose, 
    outputLog, 
    isPythonReady, 
    selectedNode,
    onApplyRefactor 
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'refactor' | 'console'>('refactor');
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<RefactorResult | null>(null);

  // Auto switch to console if output changes
  useEffect(() => {
    if (outputLog.length > 0) {
        setActiveTab('console');
    }
  }, [outputLog]);

  // Auto scroll to bottom of log
  useEffect(() => {
    if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [outputLog, activeTab]);
  
  // Reset analysis when node changes
  useEffect(() => {
    setAnalysisResult(null);
  }, [selectedNode?.id]);

  const handleAnalyze = async () => {
    if (!selectedNode?.code) return;
    setIsAnalyzing(true);
    setAnalysisResult(null);

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `You are an expert Python code refactorer.
            Analyze the following code block. Identify ONE key refactoring opportunity (performance, readability, or safety).
            Return a JSON object with:
            - description: A short explanation of the change.
            - complexityOriginal: An estimated integer complexity score (0-100) of the original code.
            - complexityRefactored: An estimated integer complexity score (0-100) after refactoring.
            - diffOriginalSnippet: The specific segment of code being replaced (approx 3-5 lines for context). Indentation MUST be preserved.
            - diffNewSnippet: The new segment of code replacing the original snippet. Indentation MUST be preserved.
            - fullRefactoredCode: The COMPLETE, fully working code block with the change applied.

            Code to analyze:
            ${selectedNode.code}`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        description: { type: Type.STRING },
                        complexityOriginal: { type: Type.INTEGER },
                        complexityRefactored: { type: Type.INTEGER },
                        diffOriginalSnippet: { type: Type.STRING },
                        diffNewSnippet: { type: Type.STRING },
                        fullRefactoredCode: { type: Type.STRING },
                    }
                }
            }
        });
        
        const text = response.text;
        if (text) {
            setAnalysisResult(JSON.parse(text));
        }
    } catch (error) {
        console.error("Gemini Analysis Failed:", error);
    } finally {
        setIsAnalyzing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="w-96 h-full glass-panel border-l border-white/10 flex flex-col absolute right-0 top-0 z-40 shadow-2xl animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-white/10 shrink-0">
        <div className="flex items-center space-x-4">
             <button 
                onClick={() => setActiveTab('refactor')}
                className={`flex items-center space-x-2 pb-1 border-b-2 transition-colors ${activeTab === 'refactor' ? 'border-primary text-primary' : 'border-transparent text-gray-400 hover:text-white'}`}
             >
                <Sparkles size={16} />
                <span className="font-semibold text-sm">Agent</span>
             </button>
             <button 
                onClick={() => setActiveTab('console')}
                className={`flex items-center space-x-2 pb-1 border-b-2 transition-colors ${activeTab === 'console' ? 'border-yellow-400 text-yellow-400' : 'border-transparent text-gray-400 hover:text-white'}`}
             >
                <Terminal size={16} />
                <span className="font-semibold text-sm">Console</span>
             </button>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
          <X size={18} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-vscodeSidebar/50">
        
        {activeTab === 'refactor' && (
            <>
                {/* Empty State */}
                {!selectedNode && (
                    <div className="text-center text-gray-500 mt-10">
                        <Activity className="mx-auto mb-2 opacity-50" size={32} />
                        <p className="text-sm">Select a node to analyze</p>
                    </div>
                )}

                {/* Initial State - Ready to Analyze */}
                {selectedNode && !isAnalyzing && !analysisResult && (
                    <div className="flex flex-col items-center justify-center mt-10 space-y-4">
                        <div className="p-4 rounded-full bg-primary/10 text-primary mb-2">
                             <Sparkles size={32} />
                        </div>
                        <div className="text-center">
                            <h3 className="text-gray-200 font-medium">AI Refactoring Agent</h3>
                            <p className="text-gray-500 text-xs mt-1 max-w-[200px] mx-auto">
                                Analyze <span className="text-primary font-mono">{selectedNode.label}</span> for optimizations and improvements.
                            </p>
                        </div>
                        <button 
                            onClick={handleAnalyze}
                            className="bg-primary hover:bg-primary/90 text-white px-6 py-2 rounded-full text-sm font-medium shadow-lg shadow-primary/20 transition-all flex items-center space-x-2"
                        >
                            <Play size={14} className="fill-current" />
                            <span>Run Analysis</span>
                        </button>
                    </div>
                )}

                {/* Loading State */}
                {isAnalyzing && (
                    <div className="flex flex-col items-center justify-center mt-20 space-y-4">
                         <Loader2 size={32} className="text-primary animate-spin" />
                         <span className="text-sm text-gray-400 animate-pulse">Thinking...</span>
                    </div>
                )}

                {/* Results State */}
                {analysisResult && (
                    <>
                        {/* Suggestion Card */}
                        <div className="bg-surfaceHighlight/50 rounded-lg p-4 border border-white/5 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="font-semibold text-sm text-gray-200">Recommendation</h3>
                                <div className="flex items-center space-x-1 text-green-400">
                                    <Check size={14} />
                                    <span className="text-xs">Ready</span>
                                </div>
                            </div>
                            <p className="text-xs text-gray-400 leading-relaxed mb-4">
                                {analysisResult.description}
                            </p>
                            <div className="flex items-center justify-between text-xs text-gray-500 bg-black/20 p-2 rounded">
                                <span>Complexity Impact:</span>
                                <div className="flex items-center space-x-2">
                                    <span className="text-orange-400">{analysisResult.complexityOriginal}</span>
                                    <ArrowRight size={12} />
                                    <span className="text-green-400 font-bold">{analysisResult.complexityRefactored}</span>
                                </div>
                            </div>
                        </div>

                        {/* Diff Viewer */}
                        <div className="bg-[#0D1117] rounded-lg border border-white/10 overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-700">
                            <div className="flex items-center justify-between px-3 py-2 bg-white/5 border-b border-white/5">
                                <span className="text-xs font-mono text-gray-400">Diff patches</span>
                                <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">Preview</span>
                            </div>
                            <div className="font-mono text-[11px] overflow-x-auto bg-[#0D1117] leading-relaxed">
                                {analysisResult.diffOriginalSnippet.split('\n').map((line, i) => (
                                    <div key={`old-${i}`} className="flex bg-red-900/10 w-full hover:bg-red-900/20 transition-colors">
                                        <span className="w-6 shrink-0 text-red-500/50 select-none text-center border-r border-red-500/10 mr-2">-</span>
                                        <pre className="text-red-200/70 whitespace-pre font-mono m-0 py-0.5">{line || ' '}</pre>
                                    </div>
                                ))}
                                
                                {(analysisResult.diffOriginalSnippet && analysisResult.diffNewSnippet) && (
                                    <div className="h-px w-full bg-white/5 border-t border-dashed border-gray-800 my-1 opacity-50" />
                                )}

                                {analysisResult.diffNewSnippet.split('\n').map((line, i) => (
                                    <div key={`new-${i}`} className="flex bg-green-900/10 w-full hover:bg-green-900/20 transition-colors">
                                        <span className="w-6 shrink-0 text-green-500/50 select-none text-center border-r border-green-500/10 mr-2">+</span>
                                        <pre className="text-green-300 whitespace-pre font-mono m-0 py-0.5">{line || ' '}</pre>
                                    </div>
                                ))}
                            </div>
                            
                            <div className="p-2 border-t border-white/5 bg-white/5">
                                <div className="flex items-center justify-between text-[10px] text-gray-400 mb-2">
                                    <span>Optimization Score</span>
                                </div>
                                <div className="h-1.5 w-full bg-gray-700 rounded-full overflow-hidden flex">
                                    <div style={{ width: `${analysisResult.complexityOriginal}%` }} className="bg-orange-500/50 h-full" />
                                    <div style={{ width: `${Math.max(0, analysisResult.complexityOriginal - analysisResult.complexityRefactored)}%` }} className="bg-green-500 h-full" />
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </>
        )}

        {activeTab === 'console' && (
            <div className="h-full flex flex-col">
                <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
                    <span>Interpreter Output</span>
                    <div className="flex items-center space-x-2">
                        {!isPythonReady && (
                            <div className="flex items-center text-blue-400 space-x-1">
                                <Loader2 size={12} className="animate-spin" />
                                <span>Loading Pyodide...</span>
                            </div>
                        )}
                        {isPythonReady && <span className="text-green-400">Python 3.11 Ready</span>}
                    </div>
                </div>
                <div 
                    ref={scrollRef}
                    className="flex-1 bg-black/80 rounded border border-white/10 p-3 font-mono text-xs overflow-y-auto text-gray-300"
                >
                    {outputLog.length === 0 ? (
                         <span className="text-gray-600 italic">Run a Python node to see output here...</span>
                    ) : (
                        outputLog.map((line, i) => (
                            <div key={i} className="mb-1 border-b border-white/5 pb-1 last:border-0">{line}</div>
                        ))
                    )}
                </div>
            </div>
        )}

      </div>

      {/* Footer Actions */}
      {activeTab === 'refactor' && analysisResult && (
        <div className="p-4 border-t border-white/10 bg-surface shrink-0">
            <button 
                onClick={() => {
                    if (analysisResult) {
                        onApplyRefactor(analysisResult.fullRefactoredCode);
                        setAnalysisResult(null); // Reset after applying
                    }
                }}
                className="w-full bg-primary hover:bg-primary/90 text-white font-medium py-2 rounded-lg shadow-lg shadow-primary/20 transition-all flex items-center justify-center space-x-2 group"
            >
                <GitCommit size={16} className="group-hover:scale-110 transition-transform" />
                <span>Apply Patch</span>
            </button>
        </div>
      )}
    </div>
  );
};