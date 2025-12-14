import React from 'react';
import { NodeData, NodeType } from '../types';
import { FileCode2, FileJson, FileText, Play, X, Braces, Layers, FileType } from 'lucide-react';

interface CodeNodeProps {
  data: NodeData;
  scale: number;
  selected?: boolean;
  onClick: () => void;
  onRun?: (code: string) => void;
}

export const CodeNode: React.FC<CodeNodeProps> = ({ data, scale, selected, onClick, onRun }) => {
  const isDetailed = selected;
  const isPython = data.language === 'python';

  // Dynamic sizing
  const width = isDetailed ? 340 : 60;

  // Icons & Colors based on Type
  let Icon = FileCode2;
  let colorClass = 'text-blue-400';
  let bgClass = 'from-blue-500/10 to-blue-600/5';
  let borderClass = 'border-blue-500/30';

  if (data.type === NodeType.FUNCTION) {
    Icon = Braces;
    if (isPython) {
      // Python Function (Yellowish)
      colorClass = 'text-yellow-400';
      bgClass = selected
        ? 'from-[#1e293b] to-[#0f172a]' // Darker, cleaner blue-grey for selected
        : 'from-yellow-500/10 to-yellow-600/5';

      borderClass = selected
        ? 'border-blue-400 ring-1 ring-blue-500/50'
        : 'border-yellow-500/30';
    } else {
      colorClass = 'text-emerald-400';
    }
  } else if (data.type === NodeType.MODULE || data.type === NodeType.FILE) {
    // Default File Styling (Blue-ish)
    Icon = FileCode2;
    colorClass = 'text-blue-300';
    bgClass = selected ? 'from-[#1e293b] to-[#0f172a]' : 'from-blue-500/20 to-blue-600/10';
    borderClass = selected ? 'border-blue-400 ring-1 ring-blue-400/50' : 'border-blue-500/50';

    // Specific Language Overrides
    switch (data.language) {
      case 'json':
        Icon = FileJson;
        colorClass = 'text-yellow-200';
        // A brownish-yellow theme for JSON
        bgClass = selected ? 'from-[#2e2315] to-[#1a140a]' : 'from-yellow-500/10 to-yellow-600/5';
        borderClass = selected ? 'border-yellow-400 ring-1 ring-yellow-400/50' : 'border-yellow-500/30';
        break;

      case 'markdown':
        Icon = FileText;
        colorClass = 'text-purple-300';
        // A purple theme for Markdown
        bgClass = selected ? 'from-[#1e152e] to-[#110a1a]' : 'from-purple-500/10 to-purple-600/5';
        borderClass = selected ? 'border-purple-400 ring-1 ring-purple-400/50' : 'border-purple-500/30';
        break;

      case 'text':
        Icon = FileType;
        colorClass = 'text-gray-300';
        break;

      case 'python':
        // Python Files keep the standard Code Icon but maybe slightly different shade if needed
        // For now, consistent blue for "File containing code" works well to distinguish from "Function logic"
        Icon = FileCode2;
        break;
    }
  }

  // Handle run click
  const handleRun = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (data.code && onRun) {
      onRun(data.code);
    }
  };

  // --- DETAILED (SELECTED) VIEW ---
  if (isDetailed) {
    return (
      <div
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        className={`
          absolute rounded-lg overflow-hidden transition-all duration-300 backdrop-blur-xl
          border z-50
          group cursor-default
        `}
        style={{
          width,
          // Counter-scale to keep the pop-up readable regardless of zoom level
          transform: `translate(-50%, -50%) scale(${1 / Math.max(scale, 0.5)})`,
          transformOrigin: 'center',
          left: 0,
          top: 0,
          background: 'var(--vscode-editor-background)',
          borderColor: 'var(--vscode-focusBorder)',
          boxShadow: '0 0 40px -10px var(--vscode-focusBorder)'
        }}
      >
        {/* Header - Styled like a VSCode tab or Mac window */}
        <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: '1px solid var(--vscode-panel-border)', background: 'var(--vscode-sideBar-background)' }}>
          <div className="flex items-center space-x-2">
            <div className="p-1 rounded" style={{ background: 'var(--vscode-list-hoverBackground)' }}>
              <Icon size={14} className={colorClass} />
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-xs tracking-wide" style={{ color: 'var(--vscode-editor-foreground)' }}>{data.label}</span>
              <span className="text-[9px] uppercase font-mono tracking-wider" style={{ color: 'var(--vscode-descriptionForeground)' }}>{data.type} {isPython ? 'PY' : ''}</span>
            </div>
          </div>
          <div className="flex items-center space-x-1">
            {isPython && (
              <button
                onClick={handleRun}
                className="flex items-center space-x-1 px-2 py-1 rounded text-[10px] transition-colors"
                style={{ background: 'color-mix(in srgb, var(--vscode-terminal-ansiGreen) 15%, transparent)', color: 'var(--vscode-terminal-ansiGreen)', border: '1px solid color-mix(in srgb, var(--vscode-terminal-ansiGreen) 30%, transparent)' }}
                title="Run Code"
              >
                <Play size={10} fill="currentColor" />
                <span>RUN</span>
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onClick(); }}
              className="p-1 rounded transition-colors"
              style={{ color: 'var(--vscode-descriptionForeground)' }}
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Code Snippet Body */}
        <div className="p-0" style={{ background: 'var(--vscode-editor-background)' }}>
          {data.code && (
            <div className="p-3 font-mono text-[10px] leading-relaxed overflow-x-auto max-h-[200px]" style={{ color: 'var(--vscode-editor-foreground)' }}>
              <pre className="opacity-90">{data.code.split('\n').slice(0, 15).join('\n')}{data.code.split('\n').length > 15 && '\n...'}</pre>
            </div>
          )}

          {/* Metadata / Footer */}
          <div className="px-3 py-2 flex justify-between items-center" style={{ background: 'var(--vscode-sideBar-background)', borderTop: '1px solid var(--vscode-panel-border)' }}>
            <div className="flex items-center space-x-3">
              {data.complexity !== undefined && (
                <div className="flex items-center space-x-1">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: data.complexity > 15 ? 'var(--vscode-terminal-ansiYellow)' : 'var(--vscode-terminal-ansiGreen)' }} />
                  <span className="text-[10px]" style={{ color: 'var(--vscode-descriptionForeground)' }}>Complexity: {data.complexity}</span>
                </div>
              )}
            </div>
            {data.metadata?.why && (
              <span className="text-[10px] max-w-[150px] truncate" style={{ color: 'var(--vscode-descriptionForeground)' }} title={data.metadata.why}>
                {data.metadata.why}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- MINIMIZED (DEFAULT) VIEW ---
  return (
    <div
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="absolute rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer hover:scale-110 hover:brightness-110 z-0 hover:z-10"
      style={{
        width: 60,
        height: 60,
        transform: 'translate(-50%, -50%)',
        left: 0,
        top: 0,
        background: `linear-gradient(145deg, 
          color-mix(in srgb, var(--vscode-sideBar-background) 100%, white 10%), 
          var(--vscode-sideBar-background))`,
        border: `2px solid var(--vscode-panel-border)`,
        boxShadow: `0 4px 16px -4px color-mix(in srgb, black 50%, transparent),
                    inset 0 1px 0 color-mix(in srgb, white 8%, transparent),
                    0 0 0 1px color-mix(in srgb, var(--vscode-panel-border) 30%, transparent)`
      }}
    >
      <Icon size={24} className={colorClass} />
      {/* Label below node for context */}
      <div
        className="absolute top-full mt-2 px-2.5 py-1 rounded-md text-[10px] whitespace-nowrap pointer-events-none font-medium"
        style={{
          background: 'color-mix(in srgb, var(--vscode-sideBar-background) 95%, transparent)',
          color: 'var(--vscode-editor-foreground)',
          border: '1px solid color-mix(in srgb, var(--vscode-panel-border) 50%, transparent)',
          boxShadow: '0 2px 8px -2px color-mix(in srgb, black 30%, transparent)'
        }}
      >
        {data.label}
      </div>
    </div>
  );
};
