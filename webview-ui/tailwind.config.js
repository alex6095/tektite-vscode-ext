/** @type {import('tailwindcss').Config} */
export default {
    content: [
        './index.html',
        './src/**/*.{js,ts,jsx,tsx}',
    ],
    theme: {
        extend: {
            colors: {
                // Map to VSCode theme CSS variables for automatic theme sync
                background: 'var(--vscode-editor-background, #0F1117)',
                surface: 'var(--vscode-sideBar-background, #1E212B)',
                surfaceHighlight: 'var(--vscode-list-hoverBackground, #2A2E3B)',
                border: 'var(--vscode-panel-border, #363B49)',
                primary: 'var(--vscode-focusBorder, #6E8FEE)',
                accent: 'var(--vscode-textLink-foreground, #A78BFA)',
                success: 'var(--vscode-terminal-ansiGreen, #4ADE80)',
                warning: 'var(--vscode-terminal-ansiYellow, #FBBF24)',
                danger: 'var(--vscode-errorForeground, #EF4444)',
                text: 'var(--vscode-editor-foreground, #E2E8F0)',
                textMuted: 'var(--vscode-descriptionForeground, #94A3B8)',
                vscodeSidebar: 'var(--vscode-sideBar-background, #181A1F)',
                vscodeActivityBar: 'var(--vscode-activityBar-background, #1E212B)',
            },
            fontFamily: {
                sans: ['Inter', 'var(--vscode-font-family)', 'sans-serif'],
                mono: ['Fira Code', 'var(--vscode-editor-font-family)', 'monospace'],
            },
            animation: {
                'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            }
        },
    },
    plugins: [],
};
