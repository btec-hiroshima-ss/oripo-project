#!/bin/bash
set -e

# Docker インストールスクリプト（Ubuntu Server 18）
# 認証不要。サーバー初回セットアップ時に最初に実行する。

echo "=== パッケージ更新 ==="
sudo apt-get update

echo "=== 依存パッケージインストール ==="
sudo apt-get install -y \
  apt-transport-https \
  ca-certificates \
  curl \
  gnupg-agent \
  software-properties-common \
  git

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

echo ""
echo "完了。次の手順："
echo "  1. ログアウト＆ログイン or 再起動（dockerグループ反映）"
echo "  2. GitHub の認証設定（SSH キーまたは Personal Access Token）"
echo "  3. ./setup.sh を実行"
