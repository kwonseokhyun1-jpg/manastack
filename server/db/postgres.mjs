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

  await sql`
    CREATE TABLE IF NOT EXISTS trades (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      offering TEXT NOT NULL,
      wanting TEXT NOT NULL,
      note TEXT,
      created_at BIGINT NOT NULL
    )
  `

  await sql`
    CREATE INDEX IF NOT EXISTS idx_trades_created ON trades(created_at DESC)
  `

  await sql`
    CREATE TABLE IF NOT EXISTS trade_offers (
      id TEXT PRIMARY KEY,
      trade_id TEXT NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      mana INTEGER NOT NULL DEFAULT 0,
      cards TEXT NOT NULL,
      note TEXT,
      created_at BIGINT NOT NULL
    )
  `

  await sql`
    CREATE INDEX IF NOT EXISTS idx_trade_offers_trade ON trade_offers(trade_id, created_at DESC)
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
  await ensureSchema()
  const search = String(q ?? '').trim()
  if (!search) {
    const rows = await sql`
      SELECT t.id, t.user_id, t.offering, t.wanting, t.note, t.created_at, u.username
      FROM trades t
      JOIN users u ON u.id = t.user_id
      ORDER BY t.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `
    return rows.map(mapTradeRow)
  }

  const pattern = `%${search.toLowerCase()}%`
  const rows = await sql`
    SELECT t.id, t.user_id, t.offering, t.wanting, t.note, t.created_at, u.username
    FROM trades t
    JOIN users u ON u.id = t.user_id
    WHERE lower(u.username) LIKE ${pattern}
       OR lower(t.offering) LIKE ${pattern}
       OR lower(t.wanting) LIKE ${pattern}
       OR lower(coalesce(t.note, '')) LIKE ${pattern}
    ORDER BY t.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `
  return rows.map(mapTradeRow)
}

export async function createTrade(id, userId, offeringJson, wantingJson, note) {
  await ensureSchema()
  await sql`
    INSERT INTO trades (id, user_id, offering, wanting, note, created_at)
    VALUES (${id}, ${userId}, ${offeringJson}, ${wantingJson}, ${note ?? null}, ${Date.now()})
  `
}

export async function deleteTrade(id, userId) {
  await ensureSchema()
  const rows = await sql`
    DELETE FROM trades WHERE id = ${id} AND user_id = ${userId} RETURNING id
  `
  return rows.length > 0
}

export async function getTradeById(id) {
  await ensureSchema()
  const rows = await sql`
    SELECT t.id, t.user_id, t.offering, t.wanting, t.note, t.created_at, u.username
    FROM trades t
    JOIN users u ON u.id = t.user_id
    WHERE t.id = ${id}
  `
  return mapTradeRow(rows[0])
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
  await ensureSchema()
  const rows = await sql`
    SELECT o.id, o.trade_id, o.user_id, o.mana, o.cards, o.note, o.created_at, u.username
    FROM trade_offers o
    JOIN users u ON u.id = o.user_id
    WHERE o.trade_id = ${tradeId}
    ORDER BY o.created_at DESC
  `
  return rows.map(mapOfferRow)
}

export async function createTradeOffer(id, tradeId, userId, mana, cardsJson, note) {
  await ensureSchema()
  await sql`
    INSERT INTO trade_offers (id, trade_id, user_id, mana, cards, note, created_at)
    VALUES (${id}, ${tradeId}, ${userId}, ${mana}, ${cardsJson}, ${note ?? null}, ${Date.now()})
  `
}

function mapInboxRow(row) {
  return {
    offer: mapOfferRow({
      id: row.offer_id,
      trade_id: row.trade_id,
      user_id: row.offer_user_id,
      mana: row.mana,
      cards: row.cards,
      note: row.offer_note,
      created_at: row.offer_created_at,
      username: row.offer_username,
    }),
    trade: mapTradeRow({
      id: row.trade_id,
      user_id: row.trade_user_id,
      offering: row.offering,
      wanting: row.wanting,
      note: row.trade_note,
      created_at: row.trade_created_at,
      username: row.trade_username,
    }),
  }
}

export async function getTradeInbox(userId) {
  await ensureSchema()

  const incomingRows = await sql`
    SELECT
      o.id AS offer_id,
      o.trade_id,
      o.user_id AS offer_user_id,
      o.mana,
      o.cards,
      o.note AS offer_note,
      o.created_at AS offer_created_at,
      ou.username AS offer_username,
      t.user_id AS trade_user_id,
      t.offering,
      t.wanting,
      t.note AS trade_note,
      t.created_at AS trade_created_at,
      tu.username AS trade_username
    FROM trade_offers o
    JOIN trades t ON t.id = o.trade_id
    JOIN users ou ON ou.id = o.user_id
    JOIN users tu ON tu.id = t.user_id
    WHERE t.user_id = ${userId}
    ORDER BY o.created_at DESC
    LIMIT 100
  `

  const outgoingRows = await sql`
    SELECT
      o.id AS offer_id,
      o.trade_id,
      o.user_id AS offer_user_id,
      o.mana,
      o.cards,
      o.note AS offer_note,
      o.created_at AS offer_created_at,
      ou.username AS offer_username,
      t.user_id AS trade_user_id,
      t.offering,
      t.wanting,
      t.note AS trade_note,
      t.created_at AS trade_created_at,
      tu.username AS trade_username
    FROM trade_offers o
    JOIN trades t ON t.id = o.trade_id
    JOIN users ou ON ou.id = o.user_id
    JOIN users tu ON tu.id = t.user_id
    WHERE o.user_id = ${userId}
    ORDER BY o.created_at DESC
    LIMIT 100
  `

  return {
    incoming: incomingRows.map(mapInboxRow),
    outgoing: outgoingRows.map(mapInboxRow),
  }
}
