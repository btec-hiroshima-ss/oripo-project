# ローカル環境構築手順

## 前提条件

- VS Code + [Dev Containers 拡張機能](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) がインストール済みであること
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

### 3. Dev Container で開く

VS Code でプロジェクトを開き、コマンドパレット（`Ctrl+Shift+P` / `Cmd+Shift+P`）から：

```
Dev Containers: Reopen in Container
```

を選択する。初回はイメージのビルドが走るため数分かかる。

起動後、VS Code のターミナルが `/workspace` をルートとした Claude コンテナ内に接続される。

---

## 補足

- `shareDir/` はホストと Claude コンテナ間で共有される一時ドキュメント置き場（git 管理外）
- 本番サーバーのセットアップ手順は [SERVER.md](SERVER.md) を参照
