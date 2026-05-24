import { STARTING_MANA, type GameSave } from '../types/game'
import { applyDailyLogin } from './daily-login'

const STORAGE_KEY = 'manastack-save-v1'

function normalizeMinigameManaCaps(parsed: Partial<GameSave>): GameSave['minigameManaCaps'] {
  const caps = { ...(parsed.minigameManaCaps ?? {}) }

  if (parsed.triviaManaDate && typeof parsed.triviaManaEarned === 'number') {
    caps['rule-trivia'] = { date: parsed.triviaManaDate, earned: parsed.triviaManaEarned }
  }
  if (parsed.rankGuessManaDate && typeof parsed.rankGuessManaEarned === 'number') {
    caps['edhrec-rank'] = { date: parsed.rankGuessManaDate, earned: parsed.rankGuessManaEarned }
  }

  return Object.keys(caps).length > 0 ? caps : undefined
}

export function defaultSave(): GameSave {
  return {
    mana: STARTING_MANA,
    collection: [],
    folders: [],
    updatedAt: 0,
  }
}

export function normalizeSave(parsed: Partial<GameSave>): GameSave {
  return {
    mana: typeof parsed.mana === 'number' ? parsed.mana : STARTING_MANA,
    collection: Array.isArray(parsed.collection) ? parsed.collection : [],
    folders: Array.isArray(parsed.folders) ? parsed.folders : [],
    lastDailyLogin:
      typeof parsed.lastDailyLogin === 'string' ? parsed.lastDailyLogin : undefined,
    triviaManaDate:
      typeof parsed.triviaManaDate === 'string' ? parsed.triviaManaDate : undefined,
    triviaManaEarned:
      typeof parsed.triviaManaEarned === 'number' ? parsed.triviaManaEarned : undefined,
    rankGuessManaDate:
      typeof parsed.rankGuessManaDate === 'string' ? parsed.rankGuessManaDate : undefined,
    rankGuessManaEarned:
      typeof parsed.rankGuessManaEarned === 'number' ? parsed.rankGuessManaEarned : undefined,
    minigameManaCaps: normalizeMinigameManaCaps(parsed),
    updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0,
  }
}

export function loadSave(): GameSave {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultSave()
    return normalizeSave(JSON.parse(raw) as Partial<GameSave>)
  } catch {
    return defaultSave()
  }
}

export function initSaveWithDailyLogin(): { save: GameSave; dailyClaimed: boolean } {
  const loaded = loadSave()
  const { save, claimed } = applyDailyLogin(loaded)
  const stamped = claimed ? { ...save, updatedAt: Date.now() } : save
  if (claimed) persistSave(stamped)
  return { save: stamped, dailyClaimed: claimed }
}

export function persistSave(save: GameSave): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(save))
}

export function createId(): string {
  return crypto.randomUUID()
}
