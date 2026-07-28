# スケジュールウィジェット

## 概要

ホーム画面に表示するスケジュール管理ウィジェット。個人の予定を週カレンダー形式で表示・管理する。

AIPO 準拠: `portlets/schedule`（週表示ウィジェット）に相当。

### フェーズ分割

| フェーズ | Issue | 内容 | 状態 |
|---|---|---|---|
| **A** | #81 | 週表示・自分のみ・予定 CRUD（繰り返しなし） | 完了 ✅ |
| **B** | #81 | マルチユーザー表示・参加ユーザー選択 | 完了 ✅ |
| **C（本 Issue）** | #81 | 繰り返し予定の作成・編集・削除 | 実装中 |
| D | #81 | 設備予約・日/月/一覧ビュー | 未着手 |

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

- 月曜始まりで当週の7日間（月〜日）を列表示する
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

### 予定詳細・編集・削除

- スケジュールブロッククリック → 詳細モーダル（タイトル・日時・場所・内容・公開区分）
- 詳細モーダルから「編集」→ 編集フォーム（追加フォームと同構成）
- 削除は確認ダイアログ後に `eip_t_schedule` と `eip_t_schedule_map` の両方を削除
- 自分が `owner_id` でない予定は編集・削除不可（AIPO 準拠）
  - ただし管理者ロールは他ユーザーの予定も編集可（Phase A では管理者判定はスキップ）

### 繰り返し予定（既存データ）の閲覧

- 繰り返し子レコード（`parent_id > 0`）はカレンダー上に通常予定と同様に表示する
- クリックすると詳細モーダルが開くが、**編集・削除ボタンを非表示**にする（Phase C で対応）
- 詳細モーダルに「繰り返し予定です（編集は Phase C で対応予定）」を表示する

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

- [ ] 当週（月〜日）の7列週カレンダーが表示される
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

### 予定詳細モーダル

- [ ] ブロッククリックで詳細モーダルが開く
- [ ] モーダルにタイトル・日時・場所・内容・公開区分が表示される
- [ ] モーダルに参加ユーザー・登録者（名前＋日付）・更新者（名前＋日時）が表示される
- [ ] 自分が owner の場合、削除する場合の条件（この予定のみ / 完全に削除 / 参加ユーザー全員）をラジオで選択できる
- [ ] 「編集する」「削除する」「コピーして登録する」「閉じる」ボタンが表示される（owner のみ最初の3つ）
- [ ] 他ユーザーが owner の予定は「閉じる」ボタンのみ表示される
- [ ] 編集・削除後にカレンダーが即時更新される

### 繰り返し予定（Phase A 時点の条件）

- [ ] 繰り返し予定（parent_id > 0）が正しい日付でカレンダーに表示される
- [ ] 繰り返し予定の詳細モーダルに編集・削除ボタンが表示されない（Phase C で変更予定）
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
// グループ一覧取得（システムグループ除外、alias_name あり）
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
  viewUserIds: number[]                // 選択中ユーザー ID リスト
  viewUserNames: Record<string, string> // ID → 氏名マップ（スケジュール0件週でも名前を表示するためキャッシュ）
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

- [ ] ヘッダーに「ユーザーを追加」ボタンが表示される
- [ ] ボタンクリックでユーザーピッカーモーダルが開く
- [ ] グループを展開してメンバーを選択できる
- [ ] 氏名フリーワード検索でユーザーを絞り込める
- [ ] 選択確定後、カレンダーに追加ユーザーの予定が重ねて表示される
- [ ] 追加ユーザーの予定ブロックは自分と異なる色で表示される
- [ ] 選択ユーザーのチップがヘッダー下部に表示され、× で削除できる
- [ ] 31人目を追加しようとするとエラートーストが表示される
- [ ] 追加ユーザー削除後、そのユーザーの予定がカレンダーから消える
- [ ] 他ユーザーの非公開（P）予定は「非公開」とブロック表示される（タイトル非表示）
- [ ] 他ユーザーの完全非公開（C）予定はカレンダーに表示されない
- [ ] タブを切り替えてマイページに戻っても選択ユーザーが保持される（DB 保存のためリロード後も保持）

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

**終了条件:**
- 「終了日なし」（デフォルト）: 開始日から2年後まで子レコードを展開
- 「終了日あり」: 終了日 DatePicker を表示。終了日まで子レコードを展開（最大2年で制限）

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

繰り返し子レコード（`parentId > 0`）の詳細モーダルで「編集する」をクリックすると、以下の確認ダイアログを表示する:

- **「この予定のみ変更」**: 選択した子レコードのみ更新する
- **「全ての予定を変更」**: 親レコードを更新し、全子レコードを削除して再展開する

「全ての予定を変更」の制約:
- 変更可能: タイトル・時刻・場所・内容・公開区分・参加ユーザー
- 変更不可: 繰り返し種別・終了条件（変更する場合は一度削除して再作成）
- 再展開時に個別編集済みの子レコードも含め全て上書きされる

### 繰り返し予定の削除

繰り返し子レコード（`parentId > 0`）の詳細モーダルで「削除する」をクリックすると、以下の確認ダイアログを表示する:

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
updateRepeatAllAction(parentId: number, data: RepeatScheduleInput): Promise<void>

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
calcOccurrences(input: RepeatScheduleInput): Date[]
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
export type RepeatType = 'none' | 'daily' | 'weekly' | 'monthly'

// 繰り返し予定の作成・「全ての予定を変更」で使用
export type RepeatScheduleInput = ScheduleInput & {
  repeatType: Exclude<RepeatType, 'none'> // 'daily' | 'weekly' | 'monthly'
  repeatWeekDays?: boolean[]              // [日, 月, 火, 水, 木, 金, 土]（毎週の場合のみ）
  limitEndDate?: Date | null             // null = 終了日なし
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
calcOccurrences(input: RepeatScheduleInput): Date[]
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

- [ ] 繰り返し子レコード（parentId > 0）の詳細モーダルに「編集する」ボタンが表示される
- [ ] 「編集する」クリックで「この予定のみ変更 / 全ての予定を変更」ダイアログが表示される
- [ ] 「この予定のみ変更」を選択すると、その出現日のみ変更され他の出現日は変わらない
- [ ] 「全ての予定を変更」を選択すると、全出現日のタイトル・時刻が更新される

### 繰り返し予定の削除

- [ ] 繰り返し子レコード（parentId > 0）の詳細モーダルに「削除する」ボタンが表示される
- [ ] 「削除する」クリックで「この予定のみ削除 / 全ての予定を削除」ダイアログが表示される
- [ ] 「この予定のみ削除」を選択すると、その出現日のみカレンダーから消える（他の出現日は残る）
- [ ] 「全ての予定を削除」を選択すると、全出現日がカレンダーから消える（親レコードも削除）
