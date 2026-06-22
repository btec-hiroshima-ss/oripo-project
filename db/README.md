# データベース構成

## 概要

- **DBMS**: PostgreSQL 16
- **クエリビルダ**: Kysely + `pg`（ORM は使わない）
- **型生成**: `kysely-codegen`（DBスキーマから TypeScript 型を自動生成）

ORM を採用しないことで、SQL を直接書く設計とする。教材としての可読性・学習効果を重視。

## ディレクトリ構成

```
db/
  migrations/        # マイグレーション SQL（番号順で適用）
    001_xxx.sql
    002_xxx.sql
  README.md          # 本ファイル
```

## マイグレーション運用

### 命名規則

`{連番3桁}_{内容}.sql`（例: `001_create_users.sql`）

### 初回適用

PostgreSQL コンテナの `/docker-entrypoint-initdb.d/` に `migrations/` をマウントしているため、コンテナ初回起動時に自動的に番号順で適用される。

### 追加マイグレーション

ボリュームをリセット（初回扱いに戻す）するか、手動で適用する。

```bash
# ボリュームリセット（データ消失するため注意）
docker compose down -v
docker compose up -d db

# 手動適用
docker compose exec db psql -U oripo -d oripo -f /docker-entrypoint-initdb.d/00X_xxx.sql
```

## AIPO ダンプファイル

移行元の AIPO DB（PostgreSQL 8.4.7）のダンプを `db/dump/` に格納している。

| ファイル | 形式 | 用途 |
|---|---|---|
| `aipo_db_sql.dump.gz` | プレーン SQL 圧縮 | `psql` でリストア |

### ローカルへの復元手順

```bash
# 解凍
gunzip -k db/dump/aipo_db_sql.dump.gz  # aipo_db_sql.dump が展開される

# aipo_postgres ロールと aipo DB を作成（oripo DB とは別に作る）
docker compose exec -T db psql -U oripo -d postgres \
  -c "CREATE ROLE aipo_postgres SUPERUSER LOGIN PASSWORD 'aipo';" \
  -c "CREATE DATABASE aipo OWNER aipo_postgres;"

# ダンプをリストア
cat db/dump/aipo_db_sql.dump | \
  docker compose exec -T db psql -U aipo_postgres -d aipo
```

### 注意点

- **復元先は `aipo` DB**（`oripo` DB と混在させない）
- `aipo_postgres` ロールが存在しないとリストア時にエラーになる
- AIPO スキーマはそのまま Oripo には使わない。データ移行スクリプトで `aipo` → `oripo` へ変換する
- ダンプ内のパスワードは **SHA-1 + Base64（ソルトなし）**。Oripo も同じ方式を採用するため、そのまま移行可能
- ダンプにはユーザーの氏名・メールアドレス等の個人情報が含まれる。取り扱いに注意

## ローカル接続情報（開発用）

| 項目 | 値 |
|---|---|
| ホスト | `db`（コンテナ間）/ `localhost`（ホスト→コンテナ） |
| ポート | 5432 |
| ユーザー | oripo |
| パスワード | oripo_dev |
| DB名 | oripo |

接続文字列: `postgres://oripo:oripo_dev@db:5432/oripo`
