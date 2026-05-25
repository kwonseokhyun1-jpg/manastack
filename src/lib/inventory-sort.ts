import type { CardRecord } from '../types/card'
import type { CollectedCard } from '../types/game'
import { canonicalNameKey } from './card-names'
import {
  getCollectedCardRarity,
  parseUsd,
  rarityTier,
  type CardRarity,
} from './card-rarity'

export type InventorySortMode = 'recent' | 'foil' | 'name' | 'rarity' | 'price'

export const INVENTORY_SORT_OPTIONS: { value: InventorySortMode; label: string }[] = [
  { value: 'recent', label: 'Recently added' },
  { value: 'foil', label: 'Foil first' },
  { value: 'name', label: 'Name A–Z' },
  { value: 'rarity', label: 'Rarity' },
  { value: 'price', label: 'Price (USD)' },
]

function compareName(a: CollectedCard, b: CollectedCard): number {
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
}

function lookupPrice(lookup: Map<string, CardRecord>, name: string): number {
  const record = lookup.get(canonicalNameKey(name))
  return record ? parseUsd(record) : 0
}

export function buildCardLookup(cards: CardRecord[]): Map<string, CardRecord> {
  return new Map(cards.map((c) => [canonicalNameKey(c.name), c]))
}

export function filterCollectedCardsByQuery(
  items: CollectedCard[],
  query: string,
): CollectedCard[] {
  const q = query.trim().toLowerCase()
  if (!q) return items
  return items.filter((card) => card.name.toLowerCase().includes(q))
}

export function sortCollectedCards(
  items: CollectedCard[],
  mode: InventorySortMode,
  lookup: Map<string, CardRecord>,
  rarityMap: Map<string, CardRarity>,
): CollectedCard[] {
  const sorted = [...items]

  sorted.sort((a, b) => {
    switch (mode) {
      case 'recent':
        return b.collectedAt - a.collectedAt
      case 'foil': {
        const score = (c: CollectedCard) => (c.ultrafoil ? 2 : c.foil ? 1 : 0)
        const foilDiff = score(b) - score(a)
        return foilDiff !== 0 ? foilDiff : compareName(a, b)
      }
      case 'name':
        return compareName(a, b)
      case 'rarity': {
        const tierA = rarityTier(getCollectedCardRarity(a.name, rarityMap))
        const tierB = rarityTier(getCollectedCardRarity(b.name, rarityMap))
        const tierDiff = tierB - tierA
        return tierDiff !== 0 ? tierDiff : compareName(a, b)
      }
      case 'price': {
        const priceA = lookupPrice(lookup, a.name)
        const priceB = lookupPrice(lookup, b.name)
        const priceDiff = priceB - priceA
        return priceDiff !== 0 ? priceDiff : compareName(a, b)
      }
      default:
        return 0
    }
  })

  return sorted
}
