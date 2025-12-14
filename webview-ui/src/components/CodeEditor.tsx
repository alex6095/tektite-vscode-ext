
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { NodeData } from '../types';
import { FileCode, Play } from 'lucide-react';

interface CodeEditorProps {
  selectedNode: NodeData | null;
  onRun: (code: string) => void;
  onChange: (newCode: string) => void;
}

// --- SYNTAX HIGHLIGHTING LOGIC ---

const KEYWORDS = new Set([
  'def', 'class', 'if', 'elif', 'else', 'return', 'for', 'while', 'in', 'import', 'from', 'as',
  'try', 'except', 'with', 'pass', 'break', 'continue', 'lambda', 'async', 'await', 
  'global', 'nonlocal', 'assert', 'del', 'yield', 'raise'
]);

const BUILTINS = new Set([
  'print', 'len', 'range', 'str', 'int', 'list', 'dict', 'set', 'bool', 'float', 
  'tuple', 'super', 'type', 'isinstance', 'zip', 'map', 'filter', 'enumerate'
]);

const BOOLEANS = new Set(['True', 'False', 'None']);

const highlightPython = (code: string): React.ReactNode[] => {
  const tokens: React.ReactNode[] = [];
  
  const mainRegex = /("""[\s\S]*?"""|'''[\s\S]*?'''|"[^"\n]*"|'[^'\n]*'|#.*$)|([^"#'\n]+)|(\n)/gm;
  
  let match;

  while ((match = mainRegex.exec(code)) !== null) {
    const [fullMatch, stringOrComment, codeChunk, newline] = match;
    const keyPrefix = match.index;

    if (stringOrComment) {
      if (stringOrComment.startsWith('#')) {
        tokens.push(<span key={keyPrefix} className="text-gray-500 italic">{stringOrComment}</span>);
      } else {
        tokens.push(<span key={keyPrefix} className="text-green-400">{stringOrComment}</span>);
      }
    } else if (newline) {
        tokens.push(<span key={keyPrefix}>{'\n'}</span>);
    } else if (codeChunk) {
       const subRegex = /(\b[a-zA-Z_]\w*\b)|(\d+(\.\d+)?)|([(){}\[\],:;+\-*/%=&|^<>!@~`.]+)|(\s+)|([\s\S])/g;
       let subMatch;
       while ((subMatch = subRegex.exec(codeChunk)) !== null) {
          const [subText, word, number, punct, whitespace, other] = subMatch;
          const subKey = `${keyPrefix}-${subMatch.index}`;

          if (whitespace) {
             tokens.push(<span key={subKey}>{whitespace}</span>);
          } else if (number) {
             tokens.push(<span key={subKey} className="text-orange-300">{number}</span>);
          } else if (punct) {
             tokens.push(<span key={subKey} className="text-gray-400">{punct}</span>);
          } else if (word) {
             if (KEYWORDS.has(word)) {
                tokens.push(<span key={subKey} className="text-purple-400 font-medium">{word}</span>);
             } else if (BOOLEANS.has(word)) {
                tokens.push(<span key={subKey} className="text-orange-400 italic">{word}</span>);
             } else if (BUILTINS.has(word)) {
                tokens.push(<span key={subKey} className="text-blue-400">{word}</span>);
             } else {
                tokens.push(<span key={subKey} className="text-gray-200">{word}</span>);
             }
          } else if (other) {
             tokens.push(<span key={subKey} className="text-gray-200">{other}</span>);
          }
       }
    }
  }

  return tokens;
};

// Strict shared styles to ensure textarea and pre overlap perfectly
const FONT_FAMILY = '"Fira Code", "Fira Mono", monospace';
const FONT_SIZE = '13px';
const LINE_HEIGHT = '20px';
const PADDING = '20px';

const sharedEditorStyles: React.CSSProperties = {
    fontFamily: FONT_FAMILY,
    fontSize: FONT_SIZE,
    lineHeight: LINE_HEIGHT,
    letterSpacing: '0px',
    tabSize: 4,
    whiteSpace: 'pre', 
    wordBreak: 'normal',
    overflowWrap: 'normal',
    fontVariantLigatures: 'none', 
    padding: PADDING, 
    margin: 0,
    border: 0,
    outline: 0,
    boxSizing: 'border-box',
};

interface HistoryState {
    code: string;
    cursor: number;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({ selectedNode, onRun, onChange }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);

  // History Stack for Undo/Redo
  const historyRef = useRef<HistoryState[]>([]);
  const historyIndexRef = useRef<number>(-1);
  const lastTypeTime = useRef<number>(0);

  // Reset history when node changes
  useEffect(() => {
    if (selectedNode) {
        historyRef.current = [{ code: selectedNode.code || '', cursor: 0 }];
        historyIndexRef.current = 0;
        
        // Reset scroll
        if (textareaRef.current) textareaRef.current.scrollTop = 0;
        if (preRef.current) preRef.current.scrollTop = 0;
        if (lineNumbersRef.current) lineNumbersRef.current.scrollTop = 0;
    }
  }, [selectedNode?.id]);

  const recordHistory = (newCode: string, cursor: number) => {
    const now = Date.now();
    const lastEntry = historyRef.current[historyIndexRef.current];
    
    // Heuristic: If typing quickly (within 800ms) and simple length change (1 char), merge updates
    const isTypingSequence = (now - lastTypeTime.current < 800) && 
                             lastEntry && 
                             Math.abs(newCode.length - lastEntry.code.length) <= 1;

    lastTypeTime.current = now;

    // Discard any "future" history
    if (historyIndexRef.current < historyRef.current.length - 1) {
        historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
    }

    if (isTypingSequence && historyIndexRef.current > 0) {
        historyRef.current[historyIndexRef.current] = { code: newCode, cursor };
    } else {
        historyRef.current.push({ code: newCode, cursor });
        historyIndexRef.current += 1;
    }
  };

  const restoreHistory = (index: number) => {
      const state = historyRef.current[index];
      if (state) {
          onChange(state.code);
          historyIndexRef.current = index;
          setTimeout(() => {
              if (textareaRef.current) {
                  textareaRef.current.selectionStart = state.cursor;
                  textareaRef.current.selectionEnd = state.cursor;
              }
          }, 0);
      }
  };

  // Sync scroll positions
  const handleScroll = () => {
    if (textareaRef.current && preRef.current) {
        preRef.current.scrollTop = textareaRef.current.scrollTop;
        preRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
    if (textareaRef.current && lineNumbersRef.current) {
        lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  if (!selectedNode) {
    return (
        <div className="w-full h-full flex flex-col items-center justify-center text-textMuted bg-[#0F1117] select-none">
            <div className="w-20 h-20 bg-surfaceHighlight/50 rounded-full flex items-center justify-center mb-6">
                <FileCode size={40} className="text-gray-600" />
            </div>
            <p className="text-lg font-medium text-gray-400">Select a node to edit</p>
            <p className="text-xs text-gray-600 mt-2">Click on any file or function block in the graph</p>
        </div>
    );
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const target = e.target as HTMLTextAreaElement;

    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (historyIndexRef.current > 0) restoreHistory(historyIndexRef.current - 1);
        return;
    }

    if (((e.ctrlKey || e.metaKey) && e.key === 'y') || ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z')) {
        e.preventDefault();
        if (historyIndexRef.current < historyRef.current.length - 1) restoreHistory(historyIndexRef.current + 1);
        return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const value = target.value;
      const newValue = value.substring(0, start) + "    " + value.substring(end);
      
      onChange(newValue);
      lastTypeTime.current = 0;
      recordHistory(newValue, start + 4);

      setTimeout(() => {
          target.selectionStart = target.selectionEnd = start + 4;
      }, 0);
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      const cursor = e.target.selectionStart;
      onChange(val);
      recordHistory(val, cursor);
  };

  const code = selectedNode.code || '';
  const lineCount = code.split('\n').length;
  const highlightedCode = useMemo(() => highlightPython(code), [code]);

  return (
    <div className="w-full h-full flex flex-col bg-[#0F1117]">
       {/* Editor Header */}
       <div className="h-12 border-b border-white/5 flex items-center justify-between px-6 bg-[#0F1117] shrink-0 z-20">
          <div className="flex items-center space-x-3">
             <div className={`w-8 h-8 rounded flex items-center justify-center ${selectedNode.language === 'python' ? 'bg-yellow-500/10 text-yellow-500' : 'bg-blue-500/10 text-blue-500'}`}>
                <FileCode size={18} />
             </div>
             <div>
                <h2 className="text-sm font-semibold text-gray-200 tracking-wide">{selectedNode.label}</h2>
                <div className="flex items-center space-x-2">
                    <span className="text-[10px] text-gray-500 font-mono uppercase">{selectedNode.language || 'TEXT'}</span>
                    <span className="text-[10px] text-gray-600">•</span>
                    <span className="text-[10px] text-gray-500">{lineCount} lines</span>
                </div>
             </div>
          </div>
          
          {selectedNode.language === 'python' && (
              <button 
                onClick={() => onRun(code)}
                className="group flex items-center space-x-2 px-3 py-1.5 bg-green-600/10 hover:bg-green-600/20 text-green-400 rounded-md transition-all text-xs font-medium border border-green-500/20 hover:border-green-500/40"
              >
                <Play size={12} className="fill-current group-hover:scale-110 transition-transform" />
                <span>Run Code</span>
              </button>
          )}
       </div>

       {/* Editor Body */}
       <div className="flex-1 relative flex bg-[#0F1117] overflow-hidden">
            {/* Line Numbers - Fixed alignment */}
            <div 
                ref={lineNumbersRef}
                className="w-14 text-right pr-4 text-gray-600 select-none border-r border-white/5 bg-[#0F1117] overflow-hidden shrink-0" 
                style={{ 
                    fontFamily: FONT_FAMILY,
                    fontSize: FONT_SIZE,
                    lineHeight: LINE_HEIGHT,
                    paddingTop: PADDING, // Match textarea padding EXACTLY
                    paddingBottom: PADDING,
                    boxSizing: 'border-box'
                }}
            >
                {Array.from({ length: Math.max(lineCount, 1) }).map((_, i) => (
                    <div key={i} style={{ height: LINE_HEIGHT, lineHeight: LINE_HEIGHT }}>{i + 1}</div>
                ))}
            </div>

            {/* Code Content Area */}
            <div className="flex-1 relative h-full">
                
                {/* 1. Highlight Layer */}
                <pre 
                    ref={preRef}
                    aria-hidden="true" 
                    className="absolute inset-0 z-0 overflow-hidden text-transparent pointer-events-none"
                    style={{
                        ...sharedEditorStyles,
                        color: 'inherit',
                    }}
                >
                    {highlightedCode}
                    <br />
                </pre>

                {/* 2. Input Layer */}
                <textarea
                    ref={textareaRef}
                    value={code}
                    onChange={handleTextChange}
                    onScroll={handleScroll}
                    onKeyDown={handleKeyDown}
                    spellCheck={false}
                    autoCapitalize="off"
                    autoComplete="off"
                    autoCorrect="off"
                    className="absolute inset-0 z-10 bg-transparent text-transparent caret-white resize-none overflow-auto custom-scrollbar"
                    style={{
                        ...sharedEditorStyles,
                        color: 'transparent',
                    }}
                />
            </div>
       </div>
    </div>
  );
};
