import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const cardsPath = path.join(root, 'public', 'data', 'cards.json')
const outPath = path.join(root, 'public', 'rarity-map.json')
const API = 'https://api.magicthegathering.io/v1/cards'
const SCRYFALL_COLLECTION = 'https://api.scryfall.com/cards/collection'

const RARITY_TIER = {
  common: 1,
  uncommon: 2,
  rare: 3,
  mythic: 4,
}

function canonicalNameKey(name) {
  const trimmed = name.trim()
  const parts = trimmed.split(/\s*\/\/\s*/)
  if (parts.length === 2 && parts[0].toLowerCase() === parts[1].toLowerCase()) {
    return parts[0].trim().toLowerCase()
  }
  return trimmed.toLowerCase()
}

function normalizeGathererRarity(raw) {
  const value = String(raw ?? '').trim().toLowerCase()
  if (value === 'mythic' || value === 'mythic rare') return 'mythic'
  if (value === 'rare') return 'rare'
  if (value === 'uncommon') return 'uncommon'
  if (value === 'common' || value === 'basic land') return 'common'
  return null
}

function normalizeScryfallRarity(raw) {
  const value = String(raw ?? '').trim().toLowerCase()
  if (value === 'mythic') return 'mythic'
  if (value === 'rare') return 'rare'
  if (value === 'uncommon') return 'uncommon'
  if (value === 'special' || value === 'bonus') return 'rare'
  return 'common'
}

function pickModeRarity(counts) {
  let best = null
  let bestCount = -1
  let bestTier = -1

  for (const [rarity, count] of Object.entries(counts)) {
    const tier = RARITY_TIER[rarity] ?? 0
    if (count > bestCount || (count === bestCount && tier > bestTier)) {
      best = rarity
      bestCount = count
      bestTier = tier
    }
  }

  return best
}

async function fetchPage(page) {
  const res = await fetch(`${API}?page=${page}&pageSize=100`)
  if (!res.ok) throw new Error(`Gatherer API page ${page} failed (${res.status})`)
  return res.json()
}

async function buildFromGatherer(neededKeys) {
  const countsByName = new Map()

  for (let page = 1; ; page++) {
    const data = await fetchPage(page)
    const cards = data.cards ?? []
    if (cards.length === 0) break

    for (const card of cards) {
      const key = canonicalNameKey(card.name)
      if (!neededKeys.has(key)) continue

      const rarity = normalizeGathererRarity(card.rarity)
      if (!rarity) continue

      const counts = countsByName.get(key) ?? {}
      counts[rarity] = (counts[rarity] ?? 0) + 1
      countsByName.set(key, counts)
    }

    if (page % 25 === 0) {
      console.log(`Fetched Gatherer page ${page}… (${countsByName.size}/${neededKeys.size} names matched)`)
    }

    if (cards.length < 100) break
    await new Promise((resolve) => setTimeout(resolve, 40))
  }

  return countsByName
}

async function fetchScryfallRarities(nameByKey, unmatchedKeys) {
  const names = [...unmatchedKeys]
    .map((key) => nameByKey.get(key))
    .filter(Boolean)

  const rarities = new Map()
  const batchSize = 75

  for (let i = 0; i < names.length; i += batchSize) {
    const batch = names.slice(i, i + batchSize)
    const res = await fetch(SCRYFALL_COLLECTION, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        identifiers: batch.map((name) => ({ name })),
      }),
    })

    if (!res.ok) {
      console.warn(`Scryfall collection batch failed (${res.status})`)
      continue
    }

    const data = await res.json()
    for (const card of data.data ?? []) {
      const key = canonicalNameKey(card.name)
      rarities.set(key, normalizeScryfallRarity(card.rarity))
    }

    if ((i / batchSize) % 10 === 0 && i > 0) {
      console.log(`Scryfall fallback… ${Math.min(i + batchSize, names.length)}/${names.length}`)
    }

    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  return rarities
}

async function main() {
  if (!fs.existsSync(cardsPath)) {
    console.warn('cards.json not found. Run npm run ensure-data first.')
    process.exit(0)
  }

  const cardsFile = JSON.parse(fs.readFileSync(cardsPath, 'utf8'))
  const neededKeys = new Set(cardsFile.cards.map((card) => canonicalNameKey(card.name)))
  const nameByKey = new Map(
    cardsFile.cards.map((card) => [canonicalNameKey(card.name), card.name]),
  )

  console.log(`Building Gatherer rarity map for ${neededKeys.size} oracle names…`)
  const countsByName = await buildFromGatherer(neededKeys)

  const rarities = {}
  const unmatched = []
  for (const key of neededKeys) {
    const counts = countsByName.get(key)
    if (counts) {
      rarities[key] = pickModeRarity(counts) ?? 'common'
    } else {
      unmatched.push(key)
      rarities[key] = 'common'
    }
  }

  let matchedScryfall = 0
  if (unmatched.length > 0) {
    console.log(`Gatherer missed ${unmatched.length} names — fetching Scryfall fallback…`)
    const scryfallRarities = await fetchScryfallRarities(nameByKey, unmatched)
    matchedScryfall = scryfallRarities.size
    for (const [key, rarity] of scryfallRarities) {
      rarities[key] = rarity
    }
  }

  const matchedGatherer = [...neededKeys].filter((key) => countsByName.has(key)).length
  const payload = {
    updated_at: new Date().toISOString(),
    source: 'gatherer+scryfall',
    api: API,
    count: Object.keys(rarities).length,
    matched_gatherer: matchedGatherer,
    matched_scryfall: matchedScryfall,
    matched: matchedGatherer + matchedScryfall,
    rarities,
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, JSON.stringify(payload))
  console.log(
    `Wrote ${outPath} (Gatherer ${matchedGatherer}, Scryfall ${matchedScryfall}, total ${payload.matched}/${neededKeys.size})`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
