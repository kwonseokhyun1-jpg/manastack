import { fetchJsonAsset } from './assets'
import { canonicalNameKey } from './card-names'
import type { CardRarity } from './card-rarity'
import { normalizeGathererRarity } from './card-rarity'

export type RarityMapFile = {
  updated_at: string
  source: string
  count: number
  matched?: number
  rarities: Record<string, CardRarity>
}

let cache: Map<string, CardRarity> | null = null

function buildMap(raw: RarityMapFile): Map<string, CardRarity> {
  const map = new Map<string, CardRarity>()
  for (const [key, rarity] of Object.entries(raw.rarities)) {
    map.set(key, normalizeGathererRarity(rarity))
  }
  return map
}

export async function loadRarityMap(): Promise<Map<string, CardRarity>> {
  if (cache && cache.size > 0) return cache

  const raw = await fetchJsonAsset<RarityMapFile>('rarity-map.json', 'Gatherer rarity map')
  const map = buildMap(raw)
  if (map.size === 0) {
    throw new Error('Gatherer rarity map is empty. Run npm run build:rarity.')
  }

  cache = map
  return map
}

export function getRarityForName(name: string, map: Map<string, CardRarity>): CardRarity {
  return map.get(canonicalNameKey(name)) ?? 'common'
}

export function getRarityMapCached(): Map<string, CardRarity> | null {
  return cache
}

export function countRareOrMythicInPack(
  cards: { name: string }[],
  map: Map<string, CardRarity>,
): number {
  let count = 0
  for (const card of cards) {
    const rarity = getRarityForName(card.name, map)
    if (rarity === 'rare' || rarity === 'mythic') count++
  }
  return count
}
