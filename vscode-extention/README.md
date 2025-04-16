# VSCode コーディング時間追跡拡張機能

この拡張機能はVSCode内でのコーディング活動を追跡し、統計情報を表示します。

## 設定方法

1. リポジトリをクローンする
   ```
   git clone <repository-url>
   cd vscode-extention
   ```

2. 依存関係をインストールする
   ```
   npm install
   ```

3. Firebase設定ファイルを作成する
   プロジェクトのルートディレクトリに `firebase-config.json` ファイルを作成し、以下のような内容で保存します：
   ```json
   {
     "apiKey": "YOUR_FIREBASE_API_KEY",
     "authDomain": "YOUR_PROJECT_ID.firebaseapp.com",
     "projectId": "YOUR_PROJECT_ID",
     "storageBucket": "YOUR_PROJECT_ID.appspot.com",
     "messagingSenderId": "YOUR_MESSAGING_SENDER_ID",
     "appId": "YOUR_APP_ID"
   }
   ```
   **注意**: 実際のFirebase設定情報に置き換えてください。このファイルは `.gitignore` に追加されているため、Gitリポジトリにはコミットされません。

4. TypeScriptをコンパイルする
   ```
   npm run compile
   ```

5. VSCodeでデバッグ実行する
   - F5キーを押すか、
   - デバッグビュー（Ctrl+Shift+D）から「拡張機能を起動」を選択

## 機能

- VSCode内でのコーディング活動を自動追跡
- 起動時とコマンド実行時にユーザーIDを表示
- Firebase統合によるデータ保存
- ダッシュボードWebアプリでのデータ閲覧（別途）

## コマンド

- `コーディング統計を表示`: コーディング時間の統計情報を表示します
- `ユーザーIDを表示`: あなたのユーザーIDを表示してクリップボードにコピーします

## 配布・インストール方法

機密情報を含まない形で配布する方法：

1. リポジトリをクローンまたはダウンロード
2. `firebase-config.json` ファイルを別途配布またはユーザーに作成してもらう
3. `npm install` と `npm run compile` を実行
4. `code --install-extension vscode-extention-1.0.0.vsix` でインストール

## 開発者向け情報

- `npm run watch`: TypeScriptファイルの変更を監視し、自動的に再コンパイルします
- `npm run compile`: TypeScriptファイルを一度だけコンパイルします 