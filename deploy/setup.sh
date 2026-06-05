#!/bin/bash
set -e

# 本番サーバー初期セットアップスクリプト（Ubuntu Server 18）
# 実行後はログアウト＆ログインが必要

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

echo "=== git セットアップ ==="
git config --global credential.helper store

echo "=== リポジトリ取得（deploy/のみ）==="
git clone --filter=blob:none --sparse https://github.com/btec-hiroshima-ss/oripo-project.git
cd oripo-project
git sparse-checkout set deploy

echo ""
echo "完了。次の手順を実行してください："
echo "  1. ログアウト＆ログイン（dockerグループ反映）"
echo "  2. cd oripo-project/deploy"
echo "  3. cp .env.example .env.production && vi .env.production"
echo "  4. ./deploy.sh"
