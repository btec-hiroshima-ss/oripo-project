# 本番サーバー セットアップ・運用手順

関連スクリプト:

| スクリプト | 用途 |
|---|---|
| `scripts/setup-server.sh` | Docker・GUI・xrdp・swap のインストール（初回のみ） |
| `scripts/setup-tools.sh` | lazydocker・DBeaver 等の管理ツール（ツール変更時に再実行可） |
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
# 基盤（Docker・GUI・xrdp・swap）— 初回のみ
./scripts/setup-server.sh

# 管理ツール（lazydocker・DBeaver）— ツール追加・更新時も再実行可
./scripts/setup-tools.sh
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

## 外部公開（Cloudflare Quick Tunnel・暫定）

独自ドメインの発行許可が出るまでの暫定措置として、Cloudflare の **Quick Tunnel** で公開する（ドメイン取得後は #190 の名前付き Tunnel に移行する）。
`docker-compose.prod.yml` の `tunnel` コンテナが、サーバー内の `app:3000` を `https://<ランダム>.trycloudflare.com` として公開する。

- Cloudflare のアカウント・ドメイン・サーバーのポート開放はすべて不要（サーバーから Cloudflare へ外向きに接続する）
- HTTPS は Cloudflare が提供する。本番のログイン Cookie は `secure` のため、外部からは必ずこの URL でアクセスする
- `app` の 3000 番は `127.0.0.1` にのみ公開しているため、LAN から `http://<サーバーIP>:3000` では接続できない（意図した挙動）

### 公開 URL の確認・公開の停止と再開

`./deploy.sh` の最後に公開 URL が表示される。それ以外のときは次のスクリプトを使う。

```bash
cd oripo-project
./scripts/tunnel-url.sh     # 現在の公開 URL を表示（例: https://example-words-1234.trycloudflare.com）
./scripts/tunnel-stop.sh    # 外部公開を止める（アプリ・DB は動いたまま）
./scripts/tunnel-start.sh   # 外部公開を再開し、新しい URL を表示する（URL は変わる）
```

- 止めた状態は維持される。サーバーを再起動しても、`./deploy.sh` を実行しても、tunnel は起動しない（`restart: unless-stopped`、deploy.sh は tunnel が停止中なら tunnel 以外だけを起動する）

### URL が変わるタイミング（重要）

Quick Tunnel の URL は **tunnel コンテナが起動し直すたびに変わる**。変わったら利用者に新しい URL を案内する。

| 操作 | URL |
|---|---|
| `./deploy.sh`（アプリの更新） | 変わらない（tunnel はイメージ・設定が変わらない限り作り直されない） |
| サーバー再起動 | **変わる** |
| `docker compose -f docker-compose.prod.yml down` → `up -d`、`restart tunnel` | **変わる** |
| `./scripts/tunnel-stop.sh` → `./scripts/tunnel-start.sh` | **変わる** |
| `docker-compose.prod.yml` の `tunnel` の設定・イメージを変更してデプロイ | **変わる** |

URL を変えたくないときは、`app` だけを操作する（例: `docker compose -f docker-compose.prod.yml up -d --no-deps --force-recreate app`）。
`depends_on` は起動順を決めるだけで、`app` を作り直しても `tunnel` は作り直されない（Docker Compose v5.5 で確認、2026-10-01）。念のため `--no-deps` を付ける。
デプロイ後の URL は `./deploy.sh` の最後に表示されるので、前回と変わっていないか確認する。

### 制約（Cloudflare の Quick Tunnel の仕様）

- テスト・開発向けの機能で、稼働保証（SLA）は無い
- 同時に処理できるリクエストは 200 件まで
- Server-Sent Events（SSE）は使えない
- URL がランダムで、再起動のたびに変わる

社内向けの暫定運用としては許容するが、上記のため正式運用は名前付き Tunnel（独自ドメイン）で行う。

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

## 管理ツール

サーバーにリモートデスクトップ（RDP）で接続して使用する。

### DBeaver（DB管理・バックアップ・リストア）

`setup-tools.sh` で自動インストール済み。RDP 接続後にデスクトップから起動する。

#### DB接続の登録（初回のみ）

1. 「新しい接続」→「PostgreSQL」を選択
2. 以下を入力して「完了」

| 項目 | 値 |
|---|---|
| Host | `localhost` |
| Port | `5432` |
| Database | `.env.production` の `DB_NAME` |
| Username | `.env.production` の `DB_USER` |
| Password | `.env.production` の `DB_PASSWORD` |

#### DBリストア（新形式 `.dump`）

1. 対象データベースを右クリック →「ツール」→「リストア」
2. `backups/` 配下の `.dump` ファイルを選択して実行

#### DBリストア（旧形式 `.dump.gz`）

旧形式のバックアップは以下の CLI コマンドでリストアする：

```bash
docker compose -f docker-compose.prod.yml exec backup sh -c \
  'gunzip -c /backups/<ファイル名>.dump.gz | psql -h db -U $DB_USER $DB_NAME'
```

---

## トラブルシューティング

### Quick Tunnel の URL にアクセスできない

```bash
docker compose -f docker-compose.prod.yml ps tunnel        # tunnel が Up か
docker compose -f docker-compose.prod.yml logs --tail 50 tunnel
./scripts/tunnel-url.sh                                    # URL が変わっていないか
```

- サーバーから外向きの通信が社内ネットワークで遮断されていると接続できない。必要な通信先:
  - `api.trycloudflare.com`（HTTPS 443。URL の発行）
  - `*.argotunnel.com`（7844 番。UDP（QUIC）、使えない場合は TCP）
  - ログに `failed to request quick Tunnel`・`failed to connect` 等が出ていればネットワーク管理者に確認する
  - UDP だけが遮断されている場合は、`docker-compose.prod.yml` の `tunnel` の `command` に `--protocol http2` を追加すると TCP で接続する（設定変更なので URL は変わる）
- tunnel が動いているのに 502 になる場合は `app` が起動しているか確認する（`docker compose -f docker-compose.prod.yml ps app`）

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
