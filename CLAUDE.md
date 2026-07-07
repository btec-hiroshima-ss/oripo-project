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

| パス | 内容 |
|---|---|
| shareDir/ | 一時参照ドキュメント置き場（git管理外） |
| .claude/ | Claude設定・MCP設定（settings.json） |
| .devcontainer/ | Dev Container設定 |
| docker/claude/ | claudeコンテナ用Dockerfile |
| docker-compose.yml | ローカル開発環境（claude + app + db） |
| docker-compose.prod.yml | 本番サーバー用 compose |
| scripts/ | セットアップ・デプロイスクリプト |

### ドキュメント構成

| パス | 内容 |
|---|---|
| docs/01_current/ | 現行AIPO調査・仕様書 |
| docs/02_requirements/ | 要件定義 |
| docs/03_migration/ | 移行計画 |
| docs/04_operation/ | 環境構築・サーバー運用手順 |
| docs/05_develop/ | 実装フロー・コーディング規約 |

### プロジェクト構成

| ディレクトリ | 内容 |
|---|---|
| specs/ | 新システム仕様書（SDD・Markdown） |
| src/ | 実装（Phase5以降） |
| db/migrations/ | マイグレーションSQL |

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

**Phase 1〜4（ドキュメント整備中）**
- `main` ブランチのみ
- 作業ブランチ: `feature/issue-{番号}-{内容}` → PR → main

**Phase 5以降（実装開始時に切り替え）**
- `main`: リリース済み・安定版
- `develop`: 開発の集約先
- 作業ブランチ: `feature/issue-{番号}-{内容}` → PR → develop
- リリース時: develop → PR → main

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

`git push` の前に `/spec-check` を実行し、仕様書・実装・テストの整合性を確認すること。ズレがある場合はユーザーに確認を取ってから進む。

`git commit` / `git push` / `gh pr create` の前に必ず変更内容を提示してユーザーの確認を取ること。確認なしに実行しない。

既存ブランチで作業を始める前に、そのブランチの PR がマージ済みでないか確認すること。マージ済みの場合は main から新しいブランチを切り直す。

## 実装規約

コンポーネントの実装を始める前に `/check-implementation` を実行して規約を確認すること。

規約の詳細は `docs/05_develop/implementation-rules.md` を参照。

## Claude 依存に関する方針

**Claude が将来使えなくなることを前提に開発する。**

- コードは Claude なしでも読める・書けるシンプルさを保つ
- テストは初学者が自力で書き・読めるレベルに抑える（モックを使う理由）
- 仕様書・実装規約・フロードキュメントを常に最新に保ち、Claude がいなくても開発を継続できる状態を維持する
- Claude に頼りすぎず、実装の意図・判断理由はドキュメントやコメントに残す

## AIPO準拠方針（重要）

**仕様は限りなくAIPO準拠とする。どうしても変更が必要な場合のみ逸脱を認め、その理由を仕様書に明記する。**

- 仕様書を書く際は、まずAIPOの現行仕様（`docs/01_current/`・AIPOソースコード）を確認してから設計すること
- AIPOの動作を変えたい場合は、変更理由を仕様書の該当箇所にコメントで残すこと
- 独断で仕様を変えず、ユーザーに確認を取ること

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
  - 最終確認: 人間が手動で実施。仕様書の `## 受け入れ条件` をチェックリストとして使う。

## 仕様書（specs/）

### ディレクトリ構成

機能単位のフラット構成。1ファイルが大きくなった場合のみディレクトリに切り出す。

```
specs/
  images/        # モックアップ画像（Claude Designで作成）
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
