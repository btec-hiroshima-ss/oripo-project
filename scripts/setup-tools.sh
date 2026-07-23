#!/bin/bash
set -e

# 管理ツールインストールスクリプト
# lazydocker・DBeaver 等の管理ツールをインストールする。
# ツールの追加・更新時に再実行できる（べき等）。
# 基盤セットアップは setup-server.sh を先に実行すること。
# 関連ドキュメント: docs/04_operation/SERVER.md

echo "=== lazydocker インストール ==="
LAZYDOCKER_VERSION=$(curl -s "https://api.github.com/repos/jesseduffield/lazydocker/releases/latest" | grep -Po '"tag_name": "v\K[0-9.]+')
curl -Lo /tmp/lazydocker.tar.gz "https://github.com/jesseduffield/lazydocker/releases/latest/download/lazydocker_${LAZYDOCKER_VERSION}_Linux_x86_64.tar.gz"
tar xf /tmp/lazydocker.tar.gz -C /tmp lazydocker
sudo mv /tmp/lazydocker /usr/local/bin/lazydocker
rm /tmp/lazydocker.tar.gz
echo "lazydocker $(lazydocker --version 2>/dev/null || echo 'インストール済み')"

echo "=== DBeaver インストール ==="
wget -q -O /tmp/dbeaver.deb https://dbeaver.io/files/dbeaver-ce_latest_amd64.deb
sudo dpkg -i /tmp/dbeaver.deb || sudo apt-get install -f -y
rm /tmp/dbeaver.deb
echo "DBeaver インストール済み"

echo ""
echo "完了。"
