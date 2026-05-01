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

## 進捗管理

[GitHub Projects - Oripo_project](https://github.com/orgs/btec-hiroshima-ss/projects/1)

## 完了済みPhase要約
**Phase1**：旧AIPO調査の結果、サーバー・アプリ共に10年以上前のものと非常に古く流用は不可。セキュリティに関してもなにも設定されていないため、設計の参考にならない。Oripoは、サーバー立て直し・ソースコードすべて新規・セキュリティ設計再考とする。
