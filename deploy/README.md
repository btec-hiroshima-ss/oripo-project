# 本番サーバー セットアップ・運用手順

## 前提条件

- Ubuntu Server 18 以上
- Docker・docker compose インストール済み

---

## 初回セットアップ

### 1. deploy ディレクトリのみクローン

```bash
git clone --filter=blob:none --sparse https://github.com/btec-hiroshima-ss/oripo-project.git
cd oripo-project
git sparse-checkout set deploy
```

### 2. 環境変数ファイルを作成

```bash
cd deploy
cp .env.example .env.production
vi .env.production  # 本番用の値を設定
```

### 3. 初回デプロイ

```bash
chmod +x deploy.sh
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
