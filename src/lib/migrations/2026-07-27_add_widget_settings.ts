import { type Kysely } from 'kysely'

// ウィジェットインスタンスごとの設定（選択ユーザー等）を永続化するため settings 列を追加。
// AIPO は PSML（portlet_config）にポートレットごとの設定を保存していた（例: p6a-uids=選択ユーザーID）。
// oripo では同等の仕組みとして oripo_page_widgets.settings JSONB を使用する。
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('oripo_page_widgets')
    .addColumn('settings', 'jsonb')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('oripo_page_widgets')
    .dropColumn('settings')
    .execute()
}
