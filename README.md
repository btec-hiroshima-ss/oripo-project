# Oripo

AIPOグループウェアのリプレースプロジェクト。

## プロジェクト概要

### 問題点

- ユーザーが増えると重い
- 長期未更新によるセキュリティリスク

### PJ方針

Claudeを最大限活用。成果物・ローカルテストはすべてClaudeが作成・実行 → 人がレビュー。

### 開発手法

シンプルSDD（Spec-Driven Development）。仕様書（Markdown）を先に書いて社内合意 → Claudeが実装・テスト生成。

## リポジトリ構成

| ディレクトリ          | 内容                    |
| --------------------- | ----------------------- |
| docs/01_current/      | 現行AIPO調査・仕様書    |
| docs/02_requirements/ | 要件定義                |
| docs/03_migration/    | 移行計画                |
| specs/                | 新システム仕様書（SDD） |
| src/                  | 実装（Phase5以降）      |

## ローカル環境構築

[docs/04_operation/LOCAL_SETUP.md](docs/04_operation/LOCAL_SETUP.md) を参照。

## 進捗管理

[GitHub Projects - Oripo_project](https://github.com/orgs/btec-hiroshima-ss/projects/1)

## 完了済みPhase要約
**Phase1**：旧AIPO調査の結果、サーバー・アプリ共に10年以上前のものと非常に古く流用は不可。セキュリティに関してもなにも設定されていないため、設計の参考にならない。DBも再構築するが、可能ならば旧DBのテーブル構造と同一にしデータ移行予定。  
基本方針としてOripoは、サーバー立て直し・ソースコードすべて新規・セキュリティ設計再考とする。（`docs/01_current/investigation/`）

**Phase2**：AIPOのOSSリポジトリを調査し、対象6機能（ホーム・更新情報・スケジュール・ユーザー名簿・ユーザー情報管理・アクセス権限管理）の仕様書を作成（`docs/01_current/specs/`）。社内で「タイムライン」と呼ばれている機能が更新情報（whatsnew）であることを確認。アクセス制御はロールベース（RBAC）。ユーザーデータ・パスワードはそのまま移行予定。

**Phase3**：要件定義書ドラフト作成（`docs/02_requirements/requirements.md`）。実装対象7機能（ログイン・ホーム・更新情報・スケジュール・ユーザー名簿・ユーザー情報管理・アクセス権限管理）の要件を定義。AIPOの細粒度アクセス制御をシンプルな2ロール構成（管理者/一般利用者）に簡略化する方針を決定。プライバシー方針として電話番号・メールアドレス等の不要な個人情報は移行しない方針を決定。実際のAIPO DBを調査し計画との整合性を確認。社内確認は一部継続中。

**Phase4（進行中）**：技術スタック・アーキテクチャ選定。Next.js 15 / TypeScript / App Router・PostgreSQL（Kysely使用、ORM不採用）・Docker/docker compose・GitHub Actions + GHCR でのCI/CD構成を決定。アーキテクチャ・セキュリティ設計・モックアップ作成完了（`specs/architecture.md`、`docs/02_requirements/mockups/`）。DB関連ツール選定は継続中。