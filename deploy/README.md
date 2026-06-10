# 本番サーバー セットアップ・運用手順

## 前提条件

- Ubuntu Server 18 以上
- GitHub の Personal Access Token（`repo` スコープ）
  - 発行: GitHub > Settings > Developer settings > Personal access tokens

---

## サーバー初期セットアップ（初回のみ）

### 1. GitHub 認証 & リポジトリ取得

```bash
git config --global credential.helper store
git clone https://github.com/btec-hiroshima-ss/oripo-project.git
# ユーザー名と PAT を入力（以降は自動保存）
cd oripo-project/deploy
```

### 2. Docker インストール

```bash
./setup-docker.sh
sudo reboot
```

### 3. 初回デプロイ

再起動後：

```bash
cd oripo-project/deploy
cp .env.example .env.production
vi .env.production  # GHCR_USER・GHCR_TOKEN 等を設定
./deploy.sh
```

---

## デプロイ手順（更新時）

```bash
./deploy.sh
```

---

## 動作確認

```bash
# コンテナの状態確認
docker compose -f docker-compose.prod.yml ps

# ログ確認
docker compose -f docker-compose.prod.yml logs -f app
```

---

## 停止・再起動

```bash
# 停止
docker compose -f docker-compose.prod.yml down

# 再起動
docker compose -f docker-compose.prod.yml restart
```

---

## ロールバック

```bash
# 特定バージョンのイメージを指定して起動
docker compose -f docker-compose.prod.yml down
docker run -d ghcr.io/btec-hiroshima-ss/oripo-project:<タグ>
```
