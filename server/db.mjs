import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const dataDir = path.join(root, 'data')
const dbPath = path.join(dataDir, 'manastack.db')

fs.mkdirSync(dataDir, { recursive: true })

const db = new Database(dbPath)

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS saves (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    data TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
`)

const userColumns = db.prepare('PRAGMA table_info(users)').all()
if (!userColumns.some((col) => col.name === 'username')) {
  db.exec('ALTER TABLE users ADD COLUMN username TEXT')
}

db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_nocase
  ON users(username COLLATE NOCASE)
  WHERE username IS NOT NULL
`)

export function normalizeUsername(raw) {
  return String(raw ?? '').trim()
}

export function findUserByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase())
}

export function findUserByUsername(username) {
  const normalized = normalizeUsername(username)
  if (!normalized) return undefined
  return db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE').get(normalized)
}

export function findUserById(id) {
  return db.prepare('SELECT id, email, username, created_at FROM users WHERE id = ?').get(id)
}

export function createUser(id, email, username, passwordHash) {
  db.prepare(
    'INSERT INTO users (id, email, username, password_hash, created_at) VALUES (?, ?, ?, ?, ?)',
  ).run(id, email.trim().toLowerCase(), normalizeUsername(username), passwordHash, Date.now())
}

export function getSave(userId) {
  return db.prepare('SELECT data, updated_at FROM saves WHERE user_id = ?').get(userId)
}

export function upsertSave(userId, data, updatedAt) {
  db.prepare(`
    INSERT INTO saves (user_id, data, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
  `).run(userId, data, updatedAt)
}

export { db }
