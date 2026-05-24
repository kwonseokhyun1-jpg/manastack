import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const outPath = path.join(root, 'public', 'standard-pool.json')
const BASE = 'https://api.scryfall.com/cards/search'

function canonicalCardName(name) {
  const trimmed = (name ?? '').trim()
  const parts = trimmed.split(/\s*\/\/\s*/)
  if (parts.length === 2 && parts[0].toLowerCase() === parts[1].toLowerCase()) {
    return parts[0].trim()
  }
  return trimmed
}

function isStandardCard(card) {
  const type = (card.type_line ?? '').toLowerCase()
  if (type.includes('token') || type.includes('emblem')) return false
  if (card.layout === 'art_series' || card.layout === 'token') return false
  return card.legalities?.standard === 'legal'
}

function slimCard(card) {
  return {
    id: card.id,
    name: canonicalCardName(card.name),
    color_identity: card.color_identity ?? [],
    cmc: card.cmc ?? 0,
    mana_cost: card.mana_cost ?? card.card_faces?.[0]?.mana_cost,
    type_line: card.type_line ?? card.card_faces?.[0]?.type_line ?? '',
    oracle_text: card.oracle_text ?? card.card_faces?.[0]?.oracle_text ?? '',
    keywords: card.keywords ?? [],
    tags: [],
    roles: [],
    image: card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal,
    scryfall_uri: card.scryfall_uri,
    edhrec_rank: card.edhrec_rank,
    prices: { usd: card.prices?.usd ?? null },
  }
}

function dedupeByName(cards) {
  const byKey = new Map()
  for (const card of cards) {
    const key = card.name.toLowerCase()
    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, card)
      continue
    }
    const rankA = existing.edhrec_rank ?? 999999
    const rankB = card.edhrec_rank ?? 999999
    if (rankB < rankA) byKey.set(key, card)
  }
  return [...byKey.values()]
}

async function fetchSearchPage(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.details ?? `Scryfall search failed (${res.status})`)
  }
  return res.json()
}

async function fetchAllStandardCards() {
  const cards = []
  let url =
    `${BASE}?` +
    new URLSearchParams({
      q: 'f:standard',
      unique: 'cards',
      order: 'name',
    }).toString()

  while (url) {
    const page = await fetchSearchPage(url)
    for (const card of page.data ?? []) {
      if (isStandardCard(card)) cards.push(slimCard(card))
    }
    console.log(`Fetched ${cards.length} / ${page.total_cards ?? '?'} Standard cards…`)
    url = page.has_more ? page.next_page : null
    if (url) await new Promise((resolve) => setTimeout(resolve, 120))
  }

  return dedupeByName(cards)
}

async function main() {
  console.log('Building Standard-legal card pool from Scryfall…')
  const cards = await fetchAllStandardCards()
  const payload = {
    updated_at: new Date().toISOString(),
    source: 'scryfall',
    format: 'standard',
    count: cards.length,
    cards,
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, JSON.stringify(payload))
  console.log(`Wrote ${outPath} (${cards.length} cards)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
