# 更新情報ウィジェット

## 概要

ホーム画面に配置できるウィジェット。スケジュールの登録・更新情報を時系列で表示する読み取り専用フィード。

要件定義書 2.3「更新情報（タイムライン）」に対応する、ホームウィジェット（コンパクト版）。

**このフェーズのスコープ:** ホームウィジェットのみ。全件一覧ページ・キーワード検索・ページングは別 Issue で実装する。

関連 Issue: #82（更新情報コンポーネント）、#80（ホーム画面）、#81（スケジュール）

---

## モックアップ

**ホーム画面（左カラムに表示）:**
![ホーム](images/ホーム.png)

---

## 機能要件

### ウィジェット表示

- ウィジェットヘッダー: 「更新情報」タイトル
- 更新エントリの一覧（最新 20 件）
- 更新日時の新しい順（降順）で表示

### 更新エントリの表示項目

モックアップ（`specs/images/ホーム.png`）準拠。

| 項目 | 内容 |
|---|---|
| イニシャルアイコン | 更新者の苗字先頭1文字 + ユーザーIDベースの固定色（ユーザー名簿と同じロジック） |
| 更新時刻 | `HH:mm` 形式（`eip_t_whatsnew.update_date`） |
| 更新者氏名 | `last_name + ' ' + first_name`（`turbine_user` から取得） |
| アクション | 「予定「[件名]」を**追加/編集**しました。」（追加/編集を赤で強調） |

- 追加/編集の判定: `create_date` と `update_date` の差が 5 秒未満 → 追加、それ以上 → 編集
- エントリはクリック不可（スケジュール機能 #81 が未実装のためリンクなし。#81 完了後に追加予定）
- 投稿・編集・削除は不可（閲覧専用）

### データ取得条件

`eip_t_whatsnew` から以下の条件でレコードを取得する:

- `parent_id = 0`（全員向け公開エントリのみ。`-1`=個人宛・`>0`=既読フラグは除外）
- `portlet_type = 6`（スケジュール。将来的に他機能も追加可能な設計とする）
- `update_date DESC` 順
- 最大 20 件

#### テーブル JOIN

```
eip_t_whatsnew
  → eip_t_schedule（entity_id = schedule_id） → name（件名）
  → turbine_user（user_id）                  → last_name, first_name（更新者名）
```

#### `eip_t_whatsnew` への書き込みについて

`eip_t_whatsnew` への書き込みはスケジュール機能（#81）の実装に含める。  
#81 が完了するまでウィジェットに表示されるエントリはない（「更新情報はありません」が表示される）。

#### スケジュール削除済みエントリの扱い

`eip_t_schedule` が削除されても `eip_t_whatsnew` は残る（AIPO の仕様）。
JOIN で取得できなかった場合は件名を「（削除済み）」として表示する。

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
// src/app/(main)/actions.ts に追加
getWhatsnewAction(): Promise<WhatsnewEntry[]>
```

### WhatsnewEntry 型

```ts
type WhatsnewEntry = {
  whatsnewId: number
  portletType: number       // 6 = スケジュール（将来の拡張に備えて保持）
  entityId: number          // 参照先レコードID（スケジュールIDなど）
  scheduleName: string | null // スケジュール件名（削除済みの場合 null）
  updaterName: string       // 更新者氏名（姓名結合）
  updaterInitial: string    // 苗字の先頭1文字（イニシャルアイコン用）
  updaterUserId: number     // アイコン色の決定に使用（Murmur3ハッシュ適用）
  updateDate: Date
  isNew: boolean            // true=追加, false=編集（create_date と update_date の差分で判定）
}
```

---

## データモデル

既存テーブルのみ使用（新規テーブル・マイグレーション不要）。

| テーブル | 用途 |
|---|---|
| `eip_t_whatsnew` | 更新情報（portlet_type・entity_id・user_id・update_date） |
| `eip_t_schedule` | スケジュール件名（LEFT JOIN で取得） |
| `turbine_user` | 更新者氏名 |

### eip_t_whatsnew のカラム

| カラム | 型 | 用途 |
|---|---|---|
| `whatsnew_id` | integer | PK |
| `user_id` | integer | 更新者（`turbine_user.user_id` に対応） |
| `portlet_type` | integer | アプリ種別（6=スケジュール） |
| `parent_id` | integer | 0=全員向け / -1=個人宛 / >0=既読フラグ |
| `entity_id` | integer | 対象レコードID（スケジュールIDなど） |
| `update_date` | timestamp | 更新日時 |

---

## ファイル構成

```
src/
  app/
    (main)/
      actions.ts                              ← getWhatsnewAction を追加
      _components/
        widgets/
          WhatsnewWidget.tsx                  ← ウィジェット本体（'use client'）
  lib/
    whatsnew.ts                               ← DBクエリ（getWhatsnewList）
    whatsnew.types.ts                         ← WhatsnewEntry 型
    whatsnew.test.ts                          ← Vitestユニットテスト（型整合・フィルタ確認）
```

---

## 受け入れ条件

### ウィジェット
- [ ] 更新情報ウィジェットがホーム画面に表示される
- [ ] 「更新情報」タイトルが表示される
- [ ] スケジュールの更新エントリが最新 20 件・更新日時降順で表示される
- [ ] 各エントリに更新者イニシャルアイコン・時刻・氏名・アクションテキスト（「予定「件名」を追加/編集しました。」）が表示される
- [ ] エントリが 0 件のとき「更新情報はありません」と表示される
- [ ] スケジュール削除済みエントリは件名が「（削除済み）」と表示される
- [ ] エントリのリンクは今フェーズ未実装（スケジュール機能 #81 完了後に追加予定）
- [ ] モバイル（375px）で正常に表示・操作できる
