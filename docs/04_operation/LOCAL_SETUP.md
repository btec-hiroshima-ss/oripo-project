# ローカル環境構築手順

## 前提条件

- WSL に Docker がインストール済みであること（→ [付録: WSL への Docker インストール](#付録-wsl-への-docker-インストール)）
- [VS Code](https://code.visualstudio.com/) がインストール済みであること
- [Dev Containers 拡張機能](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) がインストール済みであること
- [DBeaver](https://dbeaver.io/) がインストール済みであること
- GitHub の Personal Access Token（`repo` + `read:packages` スコープ）を発行済みであること

---

## 手順

### 1. リポジトリのクローン

```bash
git clone https://github.com/btec-hiroshima-ss/oripo-project.git
cd oripo-project
```

### 2. 環境変数ファイルの作成

```bash
cp .env.example .env
```

`.env` を開き、以下の値を設定する：

| 変数 | 説明 |
|---|---|
| `GITHUB_PERSONAL_ACCESS_TOKEN` | GitHub PAT（`repo` + `read:packages` スコープ） |
| `GIT_USER_NAME` | コンテナ内で使用する git ユーザー名 |
| `GIT_USER_EMAIL` | コンテナ内で使用する git メールアドレス |

### 3. Dev Container で開く

VS Code でプロジェクトを開き、コマンドパレット（`Ctrl+Shift+P` / `Cmd+Shift+P`）から：

```
Dev Containers: Reopen in Container
```

を選択する。初回はイメージのビルドが走るため数分かかる。

起動後、VS Code のターミナルが `/workspace` をルートとした Claude コンテナ内に接続される。

### 4. 動作確認

ブラウザで `http://localhost:3000` を開き、ログイン画面が表示されれば OK。

> DB マイグレーションはアプリ起動時に自動実行されるため、手動での実行は不要。

### 5. Claude Code にログイン（Claude を使う場合のみ）

```bash
claude login
```

ブラウザが開くので Anthropic アカウントでログインする。

---

## 開発用ログイン情報

| 項目 | 値 |
|---|---|
| ユーザー名 | `Rescho` |
| パスワード | `rescho` |

---

## DB 接続（DBeaver）

DB の確認・操作には [DBeaver](https://dbeaver.io/) を使用する。

### 接続設定

DBeaver を起動し、新規接続（PostgreSQL）を作成して以下を入力：

| 項目 | 値 |
|---|---|
| Host | `localhost` |
| Port | `5432` |
| Database | `aipo` |
| Username | `aipo_postgres` |
| Password | `aipo` |

「テスト接続」をクリックして成功すれば OK。

---

## DB リストア（DBeaver）

既存の AIPO データを開発環境に取り込む場合、DBeaver でリストアする。

リストアファイルは担当者に確認すること。

### SQL ファイル（.sql）の場合

1. DBeaver で `aipo` データベースを右クリック →「ツール」→「SQL スクリプトの実行」
2. リストアファイルを選択して実行

### ダンプファイル（.dump / .backup）の場合

1. DBeaver で `aipo` データベースを右クリック →「ツール」→「リストア」
2. リストアファイルを選択して実行

---

## 付録: WSL への Docker インストール

Windows の PowerShell（管理者権限）で実行：

```powershell
wsl --install
```

インストール後、WSL（Ubuntu）を起動して以下を実行：

```bash
# Docker Engine インストール
curl -fsSL https://get.docker.com | sh

# 現在のユーザーを docker グループに追加（sudo なしで実行できるようにする）
sudo usermod -aG docker $USER
```

WSL を再起動して反映：

```powershell
# PowerShell で実行
wsl --shutdown
```

WSL を再度開き、動作確認：

```bash
docker compose version
```

---

## 補足

- `shareDir/` はホストと Claude コンテナ間で共有される一時ドキュメント置き場（git 管理外）
- 本番サーバーのセットアップ手順は [SERVER.md](SERVER.md) を参照
