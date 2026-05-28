import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const cardsPath = path.join(root, 'public', 'data', 'cards.json')
const mapPath = path.join(root, 'public', 'rarity-map.json')

const RARITY_TIER = { common: 1, uncommon: 2, rare: 3, mythic: 4 }

function canonicalNameKey(name) {
  const trimmed = name.trim()
  const parts = trimmed.split(/\s*\/\/\s*/)
  if (parts.length === 2 && parts[0].toLowerCase() === parts[1].toLowerCase()) {
    return parts[0].trim().toLowerCase()
  }
  return trimmed.toLowerCase()
}

function normalizeScryfallRarity(raw) {
  const value = String(raw ?? '').trim().toLowerCase()
  if (value === 'mythic') return 'mythic'
  if (value === 'rare') return 'rare'
  if (value === 'uncommon') return 'uncommon'
  if (value === 'special' || value === 'bonus') return 'rare'
  return 'common'
}

function pickHigherRarity(a, b) {
  return (RARITY_TIER[a] ?? 0) >= (RARITY_TIER[b] ?? 0) ? a : b
}

async function fetchOracleBulkCards() {
  const metaRes = await fetch('https://api.scryfall.com/bulk-data')
  if (!metaRes.ok) throw new Error(`Bulk metadata failed (${metaRes.status})`)
  const meta = await metaRes.json()
  const oracle = meta.data.find((entry) => entry.type === 'oracle_cards')
  if (!oracle?.download_uri) throw new Error('oracle_cards bulk entry not found')

  console.log(`Downloading Scryfall oracle bulk (${oracle.updated_at})…`)
  const bulkRes = await fetch(oracle.download_uri)
  if (!bulkRes.ok) throw new Error(`Bulk download failed (${bulkRes.status})`)
  return bulkRes.json()
}

async function main() {
  if (!fs.existsSync(cardsPath) || !fs.existsSync(mapPath)) {
    console.warn('Missing cards.json or rarity-map.json')
    process.exit(1)
  }

  const cardsFile = JSON.parse(fs.readFileSync(cardsPath, 'utf8'))
  const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'))
  const neededKeys = new Set(cardsFile.cards.map((card) => canonicalNameKey(card.name)))

  const oracleCards = await fetchOracleBulkCards()
  const scryfallByName = new Map()

  for (const card of oracleCards) {
    const key = canonicalNameKey(card.name)
    const rarity = normalizeScryfallRarity(card.rarity)
    const existing = scryfallByName.get(key)
    scryfallByName.set(key, existing ? pickHigherRarity(existing, rarity) : rarity)
  }

  let updated = 0
  for (const key of neededKeys) {
    const scryfallRarity = scryfallByName.get(key)
    if (!scryfallRarity || scryfallRarity === 'common') continue
    if (map.rarities[key] === 'common') {
      map.rarities[key] = scryfallRarity
      updated++
    }
  }

  map.updated_at = new Date().toISOString()
  map.source = 'gatherer+scryfall-bulk'
  map.scryfall_bulk_patched = updated

  fs.writeFileSync(mapPath, JSON.stringify(map))
  console.log(
    `Patched ${updated} rarities. Terra: ${map.rarities['terra, herald of hope']}. Total keys: ${neededKeys.size}`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
