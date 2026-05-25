import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
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

db.exec(`
  CREATE TABLE IF NOT EXISTS trades (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    offering TEXT NOT NULL,
    wanting TEXT NOT NULL,
    note TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_trades_created ON trades(created_at DESC);

  CREATE TABLE IF NOT EXISTS trade_offers (
    id TEXT PRIMARY KEY,
    trade_id TEXT NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mana INTEGER NOT NULL DEFAULT 0,
    cards TEXT NOT NULL,
    note TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_trade_offers_trade ON trade_offers(trade_id, created_at DESC);
`)

export function normalizeUsername(raw) {
  return String(raw ?? '').trim()
}

export async function ensureSchema() {}

export async function findUserByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase())
}

export async function findUserByUsername(username) {
  const normalized = normalizeUsername(username)
  if (!normalized) return undefined
  return db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE').get(normalized)
}

export async function findUserById(id) {
  return db.prepare('SELECT id, email, username, created_at FROM users WHERE id = ?').get(id)
}

export async function createUser(id, email, username, passwordHash) {
  db.prepare(
    'INSERT INTO users (id, email, username, password_hash, created_at) VALUES (?, ?, ?, ?, ?)',
  ).run(id, email.trim().toLowerCase(), normalizeUsername(username), passwordHash, Date.now())
}

export async function getSave(userId) {
  return db.prepare('SELECT data, updated_at FROM saves WHERE user_id = ?').get(userId)
}

export async function upsertSave(userId, data, updatedAt) {
  db.prepare(`
    INSERT INTO saves (user_id, data, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
  `).run(userId, data, updatedAt)
}

function mapTradeRow(row) {
  if (!row) return null
  return {
    id: row.id,
    userId: row.user_id,
    username: row.username ?? null,
    offering: JSON.parse(row.offering),
    wanting: JSON.parse(row.wanting),
    note: row.note ?? undefined,
    createdAt: Number(row.created_at),
  }
}

export async function listTrades({ q, limit = 50, offset = 0 } = {}) {
  const search = String(q ?? '').trim()
  if (!search) {
    const rows = db
      .prepare(
        `SELECT t.id, t.user_id, t.offering, t.wanting, t.note, t.created_at, u.username
         FROM trades t
         JOIN users u ON u.id = t.user_id
         ORDER BY t.created_at DESC
         LIMIT ? OFFSET ?`,
      )
      .all(limit, offset)
    return rows.map(mapTradeRow)
  }

  const pattern = `%${search.toLowerCase()}%`
  const rows = db
    .prepare(
      `SELECT t.id, t.user_id, t.offering, t.wanting, t.note, t.created_at, u.username
       FROM trades t
       JOIN users u ON u.id = t.user_id
       WHERE lower(u.username) LIKE ?
          OR lower(t.offering) LIKE ?
          OR lower(t.wanting) LIKE ?
          OR lower(coalesce(t.note, '')) LIKE ?
       ORDER BY t.created_at DESC
       LIMIT ? OFFSET ?`,
    )
    .all(pattern, pattern, pattern, pattern, limit, offset)
  return rows.map(mapTradeRow)
}

export async function createTrade(id, userId, offeringJson, wantingJson, note) {
  db.prepare(
    `INSERT INTO trades (id, user_id, offering, wanting, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, userId, offeringJson, wantingJson, note ?? null, Date.now())
}

export async function deleteTrade(id, userId) {
  const result = db.prepare('DELETE FROM trades WHERE id = ? AND user_id = ?').run(id, userId)
  return result.changes > 0
}

export async function getTradeById(id) {
  const row = db
    .prepare(
      `SELECT t.id, t.user_id, t.offering, t.wanting, t.note, t.created_at, u.username
       FROM trades t
       JOIN users u ON u.id = t.user_id
       WHERE t.id = ?`,
    )
    .get(id)
  return mapTradeRow(row)
}

function mapOfferRow(row) {
  if (!row) return null
  return {
    id: row.id,
    tradeId: row.trade_id,
    userId: row.user_id,
    username: row.username ?? null,
    mana: Number(row.mana),
    cards: JSON.parse(row.cards),
    note: row.note ?? undefined,
    createdAt: Number(row.created_at),
  }
}

export async function listTradeOffers(tradeId) {
  const rows = db
    .prepare(
      `SELECT o.id, o.trade_id, o.user_id, o.mana, o.cards, o.note, o.created_at, u.username
       FROM trade_offers o
       JOIN users u ON u.id = o.user_id
       WHERE o.trade_id = ?
       ORDER BY o.created_at DESC`,
    )
    .all(tradeId)
  return rows.map(mapOfferRow)
}

export async function createTradeOffer(id, tradeId, userId, mana, cardsJson, note) {
  db.prepare(
    `INSERT INTO trade_offers (id, trade_id, user_id, mana, cards, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, tradeId, userId, mana, cardsJson, note ?? null, Date.now())
}
