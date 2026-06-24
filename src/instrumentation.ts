export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { migrator } = await import('@/lib/migrator')
    const { error, results } = await migrator.migrateToLatest()

    results?.forEach((result) => {
      if (result.status === 'Success') {
        console.log(`Migration "${result.migrationName}" applied`)
      } else if (result.status === 'Error') {
        console.error(`Migration "${result.migrationName}" failed`)
      }
    })

    if (error) {
      console.error('Migration failed:', error)
      process.exit(1)
    }
  }
}
