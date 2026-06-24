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

    if (process.env.NODE_ENV === 'development' && results?.some((r) => r.status === 'Success')) {
      const { execSync } = await import('child_process')
      execSync('npm run db:generate', { stdio: 'inherit' })
    }
  }
}
