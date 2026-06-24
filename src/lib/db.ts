import { Kysely, PostgresDialect } from 'kysely'
import { Pool } from 'pg'
import type { DB } from './db.types'

const globalForDb = global as unknown as { db: Kysely<DB> }

export const db =
  globalForDb.db ??
  new Kysely<DB>({
    dialect: new PostgresDialect({
      pool: new Pool({ connectionString: process.env.DATABASE_URL }),
    }),
  })

if (process.env.NODE_ENV !== 'production') globalForDb.db = db
