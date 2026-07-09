# DBスキーマ設計

関連Issue: #120

## 方針

AIPOテーブルをそのまま使用し、Oripoで新規に必要なテーブルだけ追加する。

移行作業の最小化を優先するため、新規スキーマへの移し替えは行わない。スキーマ整理は今後の課題（#TODO）とする。

**AIPOテーブルはカラムの追加・削除・変更を一切行わない。** 各テーブルの説明に記載しているカラムはOripoが参照するものの一覧であり、記載のないカラムはAIPOに存在するがOripoでは使用しないもの。

カラム名の凡例：
- （マークなし）: Oripoで参照・使用する
- `※` : 移行はするがOripoでは使用しない

型の凡例：
- `型名` : NOT NULL
- `型名?` : NULL許容

---

## 機能とテーブルの対応

| 機能 | 使用テーブル |
|---|---|
| ログイン・認証 | `turbine_user`, `oripo_sessions` ★ |
| ホーム画面 | `oripo_pages` ★, `oripo_page_widgets` ★ |
| 更新情報 | `eip_t_whatsnew`, `eip_t_schedule`（テキスト取得用JOIN） |
| スケジュール | `eip_t_schedule`, `eip_t_schedule_map`, `eip_m_facility` |
| ユーザー名簿 | `turbine_user`, `turbine_user_group_role`, `turbine_group`, `eip_m_post` |
| 個人設定（ユーザー情報） | `turbine_user` |
| 個人設定（マイグループ） | `turbine_group`, `turbine_user_group_role`, `eip_facility_group`, `eip_m_facility` |
| 個人設定（ページ設定） | `oripo_pages` ★, `oripo_page_widgets` ★ |
| ユーザー情報管理 | `turbine_user`, `turbine_user_group_role`, `turbine_group`, `eip_m_post` |
| イベントログ管理 | `eip_t_eventlog`, `turbine_user` |
| 設備マスタ管理 | `eip_m_facility`, `eip_m_facility_group`, `eip_m_facility_group_map` |
| アクセス権限管理 | `turbine_role`, `turbine_user_group_role`, `turbine_user` |

> ★ = Oripo 新規追加テーブル

---

## Oripoで利用するAIPOテーブル

### ユーザー・認証

#### `turbine_user`
ユーザーアカウント。

| カラム | 型 | 用途 |
|---|---|---|
| `user_id` | integer | PK |
| `login_name` | varchar(32) | ログインID |
| `password_value` | varchar(200) | パスワード（SHA-1+Base64） |
| `last_name` / `first_name` | varchar(99) | 氏名 |
| `last_name_kana` / `first_name_kana` | varchar(99)? | フリガナ |
| `cellular_phone` | varchar(15)? | 携帯電話番号（社内） |
| `disabled` | char(1)? | 有効/無効フラグ（'T'=無効, 'F'=有効） |
| `in_telephone` ※ | varchar(15)? | 内線番号 |
| `out_telephone` ※ | varchar(15)? | 外線番号 |
| `email` ※ | varchar(99)? | メールアドレス |
| `cellular_mail` ※ | varchar(99)? | 携帯メールアドレス |
| `cellular_uid` ※ | varchar(99)? | 携帯端末UID |
| `position_id` ※ | integer? | 役職ID（全ユーザー0で未使用） |
| `company_id` ※ | integer? | 会社ID |
| `objectdata` ※ | bytea? | Jetspeedフレームワーク用バイナリデータ |
| `photo` ※ | bytea? | プロフィール写真 |
| `has_photo` ※ | varchar(1)? | 写真有無フラグ |
| `photo_modified` ※ | timestamp? | 写真更新日時 |
| `photo_smartphone` ※ | bytea? | スマートフォン用写真 |
| `has_photo_smartphone` ※ | varchar(1)? | スマートフォン写真有無フラグ |
| `photo_modified_smartphone` ※ | timestamp? | スマートフォン写真更新日時 |
| `confirm_value` ※ | varchar(99)? | 確認コード |
| `password_changed` | timestamp? | パスワード変更日時 |
| `created_user_id` ※ | integer? | 作成者ID |
| `updated_user_id` ※ | integer? | 更新者ID |
| `tutorial_forbid` ※ | varchar(1)? | チュートリアル非表示フラグ |
| `modified` | timestamp? | 更新日時 |
| `created` | timestamp? | 作成日時 |
| `last_login` | timestamp? | 最終ログイン日時 |

> **注意:** 電話番号は3種類あるが、Oripoの表示は `cellular_phone`（携帯電話番号）のみ。部署の対応は別途JOINが必要（下記参照）。

---

### 部署

#### `eip_m_post`
部署マスタ。

| カラム | 型 | 用途 |
|---|---|---|
| `post_id` | integer | PK |
| `post_name` | varchar(64) | 部署名 |
| `group_name` | varchar(99)? | `turbine_group.group_name` と文字列一致で紐づく |
| `company_id` ※ | integer | 会社ID |
| `zipcode` ※ | varchar(8)? | 郵便番号 |
| `address` ※ | varchar(64)? | 住所 |
| `in_telephone` ※ | varchar(15)? | 内線番号 |
| `out_telephone` ※ | varchar(15)? | 外線番号 |
| `fax_number` ※ | varchar(15)? | FAX番号 |
| `create_date` | date? | 作成日 |
| `update_date` | timestamp? | 更新日時 |

#### ユーザーと部署の対応（4テーブルJOIN）

`turbine_user.position_id` は未使用。実際の部署対応は以下の経路：

```sql
SELECT tu.login_name, emp.post_name
FROM turbine_user tu
JOIN turbine_user_group_role tugr ON tu.user_id = tugr.user_id
JOIN turbine_group tg ON tugr.group_id = tg.group_id
JOIN eip_m_post emp ON tg.group_name = emp.group_name
WHERE tu.disabled = 'F'
```

1ユーザーが複数部署に所属するため、このJOINでは1ユーザーが複数行になる点に注意。

---

### スケジュール

#### `eip_t_schedule`
スケジュール本体。

| カラム | 型 | 用途 |
|---|---|---|
| `schedule_id` | integer | PK |
| `owner_id` | integer? | 作成者 |
| `name` | varchar(99)? | 件名 |
| `start_date` / `end_date` | timestamp? | 開始・終了日時 |
| `place` | varchar(99)? | 場所 |
| `note` | text? | メモ |
| `public_flag` | varchar(1)? | 公開フラグ |
| `repeat_pattern` | varchar(10)? | 繰り返しパターン（独自エンコーディング） |
| `parent_id` | integer? | 繰り返しスケジュールの親ID |
| `edit_flag` ※ | varchar(1)? | 編集権限フラグ |
| `mail_flag` ※ | char(1)? | メール通知フラグ |
| `create_user_id` ※ | integer? | 作成者ID |
| `update_user_id` ※ | integer? | 更新者ID |
| `create_date` | date? | 作成日 |
| `update_date` | timestamp? | 更新日時 |

> **注意:** `repeat_pattern` は独自形式。[AIPOソース `ScheduleUtils.java`](https://github.com/arkjun/aipo) で確認済み。
>
> | パターン | 意味 |
> |---|---|
> | `S` | 単発（繰り返しなし） |
> | `N` | ダミースケジュール（AIPO内部が作成する時間枠仮押さえ）。表示不要 |
> | `DL` / `DN` | 毎日・終了あり / 終了なし |
> | `W[0-1×7]L` / `W[0-1×7]N` | 週次。7桁ビットが日〜土の曜日フラグ（例: `W0111110` = 月〜金）。末尾 `L`=終了あり、`N`=終了なし |
> | `M[dd]L` / `M[dd]N` | 毎月。`dd` は日付（例: `M01` = 毎月1日） |

#### `eip_t_schedule_map`
スケジュールの参加者・設備予約。

| カラム | 型 | 用途 |
|---|---|---|
| `id` | integer | PK |
| `schedule_id` | integer | FK → eip_t_schedule |
| `user_id` | integer | 対象ユーザーまたは設備ID |
| `type` | varchar(1)? | `U` = ユーザー参加者、`F` = 設備予約 |
| `status` ※ | varchar(1)? | `D` = ダミー（仮押さえ）等 |
| `common_category_id` ※ | integer | カテゴリID |

---

### 設備

#### `eip_m_facility`
設備マスタ（会議室等）。

| カラム | 型 | 用途 |
|---|---|---|
| `facility_id` | integer | PK |
| `facility_name` | varchar(64) | 設備名 |
| `user_id` ※ | integer | 作成者 |
| `note` | text? | 備考 |
| `sort` | integer? | 表示順 |
| `create_date` | date? | 作成日 |
| `update_date` | timestamp? | 更新日時 |

---

### ロール

#### `turbine_role`
システムロール定義（管理者・一般ユーザー等）。

| カラム | 型 | 用途 |
|---|---|---|
| `role_id` | integer | PK |
| `role_name` | varchar(99) | ロール名（例: `admin`, `user`, `guest`） |
| `objectdata` ※ | bytea? | Jetspeedフレームワーク用バイナリデータ |

ユーザーへのロール付与は `turbine_user_group_role.role_id` 経由で行われる。

---

### マイグループ

`turbine_group` が部署グループとマイグループを兼用している。

#### 識別方法

| 種別 | 条件 |
|---|---|
| 部署グループ | `group_name` が `eip_m_post.group_name` と一致するもの |
| マイグループ | `owner_id` がセットされており `group_alias_name` に表示名がある |

#### `turbine_group`
グループ定義（部署グループ・マイグループ共用）。

| カラム | 型 | 用途 |
|---|---|---|
| `group_id` | integer | PK |
| `group_name` | varchar(99) | タイムスタンプベースの内部キー（例: `1204104365437_4`） |
| `owner_id` | integer? | グループ作成者のuser_id（マイグループのみ） |
| `group_alias_name` | varchar(99)? | 表示名（マイグループのみ） |
| `public_flag` | char(1)? | 公開フラグ |
| `objectdata` ※ | bytea? | Jetspeedフレームワーク用バイナリデータ |

#### `turbine_user_group_role`
グループのユーザーメンバー。

| カラム | 型 | 用途 |
|---|---|---|
| `user_id` | integer | FK → turbine_user |
| `group_id` | integer | FK → turbine_group |
| `role_id` | integer | FK → turbine_role（アクセス権限管理で使用） |

#### `eip_facility_group`
グループの設備メンバー（マイグループの「所属設備」）。

| カラム | 型 | 用途 |
|---|---|---|
| `id` | integer | PK |
| `group_id` | integer | FK → turbine_group |
| `facility_id` | integer | FK → eip_m_facility |

---

### 設備グループ

#### `eip_m_facility_group`
設備グループマスタ（設備をグルーピングする単位）。

| カラム | 型 | 用途 |
|---|---|---|
| `group_id` | integer | PK |
| `group_name` | varchar(64)? | グループ名 |

#### `eip_m_facility_group_map`
設備グループと設備の対応。

| カラム | 型 | 用途 |
|---|---|---|
| `id` | integer | PK |
| `group_id` | integer? | FK → eip_m_facility_group |
| `facility_id` | integer? | FK → eip_m_facility |

> **注意:** マイグループの設備メンバー管理（`eip_facility_group`）とは別テーブル。こちらは設備マスタ管理画面で使用する設備の分類グループ。

---

### 更新情報

#### `eip_t_whatsnew`

| カラム | 型 | 用途 |
|---|---|---|
| `whatsnew_id` | integer | PK |
| `user_id` | integer? | 更新者 |
| `portlet_type` | integer? | アプリ種別 |
| `entity_id` | integer? | 対象レコードのID |
| `create_date` | timestamp? | 更新日時 |
| `parent_id` | integer? | 親レコードID（0=全員向け親、-1=個人宛、それ以外=全員向け子） |
| `update_date` | timestamp? | 更新日時 |

> **注意:** 「更新内容テキスト」は持っていない。表示には `portlet_type` に応じた対象テーブルへのJOINが必要。[AIPOソース `WhatsNewUtils.java`](https://github.com/arkjun/aipo) で確認済みのマッピング：
>
> | portlet_type | 機能 | Oripoで使う |
> |---|---|---|
> | `1` | ブログ記事 | × |
> | `2` | ブログコメント | × |
> | `3` | ワークフロー申請 | × |
> | `4` | 掲示板トピック | × |
> | `5` | メモ | × |
> | `6` | スケジュール | ○ → `eip_t_schedule.name` をJOIN |
> | `-1` | 個人宛新着 | 要検討 |
>
> Oripoの更新情報は `portlet_type = 6` のみ表示すればよい。

---

### イベントログ

#### `eip_t_eventlog`

| カラム | 型 | 用途 |
|---|---|---|
| `eventlog_id` | integer | PK |
| `user_id` | integer? | 操作ユーザー |
| `event_date` | timestamp? | 操作日時 |
| `event_type` | integer? | 操作種別（ログイン・ログアウト等） |
| `portlet_type` | integer? | 機能名 |
| `entity_id` | integer? | 対象ID |
| `ip_addr` | text? | 接続元IP |
| `note` | text? | 備考 |
| `create_date` | timestamp? | 作成日時 |
| `update_date` | timestamp? | 更新日時 |

---

## Oripoで新規追加するテーブル

### `oripo_sessions`
サーバーサイドセッション管理。

```sql
CREATE TABLE oripo_sessions (
  session_id  TEXT PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES turbine_user(user_id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL,
  ip_addr     TEXT
);
```

### `oripo_pages`
個人設定のページ設定（マイページタブ管理）。

> **注意:** AIPO では `jetspeed_user_profile.profile` にページ設定が PSML（バイナリ XML）形式で保存されているが、移行は困難なため Oripo では新規テーブルで管理し直す。移行時にユーザーのページ設定は初期化される。

```sql
CREATE TABLE oripo_pages (
  page_id     SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES turbine_user(user_id),
  page_name   TEXT NOT NULL,
  layout      TEXT NOT NULL DEFAULT 'TwoColumnsRight',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_default  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### `oripo_page_widgets`
ページに配置するウィジェット設定。

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

## 今後の課題

- AIPOの複雑なスキーマ（turbine_group兼用、4テーブルJOIN等）をOripo専用のクリーンなスキーマへ移行する
- スケジュール繰り返しパターンのデコードロジック実装
- `eip_t_whatsnew` の portlet_type マッピング定義
