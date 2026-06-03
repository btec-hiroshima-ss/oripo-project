# 本番サーバー セットアップ・運用手順

## 前提条件

- Ubuntu Server 18 以上

---

## サーバー初期セットアップ（初回のみ）

Docker のインストールからリポジトリ取得まで `setup.sh` で一括実行できます。

```bash
curl -fsSL https://raw.githubusercontent.com/btec-hiroshima-ss/oripo-project/main/deploy/setup.sh | bash
```

または手動でダウンロードして実行：

```bash
wget https://raw.githubusercontent.com/btec-hiroshima-ss/oripo-project/main/deploy/setup.sh
chmod +x setup.sh
./setup.sh
```

完了後は**ログアウト＆ログイン**して docker グループを反映してください。

---

## 初回デプロイ

`setup.sh` 実行後、ログアウト＆ログインしてから：

```bash
cd oripo-project/deploy
cp .env.example .env.production
vi .env.production  # 本番用の値を設定
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
