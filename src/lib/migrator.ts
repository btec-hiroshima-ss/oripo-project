import { Migrator, type MigrationProvider, type Migration } from 'kysely'
import { db } from './db'
import * as m20260707 from './migrations/2026-07-07_create_oripo_tables'
import * as m20260709 from './migrations/2026-07-09_add_page_layout'

const migrations: Record<string, Migration> = {
  '2026-07-07_create_oripo_tables': m20260707,
  '2026-07-09_add_page_layout': m20260709,
}

class StaticMigrationProvider implements MigrationProvider {
  async getMigrations(): Promise<Record<string, Migration>> {
    return migrations
  }
}

export const migrator = new Migrator({
  db,
  provider: new StaticMigrationProvider(),
})
