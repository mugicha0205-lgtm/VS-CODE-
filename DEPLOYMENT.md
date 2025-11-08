# Netlifyへのデプロイ手順

## 方法1: ドラッグ&ドロップでデプロイ（最も簡単）

### 手順

1. **Netlifyアカウントを作成**
   - https://www.netlify.com にアクセス
   - 「Sign up」をクリック
   - GitHubアカウントでサインアップ（推奨）または Email でサインアップ

2. **デプロイするファイルを準備**
   - 以下のファイルをデプロイします：
     - `index.html`
     - `style.css`
     - `app.js`
     - `manifest.json`
     - `service-worker.js`
     - `icon-192.png`
     - `icon-512.png`
     - `netlify.toml`

   **注意**: `server.js` と `node_modules` は不要です（既に.gitignoreで除外されています）

3. **Netlifyにデプロイ**
   - Netlify のダッシュボードで「Sites」タブを開く
   - 「Add new site」→「Deploy manually」を選択
   - フォルダ全体をドラッグ&ドロップ（または上記のファイルを選択してアップロード）

4. **デプロイ完了！**
   - 数秒でデプロイが完了します
   - `https://ランダムな名前.netlify.app` のようなURLが発行されます
   - このURLを知人に共有してください

### サイト名を変更する方法

1. Netlify ダッシュボードでサイトを選択
2. 「Site settings」をクリック
3. 「Change site name」をクリック
4. お好きな名前に変更（例: `pt-manager-app`）
5. URLが `https://pt-manager-app.netlify.app` になります

---

## 方法2: GitHubと連携してデプロイ（推奨）

この方法なら、コードを修正するたびに自動でデプロイされます。

### 手順

1. **GitHubリポジトリを作成**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/あなたのユーザー名/リポジトリ名.git
   git push -u origin main
   ```

2. **Netlifyと連携**
   - Netlify ダッシュボードで「Add new site」→「Import an existing project」
   - 「GitHub」を選択
   - リポジトリを選択
   - Build settings:
     - Build command: （空白のまま）
     - Publish directory: `.`
   - 「Deploy site」をクリック

3. **自動デプロイ完了！**
   - GitHubにpushするたびに自動でデプロイされます
   - コードを修正したら、以下のコマンドで反映：
     ```bash
     git add .
     git commit -m "修正内容"
     git push
     ```

---

## 独自ドメインの設定（オプション）

独自ドメインを持っている場合：

1. Netlify ダッシュボードで「Domain settings」を開く
2. 「Add custom domain」をクリック
3. ドメインを入力して設定

---

## トラブルシューティング

### 古いバージョンが表示される・キャッシュが残っている場合

**サーバー側（Netlify）のキャッシュをクリア:**
1. Netlify ダッシュボードでサイトを選択
2. 「Deploys」タブを開く
3. 「Trigger deploy」→「Clear cache and deploy site」をクリック

**ブラウザ側のキャッシュをクリア:**

**Chrome/Edge:**
1. `Ctrl + Shift + Delete`（Windows）または `Cmd + Shift + Delete`（Mac）
2. 「キャッシュされた画像とファイル」を選択
3. 「データを削除」をクリック
4. **または** `Ctrl + Shift + R`（強制再読み込み）

**Safari:**
1. `Cmd + Option + E`（キャッシュを空にする）
2. ページを再読み込み

**スマートフォン:**

**iPhone/iPad (Safari):**
1. 設定 → Safari → 詳細 → Webサイトデータ
2. 「全Webサイトデータを削除」をタップ

**Android (Chrome):**
1. Chrome メニュー → 設定 → プライバシーとセキュリティ
2. 「閲覧履歴データの削除」→「キャッシュされた画像とファイル」を選択
3. 「データを削除」をタップ

### PWAとしてインストールできない場合
- HTTPS接続であることを確認（Netlifyは自動でHTTPS対応）
- ブラウザのキャッシュをクリア（上記参照）
- `manifest.json` の `start_url` が正しいか確認

### データが保存されない場合
- LocalStorageを使用しているため、ブラウザごとにデータは独立
- プライベートモードではデータが保存されない場合があります
- ブラウザの履歴を削除すると、LocalStorageのデータも削除される場合があります

---

## サポート

問題が発生した場合は、開発者に連絡してください。
