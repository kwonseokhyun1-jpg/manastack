import type { CardRecord, CardRarity } from '../types/card'
import { getRarityForName } from './rarity-db'

export type { CardRarity }

export const MAX_RARE_OR_MYTHIC_PER_PACK = 2

export function parseUsd(card: CardRecord): number {
  const raw = card.prices?.usd
  if (raw == null || raw === '') return 0
  const value = Number.parseFloat(raw)
  return Number.isFinite(value) ? value : 0
}

export function normalizeGathererRarity(raw: string): CardRarity {
  const value = raw.trim().toLowerCase()
  if (value === 'mythic' || value === 'mythic rare') return 'mythic'
  if (value === 'rare') return 'rare'
  if (value === 'uncommon') return 'uncommon'
  return 'common'
}

/** Scryfall / Gatherer-style rarity strings. */
export function normalizeScryfallRarity(raw: string | undefined | null): CardRarity {
  const value = String(raw ?? '').trim().toLowerCase()
  if (value === 'mythic') return 'mythic'
  if (value === 'rare') return 'rare'
  if (value === 'uncommon') return 'uncommon'
  if (value === 'special' || value === 'bonus') return 'rare'
  return 'common'
}

export function getCardRarity(
  card: CardRecord,
  rarityMap: Map<string, CardRarity>,
): CardRarity {
  if (card.rarity) return card.rarity
  return getRarityForName(card.name, rarityMap)
}

export function getCollectedCardRarity(
  name: string,
  rarityMap: Map<string, CardRarity>,
  record?: CardRecord | null,
  liveRarity?: string | null,
): CardRarity {
  if (record?.rarity) return record.rarity
  if (liveRarity) return normalizeScryfallRarity(liveRarity)
  return getRarityForName(name, rarityMap)
}

export function rarityTier(rarity: CardRarity): number {
  switch (rarity) {
    case 'mythic':
      return 4
    case 'rare':
      return 3
    case 'uncommon':
      return 2
    default:
      return 1
  }
}

export type PackRarityCounts = {
  rareOrMythic: number
}

export function emptyPackRarityCounts(): PackRarityCounts {
  return { rareOrMythic: 0 }
}

export function canAddRarityToPack(rarity: CardRarity, counts: PackRarityCounts): boolean {
  if ((rarity === 'rare' || rarity === 'mythic') && counts.rareOrMythic >= MAX_RARE_OR_MYTHIC_PER_PACK) {
    return false
  }
  return true
}

export function addRarityToPack(rarity: CardRarity, counts: PackRarityCounts): void {
  if (rarity === 'rare' || rarity === 'mythic') counts.rareOrMythic++
}
