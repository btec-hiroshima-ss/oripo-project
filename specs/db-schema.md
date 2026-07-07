# DBスキーマ設計

関連Issue: #120

## 方針

AIPOテーブルをそのまま使用し、Oripoで新規に必要なテーブルだけ追加する。

移行作業の最小化を優先するため、新規スキーマへの移し替えは行わない。スキーマ整理は今後の課題（#TODO）とする。

---

## Oripoで利用するAIPOテーブル

### ユーザー・認証

#### `turbine_user`
ユーザーアカウント。

| カラム | 用途 |
|---|---|
| `user_id` | PK |
| `login_name` | ログインID |
| `password_value` | パスワード（SHA-1+Base64） |
| `last_name` / `first_name` | 氏名 |
| `last_name_kana` / `first_name_kana` | フリガナ |
| `cellular_phone` | 携帯電話番号（社内） |
| `disabled` | 有効/無効フラグ（'T'=無効, 'F'=有効） |

> **注意:** `position_id` は全ユーザー0で未使用。部署の対応は別途JOINが必要（下記参照）。

---

### 部署

#### `eip_m_post`
部署マスタ。

| カラム | 用途 |
|---|---|
| `post_id` | PK |
| `post_name` | 部署名 |
| `group_name` | `turbine_group.group_name` と文字列一致で紐づく |

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

| カラム | 用途 |
|---|---|
| `schedule_id` | PK |
| `user_id` | 作成者 |
| `name` | 件名 |
| `start_date` / `end_date` | 開始・終了日時 |
| `place` | 場所 |
| `note` | メモ |
| `public_flag` | 公開フラグ |
| `repeat_pattern` | 繰り返しパターン（独自エンコーディング） |

> **注意:** `repeat_pattern` は独自形式（例: `W0111110N` = 週次・月〜金・終了なし、`DL` = 毎日・終了あり、`S` = 単発）。デコードロジックの実装が必要。[AIPOソース](https://github.com/arkjun/aipo)を参照。

#### `eip_t_schedule_map`
スケジュールの参加者・設備予約。

| カラム | 用途 |
|---|---|
| `schedule_map_id` | PK |
| `schedule_id` | FK → eip_t_schedule |
| `user_id` | 対象ユーザーまたは設備ID |
| `type` | `U` = ユーザー参加者、`F` = 設備予約 |

---

### 設備

#### `eip_m_facility`
設備マスタ（会議室等）。

| カラム | 用途 |
|---|---|
| `facility_id` | PK |
| `facility_name` | 設備名 |

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

| カラム | 用途 |
|---|---|
| `group_id` | PK |
| `group_name` | タイムスタンプベースの内部キー（例: `1204104365437_4`） |
| `owner_id` | グループ作成者のuser_id（マイグループのみ） |
| `group_alias_name` | 表示名（マイグループのみ） |
| `public_flag` | 公開フラグ |

#### `turbine_user_group_role`
グループのユーザーメンバー。

| カラム | 用途 |
|---|---|
| `user_id` | FK → turbine_user |
| `group_id` | FK → turbine_group |

#### `eip_facility_group`
グループの設備メンバー（マイグループの「所属設備」）。

| カラム | 用途 |
|---|---|
| `id` | PK |
| `group_id` | FK → turbine_group |
| `facility_id` | FK → eip_m_facility |

---

### 更新情報

#### `eip_t_whatsnew`

| カラム | 用途 |
|---|---|
| `whatsnew_id` | PK |
| `user_id` | 更新者 |
| `portlet_type` | アプリ種別（int） |
| `entity_id` | 対象レコードのID |
| `create_date` | 更新日時 |

> **注意:** 「更新内容テキスト」は持っていない。表示には `portlet_type` → テーブルのマッピング定義と対象テーブルへのJOINが必要（例: portlet_type=スケジュール → `eip_t_schedule.name`）。

---

### イベントログ

#### `eip_t_eventlog`

| カラム | 用途 |
|---|---|
| `eventlog_id` | PK |
| `user_id` | 操作ユーザー |
| `event_date` | 操作日時 |
| `event_type` | 操作種別（ログイン・ログアウト等） |
| `portlet_type` | 機能名 |
| `entity_id` | 対象ID |
| `ip_addr` | 接続元IP |

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

```sql
CREATE TABLE oripo_pages (
  page_id     SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES turbine_user(user_id),
  page_name   TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_default  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 今後の課題

- AIPOの複雑なスキーマ（turbine_group兼用、4テーブルJOIN等）をOripo専用のクリーンなスキーマへ移行する
- スケジュール繰り返しパターンのデコードロジック実装
- `eip_t_whatsnew` の portlet_type マッピング定義
