import { MINIGAME_DAILY_MANA_CAP, type GameSave, type MinigameManaId } from '../types/game'
import { todayKey } from './daily-login'

function entryEarnedToday(
  save: GameSave,
  gameId: MinigameManaId,
  date = new Date(),
): number {
  const today = todayKey(date)
  const entry = save.minigameManaCaps?.[gameId]
  if (!entry || entry.date !== today) return 0
  return entry.earned
}

export function minigameManaEarnedToday(
  save: GameSave,
  gameId: MinigameManaId,
  date = new Date(),
): number {
  return entryEarnedToday(save, gameId, date)
}

export function minigameManaRemainingToday(
  save: GameSave,
  gameId: MinigameManaId,
  date = new Date(),
): number {
  return Math.max(0, MINIGAME_DAILY_MANA_CAP - entryEarnedToday(save, gameId, date))
}

export function canAwardMinigameMana(
  save: GameSave,
  gameId: MinigameManaId,
  date = new Date(),
): boolean {
  return minigameManaRemainingToday(save, gameId, date) > 0
}

export function applyMinigameManaReward(
  save: GameSave,
  gameId: MinigameManaId,
  amount: number,
  date = new Date(),
): { save: GameSave; awarded: number } | null {
  if (amount <= 0) return null

  const today = todayKey(date)
  const earned = entryEarnedToday(save, gameId, date)
  const remaining = MINIGAME_DAILY_MANA_CAP - earned
  if (remaining <= 0) return { save, awarded: 0 }

  const awarded = Math.min(amount, remaining)
  const caps = { ...(save.minigameManaCaps ?? {}) }
  caps[gameId] = { date: today, earned: earned + awarded }

  return {
    save: {
      ...save,
      mana: save.mana + awarded,
      minigameManaCaps: caps,
    },
    awarded,
  }
}
