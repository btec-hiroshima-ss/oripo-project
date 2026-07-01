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

echo "=== GUI（Xubuntu デスクトップ）インストール ==="
sudo apt-get install -y xubuntu-desktop

echo "=== デフォルトをサーバーモードに固定（GUI 自動起動しない） ==="
sudo systemctl set-default multi-user.target

echo "=== xrdp インストール ==="
sudo apt-get install -y xrdp
sudo systemctl enable xrdp
sudo systemctl start xrdp

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
echo "  3. リモートデスクトップ（RDP）で <サーバーIP>:3389 に接続"
echo "  4. cd $(dirname "$0") && ./deploy.sh"
