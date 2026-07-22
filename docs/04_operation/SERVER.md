# 本番サーバー セットアップ・運用手順

関連スクリプト:

| スクリプト | 用途 |
|---|---|
| `scripts/setup-server.sh` | Docker・GUI のインストール（初回のみ） |
| `scripts/setup-security.sh` | ファイアウォール・xrdp 設定（本番用） |
| `scripts/setup-security-dev.sh` | ファイアウォール・xrdp 設定（ローカル検証用） |
| `deploy.sh` | デプロイ（git pull → docker compose up） |

## 前提条件

- Ubuntu Server 18 以上
- GitHub の Personal Access Token（`repo` スコープ）
  - 発行: GitHub > Settings > Developer settings > Personal access tokens

---

## サーバー初期セットアップ（初回のみ）

### 1. GitHub 認証 & リポジトリ取得

```bash
git config --global credential.helper store
git clone https://github.com/btec-hiroshima-ss/oripo-project.git
# ユーザー名と PAT を入力（以降は自動保存）
cd oripo-project
```

### 2. サーバーセットアップ

```bash
./scripts/setup-server.sh
sudo reboot
```

### 3. セキュリティセットアップ

再起動後：

```bash
cd oripo-project

# 本番サーバー（社内LANからのみRDP許可）
./scripts/setup-security.sh

# ローカル検証環境（VirtualBox等・192.168.x.xからRDP許可）
./scripts/setup-security-dev.sh
```

- UFW（ファイアウォール）を有効化し、受信を全拒否・RDP（3389）のみ許可
- xrdp をインストール・自動起動設定（社内リモートデスクトップ接続用）

### 4. 初回デプロイ

再起動後：

```bash
cd oripo-project
cp .env.example .env.production
vi .env.production  # GHCR_USER・GHCR_TOKEN 等を設定
./deploy.sh
```

---

## デプロイ手順（更新時）

```bash
./deploy.sh
```

---

## 動作確認

```bash
# コンテナの状態確認
docker compose -f docker-compose.prod.yml ps

# ログ確認
docker compose -f docker-compose.prod.yml logs -f app
```

---

## 停止・再起動

```bash
# 停止
docker compose -f docker-compose.prod.yml down

# 再起動
docker compose -f docker-compose.prod.yml restart
```

---

## ロールバック

```bash
# 特定バージョンのイメージを指定して起動
docker compose -f docker-compose.prod.yml down
docker run -d ghcr.io/btec-hiroshima-ss/oripo-project:<タグ>
```

---

## GUI 管理（必要時のみ起動）

通常はサーバーモード（GUI なし）で動作する。管理作業が必要な場合のみ GUI を起動する。

Xubuntu デスクトップ（XFCE）のインストールとサーバーモードへの固定は `setup-server.sh` で自動的に行われる。

### GUI 起動・停止

```bash
# 管理作業時: GUI を起動
sudo systemctl start lightdm

# 作業終了後: GUI を停止してサーバーモードに戻す
sudo systemctl stop lightdm
```

---

## 管理ツール（リモートデスクトップ接続後にブラウザでアクセス）

サーバーにリモートデスクトップ（RDP）で接続し、サーバー上のブラウザから以下の URL にアクセスする。
外部からは直接アクセス不可（127.0.0.1 バインド）。

### pgAdmin（DB管理・バックアップ・リストア）

URL: `http://localhost:5050`

| 項目 | 値 |
|---|---|
| Email | `admin@oripo.com` |
| Password | `oripo` |

#### DB接続の登録（初回のみ）

1. 左ペインの「Servers」を右クリック →「Register」→「Server」
2. 「General」タブ: Name に任意の名前を入力
3. 「Connection」タブに以下を入力して「Save」

| 項目 | 値 |
|---|---|
| Host | `db` |
| Port | `5432` |
| Database | `aipo`（または `.env.production` の `DB_NAME`） |
| Username | `.env.production` の `DB_USER` |
| Password | `.env.production` の `DB_PASSWORD` |

#### DBリストア

1. 左ペインで対象データベースを右クリック →「Restore」
2. バックアップファイル（`backups/` 配下の `.dump.gz`）を選択して実行

---

## トラブルシューティング

### `git clone` で SSL エラー（server certificate verification failed）

新規インストール直後にタイムゾーンがずれていると SSL 証明書の有効期限チェックが失敗します。

```bash
date  # 時刻を確認
sudo timedatectl set-timezone Asia/Tokyo
sudo timedatectl set-ntp true  # NTP 自動同期を有効化
```

時刻が正しくなったら再度 `git clone` してください。

### `unauthorized` / `denied` エラー（docker pull 時）

PAT に `read:packages` スコープが不足しています。
- GitHub > Settings > Developer settings > Personal access tokens
- 対象の PAT を編集 → `read:packages` を追加して保存
