#!/bin/bash
set -e

# サーバー初期セットアップスクリプト（Ubuntu Server 18）
# 事前に git clone でリポジトリを取得してから実行すること
# 関連ドキュメント: docs/04_operation/SERVER.md

echo "=== パッケージ更新 ==="
sudo apt-get update

echo "=== 依存パッケージインストール ==="
sudo apt-get install -y \
  apt-transport-https \
  ca-certificates \
  curl \
  gnupg-agent \
  software-properties-common

echo "=== Docker 公式 GPG キー追加 ==="
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -

echo "=== Docker リポジトリ追加 ==="
sudo add-apt-repository \
  "deb [arch=amd64] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) \
  stable"

echo "=== Docker インストール ==="
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io

echo "=== docker compose プラグインインストール ==="
sudo apt-get install -y docker-compose-plugin

echo "=== Docker 自動起動設定 ==="
sudo systemctl enable docker
sudo systemctl start docker

echo "=== 現ユーザーを docker グループに追加 ==="
sudo usermod -aG docker $USER

echo "=== Cockpit インストール ==="
sudo apt-get install -y cockpit
sudo systemctl enable cockpit.socket
sudo systemctl start cockpit.socket

echo "=== Cockpit root ログイン禁止 ==="
sudo mkdir -p /etc/cockpit
echo "root" | sudo tee /etc/cockpit/disallowed-users

echo "=== cockpit-navigator（ファイルマネージャー）インストール ==="
NAVIGATOR_DEB=$(curl -s https://api.github.com/repos/45Drives/cockpit-navigator/releases/latest \
  | grep browser_download_url | grep "_all.deb" | cut -d '"' -f 4)
curl -Lo /tmp/cockpit-navigator.deb "$NAVIGATOR_DEB"
sudo dpkg -i /tmp/cockpit-navigator.deb
rm /tmp/cockpit-navigator.deb

echo "=== スワップ設定（2GB） ==="
if [ ! -f /swapfile ]; then
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
  # スワップ使用率を控えめに（サーバー向け設定）
  echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
  sudo sysctl -p
  echo "スワップ設定完了"
else
  echo "スワップファイルは既に存在します（スキップ）"
fi

echo ""
echo "完了。"
echo "次の手順を実行してください："
echo "  1. scripts/setup-security.sh（本番）または scripts/setup-security-dev.sh（開発）を実行"
echo "  2. sudo reboot"
echo "  3. Cockpit: https://<サーバーIP>:9090 にブラウザでアクセス"
echo "     ユーザー: Ubuntu インストール時に作成したユーザーでログイン"
echo "  4. cd $(dirname "$0") && ./deploy.sh"
