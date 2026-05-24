import type { CollectedCard } from '../types/game'

/** Map shop preview / stale ids to the real collection row when possible. */
export function resolveCollectedCard(
  card: CollectedCard,
  collection: CollectedCard[],
): CollectedCard {
  if (collection.some((c) => c.instanceId === card.instanceId)) return card

  const matches = collection.filter(
    (c) =>
      c.name === card.name &&
      c.foil === card.foil &&
      Boolean(c.ultrafoil) === Boolean(card.ultrafoil),
  )
  if (matches.length === 0) return card
  return matches.sort((a, b) => b.collectedAt - a.collectedAt)[0]
}

export function isCollectedInstance(
  card: CollectedCard,
  collection: CollectedCard[],
): boolean {
  return collection.some((c) => c.instanceId === card.instanceId)
}
