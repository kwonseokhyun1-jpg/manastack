import type { CardRecord } from '../types/card'

export function isLand(card: CardRecord): boolean {
  return /\bLand\b/.test(card.type_line)
}

export function getCardImage(card: CardRecord): string | undefined {
  return card.image ?? card.card_faces?.[0]?.image
}
