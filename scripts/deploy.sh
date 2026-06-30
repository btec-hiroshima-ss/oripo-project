#!/bin/bash
set -e

# 本番デプロイスクリプト（git pull → docker compose pull/up）
# 関連ドキュメント: docs/04_operation/SERVER.md

cd "$(dirname "$0")/.."

# 環境変数を読み込む
set -a; source .env.production; set +a

# GHCR ログイン
echo $GHCR_TOKEN | docker login ghcr.io -u $GHCR_USER --password-stdin

# 最新の設定を取得
git pull

# 最新イメージをpullして再起動
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d

# 古いイメージを削除
docker image prune -f
