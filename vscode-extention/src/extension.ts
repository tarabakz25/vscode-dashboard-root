import * as vscode from 'vscode'
import { EventTracker } from './eventTracker'
import { setExtensionContext, initializeFirebase, getUserId, linkGitHubAccountToUser } from './utils'


export async function activate(context: vscode.ExtensionContext) {
    console.log('Extension is now active!')

    // 拡張機能のコンテキストを設定
    setExtensionContext(context)
    
    // 固定のFirebase設定を使用して初期化
    initializeFirebase()
    
    // イベントトラッカーを初期化
    const eventTracker = new EventTracker(context)
    eventTracker.startTracking()

    // 統計表示コマンドを登録
    let showStats = vscode.commands.registerCommand('vscode-coding-time-tracker.showStats', async () => {
        const userId = await getUserId();
        const dashboardUrl = `http://localhost:3000/dashboard?userId=${userId}`
        
        const options = ['ユーザーIDをコピー', 'ダッシュボードを開く']
        const selection = await vscode.window.showInformationMessage(
            `あなたのユーザーID: ${userId}`, 
            ...options
        )
        
        if (selection === 'ユーザーIDをコピー') {
            await vscode.env.clipboard.writeText(userId);
            vscode.window.showInformationMessage('ユーザーIDをクリップボードにコピーしました');
        } else if (selection === 'ダッシュボードを開く') {
            vscode.env.openExternal(vscode.Uri.parse(dashboardUrl));
        }
    })

    // GitHubアカウント連携コマンドを登録
    let linkGitHubAccount = vscode.commands.registerCommand('vscode-coding-time-tracker.linkGitHubAccount', async () => {
        try {
            // 1. VS CodeのユーザーIDを取得
            const userId = await getUserId();
            if (!userId) {
                vscode.window.showErrorMessage('ユーザーIDを取得できませんでした。');
                return;
            }

            // 2. GitHub認証セッションを取得
            const session = await vscode.authentication.getSession('github', ['read:user'], { createIfNone: true });

            if (session) {
                const githubUsername = session.account.label;
                const githubUserId = session.account.id; // GitHubの数値IDを取得

                // 3. Firebaseに情報を保存
                await linkGitHubAccountToUser(userId, githubUsername, githubUserId); // 関数を呼び出す

                vscode.window.showInformationMessage(`GitHubアカウント (${githubUsername}) との連携に成功しました。`);
            } else {
                vscode.window.showWarningMessage('GitHubアカウントの認証に失敗しました。');
            }
        } catch (error) {
            console.error('GitHubアカウント連携エラー:', error);
            // linkGitHubAccountToUser 内でエラーが投げられた場合もここでキャッチされる
            vscode.window.showErrorMessage('GitHubアカウントの連携中にエラーが発生しました。');
        }
    })

    context.subscriptions.push(showStats, linkGitHubAccount);
}

export function deactivate() {
    console.log('Extension is now deactivated!')
}