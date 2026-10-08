import type { CardRecord } from '../types/card'
import type { ManaColor } from '../types/mtg'
import type { DeckEntry, ParsedDecklist, ResolvedDeck } from '../types/playtest'
import { getCardByNameLocal } from './card-db'
import { canonicalCardName } from './card-names'
import { resolveCardNameFuzzy } from './card-name-resolve'
import { sortIdentity } from './color-filter'
import { getPlaytestLandByName, makePlaceholderCard } from './playtest-lands'

const SECTION_COMMANDER = /^(commander|commanders?)\s*:?\s*$/i
const SECTION_MAIN = /^(deck|mainboard|main\s*board)\s*:?\s*$/i
const SECTION_SIDE = /^(sideboard|side\s*board|maybeboard)\s*:?\s*$/i

/** `1 Sol Ring`, `1x Sol Ring`, `Sol Ring`, Arena `2 Mountain (ONE) 273` */
const LINE_RE =
  /^(?:SB:\s*)?(?:(\d+)\s*[xX]?\s+)?(.+?)(?:\s+\([A-Za-z0-9]+\)\s+\d+)?\s*$/

function cleanCardName(raw: string): string {
  let name = raw.trim()
  name = name.replace(/\s+\([A-Za-z0-9]{2,5}\)\s*\d*\s*$/, '')
  name = name.replace(/\s*[*★]+\s*$/, '')
  return canonicalCardName(name)
}

function resolveEntry(name: string, quantity: number): DeckEntry {
  const local =
    getCardByNameLocal(name) ??
    resolveCardNameFuzzy(name) ??
    getPlaytestLandByName(name)
  if (local) {
    return { name: local.name, quantity, card: local }
  }
  // Keep playtest usable when the local pool lacks a printing
  return {
    name,
    quantity,
    card: makePlaceholderCard(name),
    unresolved: true,
  }
}

function isLegendaryCreature(card: CardRecord): boolean {
  return /Legendary/i.test(card.type_line) && /Creature/i.test(card.type_line)
}

export type ParseDecklistOptions = {
  /** Explicit commander name (separate UI field). Wins over decklist sections. */
  commanderName?: string
}

/**
 * Parse a pasted or uploaded decklist (Arena / MTGO / plain `1 Card Name` text).
 * Requires the card name index to be initialized (`loadMinigamePool` / `loadCardDatabase`).
 */
export function parseDecklistText(
  text: string,
  deckName = 'My Deck',
  options?: ParseDecklistOptions,
): ParsedDecklist {
  const lines = text.split(/\r?\n/)
  const cards: DeckEntry[] = []
  const unresolved: string[] = []
  let commander: DeckEntry | undefined
  let section: 'main' | 'commander' | 'side' = 'main'
  let inferredName = deckName
  const overrideCommander = cleanCardName(options?.commanderName ?? '')

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line || line.startsWith('//') || line.startsWith('#')) continue

    if (/^name\s*:/i.test(line)) {
      inferredName = line.replace(/^name\s*:/i, '').trim() || inferredName
      continue
    }

    if (SECTION_COMMANDER.test(line)) {
      section = 'commander'
      continue
    }
    if (SECTION_MAIN.test(line)) {
      section = 'main'
      continue
    }
    if (SECTION_SIDE.test(line)) {
      section = 'side'
      continue
    }

    if (section === 'side' || /^SB:/i.test(line)) continue

    const match = line.match(LINE_RE)
    if (!match) continue

    const quantity = Math.max(1, Math.min(99, Number(match[1] ?? '1') || 1))
    const name = cleanCardName(match[2] ?? '')
    if (!name) continue

    const entry = resolveEntry(name, quantity)

    if (section === 'commander') {
      // Explicit UI commander field takes precedence; skip inline commander lines.
      if (!overrideCommander) {
        commander = { ...entry, quantity: 1 }
        if (entry.unresolved) unresolved.push(entry.name)
      }
      continue
    }

    cards.push(entry)
    if (entry.unresolved) unresolved.push(entry.name)
  }

  if (overrideCommander) {
    commander = resolveEntry(overrideCommander, 1)
    if (commander.unresolved) unresolved.push(commander.name)
    // Keep commander out of the 99 if it was also listed in the mainboard.
    const cmdKey = overrideCommander.toLowerCase()
    const idx = cards.findIndex((c) => c.name.toLowerCase() === cmdKey)
    if (idx >= 0) cards.splice(idx, 1)
  } else if (!commander) {
    const legendary = cards.find(
      (c) => c.card && isLegendaryCreature(c.card) && c.quantity === 1,
    )
    if (legendary?.card) {
      commander = { name: legendary.card.name, quantity: 1, card: legendary.card }
      const idx = cards.indexOf(legendary)
      if (idx >= 0) cards.splice(idx, 1)
    }
  }

  const totalCards =
    cards.reduce((sum, c) => sum + c.quantity, 0) + (commander ? 1 : 0)

  return {
    name: inferredName,
    commander,
    cards,
    unresolved: [...new Set(unresolved)],
    totalCards,
  }
}

/** Drop Commander / Sideboard section bodies so the textarea stores the 99 only. */
export function extractMainboardText(text: string): string {
  const lines = text.split(/\r?\n/)
  const out: string[] = []
  let skip = false
  for (const line of lines) {
    const trimmed = line.trim()
    if (SECTION_COMMANDER.test(trimmed)) {
      skip = true
      continue
    }
    if (SECTION_MAIN.test(trimmed)) {
      skip = false
      out.push(line)
      continue
    }
    if (SECTION_SIDE.test(trimmed)) {
      skip = true
      continue
    }
    if (!skip) out.push(line)
  }
  const result = out.join('\n').trim()
  return result || text
}

export function expandDeckEntries(entries: DeckEntry[]): CardRecord[] {
  const out: CardRecord[] = []
  for (const entry of entries) {
    if (!entry.card) continue
    for (let i = 0; i < entry.quantity; i++) out.push(entry.card)
  }
  return out
}

export function parsedToResolved(parsed: ParsedDecklist): ResolvedDeck | null {
  const mainboard = expandDeckEntries(parsed.cards)
  if (mainboard.length === 0 && !parsed.commander?.card) return null

  const commander = parsed.commander?.card
  return {
    name: parsed.name,
    commander,
    mainboard,
    colorIdentity: sortIdentity((commander?.color_identity ?? []) as ManaColor[]),
  }
}
