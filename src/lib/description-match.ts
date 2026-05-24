import type { CardRecord } from '../types/card'
import type { ManaColor } from '../types/mtg'
import { canonicalNameKey } from './card-names'
import { isLand } from './card-utils'

export const DESCRIPTION_MATCH_TIME_SEC = 25
export const DESCRIPTION_MATCH_COUNT = 3
export const DESCRIPTION_MATCH_MANA_MAX = 3

export type DescriptionMission = {
  id: string
  description: string
  count: number
  matches: (card: CardRecord) => boolean
}

const COLOR_LABEL: Record<ManaColor, string> = {
  W: 'white',
  U: 'blue',
  B: 'black',
  R: 'red',
  G: 'green',
}

type CardType =
  | 'Creature'
  | 'Instant'
  | 'Sorcery'
  | 'Enchantment'
  | 'Artifact'
  | 'Planeswalker'

function cardTypeLine(card: CardRecord): string {
  const faces = card.card_faces?.map((f) => f.type_line).join(' ') ?? ''
  return `${card.type_line} ${faces}`
}

function hasCardType(card: CardRecord, type: CardType): boolean {
  return cardTypeLine(card).includes(type)
}

function hasColor(card: CardRecord, color: ManaColor): boolean {
  return card.color_identity.includes(color)
}

function isColorless(card: CardRecord): boolean {
  return card.color_identity.length === 0
}

function hasKeyword(card: CardRecord, keyword: string): boolean {
  const lower = keyword.toLowerCase()
  return (card.keywords ?? []).some((k) => k.toLowerCase() === lower)
}

function isSpell(card: CardRecord): boolean {
  return hasCardType(card, 'Instant') || hasCardType(card, 'Sorcery')
}

function countUniqueMatches(
  pool: CardRecord[],
  matches: (card: CardRecord) => boolean,
): number {
  const seen = new Set<string>()
  let count = 0
  for (const card of pool) {
    if (!matches(card)) continue
    const key = canonicalNameKey(card.name)
    if (seen.has(key)) continue
    seen.add(key)
    count += 1
  }
  return count
}

type MissionTemplate = {
  id: string
  build: () => Omit<DescriptionMission, 'id'> & { id: string }
}

const MISSION_TEMPLATES: MissionTemplate[] = [
  ...(['U', 'B', 'R', 'G', 'W'] as ManaColor[]).flatMap((color) => [
    {
      id: `${color}-enchantment`,
      build: () => ({
        id: `${color}-enchantment`,
        description: `List ${DESCRIPTION_MATCH_COUNT} ${COLOR_LABEL[color]} enchantments`,
        count: DESCRIPTION_MATCH_COUNT,
        matches: (c: CardRecord) => hasColor(c, color) && hasCardType(c, 'Enchantment') && !isLand(c),
      }),
    },
    {
      id: `${color}-creature`,
      build: () => ({
        id: `${color}-creature`,
        description: `List ${DESCRIPTION_MATCH_COUNT} ${COLOR_LABEL[color]} creatures`,
        count: DESCRIPTION_MATCH_COUNT,
        matches: (c: CardRecord) => hasColor(c, color) && hasCardType(c, 'Creature') && !isLand(c),
      }),
    },
    {
      id: `${color}-instant`,
      build: () => ({
        id: `${color}-instant`,
        description: `List ${DESCRIPTION_MATCH_COUNT} ${COLOR_LABEL[color]} instants`,
        count: DESCRIPTION_MATCH_COUNT,
        matches: (c: CardRecord) => hasColor(c, color) && hasCardType(c, 'Instant') && !isLand(c),
      }),
    },
  ]),
  {
    id: 'artifact',
    build: () => ({
      id: 'artifact',
      description: `List ${DESCRIPTION_MATCH_COUNT} artifacts`,
      count: DESCRIPTION_MATCH_COUNT,
      matches: (c) => hasCardType(c, 'Artifact') && !isLand(c),
    }),
  },
  {
    id: 'colorless-artifact',
    build: () => ({
      id: 'colorless-artifact',
      description: `List ${DESCRIPTION_MATCH_COUNT} colorless artifacts`,
      count: DESCRIPTION_MATCH_COUNT,
      matches: (c) => isColorless(c) && hasCardType(c, 'Artifact') && !isLand(c),
    }),
  },
  {
    id: 'flying',
    build: () => ({
      id: 'flying',
      description: `List ${DESCRIPTION_MATCH_COUNT} cards with flying`,
      count: DESCRIPTION_MATCH_COUNT,
      matches: (c) => hasKeyword(c, 'Flying') && !isLand(c),
    }),
  },
  {
    id: 'legendary',
    build: () => ({
      id: 'legendary',
      description: `List ${DESCRIPTION_MATCH_COUNT} legendary cards`,
      count: DESCRIPTION_MATCH_COUNT,
      matches: (c) => cardTypeLine(c).includes('Legendary') && !isLand(c),
    }),
  },
  {
    id: 'red-spell',
    build: () => ({
      id: 'red-spell',
      description: `List ${DESCRIPTION_MATCH_COUNT} red instants or sorceries`,
      count: DESCRIPTION_MATCH_COUNT,
      matches: (c) => hasColor(c, 'R') && isSpell(c) && !isLand(c),
    }),
  },
  {
    id: 'blue-spell',
    build: () => ({
      id: 'blue-spell',
      description: `List ${DESCRIPTION_MATCH_COUNT} blue instants or sorceries`,
      count: DESCRIPTION_MATCH_COUNT,
      matches: (c) => hasColor(c, 'U') && isSpell(c) && !isLand(c),
    }),
  },
]

export function pickDescriptionMission(
  pool: CardRecord[],
  avoidId?: string,
): DescriptionMission | null {
  const viable = MISSION_TEMPLATES.filter((template) => {
    if (template.id === avoidId) return false
    const mission = template.build()
    return countUniqueMatches(pool, mission.matches) >= mission.count + 5
  })

  const candidates = viable.length > 0 ? viable : MISSION_TEMPLATES.filter((t) => {
    if (t.id === avoidId) return false
    const mission = t.build()
    return countUniqueMatches(pool, mission.matches) >= mission.count
  })

  if (candidates.length === 0) return null

  const picked = candidates[Math.floor(Math.random() * candidates.length)]
  return picked.build()
}

export function manaRewardForDescriptionMatch(
  timeRemainingSec: number,
  timeLimit = DESCRIPTION_MATCH_TIME_SEC,
): number {
  if (timeRemainingSec <= 0) return 0
  return Math.min(
    DESCRIPTION_MATCH_MANA_MAX,
    Math.max(1, Math.ceil((timeRemainingSec / timeLimit) * DESCRIPTION_MATCH_MANA_MAX)),
  )
}

export function cardMatchesMission(
  card: CardRecord,
  mission: DescriptionMission,
): boolean {
  return mission.matches(card)
}

export const DESCRIPTION_MATCH_REWARD_LABEL = 'Up to 3 mana — faster wins pay more'
