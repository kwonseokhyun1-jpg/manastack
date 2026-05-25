import type { CardRecord } from './card'

export type CollectedCard = {
  instanceId: string
  cardId: string
  name: string
  image?: string
  typeLine: string
  cmc: number
  foil: boolean
  ultrafoil?: boolean
  collectedAt: number
}

export type ShowcaseFolder = {
  id: string
  name: string
  cardInstanceIds: string[]
  createdAt: number
}

export type MinigameManaId =
  | 'art-guess'
  | 'unscramble'
  | 'spellify'
  | 'description-match'
  | 'rule-trivia'
  | 'edhrec-rank'

export type MinigameManaEntry = {
  date: string
  earned: number
}

export type GameSave = {
  mana: number
  collection: CollectedCard[]
  folders: ShowcaseFolder[]
  lastDailyLogin?: string
  /** @deprecated Migrated into minigameManaCaps */
  triviaManaDate?: string
  /** @deprecated Migrated into minigameManaCaps */
  triviaManaEarned?: number
  /** @deprecated Migrated into minigameManaCaps */
  rankGuessManaDate?: string
  /** @deprecated Migrated into minigameManaCaps */
  rankGuessManaEarned?: number
  /** @deprecated Shared cap — no longer used */
  minigameManaDate?: string
  /** @deprecated Shared cap — no longer used */
  minigameManaEarned?: number
  minigameManaCaps?: Partial<Record<MinigameManaId, MinigameManaEntry>>
  updatedAt?: number
}

export type BoosterCard = {
  card: CardRecord
  foil: boolean
  ultrafoil?: boolean
}

export const STARTING_MANA = 10
export const MANA_PER_WIN = 1
export const GUESS_MANA_MAX = 5
export const TRIVIA_MANA_PER_CORRECT = 1
/** Daily mana earning cap per minigame. */
export const MINIGAME_DAILY_MANA_CAP = 100
export const TRIVIA_DAILY_MANA_CAP = MINIGAME_DAILY_MANA_CAP
export const RANK_GUESS_MANA_PER_CORRECT = 1
export const RANK_GUESS_DAILY_MANA_CAP = MINIGAME_DAILY_MANA_CAP
export const DAILY_LOGIN_MANA = 5
export const ULTRAFOIL_CHANCE = 0.05
export const BOOSTER_COST = 10
export const BOOSTER_BOX_COST = 100
export const STANDARD_BOOSTER_COST = 10
export const STANDARD_BOOSTER_BOX_COST = 100
export const PACKS_PER_BOX = 11
export const CARDS_PER_PACK = 10

export function manaRewardForAttempt(attempt: number): number {
  if (attempt < 1) return 0
  return Math.max(0, GUESS_MANA_MAX + 1 - attempt)
}

export const GUESS_MANA_REWARD_LABEL = '5 → 4 → 3 → 2 → 1 mana by try'

/** Spellify win payout by total guesses used (1–13). Hard mode pays double. */
export function spellifyManaReward(guesses: number, hardMode = false): number {
  let reward = 0
  if (guesses <= 3) reward = 5
  else if (guesses <= 6) reward = 4
  else if (guesses <= 9) reward = 3
  else if (guesses <= 11) reward = 2
  else if (guesses <= 13) reward = 1
  return hardMode ? reward * 2 : reward
}

export const SPELLIFY_MANA_REWARD_LABEL =
  '5 mana (1–3 tries), 4 (4–6), 3 (7–9), 2 (10–11), 1 (12–13)'

export const SPELLIFY_HARD_MANA_REWARD_LABEL =
  '10 mana (1–3 tries), 8 (4–6), 6 (7–9), 4 (10–11), 2 (12–13) — double hard mode'
