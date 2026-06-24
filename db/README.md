# データベース構成

## 概要

- **DBMS**: PostgreSQL 16
- **クエリビルダ**: Kysely + `pg`（ORM は使わない）
- **型生成**: `kysely-codegen`（DBスキーマから TypeScript 型を自動生成）

ORM を採用しないことで、SQL を直接書く設計とする。教材としての可読性・学習効果を重視。

## マイグレーション運用

マイグレーションは **Kysely Migrator** で管理する。ファイルは `src/lib/migrations/` に TypeScript で配置。

### 命名規則

`{YYYY-MM-DD}_{内容}.ts`（例: `2026-06-24_create_users.ts`）

### 自動適用

アプリ起動時（`npm run dev` / 本番起動）に `src/instrumentation.ts` が未適用のマイグレーションを自動で実行する。手動操作は不要。

### マイグレーションファイルの書き方

```ts
// src/lib/migrations/2026-06-24_create_users.ts
import type { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  // テーブル作成など
}

export async function down(db: Kysely<unknown>): Promise<void> {
  // ロールバック処理
}
```

### DBリセット

```bash
# ボリュームごと削除して再起動（データ消失するため注意）
docker compose down -v
docker compose up -d
```

## AIPO ダンプのリストア

移行元の AIPO DB（PostgreSQL 8.4.7）のダンプは個人情報を含むため git 管理外。AIPO の日次バックアップから取得すること。

### ローカルへの復元手順（DBeaver 使用）

```bash
# 1. DB コンテナ起動
docker compose up -d db

# 2. ダンプファイル（aipo_db_sql.dump.gz）を任意の場所に配置後、解凍
gunzip -k aipo_db_sql.dump.gz
```

3. DBeaver で `aipo_postgres` ユーザーとして `aipo` DB に接続し（接続設定は下記参照）、「SQLスクリプトの実行」で `aipo_db_sql.dump` を流す

```bash
# 4. スケジュールの日付範囲を確認（移行期間の判断に使う）
SELECT MIN(create_date), MAX(create_date) FROM eip_t_schedule;
```

### 注意点

- `aipo_postgres` ロールと `aipo` DB は docker compose 起動時に自動作成される（ロールの手動作成は不要）
- AIPO スキーマをベースに不要なレコード・カラムを削除して Oripo のスキーマとして使用する
- ダンプ内のパスワードは **SHA-1 + Base64（ソルトなし）**。Oripo も同じ方式を採用するため、そのまま移行可能

## DB 管理ツール（DBeaver）

DB の閲覧・クエリ実行・データ移行は **DBeaver Community Edition** を使用する。

### インストール

```bash
# Ubuntu（ローカル開発機・本番サーバー共通）
wget -O /tmp/dbeaver.deb https://dbeaver.io/files/dbeaver-ce_latest_amd64.deb
sudo dpkg -i /tmp/dbeaver.deb
```

### 接続設定

**ローカル開発**

| 項目 | 値 |
|---|---|
| Host | `localhost` |
| Port | `5432` |
| Database | `aipo` |
| User | `aipo_postgres` |
| Password | `aipo` |

**本番サーバー**

| 項目 | 値 |
|---|---|
| Host | `localhost`（サーバー上で直接実行） |
| Port | `5432` |
| Database | `aipo` |
| User | `.env.production` 参照 |

## ローカル接続情報（アプリ用）

接続文字列: `postgres://aipo_postgres:aipo@db:5432/aipo`
