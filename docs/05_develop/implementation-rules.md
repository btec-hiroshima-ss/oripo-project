# 実装規約

## コメント規約

**保守性を重視したコメントを積極的に残すこと。**

コードを読む人が「なぜこう書いたのか」を理解できるようにすることが目的。

### 書くべきコメント

- **なぜそうしたか（WHY）** — 制約・仕様上の理由・回避策の意図
- **非自明な挙動** — 読んだだけでは気づかない副作用・依存関係
- **Next.js / React の仕組みによる制約** — `Suspense` が必要な理由・Server Component の制限など
- **セクション区切り** — JSX の中で役割が変わる箇所（フォーム・エラー表示・ボタンなど）

### 書かなくていいコメント

- コードを読めばわかる「何をしているか（WHAT）」
- 変数名・関数名で伝わること

### 例

```tsx
// useTransition: ログイン処理中に UI をブロックせず isPending フラグを取得する
const [isPending, startTransition] = useTransition()

// フォームエリア: LoginForm は useSearchParams を使うため Suspense が必要
<Suspense>
  <LoginForm />
</Suspense>

// 認証前に訪問しようとしていたページへ戻す（なければホームへ）
const redirectTo = searchParams.get('redirect') ?? '/'
```

---

## 定数

ファイル内で複数箇所から参照される文字列・数値は、ファイル上部（import の直後）で定数として定義する。

- 命名は `UPPER_SNAKE_CASE`
- **WHY コメントを必ず付ける** — 何の定数かだけでなく、なぜ分離したかを残す

```tsx
// DroppableColumn の id 生成（`col-0`, `col-1`, ...）と dragEnd 時の列ドロップ判定で共用するプレフィックス
const COL_DROP_PREFIX = 'col-'

// 後でスライスで列インデックスを取り出す: overId.slice(COL_DROP_PREFIX.length)
```

マジックナンバーや繰り返し登場するリテラルは、ロジックの中に直書きせず必ず定数化すること。

---

## コンポーネント設計

判断ルール:

- **DB アクセス・データ取得するコンポーネント** → Server Component
- **それ以外** → `'use client'`（Client Component）

```
page.tsx（Server Component）
  → DB アクセスしてデータ取得
  → 子コンポーネントにデータを渡す
       ├─ 表示コンポーネント（'use client'）
       └─ 動くUIコンポーネント（'use client'）
```

- Route Handler（`/api/*`）は外部連携が発生した場合のみ使用する（基本不要）

## ファイル構成

```
src/
  app/
    {機能名}/
      page.tsx      ← Server Component（src/lib/ の関数を呼ぶだけ）
      actions.ts    ← Server Actions（更新・作成・削除）
      {Component}.tsx  ← 'use client' コンポーネント
  lib/
    db.ts           ← DB接続
    auth.ts         ← 認証・セッション管理
    migrator.ts     ← マイグレーション
    {機能名}.ts     ← DBクエリ関数（例: schedule.ts / user.ts）
```

- `src/lib/{機能名}.ts` にDBクエリ関数をまとめる（SQLをコンポーネントに書かない）
- `page.tsx` は `src/lib/` の関数を呼ぶだけにする
- 将来的に外部APIが必要になった場合は `app/api/` に Route Handler を追加し、同じ `src/lib/` の関数を再利用する

## テスト方針

**ユニットテスト（Vitest）はモックを使う。**

```ts
// src/lib/ の関数をモックして、コンポーネント・Server Actions をテストする
vi.mock('@/lib/schedule', () => ({
  getMySchedules: vi.fn().mockResolvedValue([mockSchedule])
}))
```

**この方針を採用した理由:**

- 実 DB を使ったテストはテストデータの管理・CI設定・テスト間の干渉対策など学習コストが高い
- Oripo はスキルアップ教材としての側面もあり、初学者が自力でテストを書き・読める状態を維持することを優先する
- Claude に依存したテスト生成を前提にしない（将来 Claude が使えない環境でも保守できるシンプルさを保つ）

**テストの種類:**

| 種類 | ツール | 実行タイミング | 対象 |
|---|---|---|---|
| ユニットテスト | Vitest + モック | CI 自動実行 | `src/lib/` の関数 |
| 最終確認 | 人間が手動 | ページ完成時 | 仕様書の受け入れ条件をチェックリストとして使う |

## DB クエリ

- N+1 クエリを避ける（ループ内でクエリを発行しない）
- 一覧取得は必ず LIMIT でページングする
- JOIN が複雑になる場合はクエリを分割して可読性を優先する

## 認証

- 認証ロジックは `src/lib/auth.ts` に集約する
- セッション確認が必要なページは `src/lib/auth.ts` の関数を呼び出す（散らばせない）

## ログ出力

### 基本ルール

- `logger` は `@/lib/logger` からインポートする
- **サーバーサイド専用**（Server Component・Server Actions・middleware・`src/lib/`）。Client Component には書かない
- ログには必ず `event` フィールドを含める（検索・集計のキーになる）

```ts
import { logger } from '@/lib/logger'

// 第1引数: 構造化データ（event 必須）
// 第2引数: 人間向けの説明メッセージ
logger.info({ event: 'auth.login.success', loginName, userId }, 'ログイン成功')
logger.warn({ event: 'auth.login.failure', loginName }, 'ログイン失敗: 認証情報不一致')
```

### ログレベル

| レベル | 用途 | 例 |
|---|---|---|
| `info` | 正常系の重要イベント | ログイン成功・ログアウト |
| `warn` | 失敗・セキュリティ上の異常 | ログイン失敗・ロックアウト・未認証アクセス |
| `error` | 予期しないエラー・例外 | DB接続失敗・外部API障害 |

- `debug` は本番では出力しない（`LOG_LEVEL` 環境変数で制御）
- ルーティング・静的ファイル配信など高頻度の正常リクエストは記録しない

### event フィールドの命名規則

`{ドメイン}.{アクション}[.{結果}]` の形式で統一する。

```
auth.login.success
auth.login.failure
auth.login.locked_out
auth.login.disabled
auth.logout
auth.lockout
auth.unauthorized
schedule.create
schedule.delete
```

### 含めてよいデータ・含めてはいけないデータ

**含めてよい:**
- `loginName`（ログイン名）
- `userId`（数値ID）
- `pathname`（リクエストパス）
- エラーコード・ステータスコード

**含めてはいけない:**
- パスワード・ハッシュ値
- セッショントークン・Cookie値
- 個人情報（氏名・メールアドレス・生年月日など）

### ログファイル

- 出力先: stdout（`docker compose logs app`）と `/var/log/app/app.YYYY-MM-DD.log`（同時）
- 日次ローテーション（pino-roll）
- 30日分のバックアップを `backups/logs/` に保持（バックアップコンテナが毎日3時に実行）

## 依存パッケージのバージョン管理

- 開発中は `^` 付き（例: `"next": "^15.3.2"`）でよい
- **リリース時は `^` を外してバージョンを固定する**（例: `"next": "15.3.2"`）
- 理由: `^` のままだとマイナーアップデートで意図せず破壊的変更が入ることがある（Next.js 15.3 → 15.5 で `instrumentationHook` の型が消えてビルドが壊れた事例あり）
- セキュリティアップデートが必要な場合は意図的にバージョンを上げてテストしてからリリースする
