import * as vscode from 'vscode';

const API_KEY_SECRET = 'tektite.geminiApiKey';

export async function getEmbedding(
    secrets: vscode.SecretStorage,
    content: string
): Promise<number[] | null> {
    const apiKey = await secrets.get(API_KEY_SECRET);

    if (!apiKey) {
        vscode.window.showWarningMessage(
            'Tektite: Gemini API key not set. Use "Tektite: Set Gemini API Key" command.'
        );
        return null;
    }

    try {
        // Dynamic import to avoid bundling issues
        const { GoogleGenAI } = await import('@google/genai');
        const ai = new GoogleGenAI({ apiKey });

        const result = await ai.models.embedContent({
            model: 'text-embedding-004',
            contents: content
        });

        return result.embeddings?.[0]?.values ?? null;
    } catch (error: any) {
        console.error('Embedding error:', error);
        vscode.window.showErrorMessage(`Tektite: Embedding failed - ${error.message}`);
        return null;
    }
}

export async function callAI(
    secrets: vscode.SecretStorage,
    prompt: string,
    schema?: any
): Promise<any | null> {
    const apiKey = await secrets.get(API_KEY_SECRET);

    if (!apiKey) {
        vscode.window.showWarningMessage(
            'Tektite: Gemini API key not set. Use "Tektite: Set Gemini API Key" command.'
        );
        return null;
    }

    try {
        const { GoogleGenAI, Type } = await import('@google/genai');
        const ai = new GoogleGenAI({ apiKey });

        const config: any = {};
        if (schema) {
            config.responseMimeType = 'application/json';
            config.responseSchema = schema;
        }

        const result = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: prompt,
            config
        });

        const text = result.text;

        if (schema && text) {
            try {
                return JSON.parse(text);
            } catch {
                return text;
            }
        }

        return text;
    } catch (error: any) {
        console.error('AI call error:', error);
        vscode.window.showErrorMessage(`Tektite: AI call failed - ${error.message}`);
        return null;
    }
}
