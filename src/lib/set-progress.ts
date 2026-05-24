import { fetchJsonAsset } from './assets'
import { canonicalNameKey } from './card-names'
import type { CollectedCard } from '../types/game'

export type SetCatalogEntry = {
  code: string
  name: string
  total: number
}

export type SetCatalogFile = {
  updated_at: string
  set_count: number
  sets: SetCatalogEntry[]
  nameToSets: Record<string, string[]>
}

let cache: SetCatalogFile | null = null

export async function loadSetCatalog(): Promise<SetCatalogFile> {
  if (cache) return cache
  cache = await fetchJsonAsset<SetCatalogFile>('set-catalog.json', 'Set catalog')
  return cache
}

export type SetProgress = {
  code: string
  name: string
  owned: number
  total: number
  percent: number
}

export function computeSetProgress(
  catalog: SetCatalogFile,
  collection: CollectedCard[],
): SetProgress[] {
  const ownedNames = new Set(collection.map((c) => canonicalNameKey(c.name)))
  const ownedBySet = new Map<string, number>()

  for (const nameKey of ownedNames) {
    const setCodes = catalog.nameToSets[nameKey]
    if (!setCodes) continue
    for (const code of setCodes) {
      ownedBySet.set(code, (ownedBySet.get(code) ?? 0) + 1)
    }
  }

  return catalog.sets
    .map((set) => {
      const owned = ownedBySet.get(set.code) ?? 0
      const total = set.total
      const percent = total > 0 ? Math.round((owned / total) * 100) : 0
      return { code: set.code, name: set.name, owned, total, percent }
    })
    .sort((a, b) => {
      if (b.percent !== a.percent) return b.percent - a.percent
      if (b.owned !== a.owned) return b.owned - a.owned
      return a.name.localeCompare(b.name)
    })
}
