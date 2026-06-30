#!/bin/bash
set -e

# セキュリティセットアップスクリプト（Ubuntu Server 18）
# setup-server.sh の実行・再起動後に実行すること

echo "=== xrdp インストール ==="
sudo apt-get update
sudo apt-get install -y xrdp

echo "=== xrdp 自動起動設定 ==="
sudo systemctl enable xrdp
sudo systemctl start xrdp

echo "=== UFW ファイアウォール設定 ==="
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 3389   # RDP（社内リモートデスクトップ接続用）
sudo ufw --force enable

echo ""
echo "完了。"
echo "ファイアウォール状態:"
sudo ufw status
