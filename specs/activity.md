# 更新情報ウィジェット

## 概要

ホーム画面に配置できるウィジェット。スケジュールの登録・更新情報を時系列で表示する読み取り専用フィード。

要件定義書 2.3「更新情報（タイムライン）」に対応する、ホームウィジェット（コンパクト版）。

関連 Issue: #82（更新情報コンポーネント）、#80（ホーム画面）、#81（スケジュール）

---

## モックアップ

**ホーム画面（左カラムに表示）:**
![ホーム](images/ホーム.png)

---

## 機能要件

### ウィジェット表示

- ウィジェットヘッダー: 「更新情報」タイトル
- 更新エントリの一覧（1ページ10件、AIPO 準拠）
- 更新日時の新しい順（降順）で表示

### ページング（AIPO 準拠）

AIPO のウィジェットは「1 〜 10 / 550 ◄ ►」形式のページングを持つ。

- 1ページあたり10件（`ACTIVITY_PAGE_SIZE = 10`）
- ウィジェット上部に件数表示と前後ページボタン（◄ ►）を表示
- 表示形式: `{start} 〜 {end} / {total}`
- ◄ で前ページ、► で次ページ
- 先頭ページで ◄ 無効、末尾ページで ► 無効

### 更新エントリの表示項目

モックアップ（`specs/images/ホーム.png`）準拠。

| 項目 | 内容 |
|---|---|
| イニシャルアイコン | 更新者の苗字先頭1文字 + ユーザーIDベースの固定色（ユーザー名簿と同じロジック） |
| 更新時刻 | `HH:mm` 形式（`activity.update_date`） |
| 更新者氏名 | `last_name + ' ' + first_name`（`turbine_user` から取得） |
| アクション | 「予定「[件名]」を**追加/編集**しました。」（追加/編集を赤で強調） |

- 追加/編集の判定: `activity.title` に「追加」が含まれるか否か（AIPO が書き込む時点で判定済み）
- エントリはクリック不可（スケジュール機能 #81 が未実装のためリンクなし。#81 完了後に追加予定）
- 投稿・編集・削除は不可（閲覧専用）

### データ取得条件

`activity` テーブルから以下の条件でレコードを取得する:

- `app_id = 'Schedule'`（スケジュール）
- `activity_map.login_name = '-1'`（全員向け公開）**または** `activity_map.login_name = 現在のユーザーloginName`（共有先）
- `update_date DESC` 順
- 1ページ10件・オフセットページング

#### テーブル JOIN

```
activity
  JOIN activity_map ON activity_map.activity_id = activity.id
  JOIN turbine_user ON turbine_user.login_name = activity.login_name
```

#### データソースについて（AIPO調査結果）

AIPO はスケジュール保存時に `ALActivityService.create()` を呼び出し、`activity` + `activity_map` テーブルに書き込む（`ScheduleUtils.createNewScheduleActivity()` / `createShareScheduleActivity()` — `portlets/schedule/src/main/java/.../ScheduleUtils.java` 参照）。

`eip_t_whatsnew` はスケジュールでは使用されていない（全ソース検索で呼び出し元なし、本番 DB も空）。

`activity.priority` の意味:

| 値 | 意味 | `activity_map.login_name` |
|---|---|---|
| 0 | 全員向け公開（作成者が自分のアクティビティを全体に公開） | `"-1"` |
| 1 | 共有先限定（スケジュール共有相手への通知） | 特定ユーザーの `login_name` |

#### `activity.title` のフォーマット

AIPO が書き込む時点で完成形テキストが格納されている。

- 追加: `"予定「〇〇」を追加しました。"`
- 編集: `"予定「〇〇」を編集しました。"`

件名は `「」` 内を正規表現で抽出。追加/編集の判定は `"追加"` を含むかで行う。

#### スケジュール削除済みエントリの扱い

`activity` レコードはスケジュール削除後も残る（AIPO の仕様）。  
`title` に件名が格納済みのため、`eip_t_schedule` が削除されても件名は表示できる。

### データなし時の表示

エントリが 0 件のとき「更新情報はありません」と表示する。

### レスポンシブ対応

| ブレークポイント | 挙動 |
|---|---|
| デスクトップ（lg 以上） | カラム内に収まるサイズ |
| モバイル（lg 未満） | 1列に強制表示（他ウィジェットと同様） |

---

## API

Server Action で実装（Route Handler は使わない）。

```ts
// src/app/(main)/actions.ts
getActivityAction(page?: number): Promise<{ entries: ActivityEntry[]; totalCount: number }>
```

### ActivityEntry 型

```ts
type ActivityEntry = {
  activityId: number
  entityId: number              // スケジュールID（activity.external_id）
  scheduleName: string | null   // title の「」内から抽出。削除済みでも title に残るため通常は非 null
  updaterName: string           // 更新者氏名（姓名結合）
  updaterInitial: string        // 苗字の先頭1文字（イニシャルアイコン用）
  updaterUserId: number         // アイコン色の決定に使用（Murmur3ハッシュ適用）
  updateDate: Date
  isNew: boolean                // true=追加, false=編集（activity.title の「追加」「編集」で判定）
}
```

---

## データモデル

既存テーブルのみ使用（新規テーブル・マイグレーション不要）。

| テーブル | 用途 |
|---|---|
| `activity` | 更新情報本体（title・login_name・update_date・priority） |
| `activity_map` | 更新情報の配信先（login_name='-1' で全員向け、特定名で共有先） |
| `turbine_user` | 更新者の氏名取得（`login_name` で JOIN） |

### activity のカラム

| カラム | 型 | 用途 |
|---|---|---|
| `id` | integer | PK |
| `app_id` | varchar | アプリ種別（`'Schedule'`） |
| `login_name` | varchar | 更新者のログイン名 |
| `title` | varchar | 完成形タイトル（「予定「〇〇」を追加/編集しました。」） |
| `external_id` | varchar | スケジュールID（文字列） |
| `priority` | float | 0=全員向け / 1=共有先限定 |
| `update_date` | timestamp | 更新日時 |

### activity_map のカラム

| カラム | 型 | 用途 |
|---|---|---|
| `id` | integer | PK |
| `activity_id` | integer | FK → `activity.id` |
| `login_name` | varchar | `'-1'`=全員向け / 特定ユーザー名=共有先 |
| `is_read` | integer | 既読フラグ（0=未読, 1=既読） |

---

## ファイル構成

```
src/
  app/
    (main)/
      actions.ts                              ← getActivityAction を追加
      _components/
        widgets/
          ActivityWidget.tsx                  ← ウィジェット本体（'use client'）
  lib/
    activity.ts                               ← DBクエリ（getActivityList）
    activity.types.ts                         ← ActivityEntry 型
    activity.utils.ts                         ← 純粋関数（getScheduleDisplayName・formatActivityDate）
    activity.test.ts                          ← Vitestユニットテスト
```

---

## 受け入れ条件

### ウィジェット
- [ ] 更新情報ウィジェットがホーム画面に表示される
- [ ] 「更新情報」タイトルが表示される
- [ ] スケジュールの更新エントリが1ページ10件・更新日時降順で表示される
- [ ] ウィジェット上部に「{start} 〜 {end} / {total} ◄ ►」のページング表示がある
- [ ] ◄ / ► ボタンでページ移動できる（先頭/末尾で無効化）
- [ ] 各エントリに更新者イニシャルアイコン・時刻・氏名・アクションテキスト（「予定「件名」を追加/編集しました。」）が表示される
- [ ] エントリが 0 件のとき「更新情報はありません」と表示される
- [ ] スケジュール削除済みエントリは件名が「（削除済み）」と表示される
- [ ] エントリのリンクは今フェーズ未実装（スケジュール機能 #81 完了後に追加予定）
- [ ] モバイル（375px）で正常に表示・操作できる
