import type { CardRecord } from '../types/card'
import type { ManaColor } from '../types/mtg'
import { parseManaCost, type ManaCost } from './playtest-mana'

export function isLandCard(card: Pick<CardRecord, 'type_line'>): boolean {
  return /\bLand\b/.test(card.type_line)
}

export function isBasicLand(card: Pick<CardRecord, 'type_line'>): boolean {
  return /\bBasic\b/.test(card.type_line) && isLandCard(card)
}

export function isCreatureCard(card: Pick<CardRecord, 'type_line'>): boolean {
  return /\bCreature\b/.test(card.type_line)
}

export function isArtifactCard(card: Pick<CardRecord, 'type_line'>): boolean {
  return /\bArtifact\b/.test(card.type_line)
}

export function isEnchantmentCard(card: Pick<CardRecord, 'type_line'>): boolean {
  return /\bEnchantment\b/.test(card.type_line)
}

export function isPlaneswalkerCard(card: Pick<CardRecord, 'type_line'>): boolean {
  return /\bPlaneswalker\b/.test(card.type_line)
}

export function isPermanentSpell(card: Pick<CardRecord, 'type_line'>): boolean {
  return (
    isCreatureCard(card) ||
    isArtifactCard(card) ||
    isEnchantmentCard(card) ||
    isPlaneswalkerCard(card) ||
    (/\bBattle\b/.test(card.type_line) && !isLandCard(card))
  )
}

export function isInstantOrSorcery(card: Pick<CardRecord, 'type_line'>): boolean {
  return /\b(Instant|Sorcery)\b/.test(card.type_line)
}

/** Mana a land can tap for (simplified — basics + common duals / any-color). */
export function landProduces(card: Pick<CardRecord, 'name' | 'type_line' | 'oracle_text' | 'color_identity'>): Array<ManaColor | 'C'> {
  const text = `${card.oracle_text ?? ''}`.toLowerCase()
  const name = card.name.toLowerCase()
  const type = card.type_line

  if (/\bPlains\b/.test(type) || name === 'plains') return ['W']
  if (/\bIsland\b/.test(type) || name === 'island') return ['U']
  if (/\bSwamp\b/.test(type) || name === 'swamp') return ['B']
  if (/\bMountain\b/.test(type) || name === 'mountain') return ['R']
  if (/\bForest\b/.test(type) || name === 'forest') return ['G']
  if (name === 'wastes') return ['C']

  if (
    /any color/.test(text) ||
    /commander's color identity/.test(text) ||
    name === 'command tower' ||
    name === 'city of brass' ||
    name === 'mana confluence' ||
    name === 'exotic orchard' ||
    name === 'path of ancestry' ||
    name === 'forbidden orchard'
  ) {
    const id = card.color_identity
    if (id.length === 0) return ['W', 'U', 'B', 'R', 'G']
    return id as ManaColor[]
  }

  if (/add \{c\}\{c\}/i.test(card.oracle_text ?? '') || name === 'ancient tomb' || name === 'temple of the false god') {
    return ['C', 'C']
  }

  const produced: Array<ManaColor | 'C'> = []
  for (const color of ['W', 'U', 'B', 'R', 'G', 'C'] as const) {
    const re = new RegExp(`add \\{${color}\\}`, 'i')
    if (re.test(card.oracle_text ?? '')) produced.push(color)
  }
  if (produced.length > 0) return produced

  // Fallback: color identity of the land, else colorless
  if (card.color_identity.length > 0) return card.color_identity as ManaColor[]
  return ['C']
}

export function isManaRock(card: CardRecord): boolean {
  if (isLandCard(card)) return false
  if (!isArtifactCard(card) && !isCreatureCard(card)) return false
  return /\{t\}: add |add \{|add one mana|add two mana|add three mana/i.test(
    card.oracle_text ?? '',
  )
}

function parseStat(value: string | undefined, fallback: number): number {
  if (value == null || value === '') return fallback
  if (value === '*') return Math.max(1, fallback)
  if (value === '1+*' || value === '2+*' || value.endsWith('+*')) {
    const base = Number.parseInt(value, 10)
    return Number.isFinite(base) ? Math.max(1, base + fallback) : fallback
  }
  const n = Number.parseInt(value, 10)
  return Number.isFinite(n) ? n : fallback
}

/**
 * Power/toughness for combat. Prefers printed Scryfall stats; falls back to
 * CMC/keyword heuristics when the pool entry has no P/T.
 */
export function estimatePowerToughness(card: CardRecord): { power: number; toughness: number } {
  if (!isCreatureCard(card)) return { power: 0, toughness: 0 }

  const cmc = Math.max(0, card.cmc)
  const heuristicPower = Math.max(1, Math.round(cmc * 0.9))
  const heuristicToughness = Math.max(1, Math.round(cmc * 0.95) || 1)

  const printedPower = card.power ?? card.card_faces?.[0]?.power
  const printedToughness = card.toughness ?? card.card_faces?.[0]?.toughness
  if (printedPower != null || printedToughness != null) {
    return {
      power: parseStat(printedPower, heuristicPower),
      toughness: parseStat(printedToughness, heuristicToughness),
    }
  }

  let power = heuristicPower
  let toughness = heuristicToughness

  const text = `${card.oracle_text ?? ''} ${card.keywords.join(' ')}`.toLowerCase()
  if (/\bflying\b/.test(text)) power = Math.max(power, 1)
  if (/\btrample\b/.test(text)) power += 1
  if (/\bdefender\b/.test(text)) {
    power = 0
    toughness = Math.max(toughness, cmc + 1)
  }
  if (/\bindestructible\b/.test(text)) toughness = Math.max(toughness, 3)
  if (card.name.toLowerCase().includes('wall')) {
    power = Math.min(power, 0)
    toughness = Math.max(toughness, 4)
  }
  if (/legendary/i.test(card.type_line) && /creature/i.test(card.type_line)) {
    power = Math.max(power, Math.ceil(cmc * 0.85))
    toughness = Math.max(toughness, Math.ceil(cmc * 0.9))
  }

  return { power, toughness }
}

export function spellCost(card: CardRecord, commanderTax = 0): ManaCost {
  const base = parseManaCost(card.mana_cost)
  if (commanderTax > 0) {
    return { ...base, generic: base.generic + commanderTax }
  }
  return base
}

export function hasKeyword(card: CardRecord, keyword: string): boolean {
  const k = keyword.toLowerCase()
  if (card.keywords.some((x) => x.toLowerCase() === k)) return true
  return new RegExp(`\\b${k}\\b`, 'i').test(card.oracle_text ?? '')
}
