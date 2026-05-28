import type { CardRecord } from '../types/card'
import { canonicalNameKey } from './card-names'
import { levenshtein } from './fuzzy-text'
import { getCardByNameLocal } from './card-db'

type NameEntry = { name: string; lower: string }

let nameIndex: NameEntry[] | null = null
let sortedByLower: NameEntry[] | null = null

function lowerBound(entries: NameEntry[], query: string): number {
  let lo = 0
  let hi = entries.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (entries[mid].lower < query) lo = mid + 1
    else hi = mid
  }
  return lo
}

export function initCardNameIndex(cards: CardRecord[]): void {
  const seen = new Set<string>()
  nameIndex = []
  for (const c of cards) {
    const key = canonicalNameKey(c.name)
    if (seen.has(key)) continue
    seen.add(key)
    nameIndex.push({ name: c.name, lower: key })
  }
  sortedByLower = [...nameIndex].sort((a, b) => a.lower.localeCompare(b.lower))
}

export function suggestCardNames(query: string, limit = 12): string[] {
  if (query.length < 2 || !sortedByLower) return []

  const q = query.toLowerCase()
  const results: string[] = []
  const start = lowerBound(sortedByLower, q)

  for (let i = start; i < sortedByLower.length; i++) {
    const entry = sortedByLower[i]
    if (!entry.lower.startsWith(q)) break
    results.push(entry.name)
    if (results.length >= limit) return results
  }

  if (results.length >= limit || q.length < 3 || !nameIndex) {
    return results
  }

  const seen = new Set(results.map((name) => canonicalNameKey(name)))
  const needed = limit - results.length
  let added = 0

  for (const entry of nameIndex) {
    if (seen.has(entry.lower)) continue
    if (!entry.lower.includes(q)) continue
    results.push(entry.name)
    seen.add(entry.lower)
    added++
    if (added >= needed) break
  }

  return results
}

export function resolveCardNameFuzzy(query: string): CardRecord | undefined {
  const cleaned = query.trim()
  if (!cleaned) return undefined

  const lower = cleaned.toLowerCase()
  const exact = getCardByNameLocal(lower)
  if (exact) return exact

  if (!sortedByLower) return undefined

  const start = lowerBound(sortedByLower, lower)
  for (let i = start; i < sortedByLower.length; i++) {
    const entry = sortedByLower[i]
    if (!entry.lower.startsWith(lower)) break
    if (lower.length >= 3) return getCardByNameLocal(entry.lower)
  }

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
