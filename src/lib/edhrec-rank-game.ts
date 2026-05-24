import type { CardRecord } from '../types/card'
import { getCardImage, isLand } from './card-utils'

export type RankGameMode = 'commanders' | 'cards'

export type RankPair = {
  left: CardRecord
  right: CardRecord
}

function cardTypeLine(card: CardRecord): string {
  const faces = card.card_faces?.map((f) => f.type_line).join(' ') ?? ''
  return `${card.type_line} ${faces}`
}

function cardOracleText(card: CardRecord): string {
  if (card.card_faces && card.card_faces.length > 0) {
    return card.card_faces.map((f) => f.oracle_text ?? '').join('\n')
  }
  return card.oracle_text ?? ''
}

export function isCommander(card: CardRecord): boolean {
  const typeLine = cardTypeLine(card)

  if (/\bBackground\b/.test(typeLine)) return true
  if (!/\bLegendary\b/.test(typeLine)) return false
  if (/\bCreature\b/.test(typeLine)) return true
  if (/\bPlaneswalker\b/.test(typeLine)) {
    return /can be your commander/i.test(cardOracleText(card))
  }

  return false
}

export function buildRankGuessPool(cards: CardRecord[], mode: RankGameMode): CardRecord[] {
  return cards.filter((c) => {
    if (c.edhrec_rank == null || c.edhrec_rank <= 0) return false
    if (!getCardImage(c)) return false
    if (mode === 'commanders') return isCommander(c)
    return !isCommander(c) && !isLand(c)
  })
}

export function morePopularCard(a: CardRecord, b: CardRecord): CardRecord {
  const rankA = a.edhrec_rank ?? Number.MAX_SAFE_INTEGER
  const rankB = b.edhrec_rank ?? Number.MAX_SAFE_INTEGER
  return rankA <= rankB ? a : b
}

export function pickRankPair(pool: CardRecord[], previous?: RankPair): RankPair {
  if (pool.length < 2) throw new Error('Not enough ranked cards')

  for (let attempt = 0; attempt < 60; attempt++) {
    const left = pool[Math.floor(Math.random() * pool.length)]
    const right = pool[Math.floor(Math.random() * pool.length)]
    if (left.id === right.id) continue
    if (left.edhrec_rank === right.edhrec_rank) continue
    if (
      previous &&
      ((left.id === previous.left.id && right.id === previous.right.id) ||
        (left.id === previous.right.id && right.id === previous.left.id))
    ) {
      continue
    }
    if (Math.random() < 0.5) return { left, right }
    return { left: right, right: left }
  }

  const left = pool[0]
  const right = pool.find((c) => c.id !== left.id && c.edhrec_rank !== left.edhrec_rank)
  if (!right) throw new Error('Could not pick a valid card pair')
  return { left, right }
}

export function formatEdhrecRank(rank: number | undefined): string {
  if (rank == null || rank <= 0) return '—'
  return `#${rank.toLocaleString()}`
}

export function rankLabel(mode: RankGameMode): string {
  return mode === 'commanders' ? 'EDHREC' : 'EDHREC staple'
}

export function modePrompt(mode: RankGameMode): string {
  return mode === 'commanders'
    ? 'Tap the more popular commander on EDHREC'
    : 'Tap the more popular staple on EDHREC'
}

export function modeDescription(mode: RankGameMode): string {
  return mode === 'commanders'
    ? 'Which commander is more popular on EDHREC? Lower rank number wins.'
    : 'Which staple is more popular on EDHREC? Lower rank number wins.'
}

export function poolTooSmallMessage(mode: RankGameMode): string {
  return mode === 'commanders'
    ? 'Not enough ranked commanders in the database.'
    : 'Not enough ranked cards in the database.'
}
