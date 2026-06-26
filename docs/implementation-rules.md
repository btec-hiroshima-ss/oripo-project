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

## DB クエリ

- N+1 クエリを避ける（ループ内でクエリを発行しない）
- 一覧取得は必ず LIMIT でページングする
- JOIN が複雑になる場合はクエリを分割して可読性を優先する

## 認証

- 認証ロジックは `src/lib/auth.ts` に集約する
- セッション確認が必要なページは `src/lib/auth.ts` の関数を呼び出す（散らばせない）
