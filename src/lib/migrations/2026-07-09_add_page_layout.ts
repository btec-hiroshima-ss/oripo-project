import { type Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('oripo_pages')
    .addColumn('layout', 'text', (col) =>
      col.notNull().defaultTo('TwoColumnsRight')
    )
    .execute()

  await sql`
    ALTER TABLE oripo_page_widgets
    ADD CONSTRAINT oripo_page_widgets_page_id_widget_type_unique
    UNIQUE (page_id, widget_type)
  `.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE oripo_page_widgets
    DROP CONSTRAINT oripo_page_widgets_page_id_widget_type_unique
  `.execute(db)

  await db.schema.alterTable('oripo_pages').dropColumn('layout').execute()
}
