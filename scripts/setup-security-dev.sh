#!/bin/bash
set -e

# セキュリティセットアップスクリプト・開発用（VirtualBox ローカル検証環境）
# setup-server.sh の実行・再起動後に実行すること
# 関連ドキュメント: docs/04_operation/SERVER.md

sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow from 192.168.0.0/16 to any port 3389    # RDP（ホストPC・VirtualBox等ローカル環境）
sudo ufw --force enable

echo ""
echo "完了。"
echo "ファイアウォール状態:"
sudo ufw status
