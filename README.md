# Tektite - Code from the Stars ✨

**Think in Graphs, Write in Blocks.**

A VSCode extension that visualizes your codebase as a knowledge graph, helping you understand code relationships and navigate complex projects intuitively.

## Features

- 🔗 **Code Knowledge Graph**: Visualize files, modules, and functions as interconnected nodes
- 🎨 **Multiple Layouts**: Connection-based, semantic, and flow views
- 🔍 **Smart Search**: Find nodes quickly with fuzzy search
- 🤖 **AI-Powered Analysis**: Semantic similarity detection and refactoring suggestions (requires Gemini API key)
- 🐍 **Python Execution**: Run Python code directly in the integrated terminal
- 🎭 **Theme Sync**: Automatically matches your VSCode theme

## Installation

### From VSIX (Local Install)

1. Build the extension:
   ```bash
   npm install
   cd webview-ui && npm install && npm run build && cd ..
   npm run compile
   npm run package
   ```

2. Install in VSCode:
   - Open Extensions panel (`Cmd+Shift+X` / `Ctrl+Shift+X`)
   - Click `...` → `Install from VSIX...`
   - Select the generated `.vsix` file

### From Marketplace (Coming Soon)

Search for "Tektite" in the VSCode Extensions marketplace.

## Usage

1. Open a workspace containing Python files
2. Open Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
3. Run **"Tektite: Open Code Graph"**

### Commands

| Command | Description |
|---------|-------------|
| `Tektite: Open Code Graph` | Opens the graph visualization panel |
| `Tektite: Set Gemini API Key` | Configure your API key for AI features |

### Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `tektite.pythonPath` | `python3` | Path to Python interpreter |

## Development

### Prerequisites

- Node.js 18+
- npm 9+

### Setup

```bash
# Install extension dependencies
npm install

# Install webview dependencies
cd webview-ui
npm install
cd ..
```

### Debugging

1. Open this project in VSCode
2. Press `F5` to launch the Extension Development Host
3. A new VSCode window will open with the extension loaded

### Building

```bash
# Build webview
cd webview-ui && npm run build && cd ..

# Compile extension
npm run compile

# Package as VSIX
npm run package
```

## Architecture

```
tektite-vscode-ext/
├── src/                 # Extension host (TypeScript)
│   ├── extension.ts     # Entry point
│   ├── TektitePanel.ts  # Webview provider
│   ├── messageHandler.ts # Message protocol
│   ├── pythonRunner.ts  # Terminal execution
│   └── aiService.ts     # Gemini AI integration
├── webview-ui/          # React frontend
│   └── src/
│       ├── App.tsx      # Main component
│       ├── vscodeApi.ts # Message utilities
│       └── components/  # UI components
└── out/                 # Compiled extension
```

## License

MIT

## Credits

Built with ❤️ using React, D3.js, and the VSCode Extension API.
