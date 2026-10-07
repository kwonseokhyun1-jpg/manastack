import type { ManaColor } from '../types/mtg'

export type ManaPool = Record<ManaColor | 'C', number>

export type ManaCost = {
  generic: number
  W: number
  U: number
  B: number
  R: number
  G: number
  C: number
  /** True when cost has {X} — treat X as 0 for auto-cast. */
  hasX: boolean
}

export function emptyManaPool(): ManaPool {
  return { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 }
}

export function poolTotal(pool: ManaPool): number {
  return pool.W + pool.U + pool.B + pool.R + pool.G + pool.C
}

/** Parse a Scryfall-style mana cost like `{2}{W}{U}` or `{G}`. */
export function parseManaCost(manaCost?: string): ManaCost {
  const cost: ManaCost = {
    generic: 0,
    W: 0,
    U: 0,
    B: 0,
    R: 0,
    G: 0,
    C: 0,
    hasX: false,
  }
  if (!manaCost) return cost

  const symbols = manaCost.match(/\{([^}]+)\}/g) ?? []
  for (const raw of symbols) {
    const sym = raw.slice(1, -1).toUpperCase()
    if (sym === 'X') {
      cost.hasX = true
      continue
    }
    if (/^\d+$/.test(sym)) {
      cost.generic += Number(sym)
      continue
    }
    if (sym === 'C' || sym === 'S') {
      cost.C += 1
      continue
    }
    // Hybrid / phyrexian — require one half as colored (simplified)
    if (sym.includes('/')) {
      const parts = sym.split('/')
      const colored = parts.find((p) => 'WUBRG'.includes(p))
      if (colored && colored in cost) {
        cost[colored as ManaColor] += 1
      } else if (parts.includes('P') || parts.includes('2')) {
        cost.generic += 1
      }
      continue
    }
    if ('WUBRG'.includes(sym)) {
      cost[sym as ManaColor] += 1
    }
  }
  return cost
}

export function manaValueOfCost(cost: ManaCost): number {
  return cost.generic + cost.W + cost.U + cost.B + cost.R + cost.G + cost.C
}

export function canPayCost(pool: ManaPool, cost: ManaCost): boolean {
  const remaining: ManaPool = { ...pool }
  for (const color of ['W', 'U', 'B', 'R', 'G', 'C'] as const) {
    if (remaining[color] < cost[color]) return false
    remaining[color] -= cost[color]
  }
  return poolTotal(remaining) >= cost.generic
}

/** Pay a cost from the pool (mutates a copy). Prefers spending matching colors, then colorless, then off-color. */
export function payCost(pool: ManaPool, cost: ManaCost): ManaPool | null {
  if (!canPayCost(pool, cost)) return null
  const next: ManaPool = { ...pool }

  for (const color of ['W', 'U', 'B', 'R', 'G', 'C'] as const) {
    next[color] -= cost[color]
  }

  let generic = cost.generic
  // Spend colorless first for generic
  const useC = Math.min(next.C, generic)
  next.C -= useC
  generic -= useC

  for (const color of ['W', 'U', 'B', 'R', 'G'] as const) {
    if (generic <= 0) break
    const use = Math.min(next[color], generic)
    next[color] -= use
    generic -= use
  }

  if (generic > 0) return null
  return next
}

export function addMana(pool: ManaPool, color: ManaColor | 'C', amount = 1): ManaPool {
  return { ...pool, [color]: pool[color] + amount }
}
