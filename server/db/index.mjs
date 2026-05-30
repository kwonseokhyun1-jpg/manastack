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

  if (process.env.DEPLOY_TARGET === 'cloudflare') {
    throw new Error(dbUnavailableMessage())
  }

  dbPromise = import('./sqlite.mjs')
  return dbPromise
}

export async function getDb() {
  return loadDb()
}

export function dbUnavailableMessage() {
  if (process.env.DEPLOY_TARGET === 'cloudflare' && !usePostgres()) {
    return 'Cloudflare deploy needs Postgres. Set DATABASE_URL (e.g. Neon) as a Wrangler secret: wrangler secret put DATABASE_URL'
  }
  if (process.env.VERCEL && !usePostgres()) {
    return 'Auth server needs a database. Add a Postgres database in Vercel Storage (Neon), connect it to this project, then redeploy.'
  }
  return 'Database unavailable.'
}
