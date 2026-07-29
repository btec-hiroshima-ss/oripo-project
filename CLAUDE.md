# 🚨 絶対に守るルール

> **これを読み飛ばしてはならない。作業前に毎回確認すること。**

1. **`main`・`develop` への直接 push は禁止。** 緊急対応・コンフリクト解消を含むいかなる場合も、feature ブランチを切って PR を作成し、マージはユーザーが行う。
2. **push 前に、ブランチの PR がマージ済みでないか必ず確認する。** `gh pr list --head <branch> --state merged` で確認し、マージ済みなら `develop` から新しいブランチを切り直す。マージ済みブランチへの push は絶対に行わない。
3. **push 前に必ず `/spec-check` を実行する。** 「軽微だから」「急ぐから」という理由でスキップしない。
4. **PR コメントには全スレッドに返信する。** GraphQL（`addPullRequestReviewThreadReply` mutation）を使い、末尾に `---\n*🤖 Claude による自動返信*` を付ける。
5. **フィードバック対応でコードを変えたら正規フローを通す。** 変更が軽微でもスキップしない（下表参照）。
6. **Issue の作成・クローズは人間のみ行う。** Claude が作成できるのは「子の子 Issue」（サブタスク）のみ。
7. **GitHub MCP は使わない。`gh` コマンドを使う。**

---

# 作業フロー

**ファイルの編集・保存は確認不要。人間レビューはステップ 6 の PR のみ。**

| # | やること | ゲート（次へ進む前に必須） |
|---|---|---|
| 1 | `develop` からブランチを切り、`specs/*.md` を作成・更新する | — |
| 2 | `/spec-review` を実行する | 指摘ゼロになるまで修正 |
| 3 | `/check-implementation` を確認してから実装・テストを書く | **テストなしでステップ 4 に進まない** |
| 4 | `/code-review` を実行する | 指摘ゼロになるまで修正 |
| 5 | `/browser-check` を実行する（PC + モバイル 375px） | NG ゼロになるまで修正 |
| 6 | `/spec-check` を実行 → push → PR 作成 → ユーザーにレビュー依頼 | **`/spec-check` をスキップしない** |
| 7 | フィードバック対応（下記手順を守ること） | 全スレッド返信完了まで次の push をしない |

## ステップ 7: フィードバック対応の手順

1. **全コメントを把握する** — GraphQL で未解決スレッドを一覧し、質問系・修正必要系に分類する
2. **修正をまとめて実施する** — 1件ごとに push しない
3. **全スレッドに返信する** — 修正不要なコメントも含め、すべてのスレッドに返信する
4. **正規フローを必ず通してから push する**

| 変更内容 | 実行するスキル |
|---|---|
| コードを変更した | `/check-implementation` → `/code-review` |
| UI を変更した | `/browser-check` |
| 仕様書を変更した | `/spec-review` |
| 仕様書・型・受け入れ条件を変更した | `/spec-check` |

**GraphQL 返信の注意:**
- `addPullRequestReviewThreadReply` mutation で返信する
- pending review でブロックされた場合（`user_id can only have one pending review` エラー）はユーザーに「GitHub UI でドラフトレビューを Submit してください」と依頼し、Submit 後に返信を再開する

---

# 実装規約

**優先順位: 要件定義書 ＞ AIPO仕様 ＞ 独自判断**

- 要件定義書（`docs/02_requirements/requirements.md`）を最初に確認する
- 記載がない場合のみ AIPO 仕様（`docs/01_current/`・AIPO ソースコード）に準拠する
- 両方から逸脱する場合は仕様書に理由を明記し、ユーザーに確認を取ること

**UIデザイン**
- モックアップは `specs/images/` が確定版（`docs/02_requirements/mockups/` は旧版、参照しない）
- 仕様書に画像がある場合は **必ず `Read` ツールで画像を開いてから実装する**
- モバイルレイアウトは `specs/images/スマホWEB版.png` を確認する
- `<input>` のフォントサイズは 16px 以上（`text-base`）— iOS Safari の入力時自動ズーム防止

**コメント規約**（詳細: `docs/05_develop/implementation-rules.md`）
- WHY（なぜそう書いたか）を残す。WHAT（何をしているか）は書かない
- 保守性を重視して積極的にコメントを残す

---

# プロジェクト情報

## ブランチ・コミット
- ブランチ名: `feature/issue-{番号}-{内容}` → PR → `develop`
- リリース時: `develop` → PR → `main`
- `develop` が存在しない場合: `git checkout -b develop main && git push -u origin develop`
- コミットメッセージ: 日本語、プレフィックスなし（例: `ログイン機能を追加`）
- 既存ブランチで作業開始前に PR がマージ済みでないか確認する。マージ済みなら `develop` から切り直す

## ディレクトリ構成

| パス | 内容 |
|---|---|
| `specs/` | 新システム仕様書（SDD） |
| `specs/images/` | モックアップ画像（確定版） |
| `specs/checklists/` | 手動確認チェックリスト |
| `src/` | 実装（Next.js App Router） |
| `db/migrations/` | マイグレーション SQL |
| `docs/01_current/` | 現行 AIPO 調査資料 |
| `docs/02_requirements/` | 要件定義書 |
| `docs/05_develop/` | 実装規約 |
| `shareDir/` | 一時参照ドキュメント（git 管理外） |

## ツール・環境
- **GitHub**: `gh` コマンドを使用（GitHub MCP 不使用）
- **DB**: PostgreSQL MCP で `postgres://aipo_postgres:aipo@db:5432/aipo` に直接クエリ可能
- **AIPO ソース**: `gh api repos/arkjun/aipo/contents/<path> --jq '.content' | base64 -d` で参照可能
- **ブラウザ**: chrome-devtools MCP、URL は `http://host.docker.internal:3000`（`http://app:3000` は HSTS 制約で禁止）
- **ログイン**: ユーザー名 `Rescho` / パスワード `rescho`
- **一時資料**: `/workspace/shareDir/` を確認する

## テスト方針
- ユニットテスト: Vitest、ソースと同置（`schedule.ts` → `schedule.test.ts`）
- テストは仕様書の `## 受け入れ条件` をもとに生成する
- 手動確認チェックリスト: `specs/checklists/{機能名}.md`（`/generate-checklist` で生成）

## 仕様書テンプレート

```markdown
# 機能名
## 概要
## モックアップ
## 機能要件
## API
## データモデル
## 受け入れ条件
```
