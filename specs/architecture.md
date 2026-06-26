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

- Server Component から直接 DB アクセス（Route Handler 経由は不要）
- クエリビルダ: **Kysely**（ORM は使わない。SQL を直接書く設計）
- 型生成: `kysely-codegen`（DB スキーマから TypeScript 型を自動生成）
- 接続情報は環境変数で管理（`DATABASE_URL`）

> コンポーネント設計・DBクエリ・認証の実装規約は [docs/implementation-rules.md](../docs/implementation-rules.md) を参照。

---

## 4. インフラ・デプロイ構成

### 本番サーバー

- OS: Ubuntu Server 18
- ローカル検証: VirtualBox または Mac + UTM で同環境を再現

> 📖 **サーバーセットアップ・運用手順**: [docs/SERVER.md](../docs/SERVER.md) を参照。

### 本番関連ファイル構成

```
（プロジェクトルート）
  docker-compose.prod.yml   # 本番用 compose
  deploy.sh                 # デプロイスクリプト（git pull + compose pull/up）
  setup-server.sh           # Docker インストールスクリプト（初回のみ）
  .env.example              # 環境変数テンプレート
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

- 通信: HTTPS（Cloudflare が自動提供）
- XSS・CSRF・SQL インジェクション対策
- パスワード: SHA-1 + Base64（AIPO と同アルゴリズム、移行時にそのままコピー）

### 認証・セッション管理

**フェーズ1（初期リリース）: Cookie 方式（iron-session）**

セッションデータを AES 暗号化して Cookie に保存する。サーバー側にセッションストアは不要。

```
ログイン  → セッションデータを暗号化 → Cookie に保存
リクエスト → Cookie を復号してユーザー情報取得（DB アクセスなし）
ログアウト → Cookie を削除
```

DB 移行時のリスクを最小化するためフェーズ1ではこの方式を採用する。認証ロジックは `src/lib/auth.ts` に集約し、後の差し替えに備える。

**Cookie 属性**

| 属性 | 値 | 目的 |
|---|---|---|
| `HttpOnly` | true | XSS による Cookie 窃取を防ぐ |
| `Secure` | true | HTTPS 通信時のみ送信 |
| `SameSite` | `Strict` | CSRF 攻撃を防ぐ |

- 有効期限: ログインから 8 時間（業務時間を考慮）

**フェーズ2（運用安定後）: DB セッション方式へ移行**

退職・異動者の即時ログアウトが必要になった段階で移行する。`src/lib/auth.ts` の差し替えのみでページ・ビジネスロジックへの影響はない。

### 実行プロセス

- コンテナ内を含む全プロセスを非ルートユーザーで実行
- `Dockerfile.prd` にて専用ユーザー（appuser）を作成し `USER appuser` で切り替え済み
