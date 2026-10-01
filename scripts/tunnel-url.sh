#!/bin/bash
# Cloudflare Quick Tunnel の現在の公開 URL を表示する。
# 使い方: ./scripts/tunnel-url.sh [--wait 秒]
#   --wait を付けると URL がログに出るまで最大その秒数待つ（tunnel 起動直後・deploy.sh から使う）
# URL は tunnel コンテナが起動し直すたびに変わる。restart では同じコンテナのログに古い URL が残るため、
# 現在のコンテナが起動した時刻以降のログだけを見る。
# 公開 URL は「単語-単語-….trycloudflare.com」の形。接続失敗時のログに出る api.trycloudflare.com を
# 拾わないよう、ハイフンを含むホスト名だけを対象にする
# 関連ドキュメント: docs/04_operation/SERVER.md「外部公開（Cloudflare Quick Tunnel・暫定）」
set -e
cd "$(dirname "$0")/.."

COMPOSE="docker compose -f docker-compose.prod.yml"
wait_seconds=0
if [ "$1" = "--wait" ]; then wait_seconds="${2:-60}"; fi

find_url() {
  local id started
  id=$($COMPOSE ps -q tunnel 2>/dev/null)
  [ -n "$id" ] || return 0
  started=$(docker inspect -f '{{.State.StartedAt}}' "$id")
  docker logs --since "$started" "$id" 2>&1 \
    | grep -oE 'https://[a-z0-9]+(-[a-z0-9]+)+\.trycloudflare\.com' | tail -1
}

url=$(find_url)
elapsed=0
while [ -z "$url" ] && [ "$elapsed" -lt "$wait_seconds" ]; do
  sleep 2; elapsed=$((elapsed + 2))
  url=$(find_url)
done

if [ -z "$url" ]; then
  echo "公開 URL が見つかりません（tunnel が停止中、または起動に失敗しています）。確認:" >&2
  echo "  $COMPOSE ps tunnel" >&2
  echo "  $COMPOSE logs --tail 50 tunnel" >&2
  exit 1
fi
echo "$url"
