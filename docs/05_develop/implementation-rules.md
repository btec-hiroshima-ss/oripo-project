# 実装規約

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
