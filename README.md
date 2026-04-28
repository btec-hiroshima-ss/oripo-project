# Oripoプロジェクト

## プロジェクト概要

### 問題点

・ユーザーが増えると重い
・アップデートを全くしていないのでセキュリティリスク有り

### PJ方針

Claudeを最大限活用。各種成果物及びローカルテストはすべてClaudeが作成・実行→人がレビューの流れで行う。

### 開発手法

仕様駆動開発（SDD: Spec-Driven Development）とする。  
リバースエンジニアリングで仕様書作成容易＆Claudeフル活用なため適切。  
そのため、仕様・設計書といったドキュメント作成が最優先。

## プロジェクト管理

・プロジェクトの進捗：Github Project  
・ナレッジ管理場所：Github及びREADME.md
・資料保管場所：[SharePoint](https://outsourcinginc.sharepoint.com/:f:/r/sites/ost-resukopj/Shared%20Documents/AIPO_replace?csf=1&web=1&e=DjOMsr)  
・設計用ドキュメント：gitリポジトリ内に /specs(仕様書) /docs(仕様書以外) のドキュメントディレクトリを作成し常に履歴管理

## 現行AIPOサーバー等情報

### AIPOサーバー

1. 有線LANを接続
2. windowsのリモートデスクトップで  
   IPアドレス：172.29.4.23  
   ID：administrator  
   PW：Kdns3300

### ドキュメント保管箇所

1. 有線LANを接続
2. エクスプローラーで  
   パス：\sto01\Share\プロジェクトフォルダ\101：OST\D999999
3. ID、PWを入力  
   ID：OSTech  
   PW：OSTech3300

### ESxiサーバ(詳しくは聞いていません。しかしサーバー構築時必要)

1. IPアドレス：172.29.100.1
2. ESxiサーバの利用状況（最終更新が2019年）</br>
   \sto01\Share\プロジェクトフォルダ\101：OST\D999999：環境\_社内インフラ設備整備\サーバー機別ＶＭ環境 使用状況\_201704.xlsx

### AIPOリポジトリ

https://github.com/arkjun/aipo?tab=readme-ov-file

## 現AIPOサーバースペック

OS：WindowsServer2008  
メモリ：7GB  
CPU：Intel® Xeon® Gold 5118 @ 2.30GHz 4コア

- 12コア / 24スレッド
- ベース 2.3GHz
- Turbo 最大 3.2GHz
- IPC は Core i 第7世代クラス

セキュリティ：ファイアウォール無し。多くのportがワイルドカードLISTENING。事実上なんのセキュリティも考慮されていない。

## 現行AIPOアプリ調査結果

### アプリケーション

| 項目                     | 内容                                                                 |
| ------------------------ | -------------------------------------------------------------------- |
| バージョン               | AIPO 7.0.2.0                                                         |
| 言語                     | Java                                                                 |
| アプリケーションサーバー | Apache Tomcat                                                        |
| フレームワーク           | Apache Jetspeed（ポートレット構成）、Cayenne ORM、Velocity、Guice 等 |
| 依存管理                 | なし（JARを手動配置）                                                |

### データベース

| 項目       | 内容                               |
| ---------- | ---------------------------------- |
| 種類       | PostgreSQL 8.4.7（2014年EOL済み）  |
| テーブル数 | 約80                               |
| 特記       | ユーザー写真をDBに直接バイナリ保存 |

# Oripo

AIPOグループウェアのリプレースプロジェクト。

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
