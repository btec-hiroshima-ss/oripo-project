/**
 * AIPOスキーマのクリーンアップ
 *
 * Oripoのスコープ外テーブル・カラムを削除する。
 * 開発中に必要なテーブルが変わる可能性があるため、
 * 実際に適用する前に内容を確認・調整すること。
 */
import type { Kysely } from 'kysely'
import { sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  // -------------------------------------------------------
  // 1. スコープ外テーブルの削除（CASCADE で子テーブルも一括削除）
  // -------------------------------------------------------

  // ブログ
  await sql`DROP TABLE IF EXISTS eip_t_blog CASCADE`.execute(db)
  await sql`DROP TABLE IF EXISTS eip_t_blog_thema CASCADE`.execute(db)

  // 掲示板
  await sql`DROP TABLE IF EXISTS eip_t_msgboard_category CASCADE`.execute(db)
  await sql`DROP TABLE IF EXISTS eip_t_msgboard_topic CASCADE`.execute(db)

  // Todo
  await sql`DROP TABLE IF EXISTS eip_t_todo_category CASCADE`.execute(db)
  await sql`DROP TABLE IF EXISTS eip_t_todo CASCADE`.execute(db)

  // ワークフロー（循環参照があるため制約を先に外す）
  await sql`ALTER TABLE eip_t_workflow_request DROP CONSTRAINT IF EXISTS eip_t_workflow_request_category_id_fkey`.execute(db)
  await sql`DROP TABLE IF EXISTS eip_t_workflow_route CASCADE`.execute(db)
  await sql`DROP TABLE IF EXISTS eip_t_workflow_category CASCADE`.execute(db)
  await sql`DROP TABLE IF EXISTS eip_t_workflow_request CASCADE`.execute(db)

  // 報告書
  await sql`DROP TABLE IF EXISTS eip_t_report CASCADE`.execute(db)

  // 勤怠
  await sql`DROP TABLE IF EXISTS eip_t_ext_timecard_system CASCADE`.execute(db)
  await sql`DROP TABLE IF EXISTS eip_t_ext_timecard CASCADE`.execute(db)
  await sql`DROP TABLE IF EXISTS eip_t_timecard_settings CASCADE`.execute(db)
  await sql`DROP TABLE IF EXISTS eip_t_timecard CASCADE`.execute(db)

  // メール
  await sql`DROP TABLE IF EXISTS eip_m_mail_account CASCADE`.execute(db)
  await sql`DROP TABLE IF EXISTS eip_m_mail_notify_conf CASCADE`.execute(db)
  await sql`DROP TABLE IF EXISTS eip_t_mail_filter CASCADE`.execute(db)
  await sql`DROP TABLE IF EXISTS eip_t_mail_folder CASCADE`.execute(db)
  await sql`DROP TABLE IF EXISTS eip_t_mail CASCADE`.execute(db)

  // 伝言メモ
  await sql`DROP TABLE IF EXISTS eip_t_note CASCADE`.execute(db)

  // メモ
  await sql`DROP TABLE IF EXISTS eip_t_memo CASCADE`.execute(db)

  // 共有フォルダ
  await sql`DROP TABLE IF EXISTS eip_t_cabinet_folder CASCADE`.execute(db)
  await sql`DROP TABLE IF EXISTS eip_t_cabinet_file CASCADE`.execute(db)

  // アドレス帳
  await sql`DROP TABLE IF EXISTS eip_m_addressbook CASCADE`.execute(db)
  await sql`DROP TABLE IF EXISTS eip_m_addressbook_company CASCADE`.execute(db)
  await sql`DROP TABLE IF EXISTS eip_m_address_group CASCADE`.execute(db)
  await sql`DROP TABLE IF EXISTS eip_m_company CASCADE`.execute(db)

  // タイムライン（更新情報の投稿機能 ※ eip_t_whatsnew は残す）
  await sql`DROP TABLE IF EXISTS eip_t_timeline CASCADE`.execute(db)

  // スケジュールカテゴリ（FK制約を先に外してから削除）
  await sql`ALTER TABLE eip_t_schedule_map DROP CONSTRAINT IF EXISTS eip_t_schedule_map_common_category_id_fkey`.execute(db)
  await sql`DROP TABLE IF EXISTS eip_t_common_category CASCADE`.execute(db)

  // その他不要テーブル
  await sql`DROP TABLE IF EXISTS activity CASCADE`.execute(db)
  await sql`DROP TABLE IF EXISTS activity_map CASCADE`.execute(db)
  await sql`DROP TABLE IF EXISTS oauth_consumer CASCADE`.execute(db)
  await sql`DROP TABLE IF EXISTS oauth_entry CASCADE`.execute(db)
  await sql`DROP TABLE IF EXISTS oauth_token CASCADE`.execute(db)
  await sql`DROP TABLE IF EXISTS application CASCADE`.execute(db)
  await sql`DROP TABLE IF EXISTS aipo_license CASCADE`.execute(db)
  await sql`DROP TABLE IF EXISTS app_data CASCADE`.execute(db)
  await sql`DROP TABLE IF EXISTS container_config CASCADE`.execute(db)
  await sql`DROP TABLE IF EXISTS module_id CASCADE`.execute(db)
  await sql`DROP TABLE IF EXISTS eip_m_inactive_application CASCADE`.execute(db)
  await sql`DROP TABLE IF EXISTS eip_m_config CASCADE`.execute(db)
  await sql`DROP TABLE IF EXISTS jetspeed_group_profile CASCADE`.execute(db)
  await sql`DROP TABLE IF EXISTS jetspeed_role_profile CASCADE`.execute(db)
  await sql`DROP TABLE IF EXISTS jetspeed_user_profile CASCADE`.execute(db)
  await sql`DROP TABLE IF EXISTS turbine_permission CASCADE`.execute(db)
  await sql`DROP TABLE IF EXISTS turbine_role_permission CASCADE`.execute(db)

  // -------------------------------------------------------
  // 2. 不要カラムの削除（プライバシー方針 / 未使用）
  // -------------------------------------------------------

  // turbine_user: 個人情報・未使用カラムを削除
  await db.schema.alterTable('turbine_user')
    .dropColumn('email')
    .dropColumn('in_telephone')
    .dropColumn('out_telephone')
    .dropColumn('cellular_phone')
    .dropColumn('cellular_mail')
    .dropColumn('cellular_uid')
    .dropColumn('photo')
    .dropColumn('photo_smartphone')
    .dropColumn('has_photo')
    .dropColumn('has_photo_smartphone')
    .dropColumn('photo_modified')
    .dropColumn('photo_modified_smartphone')
    .dropColumn('confirm_value')
    .dropColumn('objectdata')
    .dropColumn('tutorial_forbid')
    .dropColumn('company_id')
    .execute()

  // eip_m_post: 住所・電話等を削除（post_name だけ使う）
  await db.schema.alterTable('eip_m_post')
    .dropColumn('address')
    .dropColumn('zipcode')
    .dropColumn('in_telephone')
    .dropColumn('out_telephone')
    .dropColumn('fax_number')
    .dropColumn('company_id')
    .execute()

  // -------------------------------------------------------
  // 3. 古いデータの削除
  // -------------------------------------------------------

  // 3年以上前のスケジュールを削除（mapも CASCADE で連動して削除される）
  await sql`
    DELETE FROM eip_t_schedule
    WHERE end_date < NOW() - INTERVAL '3 years'
  `.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  // テーブル削除・カラム削除のロールバックは現実的でないため未実装
  // 本番適用前に必ずバックアップを取ること
  throw new Error('このマイグレーションはロールバックできません。バックアップから復元してください。')
}
