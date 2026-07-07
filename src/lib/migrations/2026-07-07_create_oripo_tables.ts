import type { Kysely, sql } from 'kysely'

// 不使用のAIPOテーブル一覧（削除しない・読み取りもしない）
//
// ページ設定（Jetspeed）:
//   jetspeed_user_profile, jetspeed_group_profile, jetspeed_role_profile
//
// メール:
//   eip_m_mail_account, eip_m_mail_notify_conf
//   eip_t_mail, eip_t_mail_filter, eip_t_mail_folder
//
// ブログ:
//   eip_t_blog, eip_t_blog_entry, eip_t_blog_comment,
//   eip_t_blog_file, eip_t_blog_footmark_map, eip_t_blog_thema
//
// 掲示板:
//   eip_t_msgboard_topic, eip_t_msgboard_category,
//   eip_t_msgboard_category_map, eip_t_msgboard_file
//
// ワークフロー:
//   eip_t_workflow_request, eip_t_workflow_request_map,
//   eip_t_workflow_route, eip_t_workflow_category, eip_t_workflow_file
//
// タイムカード:
//   eip_t_timecard, eip_t_timecard_settings,
//   eip_t_ext_timecard, eip_t_ext_timecard_system, eip_t_ext_timecard_system_map
//
// TODO:
//   eip_t_todo, eip_t_todo_category
//
// メモ:
//   eip_t_note, eip_t_note_map, eip_t_memo
//
// タイムライン:
//   eip_t_timeline, eip_t_timeline_map, eip_t_timeline_file,
//   eip_t_timeline_like, eip_t_timeline_url
//
// 報告書:
//   eip_t_report, eip_t_report_map, eip_t_report_file, eip_t_report_member_map
//
// キャビネット:
//   eip_t_cabinet_file, eip_t_cabinet_folder, eip_t_cabinet_folder_map
//
// アドレス帳:
//   eip_m_addressbook, eip_m_addressbook_company, eip_m_address_group,
//   eip_t_addressbook_group_map
//
// ACL（AIPO独自権限管理）:
//   eip_t_acl_map, eip_t_acl_role, eip_t_acl_portlet_feature, eip_t_acl_user_role_map
//
// その他:
//   activity, activity_map, aipo_license, app_data, application,
//   container_config, eip_m_company, eip_m_config, eip_m_inactive_application,
//   eip_m_position, eip_m_user_position, eip_t_common_category,
//   jetspeed_user_profile, module_id,
//   oauth_consumer, oauth_entry, oauth_token,
//   turbine_permission, turbine_role_permission

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('oripo_sessions')
    .addColumn('session_id', 'text', (col) => col.primaryKey())
    .addColumn('user_id', 'integer', (col) =>
      col.notNull().references('turbine_user.user_id')
    )
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .addColumn('expires_at', 'timestamptz', (col) => col.notNull())
    .addColumn('ip_addr', 'text')
    .execute()

  await db.schema
    .createTable('oripo_pages')
    .addColumn('page_id', 'serial', (col) => col.primaryKey())
    .addColumn('user_id', 'integer', (col) =>
      col.notNull().references('turbine_user.user_id')
    )
    .addColumn('page_name', 'text', (col) => col.notNull())
    .addColumn('sort_order', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('is_default', 'boolean', (col) => col.notNull().defaultTo(false))
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .execute()

  await db.schema
    .createTable('oripo_page_widgets')
    .addColumn('widget_id', 'serial', (col) => col.primaryKey())
    .addColumn('page_id', 'integer', (col) =>
      col.notNull().references('oripo_pages.page_id').onDelete('cascade')
    )
    .addColumn('widget_type', 'text', (col) => col.notNull())
    .addColumn('col', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('row', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('oripo_page_widgets').execute()
  await db.schema.dropTable('oripo_pages').execute()
  await db.schema.dropTable('oripo_sessions').execute()
}
