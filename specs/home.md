# ホーム画面（マイページ）

## 概要

ログイン後の起点となるホーム画面。AIPO の「マイページ」に相当。

ユーザーは複数の**ページ（タブ）**を持ち、各ページに**ウィジェット**を自由に配置できる。
ウィジェットの配置はドラッグ＆ドロップで変更可能。

AIPO 準拠: `jetspeed_user_profile.profile`（PSML XML BLOB）ではなく、
Oripo 独自の正規化テーブル（`oripo_pages` / `oripo_page_widgets`）で管理する。
移行時にユーザーのページ設定は初期化する（移行コストが過大なため）。

関連 Issue: #80（ホーム画面）、#125（ページレイアウト機能）、#126（タブによる画面切り替え）

---

## モックアップ

**デスクトップ:**
![ホーム](../docs/02_requirements/mockups/ホーム.png)

**モバイル:**
![スマホWEB版](../docs/02_requirements/mockups/スマホWEB版.png)

---

## 機能要件

### タブ（ページ）管理

ユーザーは複数のタブ（ページ）を持てる。

- タブはヘッダー下のサブナビゲーションバーに表示する
- デフォルトで「マイページ」タブ 1 枚が作成済みの状態
- タブの追加・削除・タイトル変更・並び替えが可能
- タブは最大 10 枚まで（AIPO 準拠）
- 削除時は確認ダイアログを表示（ウィジェット設定も消える）
- 個人設定は専用ページ（`/settings`）で管理し、タブには含めない（AIPO から逸脱、UI 簡素化のため）

### ページレイアウト

各タブはカラムレイアウトを持つ。AIPO の 6 種類から主要なものに絞る。

| レイアウト名（内部値） | 表示名 | カラム比率 |
|---|---|---|
| `OneColumn` | 1列 | 100% |
| `TwoColumns` | 2列（等幅） | 50% / 50% |
| `TwoColumnsRight` | 2列（右広） | 25% / 75% |（デフォルト）|
| `TwoColumnsLeft` | 2列（左広） | 75% / 25% |
| `ThreeColumns` | 3列 | 25% / 50% / 25% |

- レイアウト変更時、既存ウィジェットは列インデックスが範囲外になった場合に最後の列に移動する
- レイアウト選択 UI は「ページ設定」メニュー内に配置

### ウィジェット

各ウィジェットはタイル形式でカラム内に縦積みで配置する。

**Phase 1 で実装するウィジェット（Issue #81〜#83 と対応）:**

| widget_type | 表示名 | Issue |
|---|---|---|
| `Schedule` | スケジュール | #81 |
| `Whatsnew` | 更新情報 | #82 |
| `UserList` | ユーザー名簿 | #83 |

- 同一 widget_type を同じページに複数配置可能（AIPO から逸脱、ユーザーの自由度向上のため）
- ウィジェット内には「最小化」ボタンを設け、折りたたみ表示が可能
- 「追加」ボタンでウィジェット一覧を表示し、全種類を常に選択肢に出す
- ウィジェットを「削除」するとそのページから取り除かれる（データは消えない）

### ドラッグ＆ドロップ

ウィジェットを別カラムや別の行位置へドラッグして移動できる。

- ライブラリ: `@dnd-kit/core`（AIPO の Dojo から変更）
- 移動後は即時 API 保存（楽観的更新 + エラー時ロールバック）
- モバイルでは D&D 無効（代わりに設定メニューで列選択）

### デフォルト設定（新規ユーザー / 初回ログイン時）

以下の設定で `oripo_pages` と `oripo_page_widgets` を自動生成する。

| 項目 | 値 |
|---|---|
| タブ名 | マイページ |
| レイアウト | TwoColumnsRight（25% / 75%） |

| col | row | widget_type |
|---|---|---|
| 0 | 0 | Whatsnew |
| 0 | 1 | UserList |
| 1 | 0 | Schedule |

### レスポンシブ対応

| ブレークポイント | 挙動 |
|---|---|
| デスクトップ（lg 以上） | マルチカラムレイアウト + D&D 有効 |
| モバイル（lg 未満） | 1列に強制（カラム設定を無視して縦積み）・D&D 無効 |

モバイルでのウィジェット表示順: カラム 0 の row 昇順 → カラム 1 の row 昇順 → …（col 昇順に結合）

---

## API

### ページ（タブ）

| Method | Path | 説明 |
|---|---|---|
| GET | `/api/pages` | 自分のページ一覧取得 |
| POST | `/api/pages` | ページ新規作成 |
| PATCH | `/api/pages/[pageId]` | ページ更新（タイトル・レイアウト・sort_order） |
| DELETE | `/api/pages/[pageId]` | ページ削除 |

### ウィジェット

| Method | Path | 説明 |
|---|---|---|
| GET | `/api/pages/[pageId]/widgets` | ウィジェット一覧取得 |
| POST | `/api/pages/[pageId]/widgets` | ウィジェット追加 |
| PATCH | `/api/pages/[pageId]/widgets/[widgetId]` | 位置更新（col / row） |
| DELETE | `/api/pages/[pageId]/widgets/[widgetId]` | ウィジェット削除 |

すべて Server Actions（`actions.ts`）で実装し、Route Handler は使わない。

---

## データモデル

`specs/db-schema.md` に定義済みの `oripo_pages` / `oripo_page_widgets` を使用する。
ただし `oripo_pages` に `layout` カラムが不足しているため追加が必要。

### `oripo_pages`（追記）

```sql
CREATE TABLE oripo_pages (
  page_id     SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES turbine_user(user_id),
  page_name   TEXT NOT NULL,
  layout      TEXT NOT NULL DEFAULT 'TwoColumnsRight',  -- 追加
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_default  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### `oripo_page_widgets`

```sql
CREATE TABLE oripo_page_widgets (
  widget_id   SERIAL PRIMARY KEY,
  page_id     INTEGER NOT NULL REFERENCES oripo_pages(page_id) ON DELETE CASCADE,
  widget_type TEXT NOT NULL,
  col         INTEGER NOT NULL DEFAULT 0,
  row         INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (page_id, widget_type)
);
```

---

## ファイル構成

```
src/
  app/
    (main)/
      page.tsx                  ← ホーム画面（Server Component）
      _components/
        HomeClient.tsx          ← タブ切り替え・D&D管理（Client Component）
        PageTabBar.tsx          ← タブナビゲーションバー
        WidgetGrid.tsx          ← カラムレイアウト + ウィジェット配置
        WidgetWrapper.tsx       ← 各ウィジェットの外枠（ヘッダー・最小化・削除）
        widgets/
          ScheduleWidget.tsx    ← スケジュールウィジェット（#81）
          WhatsnewWidget.tsx    ← 更新情報ウィジェット（#82）
          UserListWidget.tsx    ← ユーザー名簿ウィジェット（#83）
      actions.ts                ← Server Actions（ページ・ウィジェット CRUD）
  lib/
    pages.ts                    ← DBクエリ（oripo_pages / oripo_page_widgets）
```

---

## 受け入れ条件

### タブ
- [ ] ホーム画面にタブナビゲーションバーが表示される
- [ ] 「+」ボタンでタブを追加できる
- [ ] タブタイトルをダブルクリックで編集できる
- [ ] タブを削除できる（確認ダイアログあり）
- [ ] タブをドラッグで並び替えできる
- [ ] 新規ユーザーのデフォルトタブ「マイページ」が自動生成される

### レイアウト
- [ ] ページ設定メニューからレイアウトを選択できる
- [ ] レイアウト変更が即時反映される
- [ ] 列数を超えたウィジェットが自動的に最後の列に移動する

### ウィジェット
- [ ] デフォルト配置（Whatsnew・UserList・Schedule）が表示される
- [ ] 「ウィジェット追加」から未配置ウィジェットを追加できる
- [ ] ウィジェットを削除できる
- [ ] ウィジェットを最小化・展開できる

### ドラッグ＆ドロップ
- [ ] デスクトップでウィジェットをカラム間・行間でD&D移動できる
- [ ] 移動後の位置がDBに保存され、リロード後も維持される

### レスポンシブ
- [ ] モバイルで全ウィジェットが1列縦積みで表示される
- [ ] モバイルでD&Dが無効になっている
