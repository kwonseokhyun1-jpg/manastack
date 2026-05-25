import type { CardDatabase, CardRecord } from '../types/card'
import { canonicalCardName, canonicalNameKey } from './card-names'
import { fetchJsonAsset } from './assets'
import { initCardNameIndex } from './card-name-resolve'

let cache: CardDatabase | null = null
let nameIndex: Map<string, CardRecord> | null = null

function normalizeCardRecord(card: CardRecord): CardRecord {
  return {
    ...card,
    roles: Array.isArray(card.roles) ? card.roles : [],
    tags: Array.isArray(card.tags) ? card.tags : [],
    keywords: Array.isArray(card.keywords) ? card.keywords : [],
  }
}

function dedupeCardsByCanonicalName(cards: CardRecord[]): CardRecord[] {
  const byKey = new Map<string, CardRecord>()
  for (const card of cards) {
    const key = canonicalNameKey(card.name)
    const normalized = { ...card, name: canonicalCardName(card.name) }
    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, normalized)
      continue
    }
    const rankA = existing.edhrec_rank ?? 999999
    const rankB = normalized.edhrec_rank ?? 999999
    if (rankB < rankA) byKey.set(key, normalized)
  }
  return [...byKey.values()]
}

export async function loadCardDatabase(): Promise<CardDatabase> {
  if (cache) return cache

  const raw = await fetchJsonAsset<CardDatabase>('data/cards.json', 'Card database')
  const cards = dedupeCardsByCanonicalName(raw.cards.map(normalizeCardRecord))
  cache = { ...raw, cards, count: cards.length }
  nameIndex = new Map(cards.map((c) => [canonicalNameKey(c.name), c]))
  initCardNameIndex(cards)
  return cache
}

type PoolFile = {
  updated_at: string
  count: number
  cards: CardRecord[]
}

type CommandersFile = {
  updated_at: string
  count: number
  commanders: CardRecord[]
}

let commanderPoolCache: CardRecord[] | null = null
let standardPoolCache: CardRecord[] | null = null

export async function loadCommanderRankPool(): Promise<CardRecord[]> {
  if (commanderPoolCache) return commanderPoolCache

  const raw = await fetchJsonAsset<CommandersFile>(
    'data/commanders.json',
    'Commander rank list',
  )
  commanderPoolCache = raw.commanders.map(normalizeCardRecord)
  return commanderPoolCache
}

let minigamePoolCache: CardRecord[] | null = null

export async function loadMinigamePool(): Promise<CardRecord[]> {
  if (cache) return cache.cards
  if (minigamePoolCache) return minigamePoolCache

  try {
    const raw = await fetchJsonAsset<PoolFile>(
      'data/minigame-pool.json',
      'Minigame pool',
    )
    minigamePoolCache = raw.cards.map(normalizeCardRecord)
  } catch {
    return (await loadCardDatabase()).cards
  }

  nameIndex = new Map(minigamePoolCache!.map((c) => [canonicalNameKey(c.name), c]))
  initCardNameIndex(minigamePoolCache!)
  return minigamePoolCache!
}

export async function loadStandardPool(): Promise<CardRecord[]> {
  if (standardPoolCache) return standardPoolCache

  const raw = await fetchJsonAsset<PoolFile & { format?: string }>(
    'standard-pool.json',
    'Standard card pool',
  )
  standardPoolCache = dedupeCardsByCanonicalName(raw.cards.map(normalizeCardRecord))
  return standardPoolCache
}

export function getCardByNameLocal(name: string): CardRecord | undefined {
  if (!nameIndex) return undefined
  const key = canonicalNameKey(name)
  return nameIndex.get(key) ?? nameIndex.get(name.toLowerCase())
}

export function getAllCardsCached(): CardRecord[] {
  return cache?.cards ?? minigamePoolCache ?? []
}
