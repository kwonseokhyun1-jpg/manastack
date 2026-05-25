import { neon } from '@neondatabase/serverless'

function getSql() {
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL
  if (!url) {
    throw new Error('Missing DATABASE_URL or POSTGRES_URL')
  }
  return neon(url)
}

let sqlClient = null

function sql(strings, ...values) {
  if (!sqlClient) sqlClient = getSql()
  return sqlClient(strings, ...values)
}

export function normalizeUsername(raw) {
  return String(raw ?? '').trim()
}

let schemaReady = false

export async function ensureSchema() {
  if (schemaReady) return

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      username TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      created_at BIGINT NOT NULL
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS saves (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      data TEXT NOT NULL,
      updated_at BIGINT NOT NULL
    )
  `

  schemaReady = true
}

export async function findUserByEmail(email) {
  await ensureSchema()
  const rows = await sql`
    SELECT * FROM users WHERE lower(email) = lower(${email.trim()})
  `
  return rows[0]
}

export async function findUserByUsername(username) {
  await ensureSchema()
  const normalized = normalizeUsername(username)
  if (!normalized) return undefined
  const rows = await sql`
    SELECT * FROM users WHERE lower(username) = lower(${normalized})
  `
  return rows[0]
}

export async function findUserById(id) {
  await ensureSchema()
  const rows = await sql`
    SELECT id, email, username, created_at FROM users WHERE id = ${id}
  `
  return rows[0]
}

export async function createUser(id, email, username, passwordHash) {
  await ensureSchema()
  await sql`
    INSERT INTO users (id, email, username, password_hash, created_at)
    VALUES (${id}, ${email.trim().toLowerCase()}, ${normalizeUsername(username)}, ${passwordHash}, ${Date.now()})
  `
}

export async function getSave(userId) {
  await ensureSchema()
  const rows = await sql`
    SELECT data, updated_at FROM saves WHERE user_id = ${userId}
  `
  return rows[0]
}

export async function upsertSave(userId, data, updatedAt) {
  await ensureSchema()
  await sql`
    INSERT INTO saves (user_id, data, updated_at)
    VALUES (${userId}, ${data}, ${updatedAt})
    ON CONFLICT (user_id) DO UPDATE
    SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at
  `
}
