#!/bin/bash
set -e

# 本番デプロイスクリプト（git pull → docker compose pull/up）
# 関連ドキュメント: docs/04_operation/SERVER.md

cd "$(dirname "$0")"

# 環境変数を読み込む
set -a; source .env.production; set +a

# GHCR ログイン
echo $GHCR_TOKEN | docker login ghcr.io -u $GHCR_USER --password-stdin

# 最新の設定を取得（GHCR_TOKEN を使って認証）
git remote set-url origin https://${GHCR_USER}:${GHCR_TOKEN}@github.com/btec-hiroshima-ss/oripo-project.git
git pull

# ログディレクトリを事前作成（appuser が書き込めるよう 777 に設定）
# bind mount は Docker がディレクトリを作る前にホスト側ディレクトリが存在していないと root 所有になり
# コンテナ内の非 root ユーザー（appuser）が書き込めない。deploy.sh で先に作ることで回避する。
mkdir -p logs && chmod 777 logs

COMPOSE="docker compose -f docker-compose.prod.yml"

# 最新イメージをpullして再起動
$COMPOSE pull
# scripts/tunnel-stop.sh で外部公開を止めている（tunnel が停止中の）ときは、デプロイで勝手に公開を
# 再開しないよう tunnel 以外だけを起動する
if [ "$($COMPOSE ps -a --format '{{.State}}' tunnel 2>/dev/null)" = "exited" ]; then
  $COMPOSE up -d $($COMPOSE config --services | grep -vx tunnel)
  tunnel_stopped=1
else
  $COMPOSE up -d
fi

# 古いイメージを削除
docker image prune -f

# 公開 URL を表示する（Quick Tunnel は tunnel が起動し直すと URL が変わるため、毎回確認できるようにする）
if [ -n "$tunnel_stopped" ]; then
  echo "外部公開は停止中です（再開: ./scripts/tunnel-start.sh）"
elif url=$(./scripts/tunnel-url.sh --wait 60); then
  echo "公開 URL: $url"
else
  echo "公開 URL を取得できませんでした。./scripts/tunnel-url.sh で確認してください"
fi
