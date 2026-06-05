# 本番サーバー セットアップ・運用手順

## 前提条件

- Ubuntu Server 18 以上

---

## サーバー初期セットアップ（初回のみ）

### 1. Docker インストール

認証不要。サーバーに直接コピーして実行してください。

```bash
chmod +x setup-docker.sh
./setup-docker.sh
```

完了後は**ログアウト＆ログイン**または**再起動**して docker グループを反映してください。

### 2. GitHub 認証設定

リポジトリがプライベートのため、git clone 前に認証設定が必要です。

```bash
git config --global credential.helper store
# 初回 clone 時にユーザー名と Personal Access Token を入力すると保存される
```

Personal Access Token は GitHub の Settings > Developer settings > Personal access tokens で発行してください（`repo` スコープが必要）。

### 3. リポジトリ取得

```bash
chmod +x setup.sh
./setup.sh
```

---

## 初回デプロイ

`setup.sh` 実行後：

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
