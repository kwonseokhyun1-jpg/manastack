function usePostgres() {
  return Boolean(process.env.POSTGRES_URL || process.env.DATABASE_URL)
}

let dbPromise = null

async function loadDb() {
  if (dbPromise) return dbPromise

  if (usePostgres()) {
    dbPromise = import('./postgres.mjs')
    return dbPromise
  }

  dbPromise = import('./sqlite.mjs')
  return dbPromise
}

export async function getDb() {
  return loadDb()
}

export function dbUnavailableMessage() {
  if (process.env.VERCEL && !usePostgres()) {
    return 'Auth server needs a database. Add a Postgres database in Vercel Storage (Neon), connect it to this project, then redeploy.'
  }
  return 'Database unavailable.'
}
