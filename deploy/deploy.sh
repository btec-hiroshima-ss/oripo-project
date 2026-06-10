#!/bin/bash
set -e

cd "$(dirname "$0")"

# 最新の設定を取得
git -C .. pull

# GHCRから最新イメージをpullして再起動
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d

# 古いイメージを削除
docker image prune -f
