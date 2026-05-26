# タイムライン 仕様（現AIPO）

調査日：2026-05-26
調査元：https://github.com/arkjun/aipo（portlets/timeline）

---

## 1. 機能概要

社内SNS的な投稿共有機能。テキスト・添付ファイル・URL共有を投稿でき、グループや部署ごとに絞り込んで表示できる。投稿に対してコメント（返信）やいいねができる。

## 2. 主要な操作・画面

- 投稿一覧表示（グループ・部署・全体で絞り込み可）
- 新規投稿（テキスト・添付ファイル・URLプレビュー付き）
- 返信（スレッド形式）
- いいね
- 続きを読む（ページング）

## 3. データ項目

### EipTTimeline（投稿本体）

| カラム | 型 | 説明 |
|---|---|---|
| TIMELINE_ID | int | 主キー |
| note | String | 投稿テキスト |
| owner_id | int | 投稿者ユーザーID |
| parent_id | int | 返信先の投稿ID（null=ルート投稿） |
| timeline_type | String | 投稿種別 |
| app_id | String | 連携アプリID |
| external_id | String | 外部連携用ID |
| create_date | Date | 投稿日時 |
| update_date | Date | 更新日時 |

### 関連テーブル

| テーブル | 内容 |
|---|---|
| EipTTimelineFile | 添付ファイル |
| EipTTimelineLike | いいね（ユーザーID紐付き） |
| EipTTimelineMap | 投稿の送信先（グループ・ユーザー） |
| EipTTimelineUrl | URLプレビュー情報 |

## 4. 特記事項・制約

- グループ絞り込みは「全体」「所属グループ」「部署」単位
- ページングあり（一定件数ごとに「続きを読む」で追加読み込み）
- ファイルアップロード可否はシステム設定に依存
