import * as vscode from 'vscode'
import { EventTracker } from './eventTracker'
import { setExtensionContext, initializeFirebase, getUserId } from './utils'
import { activateTsxPreview } from './tsxPreview'

export async function activate(context: vscode.ExtensionContext) {
    console.log('Extension is now active!')

    // 拡張機能のコンテキストを設定
    setExtensionContext(context)
    
    // 固定のFirebase設定を使用して初期化
    initializeFirebase()
    
    // イベントトラッカーを初期化
    const eventTracker = new EventTracker(context)
    eventTracker.startTracking()

    // TSXプレビュー機能を有効化
    activateTsxPreview(context)

    // 起動時にユーザーIDを表示
    showUserIdAlert()

    // 統計表示コマンドを登録
    let showStats = vscode.commands.registerCommand('vscode-coding-time-tracker.showStats', async () => {
        const userId = await getUserId();
        const dashboardUrl = `https://your-dashboard-url.com/?userId=${userId}`;
        
        const options = ['ユーザーIDをコピー', 'ダッシュボードを開く'];
        const selection = await vscode.window.showInformationMessage(
            `あなたのユーザーID: ${userId}`, 
            ...options
        );
        
        if (selection === 'ユーザーIDをコピー') {
            await vscode.env.clipboard.writeText(userId);
            vscode.window.showInformationMessage('ユーザーIDをクリップボードにコピーしました');
        } else if (selection === 'ダッシュボードを開く') {
            vscode.env.openExternal(vscode.Uri.parse(dashboardUrl));
        }
    })

    // ユーザーID表示コマンドを登録
    let showUserId = vscode.commands.registerCommand('vscode-coding-time-tracker.showUserId', async () => {
        showUserIdAlert()
    });

    context.subscriptions.push(showStats, showUserId);
}

// ユーザーIDをアラートとして表示
async function showUserIdAlert() {
    try {
        const userId = await getUserId();
        
        // クリップボードにコピー
        await vscode.env.clipboard.writeText(userId);
        
        // 左下のボックスに表示
        vscode.window.setStatusBarMessage(
            `ユーザーID: ${userId}`,
        );
    } catch (error) {
        console.error('ユーザーID取得エラー:', error);
    }
}

export function deactivate() {
    console.log('Extension is now deactivated!')
}