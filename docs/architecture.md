# アーキテクチャ設計書

プロジェクト: Oripo（AIPO リプレース）
作成日: 2026-06-17
ステータス: **ドラフト**

---

## 1. システム構成概要

```
[ユーザー（ブラウザ）]
        ↓ HTTPS
[Cloudflare CDN / Tunnel]
        ↓
[Ubuntu Server 18]
  └─ Docker
       ├─ app コンテナ（Next.js）: port 3000
       └─ db コンテナ（PostgreSQL）: port 5432（外部非公開）
```

---

## 2. 技術スタック

### 選定理由

| 技術 | 選定理由 |
|---|---|
| Next.js 15 / TypeScript | モダンなフルスタックフレームワーク。App Router による SSR・API Route の一元管理。スキルアップ教材としても適切。 |
| PostgreSQL | 現行 AIPO と同一 DB。データ移行コストを最小化できる。 |
| Docker / docker compose | サーバー移行時の再現性確保。ローカルと本番の環境差異を吸収。 |
| Cloudflare（CDN・Tunnel） | 無料プランで HTTPS・DDoS 対策・外部公開を一括対応。 |
| GHCR（GitHub Container Registry） | GitHub Actions と連携しやすく、無料枠で運用可能。 |

### バージョン

| 技術 | バージョン |
|---|---|
| Next.js | 15 |
| TypeScript | 最新安定版 |
| Node.js | 20 |
| PostgreSQL | 最新安定版 |

---

## 3. アプリケーション構造

### ディレクトリ構成（src/）

Next.js App Router の標準構成に従う。

```
src/
  app/              # ページ・レイアウト（App Router）
  components/       # 再利用可能な UI コンポーネント
  lib/              # DB アクセス・ユーティリティ
  types/            # TypeScript 型定義
```

### DB アクセス方針

- Server Components / Route Handler から直接 DB アクセス
- ORM: 未定（Prisma または Drizzle を検討）
- 接続情報は環境変数で管理

---

## 4. インフラ・デプロイ構成

### 本番サーバー

- OS: Ubuntu Server 18
- ローカル検証: VirtualBox または Mac + UTM で同環境を再現

> 📖 **サーバーセットアップ・運用手順**: [deploy/README.md](../deploy/README.md) を参照。

### deploy/ 構成

```
deploy/
  docker-compose.prod.yml   # 本番用 compose
  deploy.sh                 # デプロイスクリプト（git pull + compose pull/up）
  setup-docker.sh           # Docker インストールスクリプト（初回のみ）
  .env.example              # 環境変数テンプレート
  README.md                 # セットアップ・運用手順
```

### Dockerfile 構成

| ファイル | 用途 |
|---|---|
| `Dockerfile` | ローカル開発用（`npm run dev`） |
| `Dockerfile.prd` | 本番用（マルチステージビルド・standalone） |

---

## 5. CI/CD フロー

### ビルド・デプロイ

```
git push → main マージ
  → GitHub Actions（.github/workflows/deploy.yml）
    → Dockerfile.prd でビルド
    → GHCR（ghcr.io/btec-hiroshima-ss/oripo-project:latest）へ push

本番サーバーで ./deploy.sh を実行
  → git pull
  → docker compose pull
  → docker compose up -d
```

### ユニットテスト（Vitest）

```
PR 作成 / push
  → GitHub Actions
    → npm run test
    → 失敗時はマージブロック（検討中）
```

---

## 6. セキュリティ設計

### 外部公開

- **Cloudflare Tunnel 利用**（推奨）: サーバーのポート開放不要。Cloudflare 経由のみアクセス可。
- **Cloudflare CDN のみ**（代替）: Cloudflare の IP のみ受け付ける設定にすることで直接アクセスを遮断。

### ファイアウォール

| 方向 | 設定方針 |
|---|---|
| INPUT | 社内からの接続（SSH 等）以外は全遮断 |
| OUTPUT | Git・Docker（GHCR）以外は原則遮断 |

### WAF

- ModSecurity が有力候補（リバースプロキシコンテナ内に配置）
- 複雑化するため現時点では保留。運用安定後に検討。

### アプリケーションセキュリティ

- 認証: セッション管理（サーバーサイド）
- 通信: HTTPS（Cloudflare が自動提供）
- XSS・CSRF・SQL インジェクション対策
- パスワード: SHA-1 + Base64（AIPO と同アルゴリズム、移行時にそのままコピー）
