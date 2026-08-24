# スケジュールウィジェット

## 概要

ホーム画面に表示するスケジュール管理ウィジェット。個人の予定を週カレンダー形式で表示・管理する。

AIPO 準拠: `portlets/schedule`（週表示ウィジェット）に相当。

### フェーズ分割

| フェーズ | Issue | 内容 | 状態 |
|---|---|---|---|
| **A** | #81 | 週表示・自分のみ・予定 CRUD（繰り返しなし） | 完了 ✅ |
| **B** | #81 | マルチユーザー表示・参加ユーザー選択 | 完了 ✅ |
| **C** | #81 | 繰り返し予定の作成・編集・削除 | 完了 ✅ |
| **D（本 Issue）** | #81 | 設備予約・日/月/一覧ビュー | 実装中 |

---

## モックアップ

**デスクトップ:**
![ホーム画面](images/ホーム.png)

**スケジュール詳細モーダル:**
![スケジュール詳細](images/スケジュール詳細.png)

**モバイル（スマホ Web 版）:**
![スマホ版スケジュール](../../docs/02_requirements/mockups/スマホWEB版.png)

**AIPO 現行スクリーンショット（参考）:**
- スケジュール詳細モーダル: `docs/01_current/screenshots/04b_schedule-detail-modal.png`

---

## 機能要件（Phase A）

### 週カレンダー表示

- 日曜始まりで当週の7日間（日〜土）を列表示する（AIPO準拠）
- 時刻軸は 00:00〜24:00。デフォルトスクロール位置は 08:00 付近
- 表示対象: ログインユーザー自身が参加者（`eip_t_schedule_map.user_id`）の予定
- **通常予定**（`repeat_pattern = 'N'`）: 時刻グリッド内にブロック表示
- **終日予定**（`repeat_pattern = 'S'`）: 各日列の上部に帯で表示
- 繰り返し予定の**表示**: DB に子レコード（`parent_id > 0`, `repeat_pattern='N'`）として存在する分を通常予定と同様に表示する（Phase A で作成はしない）
  - AIPO は繰り返し予定を動的生成方式（子レコードは編集/削除時のみ作成）で管理する
  - Oripo はシンプルな事前展開方式を採用し、Phase C で作成した繰り返し予定はすべての出現日に子レコードを持つ

### ナビゲーション

- `今日` ボタン: 当週に戻る
- `◀` / `▶` ボタン: 前週・翌週に移動
- ヘッダーに `YYYY年MM月DD日（曜日）` 形式で週の開始日を表示
- 表示モードボタン（ブロック / 日 / 週 / 月 / 一覧）: Phase A は「週」のみ動作。他は非活性で表示のみ
- **祝日表示**: 日付列ヘッダーの土日を色分け表示する（土=青、日/祝=赤）。祝日名を赤字でヘッダーに表示する。
  - **要件定義書 2.4 準拠**（「祝日の自動反映」が明記されている）。
  - `holidays-jp.github.io/api/v1/date.json` から取得し、Next.js fetch キャッシュで 24 時間保持する（`src/lib/holidays.ts`）。

### 予定追加

- `+予定追加` ボタン → 追加モーダルを開く
- 追加フォームのフィールド:

| フィールド | 内容 | 必須 |
|---|---|---|
| タイトル | `name`（最大 99 文字） | ○ |
| 終日 | チェックON で `repeat_pattern = 'S'`、OFF で `= 'N'` | - |
| 日付 | `start_date`（終日 ON 時は日付のみ） | ○ |
| 開始時刻 | `start_date`（終日 OFF 時） | ○ |
| 終了時刻 | `end_date`（終日 OFF 時） | ○ |
| 場所 | `place`（最大 99 文字） | - |
| 内容 | `note` | - |
| 公開区分 | `public_flag`: 公開(O) / 非公開(P) / 完全に隠す(C) | ○ |

- フォームレイアウト（スマホモックアップ準拠）:
  - タイトル → 終日トグル → 日時 → **「繰り返しなし」ボタン**（Phase C で繰り返し設定パネルに変更。Phase A ではクリック時に "Phase C で実装予定" トースト表示）＋ **「期間で指定」ボタン**（Phase C で実装） → 場所 → 内容 → 公開区分（3択トグル）→ 追加ボタン
  - 参加ユーザー選択は Phase B で対応

- AIPO 準拠のデフォルト値:
  - `public_flag = 'O'`（公開）
  - `edit_flag = 'T'`（編集可）
  - `mail_flag = 'N'`（通知なし）
  - `parent_id = 0`（繰り返しなし）
  - `owner_id = create_user_id = update_user_id = loginUserId`
  - 作成者自身が `eip_t_schedule_map` に `type='U'`, `status='O'`（オーナー）で登録される

### 予定クリック・編集・削除

AIPO準拠: スケジュールブロッククリックで登録（編集）フォームを直接開く。

- 自分が `owner_id` の予定をクリック → 編集フォームを直接開く（詳細モーダルを経由しない）
  - 繰り返し子レコード（`parent_id > 0`）の場合: 「この予定のみ変更 / 全ての予定を変更」を編集フォーム内で選択
- 他ユーザーが `owner_id` の予定をクリック → 詳細モーダル（閲覧専用、編集・削除ボタンなし）
- 編集フォームに「削除する」ボタンを設け、クリックで確認ダイアログを表示してから削除
- 削除は `eip_t_schedule` と `eip_t_schedule_map` の両方を削除
- ただし管理者ロールは他ユーザーの予定も編集可（Phase A では管理者判定はスキップ）

### 繰り返し予定（既存データ）の閲覧

- 繰り返し子レコード（`parent_id > 0`）はカレンダー上に通常予定と同様に表示する
- 自分の繰り返し予定クリック → 編集フォームが開き、冒頭で「この予定のみ変更 / 全ての予定を変更」を選択する（Phase C 実装済みの `editMode` 仕様に準拠）

### スケジュールブロックの表示

- ブロックに表示: タイトル（省略あり）・時刻
- 色分け（Phase A）: `public_flag` による
  - `O`（公開）: ブランドカラー系
  - `P`（非公開）: グレー系
  - `C`（完全非公開）: ダークグレー系
- 終日予定は帯の中にタイトルのみ表示
- 重複予定（同時刻帯に複数）: 横並びで幅を分割表示

### レスポンシブ対応

スマホモックアップ（`スマホWEB版.png`）準拠。

| ブレークポイント | 挙動 |
|---|---|
| デスクトップ（lg 以上） | 7列の週表示 |
| モバイル（lg 未満） | 7列の横スクロール週表示。時刻軸は固定、日付列を横スクロール |

---

## API

### Server Actions（`src/app/(main)/actions.ts`）

```ts
// 指定週のスケジュール取得（自分のみ）。userId は requireAuth() 内部で取得。
getWeekSchedulesAction(weekStart: string): Promise<ScheduleEntry[]>

// スケジュール詳細取得（登録者・更新者・参加ユーザー）。詳細モーダルを開いたタイミングで呼ぶ。
getScheduleDetailAction(scheduleId: number): Promise<ScheduleDetail>

// 予定追加
addScheduleAction(data: ScheduleInput): Promise<ScheduleEntry>

// 予定更新
updateScheduleAction(scheduleId: number, data: ScheduleInput): Promise<ScheduleEntry>

// 予定削除（eip_t_schedule + eip_t_schedule_map）
deleteScheduleAction(scheduleId: number): Promise<void>

// 祝日データ取得（holidays-jp API から取得、24時間キャッシュ）
getHolidaysAction(): Promise<Record<string, string>>
```

### DB クエリ（`src/lib/schedule.ts`）

```ts
// 週表示クエリ: 指定ユーザーの日付範囲の予定を取得
// タイムゾーン注意: DBはAsia/TokyoのJSTで格納。Kyselyでは start_date::text で読み取り文字列としてパースする
getWeekSchedules(userId: number, from: Date, to: Date): Promise<ScheduleEntry[]>
```

---

## データモデル

### 既存テーブル（AIPO DB）

**`eip_t_schedule`（スケジュール本体）**

| カラム | 型 | 説明 |
|---|---|---|
| `schedule_id` | integer | PK |
| `name` | varchar(99) | タイトル（必須） |
| `note` | text | 内容 |
| `place` | varchar(99) | 場所 |
| `start_date` | timestamp | 開始日時（JST で格納） |
| `end_date` | timestamp | 終了日時（JST で格納） |
| `public_flag` | varchar(1) | O=公開 / P=非公開 / C=完全非公開 |
| `repeat_pattern` | varchar(10) | N=繰り返しなし / S=終日 / DL,DN=毎日 / W0111110L=週次 / M15N=月次 |
| `parent_id` | integer | 0=単独予定（繰り返し子の場合は親 schedule_id） |
| `edit_flag` | varchar(1) | T=編集可 / F=編集不可 |
| `mail_flag` | char(1) | N=通知なし（Phase A では常に N） |
| `owner_id` | integer | 作成者 user_id |
| `create_user_id` | integer | 登録者 user_id |
| `update_user_id` | integer | 最終更新者 user_id |
| `create_date` | date | 登録日 |
| `update_date` | timestamp | 更新日時 |

**`eip_t_schedule_map`（参加者マッピング）**

| カラム | 型 | 説明 |
|---|---|---|
| `id` | integer | PK（シーケンス採番） |
| `schedule_id` | integer | FK → eip_t_schedule |
| `user_id` | integer | 参加者 user_id（type='U'）または設備 ID（type='F'） |
| `type` | varchar(1) | U=ユーザー / F=設備 |
| `status` | varchar(1) | O=オーナー / T=参加確認済み / R=保留 / D=削除 / C=キャンセル |
| `common_category_id` | integer | カテゴリ（Phase A では 1 固定 ※ FK制約で eip_t_common_category の唯一の値が 1） |

### PK 採番（重要）

`eip_t_schedule.schedule_id` と `eip_t_schedule_map.id` はカラムに DEFAULT がない。AIPO は独自シーケンスで採番する。

```sql
-- INSERT 時に使用するシーケンス
nextval('pk_eip_t_schedule')      -- schedule_id
nextval('pk_eip_t_schedule_map')  -- id
```

Kysely での INSERT 例:
```ts
const { schedule_id } = await db
  .selectFrom(sql`nextval('pk_eip_t_schedule') as schedule_id`.as('t'))
  .selectAll()
  .executeTakeFirstOrThrow()
```

### タイムゾーンの扱い（重要）

- DB の timezone は `Asia/Tokyo`。`timestamp without time zone` カラムに JST のまま格納されている
- Node.js の pg クライアントは `timestamp without time zone` を UTC として扱うためズレが生じる
- **対策**: Kysely で取得する際は `sql\`start_date::text\`` で文字列として読み取り、JST 文字列として Date に変換する

```ts
// 正しい変換: "2026-07-22 14:00:00" を JST として扱う
function parseJstString(str: string): Date {
  // "YYYY-MM-DD HH:MM:SS" → JST として解釈し UTC の Date を返す
  return new Date(str.replace(' ', 'T') + '+09:00')
}
```

### 型定義（`src/lib/schedule.types.ts`）

```ts
export type ScheduleDetail = {
  creatorName: string
  creatorDateJst: string   // "YYYY-MM-DD HH:MM:SS"（JST）
  updaterName: string
  updaterDateJst: string   // "YYYY-MM-DD HH:MM:SS"（JST）
  participantNames: string[] // 参加ユーザー名（owner 含む）
  facilityNames: string[]  // 予約設備名（Phase D 追加; 設備なし時は空配列）
}

export type ScheduleEntry = {
  scheduleId: number
  name: string
  note: string | null
  place: string | null
  startDate: Date       // UTC に正規化済み
  endDate: Date         // UTC に正規化済み
  publicFlag: 'O' | 'P' | 'C'
  repeatPattern: string // 'N' | 'S' | ...
  isAllDay: boolean     // repeatPattern === 'S'
  parentId: number      // 0=単独予定 / >0=繰り返し子レコードの親 schedule_id
  isOwner: boolean      // ownerId === loginUserId
  ownerId: number
}

export type ScheduleInput = {
  name: string
  note?: string
  place?: string
  startDate: Date
  endDate: Date
  isAllDay: boolean
  publicFlag: 'O' | 'P' | 'C'
}
```

---

## 受け入れ条件

### 表示

- [ ] 当週（日〜土）の7列週カレンダーが表示される
- [ ] 自分が参加者の通常予定（repeat_pattern='N'）が時刻グリッドに表示される
- [ ] 終日予定（repeat_pattern='S'）が日付列上部の帯に表示される
- [ ] 繰り返し予定（既存 DB データ）が正しい日付・時刻で表示される
- [ ] `今日` ボタンで当週に戻れる
- [ ] `◀` `▶` で前週・翌週に移動できる
- [ ] 祝日を含む週では、祝日名が日付列ヘッダーに赤字で表示される

### 予定追加

- [ ] `+予定追加` ボタンから追加モーダルが開く
- [ ] タイトル・日時・場所・内容・公開区分を入力して保存できる
- [ ] 「終日」チェックON で時刻入力が非表示になる
- [ ] 保存後、カレンダーに即時反映される
- [ ] タイトル未入力でバリデーションエラーが表示される
- [ ] 終了時刻が開始時刻より前の場合バリデーションエラーが表示される

### 予定クリック動作

AIPO準拠: 予定ブロックをクリックすると登録フォームが直接開く。

- [ ] 自分が owner の通常予定をクリックすると編集フォームが開く（詳細モーダルを経由しない）
- [ ] 自分が owner の繰り返し予定（parentId > 0）をクリックすると、「この予定のみ変更 / 全ての予定を変更」選択を経て編集フォームが開く
- [ ] 編集フォームに「削除する」ボタンが表示され、クリックすると削除確認ダイアログが表示される
- [ ] 他ユーザーが owner の予定をクリックすると詳細モーダルが開く（編集・削除ボタンなし）
- [ ] 編集・削除後にカレンダーが即時更新される

### 繰り返し予定（Phase A 時点の条件）

- [ ] 繰り返し予定（parent_id > 0）が正しい日付でカレンダーに表示される
- [ ] 予定追加フォームに「繰り返しなし」ボタンが表示される（Phase A ではクリック時に未実装メッセージ）

### タイムゾーン

- [ ] 予定の時刻が JST として正しく表示される（例: DB 値 "14:00" → 画面表示 "14:00"）
- [ ] 終日予定が正しい日付に表示される（例: DB 値 "2026-07-22 00:00:00 JST" → 7月22日の帯）

### レスポンシブ

- [ ] モバイル（375px）でカレンダーがスクロール可能で表示される

---

## 機能要件（Phase B）

### マルチユーザー週表示

- ウィジェットヘッダーに「ユーザーを追加」ボタンを配置する
- ボタンをクリックするとユーザーピッカーモーダルが開く
- 選択したユーザーを「自分のみ」モードに追加し、複数ユーザーの予定を同一カレンダーに重ねて表示する
- 最大表示人数: 30人（AIPO 準拠）。30人を超えた場合はエラートーストを表示する
- ユーザーごとにプリセットカラーで予定ブロックを色分けする
  - 自分（ログインユーザー）: ブランドカラー（オレンジ）
  - 追加ユーザー1〜29: 青・緑・紫・ティール・ピンク等のプリセットパレット
- 選択中ユーザーを「自分 ＋ 追加ユーザー名」のチップ（削除ボタン付き）でヘッダー下部に一覧表示する
- チップの削除ボタン（×）でそのユーザーをビューから削除できる（自分自身は削除不可）
- タブ切り替え・ページリロード後も選択状態を保持する（`oripo_page_widgets.settings` JSONB 列にウィジェットインスタンスごとに保存。AIPO の PSML `portlet_config` 相当）
- **他ユーザー予定の公開区分フィルタ（AIPO 準拠）**:
  - `public_flag='O'`（公開）: 通常表示
  - `public_flag='P'`（非公開）: タイトルを「非公開」に置き換えて表示（枠・時刻は見える）
  - `public_flag='C'`（完全に隠す）: 取得・表示しない。他ユーザーには存在自体を見せない
  - 自分自身の予定は公開区分に関わらず全て表示する（Phase A と同じ）

### ユーザーピッカーモーダル

AIPO の `MemberNormalSelectList` ウィジェットに準拠したデュアルリストボックス UI を採用する。

- **左パネル（参加ユーザーリスト）**: 選択済みユーザーの一覧（`<select multiple>` スタイル）
  - タイトルラベル「参加ユーザーリスト」
  - 選択済みユーザーのリスト
  - 「削除」ボタン（選択したユーザーを右パネルに戻す）
- **右パネル（候補ユーザー）**: 追加可能ユーザーの一覧
  - グループ絞り込みドロップダウン（全グループ・個別グループ選択可）
  - 候補ユーザーのリスト
  - 「追加」ボタン（選択した候補ユーザーを左パネルに移動）
- 氏名フリーワード検索で候補ユーザーを絞り込める（検索ボックス）
- マルチユーザービュー用途: 自分自身は左パネルから削除不可（ロック表示）
- 「決定」ボタンで選択を確定してモーダルを閉じる
- 「キャンセル」ボタンまたはオーバーレイクリックで変更破棄して閉じる

### 参加ユーザー選択（フォーム）

AIPO のスケジュール追加フォームに準拠したレイアウトを採用する。

- 予定追加・編集フォームに「参加ユーザー」フィールドを追加する
- フィールド内には選択済み参加者の氏名を常時表示する（AIPO 準拠: 作成者名＋追加参加者名）
  - 追加済みの場合: 「作成者名、参加者A、参加者B ...」の形式でカンマ区切り表示
  - 未選択時: 作成者名のみ表示（自分自身は常に参加者）
- 「参加ユーザー選択」ボタンをクリックするとユーザーピッカーモーダルが開く
  - マルチユーザービューと同じデュアルリストボックスモーダルを再利用する（`UserPickerModal`）
  - フォーム用途では「自分自身は削除不可」の制約なし（作成者以外の参加者を管理する用途のため）
- 選択した参加ユーザーは `eip_t_schedule_map` に登録する:
  - 作成者: type='U', status='O'（オーナー）
  - 参加者: type='U', status='T'（承認済み）
- 編集時: 既存参加者を削除して再登録する（AIPO 準拠のシンプルな全更新）
- 参加ユーザーのスケジュール詳細モーダルにも参加者名が一覧表示される（Phase A から変更なし）

### レスポンシブ対応（Phase B）

| ブレークポイント | 挙動 |
|---|---|
| デスクトップ（sm 以上） | ユーザーチップをヘッダー行に横並びで表示 |
| モバイル（sm 未満） | ユーザーチップを折り返して表示 |

---

## API（Phase B 追加分）

```ts
// グループ一覧取得（部署（owner_id=1）＋ログインユーザーが作成したマイグループのみ）
// AIPO 準拠: schedule-form-select-group.vm 相当。userId はサーバー側で requireAuth() から取得。
getGroupListAction(): Promise<ScheduleGroup[]>

// グループメンバー取得（アクティブユーザーのみ）
getGroupMembersAction(groupId: number): Promise<ScheduleUser[]>

// 全ユーザー一覧取得（ユーザーピッカー検索用、アクティブユーザーのみ）
getScheduleUsersAction(): Promise<ScheduleUser[]>

// 複数ユーザーの週スケジュール取得
getWeekSchedulesMultiAction(userIds: number[], weekStart: string): Promise<MultiUserScheduleEntry[]>

// ウィジェット設定取得（`oripo_page_widgets.settings` JSONB）
getWidgetSettingsAction(widgetId: number): Promise<Record<string, unknown> | null>

// ウィジェット設定保存（`oripo_page_widgets.settings` JSONB）
saveWidgetSettingsAction(widgetId: number, settings: Record<string, unknown>): Promise<void>
```

### DB クエリ追加（`src/lib/schedule.ts`）

```ts
getWeekSchedulesMulti(userIds: number[], from: Date, to: Date): Promise<MultiUserScheduleEntry[]>
```

---

## データモデル（Phase B 追加・変更）

### `oripo_page_widgets.settings` JSONB（新規カラム）

ウィジェットインスタンスごとの設定を保存する。AIPO の PSML `portlet_config`（`p6a-uids` 等）相当。

| カラム | 型 | 説明 |
|---|---|---|
| `settings` | jsonb | ウィジェット設定 JSON（nullable） |

スケジュールウィジェットの settings スキーマ（`ScheduleWidgetSettings`）:

```ts
type ScheduleWidgetSettings = {
  weekDayGroupId?: number | null  // 週・日ビューの選択グループ ID（null=自分のみ）
  viewMode?: 'block' | 'weekly' | 'day' | 'month' | 'list'  // デフォルト 'block'
  viewDate?: string               // YYYY-MM-DD、デフォルト 当日
}
```

マイグレーション: `src/lib/migrations/2026-07-27_add_widget_settings.ts`

### 型定義追加（`src/lib/schedule.types.ts`）

```ts
// ユーザーピッカー用ユーザー情報
export type ScheduleUser = {
  userId: number
  fullName: string
}

// グループ一覧
export type ScheduleGroup = {
  groupId: number
  groupName: string        // turbine_group.group_alias_name
}

// マルチユーザービュー用エントリ: 誰のカレンダーに表示されているかを追加
export type MultiUserScheduleEntry = ScheduleEntry & {
  viewUserId: number    // このエントリが表示されているユーザーの user_id
  viewUserName: string  // 色凡例・ブロックラベル表示用
}
```

### `ScheduleInput` 変更（`src/lib/schedule.types.ts`）

```ts
export type ScheduleInput = {
  name: string
  note?: string
  place?: string
  startDate: Date
  endDate: Date
  isAllDay: boolean
  publicFlag: 'O' | 'P' | 'C'
  participantIds?: number[]  // Phase B 追加: 参加ユーザー ID リスト（自分を含む）
}
```

---

## 受け入れ条件（Phase B）

### マルチユーザービュー

> Phase D でビューごとのユーザー選択モデルが確定。週・日ビューはグループセレクト（AIPO 準拠）、月・一覧ビューは2段ドロップダウンに変更済み。以下の受け入れ条件は Phase D 実装に準拠する。

- [ ] 週ビュー・日ビューのヘッダーに1段グループセレクト（自分が所属するグループのみ）が表示される
- [ ] グループを選択するとそのグループメンバー全員の予定がカレンダーに表示される
- [ ] 月ビュー・一覧ビューのヘッダーに2段ドロップダウン（全グループ → グループメンバー）が表示される
- [ ] 2段目で特定メンバーを選択するとそのメンバーの予定のみ表示される
- [ ] 他ユーザーの非公開（P）予定は「非公開」とブロック表示される（タイトル非表示）
- [ ] 他ユーザーの完全非公開（C）予定はカレンダーに表示されない

### 参加ユーザー選択（フォーム）

- [ ] 予定追加フォームに「参加ユーザー選択」ボタンが表示される
- [ ] ボタンクリックでユーザーピッカーモーダルが開く
- [ ] 参加ユーザーを選択して「決定」すると、フォームに参加者名リストが表示される
- [ ] 予定保存後、詳細モーダルの「参加ユーザー」欄に追加した参加者が表示される
- [ ] 編集時、既存参加者が初期選択状態でピッカーに表示される

---

## モックアップ（Phase C）

フォームの「繰り返し」「期間で指定」ボタンは要件定義書のモックアップ（`docs/02_requirements/mockups/予定モーダル.png`）に表示済み。繰り返し設定パネル展開後の詳細デザインは Phase C 実装時に Oripo デザインシステムに準拠して実装する。

---

## 機能要件（Phase C）

### 期間で指定（フォーム）

フォームの時刻欄の横に **「期間で指定」** ボタンを追加する（モックアップ準拠）。

- クリックすると開始日・終了日を別々に選択するモードに切り替わる
- 時刻入力は非表示（終日扱い）
- `repeat_pattern = 'S'`、`start_date = 開始日 00:00 JST`、`end_date = (終了日+1日) 00:00 JST`
  - **除外終端（exclusive end）**: AIPO DB の実データに基づく。例: 6/25〜6/26 の期間は `end_date = 6/27 00:00 JST`
- 「繰り返し」と「期間で指定」は排他。片方が選択されているときもう一方は無効化する
- カレンダー表示: 期間中の全日に終日帯（ribbon）が表示される
  - 既存の `repeat_pattern = 'S'` クエリ（`start_date < 週末 AND end_date >= 週始`）で自動的に対応済み

### 繰り返し設定パネル（フォーム）

予定追加・編集フォームの「繰り返しなし」ボタンをクリックすると繰り返し設定パネルが展開する。

**繰り返し種別の選択（タブ切り替え）:**

| 選択肢 | 説明 |
|---|---|
| なし | デフォルト。繰り返しなし（`repeat_pattern='N'` または `'S'`） |
| 毎日 | 毎日繰り返す（`DN` / `DL`） |
| 毎週 | 曜日選択で繰り返す（`W{7bits}N` / `W{7bits}L`） |
| 毎月 | 開始日の日付で毎月繰り返す（`M{DD}N` / `M{DD}L`） |

**毎週の場合:** 曜日チェックボックス（月〜日）を表示。デフォルトは開始日の曜日にチェック。

**毎月の場合:** 「毎月X日」と表示のみ（Xは開始日の日付を自動計算。変更不可）。

**繰り返し期間（AIPO 準拠）:**
- 「終了日なし」（デフォルト）: イベント開始日から2年後まで子レコードを展開
- 「終了日あり」: `[繰り返し開始日] 〜 [繰り返し終了日]` の DatePicker ペアを表示
  - **繰り返し開始日（`limit_start_date`）**: イベント開始日（`start_date`）で初期化。変更可能
    - 変更した場合、変更後の日付以降の出現日から子レコードを展開する
  - **繰り返し終了日（`limit_end_date`）**: 終了日まで子レコードを展開（最大2年で制限）
  - 繰り返し開始日 ≦ 繰り返し終了日 の制約を設ける

### repeat_pattern エンコード規則

| 設定 | repeat_pattern | 例（月〜金） |
|---|---|---|
| 毎日・終了日なし | `DN` | `DN` |
| 毎日・終了日あり | `DL` | `DL` |
| 毎週・終了日なし | `W{7曜日ビット}N` | `W0111110N` |
| 毎週・終了日あり | `W{7曜日ビット}L` | `W0111110L` |
| 毎月・終了日なし | `M{2桁日}N` | `M15N`（毎月15日） |
| 毎月・終了日あり | `M{2桁日}L` | `M15L` |

7曜日ビット: `{日}{月}{火}{水}{木}{金}{土}` の順で各0または1。例: 月〜金 = `0111110`。

### 繰り返し予定の作成（保存処理）

1. **親レコード作成**（`parent_id=0`）
   - `repeat_pattern`: 上記エンコード規則に従い設定
   - `start_date`: 最初の出現の開始時刻（JST）
   - `end_date`:
     - 終了日なし（N）: 最初の出現の終了時刻（`start_date` と同日）
     - 終了日あり（L）: 最後の出現の終了時刻
2. **子レコード作成**（全出現日分）
   - `parent_id = 親.schedule_id`
   - `repeat_pattern = 'N'`
   - `start_date` / `end_date`: その出現日の実際の開始/終了時刻
3. **参加ユーザー登録**（`eip_t_schedule_map`）: 各子レコードに対して登録

> **Oripo-AIPO 差異**: AIPO は動的生成方式（親レコードから都度計算して表示し、子レコードは編集/削除時のみ作成）。Oripo は事前展開方式（全出現日の子レコードを DB に保存）を採用する。シンプルな実装を優先するため意図的に逸脱。

**展開上限:**

| 繰り返し種別 | 無期限時の最大件数（2年分） |
|---|---|
| 毎日 | 730件 |
| 毎週 | 最大104件（曜日数 × 104週） |
| 毎月 | 24件 |

### 繰り返し予定の編集

自分が `owner_id` の繰り返し子レコード（`parentId > 0`）をクリックすると、詳細モーダルを経由せずに直接「この予定のみ変更 / 全ての予定を変更」選択ダイアログを表示する（Phase A 仕様に準拠）。

- **「この予定のみ変更」**: 選択した子レコードのみ更新する
- **「全ての予定を変更」**: 親レコードを更新し、全子レコードを削除して再展開する

「全ての予定を変更」の制約:
- 変更可能: タイトル・時刻・場所・内容・公開区分・参加ユーザー
- 変更不可: 繰り返し種別・終了条件（変更する場合は一度削除して再作成）
- 再展開時に個別編集済みの子レコードも含め全て上書きされる

### 繰り返し予定の削除

編集フォームの「削除」ボタンをクリックすると「この予定のみ削除 / 全ての予定を削除」選択ダイアログを表示する。詳細モーダル経由では削除できない。

- **「この予定のみ削除」**: 選択した子レコードと `eip_t_schedule_map` のみ削除
- **「全ての予定を削除」**: 親レコード・全子レコード・全 `eip_t_schedule_map` を削除

---

## API（Phase C 追加分）

```ts
// 繰り返し予定の追加（子レコードを全出現日分展開して保存）
addRepeatScheduleAction(data: RepeatScheduleInput): Promise<void>

// 繰り返し予定の編集（この予定のみ変更）
updateRepeatOneAction(scheduleId: number, data: ScheduleInput): Promise<void>

// 繰り返し予定の編集（全ての予定を変更: 親更新 + 全子再展開）
// parentId: 子レコードの parent_id 値
// 繰り返し種別・終了条件は変更不可なため RepeatScheduleInput ではなく ScheduleInput を使用する
updateRepeatAllAction(parentId: number, data: ScheduleInput): Promise<void>

// 繰り返し予定の削除（この予定のみ）
deleteRepeatOneAction(scheduleId: number): Promise<void>

// 繰り返し予定の削除（全て）
deleteRepeatAllAction(parentId: number): Promise<void>
```

### DB クエリ追加（`src/lib/schedule.ts`）

```ts
// 子レコードを全出現日分展開してバッチ INSERT（内部処理）
expandAndSaveRepeatChildren(
  parentId: number,
  template: ChildRecordTemplate,
  occurrences: Date[],
  participantIds: number[]
): Promise<void>

// 子レコード全削除（親 ID で削除）
deleteRepeatChildren(parentId: number): Promise<void>

// 繰り返し出現日の計算（`src/lib/repeat.ts` に分離）
calcOccurrenceDates(params: { repeatType: RepeatType; firstStart: Date; weekDays?: boolean[]; limitEndDate?: Date | null }): Date[]
```

---

## データモデル（Phase C）

新規テーブルなし。既存の `eip_t_schedule` + `eip_t_schedule_map` を使用する。

### 親レコードの `start_date` / `end_date` 格納ルール（AIPO準拠）

| 終了条件 | `start_date` | `end_date` |
|---|---|---|
| 終了日なし（N） | 最初の出現の開始時刻 | 最初の出現の終了時刻（同日） |
| 終了日あり（L） | 最初の出現の開始時刻 | 最後の出現の終了時刻 |

既存 AIPO DB データより確認済みのルール。

### 型定義追加（`src/lib/schedule.types.ts`）

```ts
export type RepeatType = 'daily' | 'weekly' | 'monthly'

// 繰り返し予定の作成・「全ての予定を変更」で使用
export type RepeatScheduleInput = {
  name: string
  note?: string
  place?: string
  startDate: Date
  endDate: Date
  publicFlag: 'O' | 'P' | 'C'
  participantIds?: number[]
  repeatType: RepeatType
  weekDays?: boolean[]        // [日, 月, 火, 水, 木, 金, 土]（毎週の場合のみ）
  /** AIPO の limit_start_date 準拠。指定日以降の出現日から子レコードを生成する */
  limitStartDate?: Date | null
  limitEndDate?: Date | null  // null = 2年分展開（無期限）
}
```

### 追加するユーティリティ（`src/lib/repeat.ts`）

繰り返し出現日の計算・`repeat_pattern` エンコード/デコードを独立ファイルに実装する。

```ts
// RepeatScheduleInput から repeat_pattern 文字列を生成
encodeRepeatPattern(input: RepeatScheduleInput): string

// repeat_pattern 文字列をパース（フォーム初期値表示用）
decodeRepeatPattern(pattern: string): { repeatType: RepeatType; weekDays?: boolean[] }

// 全出現日（JST 日付）のリストを生成
calcOccurrenceDates(params: { repeatType: RepeatType; firstStart: Date; weekDays?: boolean[]; limitEndDate?: Date | null }): Date[]
```

---

## 受け入れ条件（Phase C）

### 期間で指定

- [ ] フォームに「期間で指定」ボタンが表示される（モックアップ準拠）
- [ ] 「期間で指定」クリックで開始日・終了日の2つの日付ピッカーが表示され、時刻入力が非表示になる
- [ ] 開始日と終了日が異なる期間予定を保存できる（`repeat_pattern='S'`）
- [ ] 保存後、期間中の全日に終日帯がカレンダーに表示される（例: 6/25〜6/27 → 3日分の帯）
- [ ] 「繰り返し」設定中は「期間で指定」が無効になる（逆も同様）

### 繰り返し予定の作成

- [ ] 予定追加フォームの「繰り返しなし」ボタンをクリックすると繰り返し設定パネルが展開する
- [ ] 繰り返し種別（毎日 / 毎週 / 毎月）を選択できる
- [ ] 「毎週」選択時に曜日チェックボックスが表示され、開始日の曜日がデフォルトチェックされる
- [ ] 「毎月」選択時に開始日から「毎月X日」が表示される（X は開始日の日付）
- [ ] 「終了日あり」を選択して終了日を指定できる
- [ ] 繰り返し予定を保存するとカレンダーに各出現日のブロックが表示される
- [ ] リロード後も繰り返し予定が正しい日付に表示される
- [ ] 毎日2年分（730件）、毎週2年分（最大104件）、毎月2年分（24件）の子レコードが DB に作成される

### 繰り返し予定の編集

- [ ] 自分の繰り返し子レコード（parentId > 0）をクリックすると「この予定のみ変更 / 全ての予定を変更」ダイアログが直接表示される（詳細モーダルを経由しない）
- [ ] 「この予定のみ変更」を選択すると、その出現日のみ変更され他の出現日は変わらない
- [ ] 「全ての予定を変更」を選択すると、全出現日のタイトル・時刻が更新される

### 繰り返し予定の削除

- [ ] 繰り返し予定の編集フォームで「削除」ボタンをクリックすると「この予定のみ削除 / 全ての予定を削除」ダイアログが表示される
- [ ] 「この予定のみ削除」を選択すると、その出現日のみカレンダーから消える（他の出現日は残る）
- [ ] 「全ての予定を削除」を選択すると、全出現日がカレンダーから消える（親レコードも削除）

---

## 機能要件（Phase D）

### ビュー切替

ウィジェットヘッダーの表示モードボタン（Phase A で非活性表示のみだった）を活性化し、以下のビューを実装する。

| ボタンラベル | ビュー | 説明 |
|---|---|---|
| 週 | 週ビュー | Phase A〜C で実装済み |
| 日 | 日ビュー | 1日分の時刻グリッド表示 |
| 月 | 月ビュー | カレンダーグリッド表示 |
| 一覧 | 一覧ビュー | 予定を時系列リスト表示 |

- 選択中のビューボタンをアクティブスタイルで強調する
- ビューを切り替えても「表示対象ユーザー」「現在日付」の状態は引き継ぐ
- 選択中のビューモードと表示基準日を `oripo_page_widgets.settings` に保存し、リロード後も復元する

### ビューごとのユーザー選択モデル（AIPO 準拠）

AIPO のスケジュール調査結果をもとに、ビューを「週・日グループビュー」と「月・一覧ビュー」の2系統に分類して実装する。

| ビュー | AIPO クラス | フィルター UI | 表示 |
|---|---|---|---|
| 週（weekly-group） | `AjaxScheduleWeeklyGroupSelectData` | 1段グループセレクト | グループ全員を色分けして同一グリッドに重ねて表示 |
| 日（oneday-group） | `CellScheduleOnedayGroupSelectData` | 1段グループセレクト | グループ全員をユーザー別列で並列表示 |
| 月（monthly） | `AjaxScheduleMonthlySelectData` | 2段ドロップダウン（グループ→ユーザー） | 常に単一ユーザー |
| 一覧（list） | `ScheduleListSelectData` | 2段ドロップダウン（グループ→ユーザー） | 常に単一ユーザー |

実装上の動作:
- **週・日ビュー（グループビュー）**: ヘッダーに1段グループセレクトを配置する。グループを選択するとそのグループ全員の予定を色分けして並列表示する。未選択時（デフォルト）はログインユーザー自身のみを表示する。グループ一覧はログインユーザーが所属するグループのみ（AIPO `getMyGroups` 相当）。
- **月・一覧ビュー**: ヘッダーの「グループ選択」→「ユーザー選択」の2段ドロップダウンで表示ユーザーを切り替える（AIPO `schedule-monthly.vm` 準拠）。常に単一ユーザーの予定のみ表示する。
- 週・日フィルターと月・一覧フィルターは独立して設定を保持する。

### 日ビュー

AIPO 準拠: `CellScheduleOnedayGroupSelectData`（グループビュー）に相当。

- 表示範囲: 選択日の 00:00〜24:00（時刻軸は週ビューと同じ）
- ヘッダー: `YYYY年MM月DD日（曜日）`
- ナビゲーション: `◀` / `▶` で前日・翌日に移動、`今日` ボタンで当日に戻る
- 終日予定を時刻グリッド上部の帯に表示する
- 通常予定をグリッド内のブロックで表示する（週ビューの1列分を全幅表示）
- フィルター: 週ビューと共通の1段グループセレクトを使用する（上記「ビューごとのユーザー選択モデル」参照）
  - グループ未選択（デフォルト）: 自分のみ → 単一列表示（公開区分で色分け）
  - グループ選択時: グループ全員をユーザー別列で並列表示（各ユーザーをプリセットカラーで色分け）
- 予定ブロッククリックで週ビューと同じ動作（AIPO準拠: 自分の予定 → 編集フォーム直接、他ユーザー予定 → 詳細モーダル）

### 月ビュー

AIPO 準拠: `AjaxScheduleMonthlySelectData` に相当。

- 表示範囲: 選択月の1日〜末日。日曜始まりの7列グリッド（6行まで）（AIPO準拠）
- ヘッダー: `YYYY年MM月`
- ナビゲーション: `◀` / `▶` で前月・翌月に移動、`今日` ボタンで当月に戻る
- 各日セルに予定タイトルを最大2件表示し、超過分は「+N件」表示する（`MAX_EVENTS_PER_CELL = 2`）
- 終日予定・期間予定は各日のセルに表示する（AIPO の連続帯は実装コストが高いため各セル個別表示で代替）
- 当月外の日（前月末尾・翌月先頭）はグレーアウト表示
- 当日はハイライト（背景色）表示
- 土曜は青字、日曜・祝日は赤字で日付表示
- 常に単一ユーザーの予定を表示する（AIPO 準拠。マルチユーザーは週ビューのみ）
- 予定タイトルクリックで週ビューと同じ動作（AIPO準拠: 自分の予定 → 編集フォーム直接、他ユーザー予定 → 詳細モーダル）

### 一覧ビュー

AIPO 準拠: `ScheduleSearchSelectData`（一覧検索）に相当。

- 本日以降の予定を開始日時の昇順で一覧表示する
- 表示件数: 30件。「もっと見る」ボタンで追加 30 件を読み込む（無限スクロールではなくボタン式）
- 各行の表示項目: 開始日時（`YYYY/MM/DD HH:MM`）・終了日時（`HH:MM`）・タイトル・場所（場所がある場合のみ）
- 終日予定は時刻部分を「終日」と表示する
- 各行クリックで週ビューと同じ動作（AIPO準拠: 自分の予定 → 編集フォーム直接、他ユーザー予定 → 詳細モーダル）
- 常に単一ユーザーの予定を表示する（AIPO 準拠。マルチユーザーは週ビューのみ）
- 過去の予定は表示しない（本日以降のみ）
- **キーワードフィルター**（AIPO準拠: `target_keyword`）: 一覧上部にテキスト入力欄を表示し、入力した文字列でタイトル・場所・メモを部分一致（`%keyword%`）検索する（AIPO `ScheduleUtils.getScheduleList` 準拠）。入力クリアで全件表示に戻る

### 設備予約

要件定義書 2.4 準拠: 設備（会議室等）の予約と空き確認。

#### フォームへの設備選択追加

予定追加・編集フォームに「設備」フィールドを追加する。

- 参加ユーザー選択フィールド（Phase B）の下に配置する
- フィールド内に選択済み設備名をカンマ区切りで表示する（未選択時は「なし」または空欄）
- 「設備選択」ボタンをクリックすると設備ピッカーモーダルが開く

#### 設備ピッカーモーダル

2 パネル・行単位ボタン方式の UI を採用する（AIPO `CellScheduleFormFacilityData` 準拠）。

- **左パネル（選択済み設備）**: 選択済み設備リスト。各行に「削除」ボタンを配置
- **右パネル（候補設備）**: 
  - 設備グループ絞り込みドロップダウン（全グループ + 個別グループ）
  - 設備リスト（設備名 + 空き状況バッジ）。各行に「追加」ボタンを配置
- 空き状況は予定フォームで選択中の日時（`startDate`〜`endDate`）に基づいてリアルタイム確認する
  - 空き: 通常表示
  - 使用中: バッジ「使用中」表示 + 選択不可（グレーアウト）
  - 日時未指定の場合: 空き状況バッジは非表示（全設備を選択可能とする）
- 「決定」「キャンセル」ボタンで確定・破棄する
- **空いていない時間帯は選択不可**（要件定義書準拠）

#### 設備の DB 登録

予定保存時、選択した設備を `eip_t_schedule_map` に登録する。

| カラム | 値 | 説明 |
|---|---|---|
| `schedule_id` | 保存した予定の schedule_id | FK |
| `user_id` | 設備の `facility_id` | type='F' 時は設備 ID |
| `type` | `'F'` | 設備を示す固定値（AIPO 準拠） |
| `status` | `'O'` | AIPO の実データに基づく固定値 |
| `common_category_id` | `1` | FK 制約により固定 |

編集時: 既存の `type='F'` レコードを削除して再登録する（ユーザー参加者と同じ全更新方式）。

#### 設備予約の表示

- 詳細モーダルの「参加ユーザー」欄の下に「予約設備」欄を追加する
- 設備が予約されている場合、設備名リストを表示する
- 設備が予約されていない場合、「予約設備」欄を表示しない

### ScheduleWidgetSettings 変更

`viewMode` と `viewDate` を settings に追加してビュー状態をリロード後も復元する。

```ts
type ScheduleWidgetSettings = {
  weekDayGroupId?: number | null  // 週・日ビューの選択グループ ID（null=自分のみ）
  viewMode?: 'block' | 'weekly' | 'day' | 'month' | 'list'  // デフォルト 'block'
  viewDate?: string               // YYYY-MM-DD、デフォルト 当日
}
```

### レスポンシブ対応（Phase D）

| ブレークポイント | 挙動 |
|---|---|
| デスクトップ（lg 以上） | 全ビューを通常表示 |
| モバイル（lg 未満） | 日ビュー: 週ビューと同様に1列表示。月ビュー: セル幅を縮小・タイトルは1件まで表示。一覧: そのまま縦スクロール。設備ピッカー: 上下2段レイアウト（ユーザーピッカーと同様） |

---

## API（Phase D 追加分）

```ts
// 日ビュー: 指定日のスケジュール取得（getWeekSchedulesMulti を日範囲で呼び出す）
getDaySchedulesAction(date: string, userIds: number[]): Promise<MultiUserScheduleEntry[]>

// 月ビュー: 指定月のスケジュール取得（getWeekSchedulesMulti を月範囲で呼び出す）
getMonthSchedulesAction(month: string, userIds: number[]): Promise<MultiUserScheduleEntry[]>

// 一覧ビュー: 本日以降の予定を offset/limit ページングで取得
getListSchedulesAction(from: string, userIds: number[], limit: number, offset: number, keyword?: string): Promise<MultiUserScheduleEntry[]>

// 設備一覧取得（全設備 + グループ情報）
getFacilitiesAction(): Promise<FacilityWithGroup[]>

// 設備の空き確認（指定日時に予約済みの facility_id 配列を返す）
// 呼び出し元で Set<number> に変換して使用する
// excludeScheduleId: 編集中スケジュール自身を除外（設備再選択時の誤判定防止）
getFacilityAvailabilityAction(startDate: string, endDate: string, excludeScheduleId?: number): Promise<number[]>

// 編集フォーム初期化用: スケジュールの予約設備 ID 一覧を取得
getScheduleFacilityIdsAction(scheduleId: number): Promise<number[]>

// 週・日ビュー用グループセレクト: ログインユーザーが所属するグループ一覧を取得
// 全グループではなく自分が所属するグループのみ（AIPO getMyGroups 相当）
getMyGroupsAction(): Promise<ScheduleGroup[]>  // userId はサーバー側で requireAuth() から取得（クライアントから渡さない）
```

### DB クエリ追加（`src/lib/schedule.ts`）

日/月ビューは `getWeekSchedulesMulti` を異なる日付範囲で呼び出して対応（新関数なし）。

```ts
// 一覧ビュー: start_date 基準で昇順取得（週ビューの end_date 基準とは異なる）
getListSchedules(loginUserId: number, userIds: number[], from: Date, limit: number, offset: number, keyword?: string): Promise<MultiUserScheduleEntry[]>

// 設備一覧取得（LEFT JOIN でグループ情報付き、sort 昇順）
getFacilities(): Promise<FacilityWithGroup[]>

// 設備空き確認（半開区間: start < endDate AND end > startDate）
// excludeScheduleId: 編集中スケジュール自身を除外（自分の設備を「使用中」と誤判定しない）
// 繰り返し予定の親レコード（repeat_pattern!='N' かつ parent_id=0）は end_date がシリーズ全体の
// 終端（数年先）になるため除外する。AIPO は parent_id=0 を「親なし」として使用している。
// 【既知の制限】繰り返し予定のパターン通りの発生（子レコードが存在しない仮想発生）は検出不可。
// ただし AIPO 自体に設備の空き確認機能がないため、これは AIPO より高機能な状態であり許容する。
getBookedFacilityIds(startDate: Date, endDate: Date, excludeScheduleId?: number): Promise<number[]>

// 編集フォーム初期値用: type='F' のレコードから facility_id を取得
getScheduleFacilityIds(scheduleId: number): Promise<number[]>
```

---

## データモデル（Phase D）

新規テーブルなし。既存テーブルを使用する。

### `eip_m_facility`（設備マスタ、既存）

| カラム | 型 | 説明 |
|---|---|---|
| `facility_id` | integer | PK |
| `user_id` | integer | 登録者 user_id |
| `facility_name` | varchar(64) | 設備名 |
| `note` | text | 備考（nullable） |
| `sort` | integer | 表示順 |
| `create_date` | date | 登録日 |
| `update_date` | timestamp | 更新日時 |

### `eip_m_facility_group`（設備グループ、既存）

| カラム | 型 | 説明 |
|---|---|---|
| `group_id` | integer | PK |
| `group_name` | varchar(64) | グループ名 |

### `eip_m_facility_group_map`（グループ↔設備マッピング、既存）

| カラム | 型 | 説明 |
|---|---|---|
| `id` | integer | PK |
| `facility_id` | integer | FK → eip_m_facility |
| `group_id` | integer | FK → eip_m_facility_group |

### 型定義追加（`src/lib/schedule.types.ts`）

```ts
// 設備情報（グループ名含む）
export type FacilityWithGroup = {
  facilityId: number
  facilityName: string
  groupName: string | null
  sort: number
}

// ScheduleInput 変更: 設備 ID リスト追加
export type ScheduleInput = {
  name: string
  note?: string
  place?: string
  startDate: Date
  endDate: Date
  isAllDay: boolean
  publicFlag: 'O' | 'P' | 'C'
  participantIds?: number[]
  periodEndDate?: Date     // Phase C: 期間指定の終了日（isAllDay=true かつ期間指定の場合のみ）
  facilityIds?: number[]  // Phase D 追加
}

// RepeatScheduleInput にも同じく追加
export type RepeatScheduleInput = {
  // ... 既存フィールド ...
  facilityIds?: number[]  // Phase D 追加
}
```

---

## 受け入れ条件（Phase D）

### ビュー切替

- [ ] ウィジェットヘッダーの「日」「月」「一覧」ボタンが活性化され、クリックでビューが切り替わる
- [ ] 選択中のビューボタンがアクティブスタイルで表示される
- [ ] ビュー切替後にリロードすると、切り替え前のビューが復元される

### 日ビュー

- [ ] 選択日の予定が 00:00〜24:00 の時刻グリッドに表示される
- [ ] 終日予定がグリッド上部の帯に表示される
- [ ] `◀` `▶` で前日・翌日に移動できる、`今日` ボタンで当日に戻る
- [ ] 自分の予定ブロッククリックで編集フォームが直接開く（詳細モーダルを経由しない）
- [ ] 他ユーザーの予定ブロッククリックで詳細モーダルが開く
- [ ] グループ未選択時: 自分の予定のみ単一列表示される（AIPO oneday-group デフォルト動作）
- [ ] 1段グループセレクトでグループを選択するとグループ全員の予定がユーザー別列で並列表示される（AIPO oneday-group 準拠）
- [ ] 週ビューのグループ設定が日ビューにも引き継がれる（週・日で共通フィルター）
- [ ] モバイル（375px）でも正しく表示・操作できる

### 月ビュー

- [ ] 選択月の全日がカレンダーグリッドに表示される
- [ ] 各日セルに予定タイトルが最大2件表示され、超過分は「+N件」と表示される
- [ ] 終日・期間予定が各日のセルに個別に表示される
- [ ] `◀` `▶` で前月・翌月に移動できる、`今日` ボタンで当月に戻る
- [ ] 当日セルがハイライト表示される
- [ ] 土曜は青字、日曜・祝日は赤字で日付表示される
- [ ] 自分の予定タイトルクリックで編集フォームが直接開く（詳細モーダルを経由しない）
- [ ] 他ユーザーの予定タイトルクリックで詳細モーダルが開く
- [ ] 常に1人のユーザーの予定のみ表示される（AIPO 準拠: 非週ビューは単一ユーザー）
- [ ] ヘッダーの「グループ選択」→「ユーザー選択」の2段ドロップダウンで別ユーザーの予定に切り替えられる
- [ ] モバイル（375px）でも正しく表示・操作できる

### 一覧ビュー

- [ ] 本日以降の予定が開始日時の昇順でリスト表示される
- [ ] 過去の予定は表示されない
- [ ] 「もっと見る」ボタンで追加 30 件が読み込まれる
- [ ] 各行に開始日時・終了時刻・タイトル・場所が表示される
- [ ] 終日予定の時刻部分が「終日」と表示される
- [ ] 自分の予定クリックで編集フォームが直接開く（詳細モーダルを経由しない）
- [ ] 他ユーザーの予定クリックで詳細モーダルが開く
- [ ] 常に1人のユーザーの予定のみ表示される（AIPO 準拠: 非週ビューは単一ユーザー）
- [ ] ヘッダーの「グループ選択」→「ユーザー選択」の2段ドロップダウンで別ユーザーの予定に切り替えられる
- [ ] キーワード入力でタイトル・場所・メモを部分一致で絞り込み検索できる
- [ ] キーワードをクリアすると全件表示に戻る
- [ ] モバイル（375px）でも正しく表示・操作できる

### 設備予約

- [ ] 予定追加・編集フォームに「設備選択」ボタンが表示される
- [ ] ボタンクリックで設備ピッカーモーダルが開く
- [ ] モーダルに設備グループ絞り込みドロップダウンと設備リストが表示される
- [ ] 予定の日時が入力済みの場合、使用中の設備が「使用中」バッジで選択不可になる
- [ ] 空いている設備を選択して「決定」するとフォームに設備名が表示される
- [ ] 設備を選択して予定を保存すると、詳細モーダルの「予約設備」欄に設備名が表示される
- [ ] 編集時、既存の予約設備がピッカーの初期選択状態で表示される
- [ ] 設備なしで保存した予定は詳細モーダルに「予約設備」欄が表示されない
- [ ] モバイル（375px）でも設備ピッカーが正しく操作できる

---

## モックアップ（Phase E）

- ブロックビューのスケジュールブロックデザイン（左端カラーバー）: `specs/images/ホーム.png` を参照

---

## 機能要件（Phase E）

### ブロックビューの有効化

現在 `disabled` 状態の「ブロック」ボタンを有効化する。

- ブロックボタンをクリックすると `viewMode='block'`（週間グループカレンダー）に切り替わる
- AIPO の `schedule-calendar.vm`（`tab='calendar'`）に相当するビューが「ブロック」である
  - AIPO では「ブロック」が AJAX 時刻ブロックカレンダー（`schedule-calendar.vm`）、「週」がテーブル型週表示（`schedule-weekly.vm`）にマッピングされる
- 「週」ボタン（`viewMode='weekly'`）: AIPO `schedule-weekly.vm` 相当のテーブル型週表示（Phase E で実装）
  - 7列（日〜土）のグリッドで各セルに予定名・開始時刻を一覧表示する
  - `ScheduleWeeklyTableView` コンポーネントで実装
  - グループフィルターは週・日ビューと共通の1段セレクトを使用する
  - セルクリックで予定追加フォームを開く（時刻は指定しない）
- `settings.viewMode='block'` を復元した際は「ブロック」ボタンをアクティブ状態にする（ブロックがデフォルト）

### スケジュールブロックのデザイン改善

モックアップ（`specs/images/ホーム.png`）準拠。現在の実装では予定ブロックが背景色で一面塗りだが、モックアップでは薄い背景色 + 左端の縦カラーバーの組み合わせになっている。

- 週・日ビューの `ScheduleBlock` に左端縦カラーバー（`border-l-2` 相当）を追加する
- ブロック背景色は現在の solid から薄い色（`/15` 透過）に変更する
- カラーバー色は現在の背景色（solid）をそのまま適用する
- テキストは `text-gray-900`（濃いグレー）で視認性を確保する

### 空き時間クリックで予定追加

AIPO の週ビュー・日ビューでは、スケジュールが登録されていない時間帯をクリック（またはドラッグ）するとその時刻で予定登録フォームが開く。

- 週ビュー: 各日カラムの空き時間帯をクリックすると、クリックした日時を初期値として予定追加フォームが開く
- 日ビュー（`ScheduleDayView`）: 空き時間帯をクリックすると同様に予定追加フォームが開く
- クリック位置から時刻を算出（`HOUR_PX` を使用して `top` から分単位で計算、30分単位に丸める）
- 予定追加フォームの初期値: `date=クリック日`, `startTime=クリック時刻`, `endTime=startTime+1時間`
  - **Oripo 独自の簡化**: AIPO はドラッグ範囲で `startTime`/`endTime` を決定し、クリック時は `endTime=startTime+30分` になるが、Oripo ではドラッグ選択を省略しクリック単操作で `endTime=startTime+1時間` 固定とする

### JST 変換ユーティリティ追加

`ScheduleFormModal.tsx` に `new Date(\`${dateStr}T${time}:00+09:00\`)` パターンが多数散在している。
`src/lib/jst.ts` に共通関数 `makeDateJst` を追加して集約する。

```ts
// 'YYYY-MM-DD' + 'HH:MM' → JST を UTC で表現した Date
// timeStr を省略した場合は 00:00 JST（その日の深夜0時）
export function makeDateJst(dateStr: string, timeStr?: string): Date {
  return new Date(`${dateStr}T${timeStr ?? '00:00'}:00+09:00`)
}
```

### 設備・ユーザーピッカーの共通コンポーネント化

`FacilityPickerModal.tsx` と `UserPickerModal.tsx` はモーダルシェル（ヘッダー・2カラムコンテナ・フッター）の UI 構造を共有しているため、ここだけを共通コンポーネント `TwoColumnPickerModal` に抽出する。

- 共通コンポーネント `TwoColumnPickerModal` を `src/app/(main)/_components/widgets/TwoColumnPickerModal.tsx` に作成する
- `PickerItem[]`（アイテムデータ）と `selectionMode` を渡すデータ駆動型で実装する
  - `immediate` モード（設備): 各行に「追加」リンク・左パネルに「削除」リンク
  - `highlight` モード（ユーザー): クリックでハイライット→「追加」ボタンで確定、ハイライット状態はコンポーネント内部で管理
- ローディング表示（`isLoading`）・検索・グループ絞り込みも共通化
- `FacilityPickerModal` と `UserPickerModal` はデータを組み立てて渡すだけになる

---

## API（Phase E 追加分）

なし（既存 Action で対応可能）

---

## データモデル（Phase E）

### TwoColumnPickerModal コンポーネント Props

`FacilityPickerModal` と `UserPickerModal` はどちらも `selectionMode="immediate"` を使用する（AIPO 仕様確認済み: 両者とも単一クリック即追加で統一）。
- **仕様変更**: 当初 `UserPickerModal` は `highlight` モード（ハイライット→まとめて追加）を想定していたが、AIPO 実装確認の結果 `FacilityPickerModal` と同じ即時追加方式に統一した。
- `locked` アイテム（自分自身など）は削除不可で「（自分）」ラベルを表示する。
- `highlight` モードのコードは `TwoColumnPickerModal` 内に残存しており、将来的な拡張に対応可能。

```ts
export type PickerItem = {
  id: number
  label: string
  badge?: string       // 「使用中」等のバッジテキスト
  disabled?: boolean   // immediate モードで追加不可
  locked?: boolean     // 削除不可（自分自身など）: immediate では「削除」ボタンを非表示にし「（自分）」ラベルを表示する
}

type TwoColumnPickerModalProps = {
  title: string
  leftLabel: string
  selectedItems: PickerItem[]
  availableItems: PickerItem[]
  selectionMode: 'immediate' | 'highlight'
  onAdd: (ids: number[]) => void
  onRemove: (ids: number[]) => void
  leftHeaderExtra?: React.ReactNode   // 「N 人選択中」等
  searchValue?: string
  onSearchChange?: (v: string) => void
  searchPlaceholder?: string
  filterOptions?: Array<{ value: string; label: string }>
  filterValue?: string
  onFilterChange?: (v: string) => void
  isLoading?: boolean
  onConfirm: () => void
  onClose: () => void
}
```

---

## 受け入れ条件（Phase E）

### ブロックビュー有効化

- [ ] 「ブロック」ボタンをクリックするとアクティブ状態になり週間グループカレンダーが表示される
- [ ] 「ブロック」ボタンは `disabled`（灰色・クリック不可）ではなくボタンとして機能する

### スケジュールブロックのデザイン

- [ ] 週ビュー・日ビューの予定ブロックに左端縦カラーバーが表示される
- [ ] ブロックの背景色が薄く（半透明）表示され、テキストが読みやすい

### 空き時間クリックで予定追加

- [ ] 週ビューの空き時間帯をクリックするとクリック位置の日時（30分単位）で予定追加フォームが開く
- [ ] 日ビューの空き時間帯をクリックするとクリック位置の時刻（30分単位）で予定追加フォームが開く
- [ ] 空き時間クリックで開いたフォームに正しい日付・開始時刻が初期値として入力されている

### JST 変換ユーティリティ

- [ ] `jst.ts` に `makeDateJst(dateStr, timeStr?)` 関数が追加されている
- [ ] `ScheduleFormModal.tsx` のテンプレートリテラル変換が `makeDateJst` に置き換えられている

### 設備・ユーザーピッカー共通コンポーネント

- [ ] `TwoColumnPickerModal` コンポーネントが作成されている
- [ ] `FacilityPickerModal` と `UserPickerModal` が `TwoColumnPickerModal` を使用している
- [ ] 既存の設備選択・ユーザー選択の動作が変わらない
- [ ] `UserPickerModal` が `selectionMode="immediate"` を使用している（クリックで即追加・削除リンクで即削除）

### 週テーブルビュー（`viewMode='weekly'`）

- [ ] 「週」ボタンをクリックすると `viewMode='weekly'` に切り替わり、テーブル型週表示が表示される
- [ ] 7列（日〜土）のグリッドで各日の予定が列挙表示される
- [ ] 各予定に開始時刻（終日予定を除く）と予定名が表示される
- [ ] 前週・次週ナビゲーション、今日ボタンが機能する
- [ ] グループフィルター（1段セレクト）が表示される
- [ ] 日付セルをクリックすると予定追加フォームが開く
- [ ] 予定をクリックすると詳細モーダル or 編集フォームが開く（週ビューと同じ挙動）
- [ ] 祝日は日曜と同様に赤色で表示される
- [ ] 今日のセルが強調表示（背景オレンジ）される
