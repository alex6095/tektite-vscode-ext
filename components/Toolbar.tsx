import React from 'react';
import { MousePointer2, Network, Layout, Edit3, Loader2, Sparkles, RefreshCw } from 'lucide-react';

export type ViewMode = 'graph' | 'editor';
export type GraphLayout = 'semantic' | 'connection' | 'flow';

export interface EdgeFilters {
    showStructure: boolean;
    showSemantic: boolean;
}

interface ToolbarProps {
  currentLayout: GraphLayout;
  currentView: ViewMode;
  edgeFilters: EdgeFilters;
  onLayoutChange: (layout: GraphLayout) => void;
  onViewChange: (view: ViewMode) => void;
  onToggleFilter: (filter: keyof EdgeFilters) => void;
  onRecalculateSemantics: () => void;
  pendingUpdates: number;
  isLoading?: boolean;
}

export const Toolbar: React.FC<ToolbarProps> = ({ 
    currentLayout, 
    currentView, 
    edgeFilters,
    onLayoutChange, 
    onViewChange, 
    onToggleFilter,
    onRecalculateSemantics,
    pendingUpdates,
    isLoading 
}) => {
  return (
    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 flex flex-col items-center gap-2 z-50">
        {/* Main Mode Switcher */}
        <div className="flex items-center bg-surface/80 backdrop-blur-xl border border-white/10 p-1 rounded-full shadow-2xl transition-all duration-300">
        
            <div className="flex items-center space-x-1 border-r border-white/10 pr-2 mr-2">
                <ToolButton 
                    icon={<Network size={16} />} 
                    label="Semantic" 
                    active={currentView === 'graph' && currentLayout === 'semantic'} 
                    onClick={() => { onViewChange('graph'); onLayoutChange('semantic'); }} 
                />
                <ToolButton 
                    icon={<Layout size={16} />} 
                    label="Connection" 
                    active={currentView === 'graph' && currentLayout === 'connection'} 
                    onClick={() => { onViewChange('graph'); onLayoutChange('connection'); }} 
                />
                <ToolButton 
                    icon={<MousePointer2 size={16} />} 
                    label="Flow" 
                    active={currentView === 'graph' && currentLayout === 'flow'} 
                    onClick={() => { onViewChange('graph'); onLayoutChange('flow'); }} 
                />
            </div>

            <ToolButton 
                icon={<Edit3 size={16} />} 
                label="Editor" 
                active={currentView === 'editor'} 
                onClick={() => onViewChange('editor')} 
            />
        </div>

        {/* Edge Filters & AI Trigger (Visible only in Graph Mode) */}
        {currentView === 'graph' && (
            <div className="flex items-center gap-3">
                <div className="flex items-center space-x-3 bg-black/60 backdrop-blur-md border border-white/5 px-4 py-1.5 rounded-full shadow-lg animate-in fade-in slide-in-from-top-2 duration-300">
                    <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mr-1">Edges</span>
                    
                    <FilterCheckbox 
                        label="Structure" 
                        color="bg-blue-500"
                        checked={edgeFilters.showStructure} 
                        onChange={() => onToggleFilter('showStructure')} 
                    />
                    <FilterCheckbox 
                        label="Semantic" 
                        color="bg-purple-500"
                        checked={edgeFilters.showSemantic} 
                        onChange={() => onToggleFilter('showSemantic')} 
                    />
                </div>

                {/* Manual Recalculate Button - Only shows when needed or loading */}
                {(pendingUpdates > 0 || isLoading) && (
                    <button
                        onClick={onRecalculateSemantics}
                        disabled={isLoading}
                        className={`
                            flex items-center space-x-2 px-3 py-1.5 rounded-full text-xs font-medium border shadow-lg transition-all duration-300
                            ${isLoading 
                                ? 'bg-purple-500/10 border-purple-500/20 text-purple-300 cursor-not-allowed' 
                                : 'bg-gradient-to-r from-purple-600 to-indigo-600 border-transparent text-white hover:shadow-purple-500/20 hover:scale-105'
                            }
                        `}
                    >
                        {isLoading ? (
                            <>
                                <Loader2 size={12} className="animate-spin" />
                                <span>Updating Brain...</span>
                            </>
                        ) : (
                            <>
                                <Sparkles size={12} className="fill-current" />
                                <span>Update Graph ({pendingUpdates})</span>
                            </>
                        )}
                    </button>
                )}
            </div>
        )}
    </div>
  );
};

const ToolButton: React.FC<{ icon: React.ReactNode, label: string, active?: boolean, onClick: () => void }> = ({ icon, label, active, onClick }) => {
    return (
        <button 
            onClick={onClick}
            className={`
            flex items-center space-x-2 px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-200
            ${active ? 'bg-primary/20 text-primary shadow-inner ring-1 ring-primary/50' : 'text-gray-400 hover:text-white hover:bg-white/5'}
            `}
        >
            {icon}
            <span>{label}</span>
        </button>
    )
}

const FilterCheckbox: React.FC<{ label: string, color: string, checked: boolean, onChange: () => void }> = ({ label, color, checked, onChange }) => (
    <label className="flex items-center space-x-2 cursor-pointer group">
        <div className={`w-3 h-3 rounded-[3px] flex items-center justify-center transition-colors border ${checked ? 'border-transparent' : 'border-gray-600 bg-transparent'}`}>
             <div className={`w-full h-full rounded-[2px] ${checked ? color : ''} transition-all duration-200 ${checked ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`} />
        </div>
        <input type="checkbox" checked={checked} onChange={onChange} className="hidden" />
        <span className={`text-[11px] transition-colors ${checked ? 'text-gray-200' : 'text-gray-500 group-hover:text-gray-400'}`}>{label}</span>
    </label>
);