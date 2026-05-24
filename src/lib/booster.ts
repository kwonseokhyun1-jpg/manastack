import type { CardRecord } from '../types/card'
import type { BoosterCard } from '../types/game'
import { CARDS_PER_PACK, ULTRAFOIL_CHANCE } from '../types/game'
import {
  addRarityToPack,
  canAddRarityToPack,
  emptyPackRarityCounts,
  getCardRarity,
  MAX_RARE_OR_MYTHIC_PER_PACK,
  type CardRarity,
} from './card-rarity'
import { canonicalNameKey } from './card-names'
import { countRareOrMythicInPack } from './rarity-db'
import { getCardImage } from './card-utils'

function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function isRareOrMythic(card: CardRecord, rarityMap: Map<string, CardRarity>): boolean {
  const rarity = getCardRarity(card, rarityMap)
  return rarity === 'rare' || rarity === 'mythic'
}

/** Bulk first, then rares/mythics, foil last — shuffled within each group. */
function orderPackForReveal(
  pack: BoosterCard[],
  rarityMap: Map<string, CardRarity>,
): BoosterCard[] {
  const bulk: BoosterCard[] = []
  const hits: BoosterCard[] = []
  const foils: BoosterCard[] = []

  for (const entry of pack) {
    if (entry.foil) {
      foils.push(entry)
    } else if (isRareOrMythic(entry.card, rarityMap)) {
      hits.push(entry)
    } else {
      bulk.push(entry)
    }
  }

  return [...shuffle(bulk), ...shuffle(hits), ...shuffle(foils)]
}

function pickConstrainedCard(
  pool: CardRecord[],
  counts: ReturnType<typeof emptyPackRarityCounts>,
  picked: Set<string>,
  rarityMap: Map<string, CardRarity>,
): CardRecord | null {
  for (const card of shuffle(pool)) {
    const key = canonicalNameKey(card.name)
    if (picked.has(key)) continue
    const rarity = getCardRarity(card, rarityMap)
    if (!canAddRarityToPack(rarity, counts)) continue
    picked.add(key)
    addRarityToPack(rarity, counts)
    return card
  }
  return null
}

export function rollUltrafoil(): boolean {
  return Math.random() < ULTRAFOIL_CHANCE
}

export function buildBoosterPack(
  allCards: CardRecord[],
  ownedNonFoilKeys: Set<string>,
  rarityMap: Map<string, CardRarity>,
): { cards: BoosterCard[]; error?: string } {
  if (allCards.length === 0) {
    return { cards: [], error: 'Card database not loaded.' }
  }

  if (rarityMap.size === 0) {
    return {
      cards: [],
      error: 'Rarity data not loaded. Run npm run build:rarity and refresh the page.',
    }
  }

  const rarityCounts = emptyPackRarityCounts()
  const picked = new Set<string>()
  const pack: BoosterCard[] = []

  const foilCard = pickConstrainedCard(allCards, rarityCounts, picked, rarityMap)
  if (!foilCard) {
    return { cards: [], error: 'Could not build foil slot for this pack.' }
  }
  pack.push({ card: foilCard, foil: true, ultrafoil: rollUltrafoil() })

  const unownedPool = allCards.filter(
    (c) => !ownedNonFoilKeys.has(canonicalNameKey(c.name)),
  )

  const nonFoilCount = CARDS_PER_PACK - 1
  if (unownedPool.length < nonFoilCount) {
    return {
      cards: [],
      error: `Not enough new cards left. You need ${nonFoilCount} unowned cards (${unownedPool.length} available).`,
    }
  }

  for (let i = 0; i < nonFoilCount; i++) {
    const card = pickConstrainedCard(unownedPool, rarityCounts, picked, rarityMap)
    if (!card) {
      return {
        cards: [],
        error: 'Could not fill this pack while respecting rarity limits (max 2 rares/mythics).',
      }
    }
    pack.push({ card, foil: false })
  }

  const rareOrMythic = countRareOrMythicInPack(
    pack.map((entry) => entry.card),
    rarityMap,
  )
  if (rareOrMythic > MAX_RARE_OR_MYTHIC_PER_PACK) {
    return {
      cards: [],
      error: `Pack generation failed rarity check (${rareOrMythic} rares/mythics). Refresh and try again.`,
    }
  }

  return { cards: orderPackForReveal(pack, rarityMap) }
}

export function cardToCollectedFields(
  card: CardRecord,
  finish: { foil: boolean; ultrafoil?: boolean },
) {
  return {
    cardId: card.id,
    name: card.name,
    image: getCardImage(card),
    typeLine: card.type_line,
    cmc: card.cmc,
    foil: finish.foil,
    ...(finish.ultrafoil ? { ultrafoil: true } : {}),
  }
}

export function countUniqueCards(collection: { foil: boolean; name: string }[]): number {
  const keys = new Set<string>()
  for (const c of collection) {
    if (!c.foil) keys.add(canonicalNameKey(c.name))
  }
  return keys.size
}
