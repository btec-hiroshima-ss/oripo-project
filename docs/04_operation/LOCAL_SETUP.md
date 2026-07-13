# ローカル環境構築手順

## 前提条件（共通）

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) がインストール済みであること
- [VS Code](https://code.visualstudio.com/) がインストール済みであること

---

## パターン A: Claude Code で開発する（推奨）

AI アシスタント（Claude Code）を使って開発する場合の手順。

### 追加前提

- [Dev Containers 拡張機能](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) がインストール済みであること
- Anthropic の Claude Code アカウントを持っていること
- GitHub の Personal Access Token（`repo` + `read:packages` スコープ）を発行済みであること

### 手順

#### 1. リポジトリのクローン

```bash
git clone https://github.com/btec-hiroshima-ss/oripo-project.git
cd oripo-project
```

#### 2. 環境変数ファイルの作成

```bash
cp .env.example .env
```

`.env` を開き、以下の値を設定する：

| 変数 | 説明 |
|---|---|
| `GITHUB_PERSONAL_ACCESS_TOKEN` | GitHub PAT（`repo` + `read:packages` スコープ） |
| `GIT_USER_NAME` | コンテナ内で使用する git ユーザー名 |
| `GIT_USER_EMAIL` | コンテナ内で使用する git メールアドレス |

#### 3. Dev Container で開く

VS Code でプロジェクトを開き、コマンドパレット（`Ctrl+Shift+P` / `Cmd+Shift+P`）から：

```
Dev Containers: Reopen in Container
```

を選択する。初回はイメージのビルドが走るため数分かかる。

起動後、VS Code のターミナルが `/workspace` をルートとした Claude コンテナ内に接続される。

#### 4. Claude Code にログイン

コンテナ内のターミナルで：

```bash
claude login
```

ブラウザが開くので Anthropic アカウントでログインする。

#### 5. 動作確認

ブラウザで `http://localhost:3000` を開き、ログイン画面が表示されれば OK。

> DB マイグレーションはアプリ起動時に自動実行されるため、手動での実行は不要。

---

## パターン B: Claude なしで開発する

Claude Code のサブスクリプションがない場合、またはシンプルな環境で開発したい場合の手順。

### 手順

#### 1. リポジトリのクローン

```bash
git clone https://github.com/btec-hiroshima-ss/oripo-project.git
cd oripo-project
```

#### 2. 環境変数ファイルの作成

```bash
cp .env.example .env
```

`.env` の `GITHUB_PERSONAL_ACCESS_TOKEN`・`GIT_USER_NAME`・`GIT_USER_EMAIL` は省略しても構わない（Claude コンテナを起動しないため）。

#### 3. アプリ・DB のみ起動

```bash
docker compose up app db --build
```

Claude コンテナ・バックアップコンテナ・Chrome コンテナは起動しない。

#### 4. 動作確認

ブラウザで `http://localhost:3000` を開き、ログイン画面が表示されれば OK。

> DB マイグレーションはアプリ起動時に自動実行されるため、手動での実行は不要。

#### 5. コードの編集

`src/` 配下のファイルをホスト側で直接編集する。app コンテナがホットリロードを検知して自動更新される。

エディタは VS Code、Cursor など何でもよい。

---

## 開発用ログイン情報

| 項目 | 値 |
|---|---|
| ユーザー名 | `Rescho` |
| パスワード | `rescho` |

---

## よく使うコマンド

```bash
# 全サービス起動（パターン A 用）
docker compose up

# アプリ・DB のみ起動（パターン B 用）
docker compose up app db

# 全サービス停止
docker compose down

# DB データを含め完全削除（やり直し時）
docker compose down -v

# アプリのログ確認（マイグレーション実行ログも含む）
docker compose logs -f app
```

---

## 補足

- `shareDir/` はホストと Claude コンテナ間で共有される一時ドキュメント置き場（git 管理外）
- 本番サーバーのセットアップ手順は [SERVER.md](SERVER.md) を参照
