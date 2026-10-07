import { createId } from './storage'

const STORAGE_KEY = 'manastack-saved-decks-v1'

export type SavedDeck = {
  id: string
  name: string
  /** Commander card name (separate from the 99). */
  commanderName: string
  /** Mainboard text (Arena / MTGO / `1 Card Name` lines). */
  mainboardText: string
  createdAt: number
  updatedAt: number
}

function normalizeDeck(raw: Partial<SavedDeck>): SavedDeck | null {
  if (!raw || typeof raw.id !== 'string' || typeof raw.name !== 'string') return null
  if (typeof raw.mainboardText !== 'string') return null
  return {
    id: raw.id,
    name: raw.name.trim() || 'Untitled Deck',
    commanderName: typeof raw.commanderName === 'string' ? raw.commanderName.trim() : '',
    mainboardText: raw.mainboardText,
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : Date.now(),
  }
}

export function loadSavedDecks(): SavedDeck[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((item) => normalizeDeck(item as Partial<SavedDeck>))
      .filter((d): d is SavedDeck => d != null)
      .sort((a, b) => b.updatedAt - a.updatedAt)
  } catch {
    return []
  }
}

function persist(decks: SavedDeck[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(decks))
}

export function getSavedDeck(id: string): SavedDeck | undefined {
  return loadSavedDecks().find((d) => d.id === id)
}

export function upsertSavedDeck(
  input: {
    id?: string
    name: string
    commanderName: string
    mainboardText: string
  },
): SavedDeck {
  const decks = loadSavedDecks()
  const now = Date.now()
  const existingIdx = input.id ? decks.findIndex((d) => d.id === input.id) : -1

  if (existingIdx >= 0) {
    const next: SavedDeck = {
      ...decks[existingIdx],
      name: input.name.trim() || 'Untitled Deck',
      commanderName: input.commanderName.trim(),
      mainboardText: input.mainboardText,
      updatedAt: now,
    }
    decks[existingIdx] = next
    persist(decks)
    return next
  }

  const created: SavedDeck = {
    id: createId(),
    name: input.name.trim() || 'Untitled Deck',
    commanderName: input.commanderName.trim(),
    mainboardText: input.mainboardText,
    createdAt: now,
    updatedAt: now,
  }
  persist([created, ...decks])
  return created
}

export function deleteSavedDeck(id: string): void {
  persist(loadSavedDecks().filter((d) => d.id !== id))
}
