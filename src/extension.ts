import * as vscode from 'vscode';
import { TektitePanel } from './TektitePanel';

export function activate(context: vscode.ExtensionContext) {
    console.log('Tektite extension is now active!');

    // Register command to open the graph panel
    const openGraphCommand = vscode.commands.registerCommand(
        'tektite.openGraph',
        () => {
            TektitePanel.createOrShow(context.extensionUri, context);
        }
    );

    // Register command to set API key
    const setApiKeyCommand = vscode.commands.registerCommand(
        'tektite.setApiKey',
        async () => {
            const apiKey = await vscode.window.showInputBox({
                prompt: 'Enter your Gemini API Key',
                password: true,
                placeHolder: 'API Key will be stored securely'
            });

            if (apiKey) {
                await context.secrets.store('tektite.geminiApiKey', apiKey);
                vscode.window.showInformationMessage('Tektite: API Key saved successfully!');
            }
        }
    );

    context.subscriptions.push(openGraphCommand, setApiKeyCommand);

    // Auto-open on activation if workspace is open
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
        TektitePanel.createOrShow(context.extensionUri, context);
    }
}

export function deactivate() {
    // Cleanup if needed
}
