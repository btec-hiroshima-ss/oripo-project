#!/bin/bash
set -e

# Docker インストールスクリプト（Ubuntu Server 18）
# 事前に git clone でリポジトリを取得してから実行すること

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

echo "=== 現ユーザーを docker グループに追加 ==="
sudo usermod -aG docker $USER

echo "=== Docker 自動起動設定 ==="
sudo systemctl enable docker
sudo systemctl start docker

echo "=== GUI（XFCE）インストール ==="
sudo apt-get install -y xfce4 xfce4-goodies lightdm

echo "=== デフォルトをサーバーモードに固定（GUI 自動起動しない） ==="
sudo systemctl set-default multi-user.target

echo ""
echo "完了。再起動後に deploy.sh を実行してください："
echo "  sudo reboot"
echo "  cd $(dirname "$0") && ./deploy.sh"
