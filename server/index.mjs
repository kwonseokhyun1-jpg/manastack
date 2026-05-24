import crypto from 'node:crypto'
import express from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import {
  createUser,
  findUserByEmail,
  findUserById,
  findUserByUsername,
  getSave,
  normalizeUsername,
  upsertSave,
} from './db.mjs'

const PORT = Number(process.env.PORT ?? 3001)
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

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.post('/api/auth/signup', async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase()
  const password = String(req.body?.password ?? '')
  const username = normalizeUsername(req.body?.username)

  if (!isValidEmail(email)) {
    res.status(400).json({ error: 'Enter a valid email address.' })
    return
  }
  if (!isValidUsername(username)) {
    res.status(400).json({
      error: 'Username must be 3–20 characters and use only letters, numbers, or underscores.',
    })
    return
  }
  if (password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters.' })
    return
  }
  if (findUserByEmail(email)) {
    res.status(409).json({ error: 'An account with this email already exists.' })
    return
  }
  if (findUserByUsername(username)) {
    res.status(409).json({ error: 'That username is already taken.' })
    return
  }

  const id = crypto.randomUUID()
  const passwordHash = await bcrypt.hash(password, 10)
  createUser(id, email, username, passwordHash)

  const token = signToken(id)
  res.status(201).json({
    token,
    user: { id, email, username },
  })
})

app.post('/api/auth/login', async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase()
  const password = String(req.body?.password ?? '')

  const user = findUserByEmail(email)
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

app.get('/api/auth/me', authMiddleware, (req, res) => {
  const user = findUserById(req.userId)
  if (!user) {
    res.status(401).json({ error: 'User not found.' })
    return
  }
  res.json({ user: publicUser(user) })
})

app.get('/api/save', authMiddleware, (req, res) => {
  const row = getSave(req.userId)
  if (!row) {
    res.json({ save: null })
    return
  }
  try {
    res.json({ save: JSON.parse(row.data), updatedAt: row.updated_at })
  } catch {
    res.status(500).json({ error: 'Save data corrupted.' })
  }
})

app.put('/api/save', authMiddleware, (req, res) => {
  const save = req.body?.save
  if (!save || typeof save !== 'object') {
    res.status(400).json({ error: 'Invalid save payload.' })
    return
  }

  const updatedAt =
    typeof req.body.updatedAt === 'number' ? req.body.updatedAt : Date.now()

  upsertSave(req.userId, JSON.stringify(save), updatedAt)
  res.json({ ok: true, updatedAt })
})

app.listen(PORT, () => {
  console.log(`Manastack API listening on http://localhost:${PORT}`)
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Stop the other API process or run npm run dev:fresh.`)
  } else {
    console.error(err)
  }
  process.exit(1)
})
