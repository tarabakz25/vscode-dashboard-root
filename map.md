``` mermaid
---
title: アプリ遷移図
---

graph TD
    A[[vscode拡張機能]]
    B[[フロントエンド]]
    C[[Firebase]]
    D[[GitHub]]

    A --> E{GitHubにログインしているか？}
    E -->|Yes| F[コーディング情報を計測]
    E -->|No| D
    D --> G[ログイン]
    G --> F[Firebaseと連携]
    F --> C
``` 