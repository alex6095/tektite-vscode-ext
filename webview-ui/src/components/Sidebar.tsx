import React, { useState, useRef, useEffect } from 'react';
import { 
  Files, Search, Settings,
  ChevronRight, ChevronDown, Folder, FileCode, FileJson, MoreHorizontal, FileText, Upload, Plus,
  Box, PanelLeftClose
} from 'lucide-react';
import { FileSystemItem } from '../types';

interface SidebarProps {
  fileTree: FileSystemItem[];
  onFileSelect: (fileId: string) => void;
  onFilesUploaded: (files: FileList) => void;
  selectedId: string | null;
  onToggle: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ fileTree, onFileSelect, onFilesUploaded, selectedId, onToggle }) => {
  const [activeActivity, setActiveActivity] = useState('explorer');
  const [sidebarSearchQuery, setSidebarSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFilesUploaded(e.dataTransfer.files);
    }
  };

  const handleTriggerUpload = () => {
    fileInputRef.current?.click();
  };

  // Flatten the tree for search
  const filterItems = (items: FileSystemItem[], query: string): FileSystemItem[] => {
    let results: FileSystemItem[] = [];
    for (const item of items) {
        if (item.type === 'file' && item.name.toLowerCase().includes(query.toLowerCase())) {
            results.push(item);
        }
        if (item.children) {
            results = [...results, ...filterItems(item.children, query)];
        }
    }
    return results;
  };
  
  const searchResults = activeActivity === 'search' && sidebarSearchQuery 
    ? filterItems(fileTree, sidebarSearchQuery) 
    : [];

  return (
    <div className="flex h-screen select-none">
      {/* Activity Bar */}
      <div className="w-12 bg-surfaceHighlight border-r border-border flex flex-col items-center py-3 z-20 h-full">
        {/* Top Icons */}
        <div className="space-y-6">
          <ActivityItem icon={<Files size={22} />} active={activeActivity === 'explorer'} onClick={() => setActiveActivity('explorer')} />
          <ActivityItem icon={<Search size={22} />} active={activeActivity === 'search'} onClick={() => setActiveActivity('search')} />
        </div>
        
        {/* Bottom Actions: Pushed to bottom using mt-auto */}
        <div className="mt-auto flex flex-col gap-4 items-center pb-2">
           <ActivityItem icon={<Settings size={22} />} onClick={() => {}} />
           
           <div 
             onClick={onToggle}
             className="cursor-pointer text-textMuted hover:text-text transition-colors p-2 hover:bg-white/5 rounded-md mb-1"
             title="Toggle Sidebar (Cmd+B)"
           >
             <PanelLeftClose size={22} />
           </div>
        </div>
      </div>

      {/* Side Panel Content */}
      <div 
        className="w-60 bg-vscodeSidebar border-r border-border flex flex-col text-sm text-textMuted relative"
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Hidden File Input */}
        <input 
            type="file" 
            ref={fileInputRef} 
            onChange={(e) => e.target.files && onFilesUploaded(e.target.files)} 
            multiple 
            className="hidden" 
        />

        {activeActivity === 'explorer' && (
          <>
            {/* Explorer Header */}
            <div className="h-10 px-4 flex items-center justify-between text-xs font-medium uppercase tracking-wide text-text/60 shrink-0">
               <span>Explorer</span>
               <div className="flex items-center space-x-2">
                  <button onClick={handleTriggerUpload} className="hover:text-text cursor-pointer transition-colors" title="Import Files">
                    <Plus size={16} />
                  </button>
                  <MoreHorizontal size={14} className="hover:text-text cursor-pointer transition-colors"/>
               </div>
            </div>

            {/* Drop Zone Overlay */}
            {isDragging && (
               <div className="absolute inset-0 z-50 bg-vscodeSidebar/90 flex flex-col items-center justify-center border-2 border-dashed border-primary m-2 rounded-xl text-primary animate-pulse pointer-events-none">
                   <Upload size={32} className="mb-2" />
                   <span className="font-semibold">Drop to Add Files</span>
               </div>
            )}

            {/* File Tree */}
            <div className="flex-1 overflow-y-auto pt-2">
               {fileTree.map(item => (
                 <FileTreeItem key={item.id} item={item} level={0} onSelect={onFileSelect} selectedId={selectedId} />
               ))}
            </div>
          </>
        )}

        {activeActivity === 'search' && (
          <div className="flex flex-col h-full">
              <div className="h-10 px-4 flex items-center justify-between text-xs font-medium uppercase tracking-wide text-text/60 shrink-0">
                  <span>Search</span>
              </div>
              <div className="px-4 pb-2">
                  <input 
                      type="text" 
                      value={sidebarSearchQuery}
                      onChange={(e) => setSidebarSearchQuery(e.target.value)}
                      placeholder="Search files..."
                      className="w-full bg-surfaceHighlight/50 border border-white/10 rounded py-1 px-2 text-xs text-text focus:outline-none focus:border-primary/50 placeholder-gray-600"
                      autoFocus
                  />
              </div>
              <div className="flex-1 overflow-y-auto pt-2">
                  {searchResults.map(item => (
                       <div 
                          key={item.id} 
                          onClick={() => onFileSelect(item.id)} 
                          className={`px-4 py-1.5 cursor-pointer flex items-center hover:bg-surfaceHighlight/30 group ${selectedId === item.id ? 'bg-primary/20 text-white' : ''}`}
                       >
                           <FileIcon language={item.language} selected={selectedId === item.id} />
                           <span className={`text-xs ml-2 ${selectedId === item.id ? 'text-gray-100' : 'text-gray-400 group-hover:text-gray-200'}`}>{item.name}</span>
                       </div>
                  ))}
                  {sidebarSearchQuery && searchResults.length === 0 && (
                      <div className="px-4 text-xs text-gray-500 mt-4 text-center">No results found</div>
                  )}
                  {!sidebarSearchQuery && (
                      <div className="px-4 text-xs text-gray-600 mt-4 text-center">Type to search...</div>
                  )}
              </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Recursive Tree Component
const FileTreeItem: React.FC<{ item: FileSystemItem, level: number, onSelect: (id: string) => void, selectedId: string | null }> = ({ item, level, onSelect, selectedId }) => {
  const [isOpen, setIsOpen] = useState(item.isOpen || false);
  const hasChildren = item.children && item.children.length > 0;
  
  useEffect(() => {
     if (item.isOpen !== undefined) setIsOpen(item.isOpen);
  }, [item.isOpen]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.type === 'folder' || hasChildren) {
      setIsOpen(!isOpen);
    } 
    onSelect(item.id);
  };

  const paddingLeft = level * 12 + 12;
  const isSelected = item.id === selectedId;

  return (
    <div>
      <div 
        onClick={handleClick}
        style={{ paddingLeft: `${paddingLeft}px` }}
        className={`
            flex items-center py-1 cursor-pointer transition-all duration-200 group relative
            ${isSelected 
                ? 'bg-primary/20 text-white shadow-[inset_2px_0_0_0_#6E8FEE]' 
                : 'text-textMuted hover:bg-surfaceHighlight/30 hover:text-text'
            }
        `}
      >
         {isSelected && (
             <div className="absolute inset-0 bg-primary/5 blur-[2px] pointer-events-none" />
         )}

         <span className={`mr-1 transition-opacity ${hasChildren ? 'opacity-100' : 'opacity-0'} z-10`}>
             {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
         </span>

         <div className="z-10 flex items-center">
            {item.type === 'folder' ? (
                <Folder size={14} className={`mr-2 ${isSelected ? 'text-blue-300' : 'text-blue-400'}`} />
            ) : item.type === 'file' ? (
                <FileIcon language={item.language} selected={isSelected} />
            ) : (
                <Box size={12} className={`mr-2 ${isSelected ? 'text-yellow-300' : 'text-yellow-500'}`} />
            )}
         </div>
         
         <span className={`text-[13px] truncate z-10 ${item.type === 'folder' ? (isSelected ? 'font-semibold text-white' : 'font-medium text-gray-300') : ''}`}>
            {item.name}
         </span>
         
         {item.type !== 'folder' && item.type !== 'file' && (
             <span className={`ml-auto mr-2 text-[10px] opacity-0 group-hover:opacity-100 font-mono z-10 ${isSelected ? 'text-blue-200 opacity-100' : 'text-gray-600'}`}>fn</span>
         )}
      </div>
      
      {hasChildren && isOpen && (
        <div>
          {item.children!.map(child => (
            <FileTreeItem key={child.id} item={child} level={level + 1} onSelect={onSelect} selectedId={selectedId} />
          ))}
        </div>
      )}
    </div>
  );
};

const FileIcon: React.FC<{ language?: string, selected?: boolean }> = ({ language, selected }) => {
  let Icon = FileCode;
  let color = selected ? "text-gray-200" : "text-gray-400";

  switch(language) {
    case 'python': color = selected ? "text-yellow-300" : "text-yellow-400"; break;
    case 'typescript': color = selected ? "text-blue-300" : "text-blue-400"; break;
    case 'react': color = selected ? "text-cyan-300" : "text-cyan-400"; break;
    case 'json': Icon = FileJson; color = selected ? "text-yellow-100" : "text-yellow-200"; break;
    case 'markdown': Icon = FileText; color = selected ? "text-purple-300" : "text-purple-400"; break;
    case 'text': Icon = FileText; color = selected ? "text-gray-400" : "text-gray-500"; break;
  }
  return <div className="w-4 mr-2 flex justify-center"><Icon size={14} className={color} /></div>;
};

const ActivityItem: React.FC<{ icon: React.ReactNode, active?: boolean, onClick: () => void }> = ({ icon, active, onClick }) => (
  <div 
    onClick={onClick}
    className={`cursor-pointer p-2 relative group transition-colors ${active ? 'text-primary' : 'text-textMuted hover:text-text'}`}
  >
    {active && <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-primary" />}
    {icon}
  </div>
);