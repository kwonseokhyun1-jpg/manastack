import crypto from 'node:crypto'
import express from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { dbUnavailableMessage, getDb } from './db/index.mjs'

const JWT_SECRET = process.env.JWT_SECRET ?? 'manastack-dev-secret-change-in-production'
const app = express()

app.use(cors({ origin: true, credentials: true }))
app.use(express.json({ limit: '2mb' }))

function authMiddleware(req, res, next) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Not authenticated.' })
    return
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET)
    req.userId = payload.sub
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired session.' })
  }
}

function signToken(userId) {
  return jwt.sign({}, JWT_SECRET, { subject: userId, expiresIn: '30d' })
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function isValidUsername(username) {
  return /^[a-zA-Z0-9_]{3,20}$/.test(username)
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    username: user.username ?? null,
  }
}

async function withDb(res, handler) {
  try {
    const db = await getDb()
    return await handler(db)
  } catch (err) {
    console.error(err)
    if (process.env.VERCEL && !process.env.POSTGRES_URL && !process.env.DATABASE_URL) {
      res.status(503).json({ error: dbUnavailableMessage() })
      return null
    }
    res.status(500).json({ error: 'Server error.' })
    return null
  }
}

app.get('/api/health', async (_req, res) => {
  const ok = await withDb(res, async (db) => {
    await db.ensureSchema()
    return true
  })
  if (ok) res.json({ ok: true })
})

app.post('/api/auth/signup', async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase()
  const password = String(req.body?.password ?? '')
  const usernameRaw = String(req.body?.username ?? '').trim()

  if (!isValidEmail(email)) {
    res.status(400).json({ error: 'Enter a valid email address.' })
    return
  }
  if (!isValidUsername(usernameRaw)) {
    res.status(400).json({
      error: 'Username must be 3–20 characters and use only letters, numbers, or underscores.',
    })
    return
  }
  if (password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters.' })
    return
  }

  await withDb(res, async (db) => {
    if (await db.findUserByEmail(email)) {
      res.status(409).json({ error: 'An account with this email already exists.' })
      return
    }
    if (await db.findUserByUsername(usernameRaw)) {
      res.status(409).json({ error: 'That username is already taken.' })
      return
    }

    const id = crypto.randomUUID()
    const passwordHash = await bcrypt.hash(password, 10)
    await db.createUser(id, email, usernameRaw, passwordHash)

    const token = signToken(id)
    res.status(201).json({
      token,
      user: { id, email, username: db.normalizeUsername(usernameRaw) },
    })
  })
})

app.post('/api/auth/login', async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase()
  const password = String(req.body?.password ?? '')

  await withDb(res, async (db) => {
    const user = await db.findUserByEmail(email)
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password.' })
      return
    }

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      res.status(401).json({ error: 'Invalid email or password.' })
      return
    }

    res.json({
      token: signToken(user.id),
      user: publicUser(user),
    })
  })
})

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  await withDb(res, async (db) => {
    const user = await db.findUserById(req.userId)
    if (!user) {
      res.status(401).json({ error: 'User not found.' })
      return
    }
    res.json({ user: publicUser(user) })
  })
})

app.get('/api/save', authMiddleware, async (req, res) => {
  await withDb(res, async (db) => {
    const row = await db.getSave(req.userId)
    if (!row) {
      res.json({ save: null })
      return
    }
    try {
      res.json({ save: JSON.parse(row.data), updatedAt: Number(row.updated_at) })
    } catch {
      res.status(500).json({ error: 'Save data corrupted.' })
    }
  })
})

app.put('/api/save', authMiddleware, async (req, res) => {
  const save = req.body?.save
  if (!save || typeof save !== 'object') {
    res.status(400).json({ error: 'Invalid save payload.' })
    return
  }

  const updatedAt =
    typeof req.body.updatedAt === 'number' ? req.body.updatedAt : Date.now()

  await withDb(res, async (db) => {
    await db.upsertSave(req.userId, JSON.stringify(save), updatedAt)
    res.json({ ok: true, updatedAt })
  })
})

function normalizeTradeCards(raw) {
  if (!Array.isArray(raw)) return []
  const out = []
  for (const item of raw) {
    const name = String(item?.name ?? '').trim()
    if (!name) continue
    out.push({
      name,
      instanceId: item?.instanceId ? String(item.instanceId) : undefined,
      foil: Boolean(item?.foil),
      ultrafoil: Boolean(item?.ultrafoil),
    })
  }
  return out
}

app.get('/api/trades', async (req, res) => {
  const q = String(req.query.q ?? '').trim()
  const limit = Math.min(Number(req.query.limit) || 50, 100)
  const offset = Math.max(Number(req.query.offset) || 0, 0)

  await withDb(res, async (db) => {
    const trades = await db.listTrades({ q, limit, offset })
    res.json({ trades })
  })
})

app.get('/api/trades/inbox', authMiddleware, async (req, res) => {
  await withDb(res, async (db) => {
    const inbox = await db.getTradeInbox(req.userId)
    res.json(inbox)
  })
})

app.post('/api/trades', authMiddleware, async (req, res) => {
  const offering = normalizeTradeCards(req.body?.offering)
  const note = String(req.body?.note ?? '').trim().slice(0, 500)

  if (offering.length === 0) {
    res.status(400).json({ error: 'Select at least one card from your collection.' })
    return
  }
  if (offering.length > 30) {
    res.status(400).json({ error: 'Maximum 30 cards per trade.' })
    return
  }

  await withDb(res, async (db) => {
    const user = await db.findUserById(req.userId)
    if (!user) {
      res.status(401).json({ error: 'User not found.' })
      return
    }

    const id = crypto.randomUUID()
    await db.createTrade(
      id,
      req.userId,
      JSON.stringify(offering),
      JSON.stringify([]),
      note || null,
    )

    res.status(201).json({
      trade: {
        id,
        userId: req.userId,
        username: user.username ?? null,
        offering,
        wanting: [],
        note: note || undefined,
        createdAt: Date.now(),
      },
    })
  })
})

app.delete('/api/trades/:id', authMiddleware, async (req, res) => {
  const id = String(req.params.id ?? '')

  await withDb(res, async (db) => {
    const deleted = await db.deleteTrade(id, req.userId)
    if (!deleted) {
      res.status(404).json({ error: 'Trade not found or not yours.' })
      return
    }
    res.json({ ok: true })
  })
})

function normalizeMana(raw) {
  const value = Number(raw)
  if (!Number.isFinite(value) || value < 0) return 0
  return Math.floor(value)
}

app.get('/api/trades/:id/offers', async (req, res) => {
  const tradeId = String(req.params.id ?? '')

  await withDb(res, async (db) => {
    const trade = await db.getTradeById(tradeId)
    if (!trade) {
      res.status(404).json({ error: 'Trade not found.' })
      return
    }
    const offers = await db.listTradeOffers(tradeId)
    res.json({ offers })
  })
})

app.post('/api/trades/:id/offers', authMiddleware, async (req, res) => {
  const tradeId = String(req.params.id ?? '')
  const cards = normalizeTradeCards(req.body?.cards)
  const mana = normalizeMana(req.body?.mana)
  const note = String(req.body?.note ?? '').trim().slice(0, 500)

  if (mana === 0 && cards.length === 0) {
    res.status(400).json({ error: 'Add mana, cards, or both to your offer.' })
    return
  }
  if (cards.length > 30) {
    res.status(400).json({ error: 'Maximum 30 cards per offer.' })
    return
  }

  await withDb(res, async (db) => {
    const trade = await db.getTradeById(tradeId)
    if (!trade) {
      res.status(404).json({ error: 'Trade not found.' })
      return
    }
    if (trade.userId === req.userId) {
      res.status(400).json({ error: 'You cannot make an offer on your own trade.' })
      return
    }

    const user = await db.findUserById(req.userId)
    if (!user) {
      res.status(401).json({ error: 'User not found.' })
      return
    }

    const id = crypto.randomUUID()
    await db.createTradeOffer(
      id,
      tradeId,
      req.userId,
      mana,
      JSON.stringify(cards),
      note || null,
    )

    res.status(201).json({
      offer: {
        id,
        tradeId,
        userId: req.userId,
        username: user.username ?? null,
        mana,
        cards,
        note: note || undefined,
        createdAt: Date.now(),
      },
    })
  })
})

app.post('/api/trades/offers/:offerId/accept', authMiddleware, async (req, res) => {
  const offerId = String(req.params.offerId ?? '')

  await withDb(res, async (db) => {
    const result = await db.acceptTradeOffer(offerId, req.userId)
    if (!result.ok) {
      res.status(result.status ?? 400).json({ error: result.error })
      return
    }
    res.json({ ok: true, save: result.save })
  })
})

app.post('/api/trades/offers/:offerId/decline', authMiddleware, async (req, res) => {
  const offerId = String(req.params.offerId ?? '')

  await withDb(res, async (db) => {
    const deleted = await db.deleteTradeOffer(offerId, req.userId)
    if (!deleted) {
      res.status(404).json({ error: 'Offer not found or not on your listing.' })
      return
    }
    res.json({ ok: true })
  })
})

export default app
