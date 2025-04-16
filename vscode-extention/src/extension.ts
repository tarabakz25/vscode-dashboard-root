import * as vscode from 'vscode'
import { EventTracker } from './eventTracker'

export function activate(context: vscode.ExtensionContext) {
    console.log('Extension is now active!')

    const eventTracker = new EventTracker(context)

    eventTracker.startTracking()

    let disposable = vscode.commands.registerCommand('vscode-coding-time-tracker.showStats', () => {
        vscode.window.showInformationMessage('コーディング統計を表示します!')
    })

    context.subscriptions.push(disposable)
}

export function deactivate() {
    console.log('Extension is now deactivated!')
}