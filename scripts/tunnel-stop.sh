#!/bin/bash
# Cloudflare Quick Tunnel による外部公開を止める（アプリ・DB は動かしたまま）。
# 止めた状態は維持される: restart: unless-stopped のためサーバー再起動後も起動せず、
# deploy.sh も tunnel が停止中なら起動しない。再開は scripts/tunnel-start.sh（URL は変わる）。
# 関連ドキュメント: docs/04_operation/SERVER.md「外部公開（Cloudflare Quick Tunnel・暫定）」
set -e
cd "$(dirname "$0")/.."

docker compose -f docker-compose.prod.yml stop tunnel
echo "外部公開を停止しました。再開するには ./scripts/tunnel-start.sh を実行してください（URL は変わります）。"
