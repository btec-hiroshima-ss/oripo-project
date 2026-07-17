# プロジェクト管理

## リポジトリ

**btec-hiroshima-ss/oripo-project** — このリポジトリ（開発環境・インフラ・アプリ・ドキュメント一式）

ローカルパス: `/workspace`（claudeコンテナ内）

## GitHub操作方法

GitHub MCPは使用しない。**GitHub CLI（`gh`）を使用**すること。

```bash
# リポジトリ操作
gh repo view btec-hiroshima-ss/oripo-project

# Projects確認
gh project list --owner btec-hiroshima-ss
gh project item-list 1 --owner btec-hiroshima-ss

# Issue操作
gh issue list -R btec-hiroshima-ss/oripo-project
gh issue view <number> -R btec-hiroshima-ss/oripo-project

# GraphQL（Projects詳細取得など）
gh api graphql -f query='...'
```

## 進捗管理

プロジェクトの進捗は **GitHub Projects**（Oripo_project / Project #1）で管理。

## ディレクトリ構成

| パス                    | 内容                                    |
| ----------------------- | --------------------------------------- |
| shareDir/               | 一時参照ドキュメント置き場（git管理外） |
| .claude/                | Claude設定・MCP設定（settings.json）    |
| .devcontainer/          | Dev Container設定                       |
| docker/claude/          | claudeコンテナ用Dockerfile              |
| docker-compose.yml      | ローカル開発環境（claude + app + db）   |
| docker-compose.prod.yml | 本番サーバー用 compose                  |
| scripts/                | セットアップ・デプロイスクリプト        |

### ドキュメント構成

| パス                  | 内容                         |
| --------------------- | ---------------------------- |
| docs/01_current/      | 現行AIPO調査・仕様書         |
| docs/02_requirements/ | 要件定義                     |
| docs/03_migration/    | 移行計画                     |
| docs/04_operation/    | 環境構築・サーバー運用手順   |
| docs/05_develop/      | 実装フロー・コーディング規約 |

### プロジェクト構成

| ディレクトリ   | 内容                              |
| -------------- | --------------------------------- |
| specs/         | 新システム仕様書（SDD・Markdown） |
| src/           | 実装（Phase5以降）                |
| db/migrations/ | マイグレーションSQL               |

## Tech Stack

- フロントエンド: Next.js 15（TypeScript、App Router）
- デプロイ: GHCR（main マージ → イメージpush）
- CI/CD: `.github/workflows/deploy.yml`（mainマージ時にGHCRへpush）
- Dockerfile: `Dockerfile`（ローカル開発用）/ `Dockerfile.prd`（本番用マルチステージ）
- ローカル開発: `docker-compose.yml`（プロジェクトルート）
- 本番: `docker-compose.prod.yml` / `deploy.sh` / `scripts/setup-server.sh`
- サーバーOS: Ubuntu Server 18

## 参照ドキュメント

一時的な参照資料は `/workspace/shareDir/` に置かれている場合がある。タスクに関連しそうなファイルがあれば参照すること。

## DB調査

`.claude/settings.json` に PostgreSQL MCP（`@modelcontextprotocol/server-postgres`）が設定されており、`aipo` DB に直接クエリを実行できる。スキーマ調査・データ確認・移行検討などに活用すること。

```
接続先: postgres://aipo_postgres:aipo@db:5432/aipo
```

## AIPOソースコード

AIPOのソースコードは GitHub のパブリックリポジトリで公開されている。DBスキーマの詳細・独自エンコーディングのデコードロジック・テーブル間の関連など、ソース調査が必要な場合は `gh` コマンドで参照すること。

```
https://github.com/arkjun/aipo
```

```bash
# ファイル検索例
gh api repos/arkjun/aipo/git/trees/master --jq '.tree[].path' | grep -i schedule

# ファイル内容取得例
gh api repos/arkjun/aipo/contents/jetspeed/src/main/java/org/apache/jetspeed/... --jq '.content' | base64 -d
```

---

# 開発ルール

## ブランチ戦略

**現在: Phase 5（実装フェーズ）**

- `main`: リリース済み・安定版
- `develop`: 開発の集約先（`main` から派生）
- 作業ブランチ: `feature/issue-{番号}-{内容}` → PR → `develop`
- リリース時: `develop` → PR → `main`

> `develop` ブランチが存在しない場合は `git checkout -b develop main && git push -u origin develop` で作成すること。

## コミットメッセージ規約

- 日本語で記述
- プレフィックスなし（例: `ログイン機能を追加`、`スケジュール表示のバグを修正`）

## タスク管理

- **1 Issue = 1タスク** = Claudeへの指示単位
- Issue の階層ルール:
  - **親Issue**（Phase単位）: 人間が作成
  - **子Issue**（機能・タスク単位）: 人間が作成
  - **子の子Issue**（サブタスク）: Claudeが作成可
- **Issue の作成・クローズ**: 人間のみが行う
- **PR の作成**: Claude が行う（Issueに紐づける）
- 作業ブランチ・PRはIssueに紐づける（変更理由の履歴として残す）

## 作業フロー

**ファイルの編集・保存は確認不要。**

Issue を受領したら以下のフローで進める。人間レビューは最後（ステップ 6 の PR）のみ。

---

### ステップ 1: 仕様書の作成・確認

- `develop` から `feature/issue-{番号}-{内容}` ブランチを切る
- 仕様書がない場合: `specs/{機能名}.md` を新規作成（下記テンプレート参照）
- 既存の場合: 現実装・Issue の内容と照らして差異を修正
- 必ず要件定義書（`docs/02_requirements/requirements.md`）と AIPO の現行仕様（`docs/01_current/`・AIPO ソースコード）を確認してから設計すること
- 要件定義書の記載が優先。記載がない場合のみ AIPO 準拠とする

### ステップ 2: 仕様書レビュー（別エージェント）

`/spec-review` を実行する（`.claude/commands/spec-review.md`）。指摘があれば修正してから次へ。

> **確認の優先順位**: 要件定義書（`docs/02_requirements/requirements.md`）＞ AIPO 仕様。要件定義書に記載がある事柄はそちらが最優先。記載がない場合のみ AIPO 準拠とする。

### ステップ 3: 実装・テスト

- `/check-implementation` で規約を確認してから着手すること
- 実装と同時にテストコード（Vitest）も作成する（`src/**/*.test.ts` に同置）
- テストは仕様書の `## 受け入れ条件` をもとに生成する
- **テストファイルの作成は必須。テストなしでステップ 4 に進まないこと。**

### ステップ 4: コードレビュー（別エージェント）

`/code-review` を実行する（`.claude/commands/code-review.md`）。指摘があれば修正してから次へ。

### ステップ 5: ブラウザ動作確認（別エージェント）

`/browser-check` を実行する（`.claude/commands/browser-check.md`）。NG があれば修正する。仕様の解釈に疑問がある場合はユーザーに確認を取ること。

### ステップ 6: push & PR 作成（唯一の人間レビューポイント）

- `/spec-check` で仕様書・実装・テストの整合性を最終確認する
- push して PR を作成する（`develop` ← `feature/issue-{番号}-{内容}`）
- PR 本文に仕様書の要点・受け入れ条件・動作確認結果を記載する
- ユーザーにレビューを依頼する

### ステップ 7: ユーザーフィードバック対応

**対応フロー（この順序で進める）:**

1. **全コメントを把握する** — GraphQL で未解決スレッドを一覧し、内容を分類する
   - 質問・確認系 → 即座に返信（修正不要）
   - 修正必要系 → 次のステップでまとめて対応
2. **修正をまとめて実施する** — 複数の修正が必要な場合は一括で直してから push する（1件ごとにpushしない）
3. **全スレッドに返信する** — 修正内容を説明して返信。修正不要なコメントも含め、すべてのスレッドに返信する
4. **スキルを再実行する** — 修正内容に応じて以下を判断する（修正が軽微でも必ず実施する）
   - コードを変更した場合: `/check-implementation`（規約違反がないか確認）
   - コードを変更した場合: `/code-review`（品質確認）
   - 仕様書を変更した場合: `/spec-review`（要件定義書・AIPO仕様との整合性確認）
   - 仕様書・型・受け入れ条件を変更した場合: `/spec-check`
   - UI に変更を加えた場合: `/browser-check`

- PR のインラインコメントに **GraphQL で返信**する（`addPullRequestReviewThreadReply` mutation）
- 修正完了後はステップ 3 から再開する

**返信文に Claude であることを明記する:**  
返信の末尾に必ず以下を付ける（誰が返信したか一目でわかるように）。

```
---
*🤖 Claude による自動返信*
```

**pending review でブロックされた場合:**  
GitHub は1ユーザーが PR に持てる pending review が1つだけという制限がある。返信 API が `user_id can only have one pending review` エラーになった場合は、ユーザーに「GitHub UI でドラフトレビューを Submit してください」と依頼し、Submit 後に返信を再開すること。新しいコメントは全返信が完了してから投稿する。

---

**全般的な注意:**

- 既存ブランチで作業を始める前に PR がマージ済みでないか確認すること。マージ済みの場合は `develop` から新しいブランチを切り直す

## 実装規約

コンポーネントの実装を始める前に `/check-implementation` を実行して規約を確認すること。

規約の詳細は `docs/05_develop/implementation-rules.md` を参照。

**コメントは保守性を重視して積極的に残すこと。**（詳細は `docs/05_develop/implementation-rules.md` の「コメント規約」参照）

- なぜそう書いたか（WHY）・非自明な挙動・Next.js/React の制約を説明するコメントを残す
- コードを読めばわかる「何をしているか（WHAT）」は書かない

**実装前に必ず以下の両方を確認すること:**

1. **仕様書** (`specs/{機能名}.md`) — 機能要件・API・データモデル・受け入れ条件
2. **要件定義書** (`docs/02_requirements/requirements.md`) — 全体方針・非機能要件・モバイル対応仕様（`### 2.11 モバイル対応` にスマホ版モックアップあり）

### UIデザインルール

仕様書の `## モックアップ` に画像がある場合、**必ず `Read` ツールで画像を開いて確認してから実装すること。**

- 色・レイアウト・アイコン・フォントサイズ・余白・角丸をモックアップに忠実に再現する
- 自己流のデザインを加えない
- 実装後は画面を確認し、モックと見比べて差異がないか必ずチェックする

### レスポンシブ対応（必須）

**全画面は必ずレスポンシブ対応すること。**（要件定義書 `### 2.11 モバイル対応` 参照）

- モバイル（スマートフォン）を含む全デバイスで正常に表示・操作できること
- PC 版と同一 URL・同一コードベース（レスポンシブデザイン）
- スマホ版のレイアウト・ナビゲーション方針は `specs/images/スマホWEB版.png` を必ず確認すること（`docs/02_requirements/mockups/` は旧版）
- フォームの `<input>` はフォントサイズを 16px 以上にする（`text-base` または `text-base sm:text-sm`）。14px 未満だと iOS Safari が入力時に自動ズームする
- 仕様書の `## 機能要件` に `### レスポンシブ対応` セクションを追加して、ブレークポイントごとの挙動を記載すること
- 実装後は chrome-devtools MCP でモバイルサイズ（375px 等）にリサイズして確認すること

### ブラウザ動作確認

UI の確認・デバッグが必要な場合は **chrome-devtools MCP でブラウザを操作**すること。

- アプリURL（chrome コンテナから）: **`http://host.docker.internal:3000`** を使うこと
- `navigate_page` でページ遷移、`take_screenshot` でスクリーンショット、`fill_form` / `click` でフォーム操作ができる
- `http://app:3000` は `.app` TLD の HSTS 制約で使えないため禁止

**開発用ログイン情報:**

| 項目       | 値       |
| ---------- | -------- |
| ユーザー名 | `Rescho` |
| パスワード | `rescho` |

## Claude 依存に関する方針

**Claude が将来使えなくなることを前提に開発する。**

- コードは Claude なしでも読める・書けるシンプルさを保つ
- テストは初学者が自力で書き・読めるレベルに抑える（モックを使う理由）
- 仕様書・実装規約・フロードキュメントを常に最新に保ち、Claude がいなくても開発を継続できる状態を維持する
- Claude に頼りすぎず、実装の意図・判断理由はドキュメントやコメントに残す

## AIPO準拠方針（重要）

**優先順位: 要件定義書 ＞ AIPO仕様 ＞ 独自判断**

- **要件定義書**（`docs/02_requirements/requirements.md`）に記載がある事柄はそちらが最優先
- 要件定義書に記載がない場合は AIPO の現行仕様に準拠する
- 両方から逸脱する場合のみ理由を仕様書に明記し、ユーザーに確認を取ること
- 仕様書を書く際は、まず要件定義書を確認し、次にAIPOの現行仕様（`docs/01_current/`・AIPOソースコード）を確認すること

### 最終テスト方針

**AIPOとOripoで同一操作を行い、GUIの挙動とDBレコードの両方が一致することを確認する。**

- 各機能の実装完了後、AIPOとOripoの両方で同じ操作を実施する
- **GUI比較**: 画面の表示内容・操作結果・エラーメッセージ等が一致しているか確認する
- **DBレコード比較**: 対応するテーブルのレコード内容・構造が一致しているか確認する（作成日時等の差異は除く）
- 不一致がある場合は仕様上の意図的な変更か否かを確認し、意図的でない場合はバグとして修正する

## 開発方針

- **手法**: シンプルSDD（Spec-Driven Development）
- **仕様書**: Markdownで記述 → 社内レビュー・合意 → Claudeが実装・テスト生成
- **テスト**:
  - ユニットテスト（Vitest）: 仕様書の受け入れ条件をもとにClaudeが生成。GitHub Actionsで自動実行。テストファイルはソースと同置（`schedule.ts` の隣に `schedule.test.ts`）。
  - 手動確認チェックリスト: `specs/checklists/{機能名}.md` に保存。`/generate-checklist` で自動生成。Vitest でカバーできない「ブラウザで目視確認が必要な項目」を操作手順・期待結果の形式で記載する。リリース前に人間が手元で操作しながら使う。
  - 最終確認: 人間が手動で実施。`specs/checklists/{機能名}.md` のチェックリストを使う。

## 仕様書（specs/）

### ディレクトリ構成

機能単位のフラット構成。1ファイルが大きくなった場合のみディレクトリに切り出す。

```
specs/
  images/          # モックアップ画像（Claude Designで作成）
  checklists/      # 手動確認用テストケース一覧（/generate-checklist で生成）
  login.md
  home.md
  schedule.md
  ...
```

### テンプレート

```markdown
# 機能名

## 概要

## モックアップ

## 機能要件

## API

## データモデル

## 受け入れ条件
```

- `## 受け入れ条件` をもとにClaudeがユニットテストを生成する
- `## モックアップ` には `images/` 配下の画像を配置（Claude Designで作成）
- `## データモデル` にはAIPO既存テーブルの利用・変更・新規追加を記載
