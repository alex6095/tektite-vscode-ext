
export enum NodeType {
  MODULE = 'MODULE',
  FILE = 'FILE',
  FUNCTION = 'FUNCTION',
  NOTE = 'NOTE',
}

export enum EdgeType {
  CALLS = 'CALLS',
  IMPORTS = 'IMPORTS',
  READS_WRITES = 'READS_WRITES',
  TESTED_BY = 'TESTED_BY',
  SEMANTIC = 'SEMANTIC',
}

export interface NodeData {
  id: string;
  type: NodeType;
  label: string;
  language?: 'typescript' | 'python' | 'markdown' | 'text' | 'json'; 
  code?: string;
  metadata?: {
    why?: string;
    tradeOff?: string;
    status?: 'stable' | 'experimental' | 'deprecated';
  };
  complexity?: number; // 0-100
  x?: number;
  y?: number;
  embedding?: number[];
  isStale?: boolean; // Indicates code has changed and embedding needs update
}

export interface LinkData {
  source: string;
  target: string;
  type: EdgeType;
  weight?: number; // Similarity score (0.0 - 1.0)
}

export interface GraphData {
  nodes: NodeData[];
  links: LinkData[];
}

// File System Types for Sidebar
export interface FileSystemItem {
  id: string;
  name: string;
  type: 'file' | 'folder';
  language?: 'python' | 'typescript' | 'json' | 'markdown' | 'text';
  children?: FileSystemItem[];
  isOpen?: boolean; // For initial state
}

export type FileMap = Record<string, string>;
