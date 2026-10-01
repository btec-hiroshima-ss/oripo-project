#!/bin/bash
# Cloudflare Quick Tunnel の現在の公開 URL を表示する。
# URL は tunnel コンテナが起動し直すたびに変わるため、起動ログから最新のものを取り出す。
# 公開 URL は「単語-単語-….trycloudflare.com」の形。接続失敗時のログに出る api.trycloudflare.com を
# 拾わないよう、ハイフンを含むホスト名だけを対象にする
# 関連ドキュメント: docs/04_operation/SERVER.md「外部公開（Cloudflare Quick Tunnel・暫定）」
set -e
cd "$(dirname "$0")/.."

url=$(docker compose -f docker-compose.prod.yml logs --no-log-prefix tunnel 2>/dev/null \
  | grep -oE 'https://[a-z0-9]+(-[a-z0-9]+)+\.trycloudflare\.com' | tail -1)

if [ -z "$url" ]; then
  echo "URL が見つかりません。tunnel コンテナの状態を確認してください:" >&2
  echo "  docker compose -f docker-compose.prod.yml ps tunnel" >&2
  echo "  docker compose -f docker-compose.prod.yml logs tunnel" >&2
  exit 1
fi
echo "$url"
