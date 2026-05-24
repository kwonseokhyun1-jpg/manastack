import { DAILY_LOGIN_MANA, type GameSave } from '../types/game'

export function todayKey(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function canClaimDailyLogin(save: GameSave, date = new Date()): boolean {
  return save.lastDailyLogin !== todayKey(date)
}

export function applyDailyLoginClaim(save: GameSave, date = new Date()): GameSave {
  const today = todayKey(date)
  if (save.lastDailyLogin === today) return save

  return {
    ...save,
    mana: save.mana + DAILY_LOGIN_MANA,
    lastDailyLogin: today,
  }
}

/** @deprecated Auto-claim on load — use manual claim via applyDailyLoginClaim */
export function applyDailyLogin(save: GameSave): { save: GameSave; claimed: boolean } {
  if (!canClaimDailyLogin(save)) {
    return { save, claimed: false }
  }
  return { save: applyDailyLoginClaim(save), claimed: true }
}
