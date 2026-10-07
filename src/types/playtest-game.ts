import type { CardRecord } from './card'
import type { ManaColor } from './mtg'
import type { ManaPool } from '../lib/playtest-mana'
import type { ResolvedDeck } from './playtest'

export type PlayerId = 'you' | 'opponent'

export type TurnStep =
  | 'mulligan'
  | 'untap'
  | 'upkeep'
  | 'draw'
  | 'main1'
  | 'combat_attackers'
  | 'combat_blockers'
  | 'combat_damage'
  | 'main2'
  | 'end'
  | 'game_over'

export type GameCard = {
  uid: string
  card: CardRecord
  isCommander?: boolean
  tapped: boolean
  /** Creatures can't attack the turn they enter (unless haste). */
  summoningSickness: boolean
  damageMarked: number
  power: number
  toughness: number
  /** Extra commander cast tax already applied is tracked on the player. */
}

export type PlayerGameState = {
  id: PlayerId
  name: string
  library: GameCard[]
  hand: GameCard[]
  battlefield: GameCard[]
  graveyard: GameCard[]
  exile: GameCard[]
  command: GameCard[]
  life: number
  landsPlayedThisTurn: number
  /** Times commander has been cast from command zone. */
  commanderCastCount: number
  /** Commander combat damage received from each opposing commander uid. */
  commanderDamage: Record<string, number>
  mana: ManaPool
  deck: ResolvedDeck
}

export type CombatAttacker = {
  attackerUid: string
  /** Blocker uids assigned (max 1 for simplicity unless trample handling). */
  blockerUids: string[]
}

export type GameLogEntry = {
  id: number
  text: string
}

export type GameState = {
  players: Record<PlayerId, PlayerGameState>
  activePlayer: PlayerId
  /** Whose input is required right now. */
  priority: PlayerId
  step: TurnStep
  turn: number
  /** First turn: active player skips draw. */
  isFirstTurn: boolean
  combat: CombatAttacker[]
  log: GameLogEntry[]
  winner: PlayerId | null
  winReason: string | null
  /** Pending blocker declarations for human. */
  awaitingBlockers: boolean
}

export type GameAction =
  | { type: 'keep_hand' }
  | { type: 'mulligan' }
  | { type: 'play_land'; cardUid: string }
  | { type: 'cast_spell'; cardUid: string }
  | { type: 'cast_commander' }
  | { type: 'tap_for_mana'; permanentUid: string; color: ManaColor | 'C' }
  | { type: 'auto_float_mana' }
  | { type: 'declare_attackers'; attackerUids: string[] }
  | { type: 'declare_blockers'; blocks: Array<{ attackerUid: string; blockerUid: string }> }
  | { type: 'pass' }
  | { type: 'concede' }

export const STARTING_LIFE = 40
export const COMMANDER_DAMAGE_TO_LOSE = 21
