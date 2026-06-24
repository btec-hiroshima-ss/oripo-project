import { Migrator, FileMigrationProvider } from 'kysely'
import { promises as fs } from 'fs'
import path from 'path'
import { db } from './db'

export const migrator = new Migrator({
  db,
  provider: new FileMigrationProvider({
    fs,
    path,
    migrationFolder: path.join(process.cwd(), 'src/lib/migrations'),
  }),
})
