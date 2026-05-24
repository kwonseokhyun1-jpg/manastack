import type { CardRecord } from '../types/card'
import { isLand } from './card-utils'

export const STAPLE_MAX_RANK = 500

export function getAllStaples(cards: CardRecord[]): CardRecord[] {
  return cards.filter((c) => {
    if (isLand(c)) return false
    if (!c.edhrec_rank || c.edhrec_rank > STAPLE_MAX_RANK) return false
    return true
  })
}
