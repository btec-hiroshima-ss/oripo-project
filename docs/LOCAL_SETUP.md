# ローカル環境構築手順

## 前提条件

- Docker / Docker Compose がインストール済みであること
- GitHub の Personal Access Token（`repo` + `read:packages` スコープ）を発行済みであること

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

### 3. コンテナの起動

```bash
docker compose up -d
```

### 4. Claude コンテナへの接続

```bash
docker compose exec claude zsh
```

接続後、`/workspace` がプロジェクトルートとしてマウントされている。

---

## 補足

- `shareDir/` はホストと Claude コンテナ間で共有される一時ドキュメント置き場（git 管理外）
- 本番サーバーのセットアップ手順は [SERVER.md](SERVER.md) を参照
