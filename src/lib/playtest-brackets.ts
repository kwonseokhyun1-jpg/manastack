import type { CardRecord } from '../types/card'
import type { ManaColor } from '../types/mtg'
import type { CommanderBracket, ResolvedDeck } from '../types/playtest'
import { isLand } from './card-utils'
import { sortIdentity } from './color-filter'
import { getAllPlaytestLands } from './playtest-lands'

/** Cards gated behind higher brackets (fast mana / game-changers / heavy tutors). */
const MIN_BRACKET_FOR_CARD: Record<string, CommanderBracket> = {
  'mana crypt': 4,
  'jeweled lotus': 4,
  'mana vault': 3,
  'grim monolith': 4,
  'chrome mox': 4,
  'mox diamond': 4,
  'lotus petal': 3,
  'ancient tomb': 3,
  'demonic tutor': 3,
  'vampiric tutor': 4,
  'imperial seal': 4,
  'mystical tutor': 3,
  'enlightened tutor': 3,
  'worldly tutor': 3,
  'gamble': 3,
  'ad nauseam': 5,
  'thorn of amethyst': 4,
  'rhystic study': 3,
  'smothering tithe': 3,
  "teferi's protection": 3,
  'cyclonic rift': 3,
  'dockside extortionist': 4,
  'fierce guardianship': 4,
  'deflecting swat': 4,
  'deadly rollick': 4,
  'flawless maneuver': 4,
  'force of will': 4,
  'force of negation': 4,
  'mental misstep': 5,
  'underworld breach': 5,
  "thassa's oracle": 5,
  'demonic consultation': 5,
  'tainted pact': 5,
  'necropotence': 4,
}

type BracketProfile = {
  landCount: [number, number]
  avgCmcBias: number
  maxEdhrecRank: number
  preferLowCmc: boolean
  rockDensity: number
  interactionDensity: number
}

const PROFILES: Record<CommanderBracket, BracketProfile> = {
  1: {
    landCount: [38, 40],
    avgCmcBias: 4.2,
    maxEdhrecRank: 12000,
    preferLowCmc: false,
    rockDensity: 0.08,
    interactionDensity: 0.08,
  },
  2: {
    landCount: [37, 39],
    avgCmcBias: 3.6,
    maxEdhrecRank: 8000,
    preferLowCmc: false,
    rockDensity: 0.1,
    interactionDensity: 0.12,
  },
  3: {
    landCount: [36, 38],
    avgCmcBias: 3.1,
    maxEdhrecRank: 4000,
    preferLowCmc: true,
    rockDensity: 0.12,
    interactionDensity: 0.16,
  },
  4: {
    landCount: [34, 37],
    avgCmcBias: 2.6,
    maxEdhrecRank: 2000,
    preferLowCmc: true,
    rockDensity: 0.14,
    interactionDensity: 0.2,
  },
  5: {
    landCount: [30, 34],
    avgCmcBias: 2.1,
    maxEdhrecRank: 1500,
    preferLowCmc: true,
    rockDensity: 0.16,
    interactionDensity: 0.28,
  },
}

const BASIC_BY_COLOR: Record<ManaColor, string> = {
  W: 'Plains',
  U: 'Island',
  B: 'Swamp',
  R: 'Mountain',
  G: 'Forest',
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function withinIdentity(card: CardRecord, identity: ManaColor[]): boolean {
  if (card.color_identity.length === 0) return true
  return card.color_identity.every((c) => identity.includes(c as ManaColor))
}

function cardAllowedInBracket(card: CardRecord, bracket: CommanderBracket): boolean {
  const key = card.name.toLowerCase()
  const min = MIN_BRACKET_FOR_CARD[key]
  if (min != null && bracket < min) return false
  if (card.game_changer && bracket < 3) return false
  return true
}

function isRock(card: CardRecord): boolean {
  return (
    /\bArtifact\b/.test(card.type_line) &&
    /add \{|add one mana|add two mana|mana of any color/i.test(card.oracle_text ?? '')
  )
}

function isInteraction(card: CardRecord): boolean {
  return /\b(Instant|Sorcery)\b/.test(card.type_line) &&
    /destroy |exile |counter target|return target|bounce|kill|wrath|board wipe/i.test(
      card.oracle_text ?? '',
    )
}

function scoreCard(card: CardRecord, profile: BracketProfile, bracket: CommanderBracket): number {
  const rank = card.edhrec_rank ?? 20000
  let score = Math.max(0, profile.maxEdhrecRank - rank)
  if (profile.preferLowCmc) score += Math.max(0, 6 - card.cmc) * 40
  else score += Math.max(0, card.cmc - 2) * 15
  if (isRock(card)) score *= 1 + profile.rockDensity * 3
  if (isInteraction(card)) score *= 1 + profile.interactionDensity * 2
  if (cardAllowedInBracket(card, bracket) === false) return -1
  // Mild randomness so regenerating yields variety
  score *= 0.7 + Math.random() * 0.6
  return score
}

function pickCommander(
  commanders: CardRecord[],
  bracket: CommanderBracket,
): CardRecord {
  const profile = PROFILES[bracket]
  const pool = commanders.filter((c) => {
    const rank = c.edhrec_rank ?? 99999
    if (bracket <= 2) return rank <= 8000
    if (bracket === 3) return rank <= 5000
    if (bracket === 4) return rank <= 2500
    return rank <= 1500
  })
  const usable = (pool.length > 20 ? pool : commanders).filter((c) =>
    (c.edhrec_rank ?? 99999) <= profile.maxEdhrecRank + 2000,
  )
  return pickRandom(usable.length > 0 ? usable : commanders)
}

function findByName(cards: CardRecord[], name: string): CardRecord | undefined {
  const key = name.toLowerCase()
  return cards.find((c) => c.name.toLowerCase() === key)
}

function buildLands(
  allCards: CardRecord[],
  identity: ManaColor[],
  count: number,
  bracket: CommanderBracket,
): CardRecord[] {
  const lands: CardRecord[] = []
  const dualish = allCards.filter(
    (c) =>
      isLand(c) &&
      withinIdentity(c, identity) &&
      cardAllowedInBracket(c, bracket) &&
      (c.edhrec_rank ?? 99999) < (bracket >= 4 ? 3000 : bracket >= 3 ? 6000 : 10000),
  )

  const nonbasics = Math.min(
    Math.floor(count * (bracket >= 4 ? 0.75 : bracket >= 3 ? 0.55 : 0.35)),
    dualish.length,
  )
  lands.push(...shuffle(dualish).slice(0, nonbasics))

  const basicsNeeded = count - lands.length
  if (identity.length === 0) {
    const wastes = findByName(allCards, 'Wastes')
    const island = findByName(allCards, 'Island')
    const filler = wastes ?? island
    if (filler) for (let i = 0; i < basicsNeeded; i++) lands.push(filler)
    return lands
  }

  for (let i = 0; i < basicsNeeded; i++) {
    const color = identity[i % identity.length]
    const basic = findByName(allCards, BASIC_BY_COLOR[color])
    if (basic) lands.push(basic)
  }
  return lands
}

/**
 * Build a random Commander deck approximating the selected power bracket.
 * Uses local card pools (EDHREC rank + gated high-power cards) as a proxy —
 * not an official bracket classification.
 */
export function generateBracketOpponentDeck(
  bracket: CommanderBracket,
  allCards: CardRecord[],
  commanders: CardRecord[],
): ResolvedDeck {
  const profile = PROFILES[bracket]
  const commander = pickCommander(commanders, bracket)
  const identity = sortIdentity(commander.color_identity as ManaColor[])
  const landTarget =
    profile.landCount[0] +
    Math.floor(Math.random() * (profile.landCount[1] - profile.landCount[0] + 1))

  // Minigame pool has no lands — merge playtest land stubs for mana bases
  const cardsWithLands = [...allCards, ...getAllPlaytestLands()]
  const lands = buildLands(cardsWithLands, identity, landTarget, bracket)
  const used = new Set(lands.map((c) => c.name.toLowerCase()))
  used.add(commander.name.toLowerCase())

  const candidates = allCards.filter((c) => {
    if (isLand(c)) return false
    if (!withinIdentity(c, identity)) return false
    if (!cardAllowedInBracket(c, bracket)) return false
    if ((c.edhrec_rank ?? 99999) > profile.maxEdhrecRank) return false
    if (used.has(c.name.toLowerCase())) return false
    return true
  })

  const scored = candidates
    .map((card) => ({ card, score: scoreCard(card, profile, bracket) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)

  const mainboard: CardRecord[] = [...lands]
  const need = 99 - mainboard.length

  // Weighted pick from top of scored list with jitter for variety
  const pool = scored.slice(0, Math.min(scored.length, 400 + bracket * 80))
  for (const item of shuffle(pool).slice(0, need)) {
    mainboard.push(item.card)
    if (mainboard.length >= 99) break
  }

  // Top up with any identity-legal cards if pool was thin
  if (mainboard.length < 99) {
    const filler = shuffle(
      allCards.filter(
        (c) =>
          !isLand(c) &&
          withinIdentity(c, identity) &&
          cardAllowedInBracket(c, bracket) &&
          !mainboard.some((m) => m.id === c.id) &&
          c.id !== commander.id,
      ),
    )
    for (const card of filler) {
      mainboard.push(card)
      if (mainboard.length >= 99) break
    }
  }

  return {
    name: `${commander.name} (Bracket ${bracket})`,
    commander,
    mainboard: mainboard.slice(0, 99),
    colorIdentity: identity,
    bracket,
  }
}
