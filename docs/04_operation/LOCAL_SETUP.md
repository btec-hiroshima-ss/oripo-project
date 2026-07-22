# ローカル環境構築手順

## 前提条件

- WSL に Docker がインストール済みであること（→ [付録: WSL への Docker インストール](#付録-wsl-への-docker-インストール)）
- [VS Code](https://code.visualstudio.com/) がインストール済みであること
- [Dev Containers 拡張機能](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) がインストール済みであること
- [DBeaver](https://dbeaver.io/) がインストール済みであること
- GitHub アカウントを持っていること

---

## 手順

### 1. GitHub PAT の発行

> すでに `repo` + `read:packages` スコープの PAT を持っている場合はスキップしてよい。

GitHub にログインし、[Personal Access Tokens](https://github.com/settings/tokens) ページで PAT を発行する。

- **Token name**: 任意（例: `oripo-local`）
- **Expiration**: 任意
- **Scopes**: `repo` と `read:packages` にチェック

発行後、トークン文字列（`ghp_xxxx...`）をコピーしておく（再表示不可）。

詳細手順 → [付録: GitHub PAT の発行方法](#付録-github-pat-の発行方法)

### 2. リポジトリのクローン

```bash
git clone https://github.com/btec-hiroshima-ss/oripo-project.git
cd oripo-project
```

ユーザー名とパスワードを求められたら、パスワード欄に手順 1 で発行した PAT を入力する。

> **Windows (WSL)**: Git Credential Manager が自動的に認証情報を保存するため、2回目以降は入力不要。

### 3. 環境変数ファイルの作成

```bash
cp .env.example .env
```

`.env` を開き、以下の値を設定する：

| 変数 | 値の例 | 説明 |
|---|---|---|
| `GITHUB_PERSONAL_ACCESS_TOKEN` | `ghp_xxxx...` | 手順 1 で発行した PAT。コンテナ内の `gh` コマンド認証に使用。 |
| `GIT_USER_NAME` | `Taro Yamada` | コンテナ内の git commit に表示される名前 |
| `GIT_USER_EMAIL` | `taro@example.com` | コンテナ内の git commit に表示されるメールアドレス |

### 4. Dev Container で開く

VS Code でプロジェクトを開き、コマンドパレット（`Ctrl+Shift+P` / `Cmd+Shift+P`）から：

```
Dev Containers: Reopen in Container
```

を選択する。初回はイメージのビルドが走るため数分かかる。

起動後、VS Code のターミナルが `/workspace` をルートとした Claude コンテナ内に接続される。

### 5. DB リストア（DBeaver）

既存の AIPO データを開発環境に取り込む。リストアファイルは担当者に確認すること。

DBeaver を起動し、新規接続（PostgreSQL）を作成：

| 項目 | 値 |
|---|---|
| Host | `localhost` |
| Port | `5432` |
| Database | `aipo` |
| Username | `aipo_postgres` |
| Password | `aipo` |

接続後、`aipo` データベースを右クリックしてリストアを実行：

- **SQL ファイル（.sql）**:「ツール」→「SQL スクリプトの実行」→ファイルを選択して実行
- **ダンプファイル（.dump / .backup）**:「ツール」→「リストア」→ファイルを選択して実行

### 6. 動作確認

ブラウザで `http://localhost:3000` を開き、ログイン画面が表示されれば OK。

> DB マイグレーションはアプリ起動時に自動実行されるため、手動での実行は不要。

### 7. Claude Code にログイン（Claude を使う場合のみ）

```bash
claude login
```

ブラウザが開くので Anthropic アカウントでログインする。

---

## 管理ツール

`docker compose up` で以下のツールが起動する。

### pgAdmin（DB管理・バックアップ・リストア）

URL: `http://localhost:5050`

| 項目 | 値 |
|---|---|
| Email | `admin@oripo.com` |
| Password | `oripo` |

#### DB接続の登録（初回のみ）

1. 左ペインの「Servers」を右クリック →「Register」→「Server」
2. 「General」タブ: Name に `oripo-local`（任意）を入力
3. 「Connection」タブに以下を入力して「Save」

| 項目 | 値 |
|---|---|
| Host | `db` |
| Port | `5432` |
| Database | `aipo` |
| Username | `aipo_postgres` |
| Password | `aipo` |

#### DBリストア

1. 左ペインで `aipo` データベースを右クリック →「Restore」
2. バックアップファイル（`backups/` 配下の `.dump.gz`）を選択して実行

---

## 開発用ログイン情報

| 項目 | 値 |
|---|---|
| ユーザー名 | `Rescho` |
| パスワード | `rescho` |

---

## 付録: GitHub PAT の発行方法

1. GitHub にログインし、右上アイコン →「Settings」を開く
2. 左メニュー最下部「Developer settings」→「Personal access tokens」→「Tokens (classic)」
3. 「Generate new token (classic)」をクリック
4. 以下を設定して「Generate token」

   | 項目 | 値 |
   |---|---|
   | Note | 任意（例: `oripo-local`） |
   | Expiration | 任意 |
   | Scopes | `repo`・`read:packages` にチェック |

5. 生成されたトークン（`ghp_xxxx...`）をコピー（**この画面を閉じると再表示不可**）

---

## 付録: WSL への Docker インストール

> WSL がすでにインストール済みの場合は「Docker Engine のインストール」から始めること。
> WSL のインストール確認: PowerShell で `wsl -l -v` を実行し、ディストリビューション一覧が表示されれば導入済み。

### WSL のインストール（未導入の場合のみ）

Windows の PowerShell（管理者権限）で実行：

```powershell
wsl --install
```

### Docker Engine のインストール

WSL（Ubuntu）を起動して以下を実行：

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
