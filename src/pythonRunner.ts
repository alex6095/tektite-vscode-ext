import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

let pythonTerminal: vscode.Terminal | undefined;

export async function runPythonCode(code: string): Promise<string> {
    // 1. Write code to temp file
    const tempDir = os.tmpdir();
    const tempFile = path.join(tempDir, `tektite_${Date.now()}.py`);

    try {
        fs.writeFileSync(tempFile, code, 'utf8');
    } catch (err: any) {
        return `Error writing temp file: ${err.message}`;
    }

    // 2. Get Python path from settings
    const pythonPath = vscode.workspace
        .getConfiguration('tektite')
        .get<string>('pythonPath', 'python3');

    // 3. Create or reuse terminal
    if (!pythonTerminal || pythonTerminal.exitStatus !== undefined) {
        pythonTerminal = vscode.window.createTerminal({
            name: 'Tektite Python',
            hideFromUser: false
        });
    }

    // 4. Show terminal and execute
    pythonTerminal.show(true);
    pythonTerminal.sendText(`${pythonPath} "${tempFile}"`);

    // 5. Schedule cleanup after delay
    setTimeout(() => {
        try {
            if (fs.existsSync(tempFile)) {
                fs.unlinkSync(tempFile);
            }
        } catch (e) {
            // Ignore cleanup errors
        }
    }, 10000);

    return `>>> Running code in terminal...\n>>> File: ${tempFile}`;
}

export function disposeTerminal() {
    if (pythonTerminal) {
        pythonTerminal.dispose();
        pythonTerminal = undefined;
    }
}
