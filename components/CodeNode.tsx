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
          border ${borderClass}
          bg-[#0F1117] z-50
          group cursor-default
          shadow-[0_0_40px_-10px_rgba(59,130,246,0.5)] 
        `}
        style={{
          width,
          // Counter-scale to keep the pop-up readable regardless of zoom level
          transform: `translate(-50%, -50%) scale(${1/Math.max(scale, 0.5)})`, 
          transformOrigin: 'center',
          left: 0,
          top: 0
        }}
      >
        {/* Header - Styled like a VSCode tab or Mac window */}
        <div className={`flex items-center justify-between px-3 py-2 border-b border-white/10 bg-gradient-to-r ${data.type === NodeType.FUNCTION ? 'from-blue-900/20 to-transparent' : 'from-slate-800/50 to-transparent'}`}>
          <div className="flex items-center space-x-2">
            <div className={`p-1 rounded ${data.type === NodeType.FUNCTION ? 'bg-yellow-500/10' : 'bg-white/5'}`}>
                <Icon size={14} className={colorClass} />
            </div>
            <div className="flex flex-col">
                <span className="font-semibold text-xs text-gray-100 tracking-wide">{data.label}</span>
                <span className="text-[9px] text-gray-500 uppercase font-mono tracking-wider">{data.type} {isPython ? 'PY' : ''}</span>
            </div>
          </div>
          <div className="flex items-center space-x-1">
             {isPython && (
                 <button 
                    onClick={handleRun}
                    className="flex items-center space-x-1 px-2 py-1 bg-green-500/10 hover:bg-green-500/20 text-green-400 rounded text-[10px] transition-colors border border-green-500/20"
                    title="Run Code"
                 >
                     <Play size={10} fill="currentColor" />
                     <span>RUN</span>
                 </button>
             )}
             <button 
                onClick={(e) => { e.stopPropagation(); onClick(); }}
                className="text-gray-500 hover:text-white p-1 hover:bg-white/10 rounded"
             >
                <X size={14} />
             </button>
          </div>
        </div>

        {/* Code Snippet Body */}
        <div className="p-0 bg-[#0d1117]">
          {data.code && (
            <div className="p-3 font-mono text-gray-300 text-[10px] leading-relaxed overflow-x-auto max-h-[200px] scrollbar-thin scrollbar-thumb-gray-700">
              <pre className="opacity-90">{data.code.split('\n').slice(0, 15).join('\n')}{data.code.split('\n').length > 15 && '\n...'}</pre>
            </div>
          )}
          
          {/* Metadata / Footer */}
          <div className="px-3 py-2 bg-[#161b22] border-t border-white/5 flex justify-between items-center">
             <div className="flex items-center space-x-3">
                 {data.complexity !== undefined && (
                     <div className="flex items-center space-x-1">
                         <div className={`w-1.5 h-1.5 rounded-full ${data.complexity > 15 ? 'bg-orange-500' : 'bg-green-500'}`} />
                         <span className="text-[10px] text-gray-500">Complexity: {data.complexity}</span>
                     </div>
                 )}
             </div>
             {data.metadata?.why && (
                 <span className="text-[10px] text-gray-500 max-w-[150px] truncate" title={data.metadata.why}>
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
       className={`
        absolute rounded-full flex items-center justify-center transition-all duration-300 shadow-lg
        border-2 ${borderClass}
        bg-surfaceHighlight cursor-pointer hover:scale-110 hover:brightness-125
        z-0 hover:z-10
      `}
      style={{
        width: 60,
        height: 60,
        transform: 'translate(-50%, -50%)',
        left: 0,
        top: 0
      }}
    >
      <Icon size={24} className={colorClass} />
      {/* Label below node for context */}
      <div className="absolute top-full mt-2 bg-black/50 px-2 py-0.5 rounded text-[10px] text-gray-300 whitespace-nowrap pointer-events-none">
          {data.label}
      </div>
    </div>
  );
};
