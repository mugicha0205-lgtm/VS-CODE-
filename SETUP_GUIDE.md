# PT Manager セットアップガイド

このドキュメントでは、PT Managerの全機能を使用するために必要な設定手順を説明します。

## 📋 目次

1. [基本的な使い方](#基本的な使い方)
2. [AIメニュー提案機能の設定](#aiメニュー提案機能の設定)
3. [Googleカレンダー連携の設定](#googleカレンダー連携の設定)
4. [PWA通知機能の設定](#pwa通知機能の設定)
5. [トラブルシューティング](#トラブルシューティング)

---

## 基本的な使い方

### すぐに使える機能

以下の機能は設定不要で、すぐに使用できます：

- ✅ 顧客管理（登録、編集、削除）
- ✅ セッション記録
- ✅ 進捗グラフ（体重、体脂肪率、筋肉量、基礎代謝）
- ✅ チケット管理
- ✅ 目標達成率の可視化
- ✅ テンプレートメニュー保存・読込
- ✅ 自動バックアップ（週次、JSONダウンロード）
- ✅ 月次レポート（PDF出力）
- ✅ 月間目標設定と売上予測
- ✅ カスタム種目追加

---

## AIメニュー提案機能の設定

### 必要なもの
- OpenAI APIキー

### 取得手順

1. **OpenAI アカウント作成**
   - https://platform.openai.com/ にアクセス
   - アカウントを作成（サインアップ）

2. **APIキーの発行**
   - https://platform.openai.com/api-keys にアクセス
   - 「Create new secret key」をクリック
   - キー名を入力（例: PT Manager）
   - 生成されたキーをコピー（`sk-`で始まる文字列）

   ⚠️ **重要**: このキーは一度しか表示されないので、必ず安全な場所に保存してください

3. **APIキーの設定**
   - PT Managerを開く
   - サイドバーの「AIメニュー提案」をクリック
   - 「OpenAI APIキー」欄に取得したキーを貼り付け
   - 「APIキーを保存」ボタンをクリック

4. **使い方**
   - 顧客を選択
   - 「AIメニューを生成」ボタンをクリック
   - AIが顧客情報に基づいて最適なトレーニングメニューを提案

### 料金について
- OpenAI APIは従量課金制です
- GPT-4o-miniを使用（1回の提案あたり数円程度）
- 詳細: https://openai.com/pricing

---

## Googleカレンダー連携の設定

### 必要なもの
- Google Cloud プロジェクト
- Google Calendar API の有効化
- OAuth 2.0 クライアントID

### 設定手順

1. **Google Cloud Console にアクセス**
   - https://console.cloud.google.com/ を開く
   - 新しいプロジェクトを作成

2. **APIの有効化**
   - 「APIとサービス」→「ライブラリ」を開く
   - 「Google Calendar API」を検索して有効化
   - 「Google Drive API」も同様に有効化（バックアップ用）

3. **OAuth 2.0 認証情報の作成**
   - 「APIとサービス」→「認証情報」を開く
   - 「認証情報を作成」→「OAuth クライアントID」を選択
   - アプリケーションの種類: 「ウェブアプリケーション」
   - 承認済みのJavaScript生成元を追加:
     - `http://localhost:3000`（開発用）
     - あなたのドメイン（本番用）
   - 承認済みのリダイレクトURIを追加:
     - `http://localhost:3000`
     - あなたのドメイン

4. **クライアントIDとAPIキーを取得**
   - OAuth クライアントIDをコピー
   - APIキーも作成してコピー

5. **app.js に設定**
   ```javascript
   // app.js の20-21行目を編集
   const GOOGLE_CLIENT_ID = 'あなたのクライアントID.apps.googleusercontent.com';
   const GOOGLE_API_KEY = 'あなたのAPIキー';
   ```

6. **使い方**
   - サイドバー下部の「Google連携」ボタンをクリック
   - Googleアカウントでログイン
   - カレンダーページで「カレンダー同期」をクリック

---

## PWA通知機能の設定

### 設定手順

1. **通知を有効化**
   - サイドバーの「設定」をクリック
   - 「予約リマインダー通知を有効にする」をON
   - 「通知を有効化」ボタンをクリック
   - ブラウザの通知許可ダイアログで「許可」をクリック

2. **通知タイミングの設定**
   - 1時間前、2時間前、3時間前、1日前から選択可能

3. **動作確認**
   - セッション記録時に「次回予約日時」を設定
   - 設定した時間になると自動的に通知が表示されます

### 対応ブラウザ
- Chrome、Edge、Firefox、Safari (macOS)
- モバイル（PWAとしてホーム画面に追加した場合）

---

## トラブルシューティング

### Q: AIメニュー生成でエラーが出る

**A: 以下を確認してください：**
- APIキーが正しいか（`sk-`で始まっているか）
- OpenAIアカウントに残高があるか
- インターネット接続が有効か

### Q: Googleカレンダー連携ができない

**A: 以下を確認してください：**
- CLIENT_IDとAPI_KEYが正しく設定されているか
- Google Cloud Console でAPIが有効になっているか
- OAuth認証情報のリダイレクトURIが正しいか

### Q: 通知が表示されない

**A: 以下を確認してください：**
- ブラウザの通知権限が許可されているか
- 設定で通知が有効になっているか
- 次回予約日時が正しく設定されているか

### Q: データが消えた

**A:**
- データはブラウザのLocalStorageに保存されています
- ブラウザのキャッシュをクリアすると削除されます
- 定期的にバックアップ（JSONダウンロード）を推奨します

---

## サポート

問題が解決しない場合は、GitHubのIssuesで報告してください。

---

## 開発者向け情報

### ローカル開発環境

```bash
# サーバー起動
node server.js

# ブラウザで開く
http://localhost:3000
```

### ディレクトリ構造

```
personal-trainer-client-manager/
├── index.html          # メインHTML
├── app.js              # アプリケーションロジック
├── style.css           # スタイル
├── manifest.json       # PWA設定
├── service-worker.js   # Service Worker
├── server.js           # 開発サーバー
└── icon-*.png          # アイコン画像
```

### 技術スタック

- **フロントエンド**: Vanilla JavaScript, HTML5, CSS3
- **グラフ**: Chart.js
- **PDF生成**: jsPDF
- **AI**: OpenAI GPT-4o-mini API
- **PWA**: Service Worker, Web Notifications API
- **データ保存**: LocalStorage

---

最終更新: 2025年11月
