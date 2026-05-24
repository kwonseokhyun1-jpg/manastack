import type { CardRecord } from '../types/card'
import { canonicalNameKey } from './card-names'
import { levenshtein } from './fuzzy-text'
import { getCardByNameLocal } from './card-db'

let nameIndex: { name: string; lower: string }[] | null = null

export function initCardNameIndex(cards: CardRecord[]): void {
  const seen = new Set<string>()
  nameIndex = []
  for (const c of cards) {
    const key = canonicalNameKey(c.name)
    if (seen.has(key)) continue
    seen.add(key)
    nameIndex.push({ name: c.name, lower: key })
  }
}

export function suggestCardNames(query: string, limit = 12): string[] {
  if (query.length < 2 || !nameIndex) return []
  const q = query.toLowerCase()
  const starts: string[] = []
  const contains: string[] = []

  for (const entry of nameIndex) {
    if (entry.lower.startsWith(q)) {
      starts.push(entry.name)
    } else if (entry.lower.includes(q)) {
      contains.push(entry.name)
    }
  }

  starts.sort((a, b) => a.localeCompare(b))
  contains.sort((a, b) => a.localeCompare(b))
  return [...starts, ...contains].slice(0, limit)
}

export function resolveCardNameFuzzy(query: string): CardRecord | undefined {
  const cleaned = query.trim()
  if (!cleaned) return undefined

  const lower = cleaned.toLowerCase()
  const exact = getCardByNameLocal(lower)
  if (exact) return exact

  if (!nameIndex) return undefined

  let best: CardRecord | undefined
  let bestDist = Infinity

  for (const entry of nameIndex) {
    if (entry.lower === lower) return getCardByNameLocal(entry.lower)
    if (entry.lower.startsWith(lower) && lower.length >= 3) {
      return getCardByNameLocal(entry.lower)
    }
    if (lower.length >= 4 && entry.lower.includes(lower)) {
      const candidate = getCardByNameLocal(entry.lower)
      if (candidate) return candidate
    }

    if (lower.length >= 4 && entry.lower.length >= 4) {
      const maxDist = lower.length <= 6 ? 1 : lower.length <= 10 ? 2 : 3
      const dist = levenshtein(lower, entry.lower)
      if (dist <= maxDist && dist < bestDist) {
        bestDist = dist
        best = getCardByNameLocal(entry.lower)
      }
    }
  }

  return best
}
