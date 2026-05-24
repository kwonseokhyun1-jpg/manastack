import type { CardRecord } from '../types/card'
import type { ManaColor } from '../types/mtg'
import { sortIdentity } from './color-filter'

const COLORLESS_TINT = '#e5e5e5'

const COLOR_TINT: Record<ManaColor, string> = {
  W: '#fde68a',
  U: '#bfdbfe',
  B: '#d4d4d8',
  R: '#fecaca',
  G: '#bbf7d0',
}

export const SPELLIFY_MAX_GUESSES = 13

export type GuessEntry = {
  guess: string
  hit: boolean
}

const VISIBLE = new Set([' ', '\n', ',', '.', ';', ':', '"', '(', ')', '—', '-', '/'])

export function buildSpellifyPool(cards: CardRecord[]): CardRecord[] {
  return cards.filter((c) => (c.oracle_text?.trim().length ?? 0) > 0)
}

export function getSpellifyDisplay(card: CardRecord) {
  const face = card.card_faces?.[0]
  const manaCost = card.mana_cost ?? face?.mana_cost ?? ''
  const typeLine = face?.type_line ?? card.type_line
  return {
    name: card.name,
    manaCost,
    typeLine,
    oracleText: composeOracleText(card),
    colors: getSpellifyHintColors(card, manaCost, typeLine),
  }
}

const COLORED_MANA: ManaColor[] = ['W', 'U', 'B', 'R', 'G']

/** Colored mana symbols present in a card's mana cost (hybrids count both). */
export function colorsFromManaCost(manaCost: string): ManaColor[] {
  const found: ManaColor[] = []
  const re = /\{([^}]+)\}/g
  let match: RegExpExecArray | null

  while ((match = re.exec(manaCost))) {
    for (const part of match[1].toUpperCase().split('/')) {
      const trimmed = part.trim()
      if (COLORED_MANA.includes(trimmed as ManaColor)) {
        if (!found.includes(trimmed as ManaColor)) found.push(trimmed as ManaColor)
      }
    }
  }

  return sortIdentity(found)
}

/** Background tint colors — artifacts with only generic mana are colorless. */
export function getSpellifyHintColors(
  card: CardRecord,
  manaCost: string,
  typeLine: string,
): ManaColor[] {
  if (/\bArtifact\b/.test(typeLine)) {
    return colorsFromManaCost(manaCost)
  }
  return sortIdentity(card.color_identity)
}

function composeOracleText(card: CardRecord): string {
  if (card.card_faces && card.card_faces.length > 1) {
    return card.card_faces
      .map((face) => {
        const text = face.oracle_text?.trim()
        if (!text) return ''
        return `${face.name}\n${text}`
      })
      .filter(Boolean)
      .join('\n\n')
  }
  return card.oracle_text ?? ''
}

export function normalizeGuessKey(guess: string): string {
  const trimmed = guess.trim()
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return trimmed.toUpperCase()
  if (trimmed.length === 1) return trimmed.toLowerCase()
  return trimmed
}

export function guessHitsCard(card: CardRecord, guess: string): boolean {
  const key = normalizeGuessKey(guess)
  if (!key) return false

  const display = getSpellifyDisplay(card)
  const haystack = [display.name, display.manaCost, display.typeLine, display.oracleText].join('\n')

  if (key.startsWith('{')) {
    const inner = key.slice(1, -1)
    const re = new RegExp(`\\{${escapeRegExp(inner)}\\}`, 'i')
    return re.test(haystack)
  }

  if (/^[0-9]$/.test(key)) {
    if (new RegExp(`\\{${key}\\}`).test(haystack)) return true
    return [...haystack].some((ch) => ch === key)
  }

  if (/^[a-z]$/.test(key)) {
    const letter = key
    if (new RegExp(`\\{[^}]*${letter}[^}]*\\}`, 'i').test(haystack)) return true
    return [...haystack].some((ch) => ch.toLowerCase() === letter)
  }

  return haystack.toLowerCase().includes(key.toLowerCase())
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function letterRevealed(ch: string, successfulGuesses: Set<string>): boolean {
  const lower = ch.toLowerCase()
  return successfulGuesses.has(lower)
}

function manaTokenRevealed(inner: string, successfulGuesses: Set<string>): boolean {
  const full = `{${inner}}`
  if (successfulGuesses.has(full.toUpperCase())) return true
  if (successfulGuesses.has(inner.toLowerCase())) return true
  if (successfulGuesses.has(inner.toUpperCase())) return true

  if (inner.length === 1) {
    return successfulGuesses.has(inner.toLowerCase())
  }

  for (const g of successfulGuesses) {
    if (g.length !== 1) continue
    if (inner.toLowerCase().includes(g)) return true
  }
  return false
}

export function maskText(text: string, successfulGuesses: Set<string>): string {
  let out = ''
  let i = 0

  while (i < text.length) {
    if (text[i] === '{') {
      const end = text.indexOf('}', i)
      if (end !== -1) {
        const inner = text.slice(i + 1, end)
        out += manaTokenRevealed(inner, successfulGuesses) ? `{${inner}}` : '_'
        i = end + 1
        continue
      }
    }

    const ch = text[i]
    if (VISIBLE.has(ch)) {
      out += ch
    } else if (/[a-zA-Z0-9]/.test(ch)) {
      out += letterRevealed(ch, successfulGuesses) ? ch : '_'
    } else {
      out += letterRevealed(ch, successfulGuesses) ? ch : '_'
    }
    i++
  }

  return out
}

/** Split masked text into word chunks for spaced underscore display. */
export type MaskSegment = { kind: 'word' | 'space' | 'break'; text: string }

export function splitMaskedDisplay(text: string): MaskSegment[] {
  const segments: MaskSegment[] = []
  let i = 0

  while (i < text.length) {
    const ch = text[i]
    if (ch === '\n') {
      segments.push({ kind: 'break', text: '\n' })
      i++
      continue
    }
    if (ch === ' ') {
      segments.push({ kind: 'space', text: ' ' })
      i++
      continue
    }

    let word = ''
    while (i < text.length && text[i] !== ' ' && text[i] !== '\n') {
      word += text[i]
      i++
    }
    if (word) segments.push({ kind: 'word', text: word })
  }

  return segments
}

export function frameStyle(colors: ReturnType<typeof sortIdentity>): {
  border: string
  frame: string
  titleBar: string
  title: string
  textBox: string
  textBoxBorder: string
  typeLine: string
  oracle: string
} {
  if (colors.length === 0) {
    return {
      border: '#1a1a1a',
      frame: 'linear-gradient(180deg, #c4c4c4 0%, #8a8a8a 45%, #6b6b6b 100%)',
      titleBar: 'linear-gradient(180deg, #e8e8e8 0%, #bdbdbd 100%)',
      title: '#1a1a1a',
      textBox: 'linear-gradient(180deg, #f5eed8 0%, #e8dcc0 100%)',
      textBoxBorder: '#9a8b6a',
      typeLine: '#3d3429',
      oracle: '#1a1a1a',
    }
  }
  if (colors.length >= 2) {
    return {
      border: '#1a1a1a',
      frame: 'linear-gradient(135deg, #fef3c7 0%, #0e68ab 35%, #111827 65%, #991b1b 100%)',
      titleBar: 'linear-gradient(180deg, #f8e7b9 0%, #c9a227 100%)',
      title: '#1a1a1a',
      textBox: 'linear-gradient(180deg, #f5eed8 0%, #e8dcc0 100%)',
      textBoxBorder: '#8a7020',
      typeLine: '#3d3429',
      oracle: '#1a1a1a',
    }
  }

  const map = {
    W: {
      border: '#1a1a1a',
      frame: 'linear-gradient(180deg, #fef9ef 0%, #f8e7b9 40%, #e8d5a0 100%)',
      titleBar: 'linear-gradient(180deg, #fffdf5 0%, #f8e7b9 100%)',
      title: '#1a1a1a',
      textBox: 'linear-gradient(180deg, #f5eed8 0%, #e8dcc0 100%)',
      textBoxBorder: '#b8a06a',
      typeLine: '#3d3429',
      oracle: '#1a1a1a',
    },
    U: {
      border: '#1a1a1a',
      frame: 'linear-gradient(180deg, #5ba3d9 0%, #0e68ab 45%, #084a7a 100%)',
      titleBar: 'linear-gradient(180deg, #7eb8e8 0%, #0e68ab 100%)',
      title: '#fff',
      textBox: 'linear-gradient(180deg, #f5eed8 0%, #e8dcc0 100%)',
      textBoxBorder: '#6a8a9a',
      typeLine: '#1e3a5f',
      oracle: '#1a1a1a',
    },
    B: {
      border: '#1a1a1a',
      frame: 'linear-gradient(180deg, #4a4a4a 0%, #2a2a2a 45%, #111 100%)',
      titleBar: 'linear-gradient(180deg, #5a5a5a 0%, #2a2a2a 100%)',
      title: '#f0f0f0',
      textBox: 'linear-gradient(180deg, #f5eed8 0%, #e8dcc0 100%)',
      textBoxBorder: '#6a6a6a',
      typeLine: '#2a2a2a',
      oracle: '#1a1a1a',
    },
    R: {
      border: '#1a1a1a',
      frame: 'linear-gradient(180deg, #e85555 0%, #d3202a 45%, #991b1b 100%)',
      titleBar: 'linear-gradient(180deg, #f08080 0%, #d3202a 100%)',
      title: '#fff',
      textBox: 'linear-gradient(180deg, #f5eed8 0%, #e8dcc0 100%)',
      textBoxBorder: '#9a5a5a',
      typeLine: '#5c1a1a',
      oracle: '#1a1a1a',
    },
    G: {
      border: '#1a1a1a',
      frame: 'linear-gradient(180deg, #3cb371 0%, #00733e 45%, #004d28 100%)',
      titleBar: 'linear-gradient(180deg, #5fd68a 0%, #00733e 100%)',
      title: '#fff',
      textBox: 'linear-gradient(180deg, #f5eed8 0%, #e8dcc0 100%)',
      textBoxBorder: '#5a8a6a',
      typeLine: '#1a3d2a',
      oracle: '#1a1a1a',
    },
  } as const

  return map[colors[0]]
}

export function isCreatureOrPW(typeLine: string): boolean {
  return /\bCreature\b/.test(typeLine) || /\bPlaneswalker\b/.test(typeLine)
}

/** Faint panel background hinting at card color (easy mode only). */
export function spellifyPanelBackground(
  colors: ManaColor[],
  hardMode: boolean,
): string {
  if (hardMode) return '#ffffff'

  if (colors.length === 0) return COLORLESS_TINT

  if (colors.length === 1) return COLOR_TINT[colors[0]]

  const stops = colors
    .map((c, i) => `${COLOR_TINT[c]} ${Math.round((i / (colors.length - 1)) * 100)}%`)
    .join(', ')
  return `linear-gradient(135deg, ${stops})`
}

export const SYMBOL_KEYS = [
  '{0}',
  '{1}',
  '{2}',
  '{3}',
  '{4}',
  '{5}',
  '{6}',
  '{7}',
  '{8}',
  '{9}',
  '{10}',
  '{X}',
  '{W}',
  '{U}',
  '{B}',
  '{R}',
  '{G}',
  '{C}',
  '{T}',
  '{E}',
  '{S}',
] as const

export function symbolLabel(key: string): string {
  if (key.startsWith('{') && key.endsWith('}')) return key.slice(1, -1)
  return key
}

export function scryfallSymbolUrl(inner: string): string {
  return `https://svgs.scryfall.io/card-symbols/${encodeURIComponent(inner.toUpperCase())}.svg`
}
