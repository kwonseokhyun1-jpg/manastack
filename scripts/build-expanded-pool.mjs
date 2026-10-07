/**
 * Expand public/data/minigame-pool.json (and cards.json) from Scryfall oracle bulk.
 * Adds lands + missing Commander-legal cards, and printed power/toughness.
 *
 * Usage: node scripts/build-expanded-pool.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { Readable } from 'node:stream'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const dataDir = path.join(root, 'public', 'data')
const minigamePath = path.join(dataDir, 'minigame-pool.json')
const cardsPath = path.join(dataDir, 'cards.json')

const SKIP_LAYOUTS = new Set([
  'art_series',
  'token',
  'double_faced_token',
  'emblem',
  'planar',
  'scheme',
  'vanguard',
  'augment',
  'host',
])

function canonicalCardName(name) {
  const trimmed = (name ?? '').trim()
  const parts = trimmed.split(/\s*\/\/\s*/)
  if (parts.length === 2 && parts[0].toLowerCase() === parts[1].toLowerCase()) {
    return parts[0].trim()
  }
  return trimmed
}

function canonicalNameKey(name) {
  return canonicalCardName(name).toLowerCase()
}

function composeOracleText(card) {
  if (Array.isArray(card.card_faces) && card.card_faces.length > 1) {
    return card.card_faces
      .map((face) => {
        const text = face.oracle_text?.trim()
        if (!text) return ''
        return `${face.name}\n${text}`
      })
      .filter(Boolean)
      .join('\n\n')
  }
  return card.oracle_text?.trim() ?? card.card_faces?.[0]?.oracle_text?.trim() ?? ''
}

function facePowerToughness(card) {
  const face = card.card_faces?.[0]
  const power = card.power ?? face?.power
  const toughness = card.toughness ?? face?.toughness
  if (power == null && toughness == null) return {}
  return {
    ...(power != null ? { power: String(power) } : {}),
    ...(toughness != null ? { toughness: String(toughness) } : {}),
  }
}

function slimCard(card) {
  const image =
    card.image_uris?.normal ??
    card.card_faces?.[0]?.image_uris?.normal ??
    card.image_uris?.large ??
    card.card_faces?.[0]?.image_uris?.large

  const faces = Array.isArray(card.card_faces)
    ? card.card_faces.map((f) => ({
        name: f.name,
        type_line: f.type_line ?? '',
        oracle_text: f.oracle_text ?? '',
        mana_cost: f.mana_cost,
        image: f.image_uris?.normal,
        ...(f.power != null ? { power: String(f.power) } : {}),
        ...(f.toughness != null ? { toughness: String(f.toughness) } : {}),
      }))
    : undefined

  return {
    id: card.id,
    name: canonicalCardName(card.name),
    color_identity: card.color_identity ?? [],
    cmc: card.cmc ?? 0,
    mana_cost: card.mana_cost ?? card.card_faces?.[0]?.mana_cost,
    type_line: card.type_line ?? card.card_faces?.[0]?.type_line ?? '',
    oracle_text: composeOracleText(card),
    keywords: card.keywords ?? [],
    tags: [],
    roles: [],
    image,
    scryfall_uri: card.scryfall_uri,
    edhrec_rank: card.edhrec_rank,
    prices: {
      usd: card.prices?.usd ?? null,
      usd_foil: card.prices?.usd_foil ?? null,
    },
    ...facePowerToughness(card),
    ...(faces?.length ? { card_faces: faces } : {}),
  }
}

function isKeepable(card) {
  if (SKIP_LAYOUTS.has(card.layout)) return false
  const type = (card.type_line ?? '').toLowerCase()
  if (type.includes('token') && !type.includes('creature')) return false
  if (card.set_type === 'memorabilia' && type.includes('card')) return false

  const legality = card.legalities?.commander
  if (legality === 'legal' || legality === 'restricted') return true

  // Always keep basics / lands even if legality missing
  if (/\bland\b/.test(type)) return legality !== 'banned'

  return false
}

function preferCard(a, b) {
  // Prefer lower EDHREC rank, then card with image, then with oracle text
  const rankA = a.edhrec_rank ?? 999999
  const rankB = b.edhrec_rank ?? 999999
  if (rankA !== rankB) return rankA < rankB ? a : b
  if (Boolean(a.image) !== Boolean(b.image)) return a.image ? a : b
  if ((a.oracle_text?.length ?? 0) !== (b.oracle_text?.length ?? 0)) {
    return (a.oracle_text?.length ?? 0) > (b.oracle_text?.length ?? 0) ? a : b
  }
  // Prefer record that already has power/toughness
  const ptA = a.power != null || a.toughness != null
  const ptB = b.power != null || b.toughness != null
  if (ptA !== ptB) return ptA ? a : b
  return a
}

function mergeCard(existing, incoming) {
  const base = preferCard(existing, incoming)
  const other = base === existing ? incoming : existing
  return {
    ...other,
    ...base,
    // Fill gaps from the other printing
    image: base.image ?? other.image,
    oracle_text: base.oracle_text || other.oracle_text || '',
    mana_cost: base.mana_cost ?? other.mana_cost,
    edhrec_rank: base.edhrec_rank ?? other.edhrec_rank,
    power: base.power ?? other.power,
    toughness: base.toughness ?? other.toughness,
    prices: base.prices?.usd ? base.prices : other.prices ?? base.prices,
    keywords:
      (base.keywords?.length ?? 0) >= (other.keywords?.length ?? 0)
        ? base.keywords
        : other.keywords,
    tags: Array.isArray(base.tags) ? base.tags : [],
    roles: Array.isArray(base.roles) ? base.roles : [],
  }
}

async function fetchOracleBulkCards() {
  const metaRes = await fetch('https://api.scryfall.com/bulk-data', {
    headers: { Accept: 'application/json', 'User-Agent': 'manastack-pool-builder/1.0' },
  })
  if (!metaRes.ok) throw new Error(`Bulk metadata failed (${metaRes.status})`)
  const meta = await metaRes.json()
  const oracle = meta.data.find((entry) => entry.type === 'oracle_cards')
  const downloadUri = oracle?.jsonl_download_uri ?? oracle?.download_uri
  if (!downloadUri) throw new Error('oracle_cards bulk download URI not found')

  console.log(`Downloading Scryfall oracle bulk (${oracle.updated_at})…`)
  const bulkRes = await fetch(downloadUri, {
    headers: { 'User-Agent': 'manastack-pool-builder/1.0' },
  })
  if (!bulkRes.ok) throw new Error(`Bulk download failed (${bulkRes.status})`)

  const isGzip =
    downloadUri.endsWith('.gz') ||
    (bulkRes.headers.get('content-type') ?? '').includes('gzip')

  let text
  if (isGzip) {
    const buf = Buffer.from(await bulkRes.arrayBuffer())
    text = zlib.gunzipSync(buf).toString('utf8')
  } else {
    text = await bulkRes.text()
  }

  // New Scryfall bulk is JSONL; older endpoint returned a JSON array.
  const trimmed = text.trim()
  let cards
  if (trimmed.startsWith('[')) {
    cards = JSON.parse(trimmed)
  } else {
    cards = trimmed
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line))
  }

  return { cards, updatedAt: oracle.updated_at }
}

function loadExistingPool(filePath) {
  if (!fs.existsSync(filePath)) return []
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  return Array.isArray(raw.cards) ? raw.cards : []
}

async function main() {
  fs.mkdirSync(dataDir, { recursive: true })

  const existing = loadExistingPool(minigamePath)
  console.log(`Existing minigame pool: ${existing.length} cards`)

  const { cards: oracleCards, updatedAt } = await fetchOracleBulkCards()
  console.log(`Oracle bulk cards: ${oracleCards.length}`)

  const byKey = new Map()
  for (const card of existing) {
    byKey.set(canonicalNameKey(card.name), {
      ...card,
      name: canonicalCardName(card.name),
      roles: Array.isArray(card.roles) ? card.roles : [],
      tags: Array.isArray(card.tags) ? card.tags : [],
      keywords: Array.isArray(card.keywords) ? card.keywords : [],
    })
  }

  let added = 0
  let merged = 0
  let landsAdded = 0

  for (const raw of oracleCards) {
    if (!isKeepable(raw)) continue
    const slim = slimCard(raw)
    const key = canonicalNameKey(slim.name)
    const prev = byKey.get(key)
    if (!prev) {
      byKey.set(key, slim)
      added++
      if (/\bLand\b/.test(slim.type_line)) landsAdded++
      continue
    }
    const next = mergeCard(prev, slim)
    if (next !== prev) {
      byKey.set(key, next)
      merged++
    }
  }

  const cards = [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name))
  const landCount = cards.filter((c) => /\bLand\b/.test(c.type_line)).length
  const withPt = cards.filter((c) => c.power != null || c.toughness != null).length

  const payload = {
    updated_at: new Date().toISOString(),
    source: 'scryfall-oracle+existing',
    scryfall_bulk_updated_at: updatedAt,
    count: cards.length,
    cards,
  }

  fs.writeFileSync(minigamePath, JSON.stringify(payload))
  fs.writeFileSync(cardsPath, JSON.stringify(payload))

  console.log(`Wrote ${minigamePath}`)
  console.log(`Wrote ${cardsPath}`)
  console.log(
    `Total ${cards.length} (added ${added}, merged fields on ${merged}, lands ${landCount}, +${landsAdded} new lands, P/T on ${withPt})`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
