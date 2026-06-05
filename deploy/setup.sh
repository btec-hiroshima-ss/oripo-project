#!/bin/bash
set -e

# サーバーセットアップスクリプト（git clone 以降）
# 事前に setup-docker.sh の実行と GitHub 認証設定が必要

echo "=== リポジトリ取得 ==="
git clone https://github.com/btec-hiroshima-ss/oripo-project.git

echo ""
echo "完了。次の手順："
echo "  1. cd oripo-project/deploy"
echo "  2. cp .env.example .env.production && vi .env.production"
echo "  3. ./deploy.sh"
