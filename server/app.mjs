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

export default app
