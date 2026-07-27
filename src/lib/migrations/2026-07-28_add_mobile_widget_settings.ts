import { type Kysely, sql } from 'kysely'

// モバイル表示時のウィジェット設定を保存するテーブル。
// oripo_page_widgets はPC版のページ構成に紐づくため、PCからウィジェットを削除しても
// モバイルの設定（スケジュールの選択ユーザー等）が消えないよう専用テーブルを用意する。
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('oripo_mobile_widget_settings')
    .addColumn('user_id', 'integer', (col) =>
      col.notNull().references('turbine_user.user_id').onDelete('cascade')
    )
    .addColumn('widget_type', 'text', (col) => col.notNull())
    .addColumn('settings', 'jsonb', (col) => col.notNull().defaultTo(sql`'{}'::jsonb`))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addPrimaryKeyConstraint('oripo_mobile_widget_settings_pkey', ['user_id', 'widget_type'])
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('oripo_mobile_widget_settings').execute()
}
