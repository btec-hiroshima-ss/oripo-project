#!/bin/bash
# Cloudflare Quick Tunnel による外部公開を開始（再開）し、新しい公開 URL を表示する。
# Quick Tunnel は起動のたびに URL が変わるため、利用者に新しい URL を案内すること。
# 関連ドキュメント: docs/04_operation/SERVER.md「外部公開（Cloudflare Quick Tunnel・暫定）」
set -e
cd "$(dirname "$0")/.."

docker compose -f docker-compose.prod.yml up -d tunnel
echo "公開 URL: $(./scripts/tunnel-url.sh --wait 60)"
