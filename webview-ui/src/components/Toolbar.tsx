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
            <div className="flex items-center backdrop-blur-xl p-1 rounded-full shadow-2xl transition-all duration-300" style={{ background: 'color-mix(in srgb, var(--vscode-sideBar-background) 90%, transparent)', border: '1px solid var(--vscode-panel-border)' }}>

                <div className="flex items-center space-x-1 pr-2 mr-2" style={{ borderRight: '1px solid var(--vscode-panel-border)' }}>
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
                    <div className="flex items-center space-x-3 backdrop-blur-md px-4 py-1.5 rounded-full shadow-lg animate-in fade-in slide-in-from-top-2 duration-300" style={{ background: 'color-mix(in srgb, var(--vscode-editor-background) 80%, transparent)', border: '1px solid var(--vscode-panel-border)' }}>
                        <span className="text-[10px] uppercase font-bold tracking-wider mr-1" style={{ color: 'var(--vscode-descriptionForeground)' }}>Edges</span>

                        <FilterCheckbox
                            label="Structure"
                            color="var(--vscode-focusBorder)"
                            checked={edgeFilters.showStructure}
                            onChange={() => onToggleFilter('showStructure')}
                        />
                        <FilterCheckbox
                            label="Semantic"
                            color="var(--vscode-textLink-foreground)"
                            checked={edgeFilters.showSemantic}
                            onChange={() => onToggleFilter('showSemantic')}
                        />
                    </div>

                    {/* Manual Recalculate Button - Only shows when needed or loading */}
                    {(pendingUpdates > 0 || isLoading) && (
                        <button
                            onClick={onRecalculateSemantics}
                            disabled={isLoading}
                            className="flex items-center space-x-2 px-3 py-1.5 rounded-full text-xs font-medium border shadow-lg transition-all duration-300"
                            style={{
                                background: isLoading
                                    ? 'color-mix(in srgb, var(--vscode-textLink-foreground) 15%, transparent)'
                                    : 'var(--vscode-button-background)',
                                borderColor: isLoading
                                    ? 'color-mix(in srgb, var(--vscode-textLink-foreground) 30%, transparent)'
                                    : 'transparent',
                                color: isLoading
                                    ? 'var(--vscode-textLink-foreground)'
                                    : 'var(--vscode-button-foreground)',
                                cursor: isLoading ? 'not-allowed' : 'pointer'
                            }}
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
            className="flex items-center space-x-2 px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-200"
            style={{
                background: active ? 'color-mix(in srgb, var(--vscode-focusBorder) 20%, transparent)' : 'transparent',
                color: active ? 'var(--vscode-focusBorder)' : 'var(--vscode-descriptionForeground)',
                boxShadow: active ? 'inset 0 1px 2px rgba(0,0,0,0.2)' : 'none'
            }}
        >
            {icon}
            <span>{label}</span>
        </button>
    )
}

const FilterCheckbox: React.FC<{ label: string, color: string, checked: boolean, onChange: () => void }> = ({ label, color, checked, onChange }) => (
    <label className="flex items-center space-x-2 cursor-pointer group">
        <div className="w-3 h-3 rounded-[3px] flex items-center justify-center transition-colors" style={{ border: checked ? 'none' : '1px solid var(--vscode-panel-border)' }}>
            <div className="w-full h-full rounded-[2px] transition-all duration-200" style={{ background: checked ? color : 'transparent', opacity: checked ? 1 : 0, transform: checked ? 'scale(1)' : 'scale(0.5)' }} />
        </div>
        <input type="checkbox" checked={checked} onChange={onChange} className="hidden" />
        <span className="text-[11px] transition-colors" style={{ color: checked ? 'var(--vscode-editor-foreground)' : 'var(--vscode-descriptionForeground)' }}>{label}</span>
    </label>
);