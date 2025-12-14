import * as vscode from 'vscode';
import * as path from 'path';
import { handleMessage } from './messageHandler';

export class TektitePanel {
    public static currentPanel: TektitePanel | undefined;
    public static readonly viewType = 'tektite.graphPanel';

    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private readonly _context: vscode.ExtensionContext;
    private _disposables: vscode.Disposable[] = [];

    public static createOrShow(extensionUri: vscode.Uri, context: vscode.ExtensionContext) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // If we already have a panel, show it
        if (TektitePanel.currentPanel) {
            TektitePanel.currentPanel._panel.reveal(column);
            return;
        }

        // Create a new panel in the main editor area
        const panel = vscode.window.createWebviewPanel(
            TektitePanel.viewType,
            'Tektite - Code Graph',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(extensionUri, 'webview-ui', 'dist'),
                    vscode.Uri.joinPath(extensionUri, 'webview-ui')
                ]
            }
        );

        TektitePanel.currentPanel = new TektitePanel(panel, extensionUri, context);
    }

    private constructor(
        panel: vscode.WebviewPanel,
        extensionUri: vscode.Uri,
        context: vscode.ExtensionContext
    ) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._context = context;

        // Set the webview's initial html content
        this._update();

        // Listen for when the panel is disposed
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            async (message) => {
                const response = await handleMessage(message, this._context);
                if (response) {
                    this._panel.webview.postMessage(response);
                }
            },
            null,
            this._disposables
        );

        // Listen for file changes in workspace
        const fileWatcher = vscode.workspace.onDidChangeTextDocument((e) => {
            if (e.document.uri.scheme === 'file') {
                this._panel.webview.postMessage({
                    type: 'fileChanged',
                    payload: {
                        path: e.document.uri.fsPath,
                        content: e.document.getText()
                    }
                });
            }
        });
        this._disposables.push(fileWatcher);
    }

    public dispose() {
        TektitePanel.currentPanel = undefined;

        this._panel.dispose();

        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }

    private _update() {
        const webview = this._panel.webview;
        this._panel.title = 'Tektite - Code Graph';
        this._panel.webview.html = this._getHtmlForWebview(webview);
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        // Get paths to built webview assets
        const distPath = vscode.Uri.joinPath(this._extensionUri, 'webview-ui', 'dist');

        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(distPath, 'assets', 'index.js')
        );
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(distPath, 'assets', 'index.css')
        );

        // Use a nonce to only allow specific scripts to run
        const nonce = getNonce();

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource} https://fonts.gstatic.com; connect-src https://generativelanguage.googleapis.com;">
    <link href="${styleUri}" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Fira+Code:wght@400;500&display=swap" rel="stylesheet">
    <title>Tektite</title>
    <style>
        :root {
            --vscode-font-family: var(--vscode-editor-font-family, 'Fira Code', monospace);
        }
        body {
            margin: 0;
            padding: 0;
            overflow: hidden;
            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            font-family: 'Inter', var(--vscode-font-family), sans-serif;
        }
        #root {
            width: 100vw;
            height: 100vh;
        }
    </style>
</head>
<body>
    <div id="root"></div>
    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
    }
}

function getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
