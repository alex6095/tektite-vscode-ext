
import { EdgeType, GraphData, NodeType, NodeData, LinkData, FileSystemItem, FileMap } from './types';

// --- Initial Content ---

const FIBONACCI_SOURCE = `def fib_iterative(n):
    """
    Calculates Fibonacci number iteratively.
    """
    if n <= 1:
        return n
    a, b = 0, 1
    for _ in range(2, n + 1):
        a, b = b, a + b
    return b

def fib_recursive(n):
    """
    Calculates Fibonacci number recursively.
    """
    if n <= 1:
        return n
    # Recursive calls create self-loops/edges
    return fib_recursive(n-1) + fib_recursive(n-2)

def run_fib_analysis():
    print("--- Running Analysis ---")
    val_iter = fib_iterative(10)
    val_rec = fib_recursive(10)
    print(f"Results: {val_iter}, {val_rec}")
`;

const FACTORIAL_SOURCE = `def factorial_recursive(n):
    """
    Calculates factorial recursively.
    Shares 'recursive' mathematical concepts with Fibonacci.
    """
    if n == 0:
        return 1
    return n * factorial_recursive(n - 1)

def run_factorial_demo():
    print(f"Calculating 5!...")
    result = factorial_recursive(5)
    print(f"Result: {result}")
`;

const STAR_TREE_SOURCE = `def print_star_tree(height):
    """
    Visual art generator.
    Prints a tree pattern to stdout.
    Completely unrelated to math algorithms.
    """
    print("\\n--- Tree ---")
    for i in range(height):
        spaces = ' ' * (height - i - 1)
        stars = '*' * (2 * i + 1)
        print(spaces + stars)
    print(' ' * (height - 1) + '|')

def draw_forest():
    print("Drawing a small forest...")
    print_star_tree(3)
    print_star_tree(5)
`;

const UTILS_SOURCE = `def logger(msg):
    print(f"[LOG]: {msg}")

def validate_input(n):
    if n < 0:
        logger("Error: Negative input")
        return False
    return True
`;

const MAIN_SOURCE = `import fibonacci
import utils
import factorial
import visuals

def main_app():
    """
    Main entry point for the application.
    """
    utils.logger("Starting App...")
    
    input_val = 10
    
    if utils.validate_input(input_val):
        # Math Stuff
        fibonacci.fib_iterative(input_val)
        factorial.run_factorial_demo()
        
        # Visual Stuff
        visuals.draw_forest()
        
    utils.logger("Finished.")

# Run main
main_app()
`;

const README_SOURCE = `# MindGraph Code

**Think in Graphs, Write in Blocks.**

This project demonstrates a Code Knowledge Graph.

## Modules
1. **fibonacci.py**: Core logic (Math)
2. **factorial.py**: Recursive logic (Math, semantically similar to fibonacci)
3. **visuals.py**: ASCII Art (Semantically distant)
4. **utils.py**: Helper functions
5. **main.py**: Entry point

## Concept
Toggle the "Semantic" view in the toolbar. 
You should see connections between **fib_recursive** and **factorial_recursive** because the AI understands they are both recursive mathematical functions, even if they don't call each other.
`;

const CONFIG_SOURCE = `{
  "layout": "semantic",
  "theme": "dark",
  "analysis": {
    "depth": 3,
    "includeStdLib": false
  }
}
`;

// --- Initial State Exports ---

export const INITIAL_FILES: FileMap = {
    'fibonacci.py': FIBONACCI_SOURCE,
    'factorial.py': FACTORIAL_SOURCE,
    'visuals.py': STAR_TREE_SOURCE,
    'utils.py': UTILS_SOURCE,
    'main.py': MAIN_SOURCE,
    'README.md': README_SOURCE,
    'graph_config.json': CONFIG_SOURCE
};

export const INITIAL_FILE_TREE: FileSystemItem[] = [
    {
        id: 'root',
        name: 'PyAlgorithms',
        type: 'folder',
        isOpen: true,
        children: [
            {
                id: 'src',
                name: 'src',
                type: 'folder',
                isOpen: true,
                children: [
                    { id: 'file-fibonacci.py', name: 'fibonacci.py', type: 'file', language: 'python' },
                    { id: 'file-factorial.py', name: 'factorial.py', type: 'file', language: 'python' },
                    { id: 'file-visuals.py', name: 'visuals.py', type: 'file', language: 'python' },
                    { id: 'file-utils.py', name: 'utils.py', type: 'file', language: 'python' },
                    { id: 'file-main.py', name: 'main.py', type: 'file', language: 'python' },
                ]
            },
            {
                id: 'docs',
                name: 'docs',
                type: 'folder',
                isOpen: true,
                children: [
                    { id: 'file-README.md', name: 'README.md', type: 'file', language: 'markdown' }
                ]
            },
            { id: 'file-graph_config.json', name: 'graph_config.json', type: 'file', language: 'json' }
        ]
    }
];

// --- Dynamic Graph Generation Logic ---

/**
 * Parses code strings to build the Knowledge Graph (Nodes & Edges).
 * Supports Python function extraction. Fallbacks to simple file nodes for others.
 */
export function generateGraphFromFiles(files: FileMap): GraphData {
    const nodes: NodeData[] = [];
    const links: LinkData[] = [];
    
    const definedFunctions = new Map<string, string>(); // funcName -> nodeId

    const fileEntries = Object.entries(files);
    const totalFiles = fileEntries.length;
    
    // Radial Layout Config
    const ORBIT_RADIUS = 350;

    // 1. Pass: Create Nodes (Modules and Functions)
    fileEntries.forEach(([filename, code], fileIndex) => {
        const fileId = `file-${filename}`;
        const isPython = filename.endsWith('.py');
        
        // --- Calculate Initial Position (Radial/Polar) ---
        // 'main.py' or 'index' usually sits in the center (0,0)
        // Others sit on an orbit
        let initialX = 0;
        let initialY = 0;

        if (filename.includes('main') || filename.includes('index')) {
            initialX = 0;
            initialY = 0;
        } else {
            // Distribute others in a circle
            const angle = (fileIndex / totalFiles) * 2 * Math.PI;
            initialX = Math.cos(angle) * ORBIT_RADIUS;
            initialY = Math.sin(angle) * ORBIT_RADIUS;
        }

        // Module/File Node
        nodes.push({
            id: fileId,
            type: isPython ? NodeType.MODULE : NodeType.FILE,
            label: filename,
            language: filename.endsWith('.py') ? 'python' : filename.endsWith('.md') ? 'markdown' : filename.endsWith('.json') ? 'json' : 'text',
            x: initialX, 
            y: initialY,
            code: code,
            complexity: isPython ? 10 : 0
        });

        if (isPython) {
            const lines = code.split('\n');
            const functionRegex = /^def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\):/;

            for (let i = 0; i < lines.length; i++) {
                const match = lines[i].match(functionRegex);
                if (match) {
                    const funcName = match[1];
                    const funcId = `fn-${funcName}`;
                    definedFunctions.set(funcName, funcId);

                    // Extract body
                    let body = [];
                    body.push(lines[i]);
                    let j = i + 1;
                    while (j < lines.length) {
                        const line = lines[j];
                        if (line.trim() === '') {
                            body.push(line);
                            j++;
                            continue;
                        }
                        if (!line.startsWith(' ') && !line.startsWith('\t') && !line.startsWith('#') && !line.startsWith('@')) {
                            break;
                        }
                        body.push(line);
                        j++;
                    }

                    let fullCode = body.join('\n');
                    
                    // Note: Removed automatic test code appending to ensure clean 2-way sync with files.

                    // Place function nodes randomly NEAR their parent file node to start
                    // The physics engine will sort them out, but this prevents a big explosion from 0,0
                    const jitter = 80;
                    nodes.push({
                        id: funcId,
                        type: NodeType.FUNCTION,
                        label: funcName,
                        language: 'python',
                        code: fullCode,
                        complexity: Math.floor(Math.random() * 20) + 1,
                        metadata: {
                            status: 'stable',
                            why: funcName.includes('recursive') ? 'Recursive Implementation' : 'Logic Block'
                        },
                        x: initialX + (Math.random() * jitter - jitter/2),
                        y: initialY + (Math.random() * jitter - jitter/2)
                    });

                    links.push({
                        source: funcId,
                        target: fileId,
                        type: EdgeType.IMPORTS
                    });
                }
            }
        }
    });

    // 2. Pass: Create Edges (Call Graph) for Python
    nodes.filter(n => n.type === NodeType.FUNCTION).forEach(sourceNode => {
        if (!sourceNode.code) return;
        
        definedFunctions.forEach((targetId, targetName) => {
            const callRegex = new RegExp(`\\b${targetName}\\(`, 'g');
            
            if (sourceNode.label === targetName) {
                 // Recursive check
                 const bodyOnly = sourceNode.code!.split('\n').slice(1).join('\n');
                 if (callRegex.test(bodyOnly)) {
                     links.push({ source: sourceNode.id, target: targetId, type: EdgeType.CALLS });
                 }
            } else {
                 if (callRegex.test(sourceNode.code!)) {
                    links.push({ source: sourceNode.id, target: targetId, type: EdgeType.CALLS });
                 }
            }
        });
    });

    return { nodes, links };
}

export const REFACTOR_DIFF_OLD = `def fib_recursive(n):
    if n <= 1:
        return n
    return fib_recursive(n-1) + fib_recursive(n-2)`;

export const REFACTOR_DIFF_NEW = `from functools import lru_cache

@lru_cache(maxsize=None)
def fib_recursive(n):
    if n <= 1:
        return n
    return fib_recursive(n-1) + fib_recursive(n-2)`;
