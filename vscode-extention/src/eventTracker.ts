import * as vscode from 'vscode'
import { storeEvent } from './utils'

export class EventTracker {
    private lastActivity: number = Date.now()
    private isIdle: boolean = false
    private readonly idleThresholdMs: number = 5 * 60 * 1000
    private disposables: vscode.Disposable[] = []

    constructor(private context: vscode.ExtensionContext) {
        // 設定からアイドル閾値を読み込むことも可能
    }

    public startTracking(): void {
        console.log('イベント追跡を開始します')
        
        // 拡張機能起動時にセッション開始イベントを記録
        this.recordSessionStartEvent()

        // キーボード、マウス、ドキュメント変更などのイベントを監視
        this.monitorEditorEvents()
        
        // 定期的なアイドル状態チェック
        this.startIdleCheck()
    }

    private recordSessionStartEvent(): void {
        const event = {
            type: 'session_start',
            timestamp: Date.now(),
            data: {
                vscodeVersion: vscode.version
            }
        }
        
        storeEvent(event)
    }

    private monitorEditorEvents(): void {
        // エディタのアクティブなテキストエディタが変更されたとき
        this.disposables.push(
            vscode.window.onDidChangeActiveTextEditor(editor => {
                if (editor) {
                    this.recordActivity('editor_change', { 
                        document: editor.document.fileName 
                    })
                }
            })
        )

        // テキスト編集時
        this.disposables.push(
            vscode.workspace.onDidChangeTextDocument(event => {
                this.recordActivity('text_edit', { 
                    document: event.document.fileName,
                    changes: event.contentChanges.length
                })
            })
        )

        // ドキュメントの保存時
        this.disposables.push(
            vscode.workspace.onDidSaveTextDocument(document => {
                this.recordActivity('document_save', { 
                    document: document.fileName 
                })
            })
        )

        // ウィンドウのフォーカス変更時
        this.disposables.push(
            vscode.window.onDidChangeWindowState(e => {
                if (e.focused) {
                    this.recordActivity('window_focus', {})
                } else {
                    this.recordActivity('window_blur', {})
                }
            })
        )

        // VSCode終了時のイベント記録
        this.context.subscriptions.push(
            vscode.workspace.onDidCloseTextDocument(() => {
                // 開いているエディタが0になった場合の処理も考えられる
            })
        )
    }

    private startIdleCheck(): void {
        // 60秒ごとにアイドル状態をチェック
        const interval = setInterval(() => {
            const now = Date.now()
            const timeSinceLastActivity = now - this.lastActivity

            // アイドル状態になったとき
            if (!this.isIdle && timeSinceLastActivity > this.idleThresholdMs) {
                this.isIdle = true
                const event = {
                    type: 'idle_start',
                    timestamp: now,
                    data: {
                        idleThreshold: this.idleThresholdMs
                    }
                }
                storeEvent(event)
            }
        }, 60 * 1000)

        // 拡張機能の終了時にインターバルをクリア
        this.context.subscriptions.push({
            dispose: () => clearInterval(interval)
        })
    }

    private recordActivity(activityType: string, data: any): void {
        const now = Date.now()
        
        // アイドル状態から復帰した場合
        if (this.isIdle) {
            this.isIdle = false
            const idleEndEvent = {
                type: 'idle_end',
                timestamp: now,
                data: {
                    idleDuration: now - this.lastActivity
                }
            }
            storeEvent(idleEndEvent)
        }

        // 最終アクティビティ時間を更新
        this.lastActivity = now

        // アクティビティイベントを記録
        const event = {
            type: 'activity',
            subtype: activityType,
            timestamp: now,
            data
        }
        
        storeEvent(event)
    }

    public dispose(): void {
        // 終了時のセッション終了イベントを記録
        const event = {
            type: 'session_end',
            timestamp: Date.now(),
            data: {}
        }
        storeEvent(event)

        // 登録したイベントリスナーをクリア
        this.disposables.forEach(d => d.dispose())
    }
}
