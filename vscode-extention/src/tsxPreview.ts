import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http';

let previewPanel: vscode.WebviewPanel | undefined;
let server: http.Server | undefined;
const PORT = 3500;

/**
 * TSXファイルをプレビューする機能
 */
export function activateTsxPreview(context: vscode.ExtensionContext) {
    // TSXプレビューコマンドを登録
    const previewCommand = vscode.commands.registerCommand('vscode-coding-time-tracker.previewTsxFile', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || path.extname(editor.document.fileName) !== '.tsx') {
            vscode.window.showErrorMessage('アクティブなエディタがTSXファイルではありません。');
            return;
        }

        showPreview(editor.document, context);
    });

    context.subscriptions.push(previewCommand);
}

/**
 * プレビューを表示する
 */
function showPreview(document: vscode.TextDocument, context: vscode.ExtensionContext) {
    const fileName = path.basename(document.fileName);
    
    // 既存のパネルがあれば再利用、なければ新規作成
    if (previewPanel) {
        previewPanel.reveal(vscode.ViewColumn.Beside);
    } else {
        previewPanel = vscode.window.createWebviewPanel(
            'tsxPreview',
            `プレビュー: ${fileName}`,
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.file(path.dirname(document.fileName)),
                    vscode.Uri.file(context.extensionPath)
                ]
            }
        );
        
        // パネルが閉じられた時の処理
        previewPanel.onDidDispose(() => {
            previewPanel = undefined;
            if (server) {
                server.close();
                server = undefined;
            }
        }, null, context.subscriptions);
    }

    // ローカルサーバーの起動
    startLocalServer(document);
    
    // Webviewの内容を設定
    updatePreviewContent(document);
}

/**
 * ローカルサーバーを起動してTSXファイルをレンダリングする
 */
function startLocalServer(document: vscode.TextDocument) {
    if (server) {
        server.close();
    }

    // 簡易的なサーバーを作成
    server = http.createServer((req, res) => {
        if (req.url === '/') {
            // HTMLを返す
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(createHtmlTemplate(document.getText()));
        } else if (req.url === '/tsx-content') {
            // TSXコンテンツを返す
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ content: document.getText() }));
        }
    });

    server.listen(PORT, () => {
        console.log(`プレビューサーバーが起動しました: http://localhost:${PORT}`);
    });

    // エラーハンドリング
    server.on('error', (err) => {
        if ((err as any).code === 'EADDRINUSE') {
            vscode.window.showErrorMessage(`ポート ${PORT} は既に使用されています。別のポートを試してください。`);
        } else {
            vscode.window.showErrorMessage(`サーバー起動エラー: ${err.message}`);
        }
    });
}

/**
 * プレビューパネルの内容を更新
 */
function updatePreviewContent(document: vscode.TextDocument) {
    if (!previewPanel) return;

    const html = `
        <!DOCTYPE html>
        <html lang="ja">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>TSX プレビュー</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    margin: 0;
                    padding: 15px;
                    background-color: var(--vscode-editor-background);
                    color: var(--vscode-editor-foreground);
                }
                iframe {
                    width: 100%;
                    height: 100vh;
                    border: 1px solid #ccc;
                    border-radius: 4px;
                }
                .error {
                    color: #ff5555;
                    padding: 10px;
                    margin: 10px 0;
                    border-left: 3px solid #ff5555;
                    background-color: rgba(255, 85, 85, 0.1);
                }
            </style>
        </head>
        <body>
            <iframe src="http://localhost:${PORT}" frameborder="0"></iframe>
            <div id="error" class="error" style="display: none;"></div>
            
            <script>
                // VSCodeとの通信用コード
                const vscode = acquireVsCodeApi();
                const iframe = document.querySelector('iframe');
                const errorDiv = document.getElementById('error');
                
                // iframe通信エラーのハンドリング
                iframe.onerror = () => {
                    errorDiv.textContent = 'プレビューの読み込みに失敗しました。';
                    errorDiv.style.display = 'block';
                };
                
                // 定期的に更新をチェック
                setInterval(() => {
                    fetch('http://localhost:${PORT}/tsx-content')
                        .then(response => response.json())
                        .then(data => {
                            if (data.content !== ${JSON.stringify(document.getText())}) {
                                iframe.src = 'http://localhost:${PORT}';
                            }
                        })
                        .catch(err => {
                            errorDiv.textContent = 'プレビューサーバーに接続できません。';
                            errorDiv.style.display = 'block';
                        });
                }, 2000);
            </script>
        </body>
        </html>
    `;

    previewPanel.webview.html = html;
}

/**
 * TSXコンテンツをレンダリングするためのHTMLテンプレートを作成
 */
function createHtmlTemplate(tsxContent: string): string {
    return `
        <!DOCTYPE html>
        <html lang="ja">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>TSX プレビュー</title>
            <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
            <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
            <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    margin: 0;
                    padding: 15px;
                }
                #root {
                    padding: 10px;
                }
                .error-container {
                    color: #ff5555;
                    padding: 10px;
                    margin: 10px 0;
                    border-left: 3px solid #ff5555;
                    background-color: rgba(255, 85, 85, 0.1);
                }
            </style>
        </head>
        <body>
            <div id="root"></div>
            <div id="error" class="error-container" style="display: none;"></div>
            
            <script type="text/babel">
                try {
                    // TSXコンテンツを変換して実行
                    ${tsxContent}
                    
                    // デフォルトのエクスポートかコンポーネントを探して表示
                    const componentNames = Object.keys(window).filter(key => 
                        typeof window[key] === 'function' && 
                        /^[A-Z]/.test(key) && 
                        key !== 'React' && 
                        key !== 'ReactDOM'
                    );
                    
                    if (componentNames.length > 0) {
                        const ComponentToRender = window[componentNames[0]];
                        ReactDOM.render(<ComponentToRender />, document.getElementById('root'));
                    } else {
                        document.getElementById('error').textContent = 'コンポーネントが見つかりませんでした。Reactコンポーネントをエクスポートしているか確認してください。';
                        document.getElementById('error').style.display = 'block';
                    }
                } catch (error) {
                    document.getElementById('error').textContent = 'エラー: ' + error.message;
                    document.getElementById('error').style.display = 'block';
                    console.error(error);
                }
            </script>
        </body>
        </html>
    `;
} 