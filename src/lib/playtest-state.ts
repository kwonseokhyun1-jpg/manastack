import type { CardRecord } from '../types/card'
import type {
  BattlefieldCard,
  PlaytestCard,
  PlaytestPlayerState,
  PlaytestZone,
  ResolvedDeck,
} from '../types/playtest'
import { STARTING_LIFE } from '../types/playtest'
import { getCardImage } from './card-utils'

let playtestUid = 0

export function newPlaytestUid(): string {
  playtestUid += 1
  return `pt-${Date.now()}-${playtestUid}`
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function toPlaytestCard(
  card: CardRecord | { name: string; image?: string },
  opts?: { isCommander?: boolean; isToken?: boolean },
): PlaytestCard {
  const record = 'id' in card ? (card as CardRecord) : null
  return {
    uid: newPlaytestUid(),
    name: card.name,
    image: opts?.isToken
      ? card.image
      : (record ? getCardImage(record) : card.image),
    isCommander: opts?.isCommander,
    isToken: opts?.isToken,
    tapped: false,
  }
}

export function createPlayerState(deck: ResolvedDeck): PlaytestPlayerState {
  const libraryCards = shuffle(deck.mainboard.map((c) => toPlaytestCard(c)))
  const hand = libraryCards.splice(0, 7)
  const command = deck.commander
    ? [toPlaytestCard(deck.commander, { isCommander: true })]
    : []

  return {
    library: libraryCards,
    hand,
    battlefield: [],
    graveyard: [],
    exile: [],
    command,
    life: STARTING_LIFE,
    tokens: 0,
    turn: 1,
  }
}

export function stripBattlefield(card: BattlefieldCard): PlaytestCard {
  const { x: _x, y: _y, ...rest } = card
  return rest
}

export function applyZoneMove(
  state: PlaytestPlayerState,
  from: PlaytestZone,
  fromIndex: number,
  to: PlaytestZone,
  bfPos?: { x: number; y: number },
  libraryPosition: 'top' | 'bottom' = 'bottom',
): PlaytestPlayerState {
  if (from === to && to !== 'battlefield') return state

  const source = [...state[from]] as PlaytestCard[]
  const [raw] = source.splice(fromIndex, 1)
  if (!raw) return state

  if (raw.isToken && to !== 'battlefield') {
    return { ...state, [from]: source as PlaytestPlayerState[typeof from] }
  }

  if (to === 'battlefield') {
    const pos = bfPos ?? { x: 40 + state.battlefield.length * 24, y: 40 }
    const bfCard: BattlefieldCard = {
      ...raw,
      x: pos.x,
      y: pos.y,
      tapped: raw.tapped ?? false,
    }
    return {
      ...state,
      [from]: source as PlaytestPlayerState[typeof from],
      battlefield: [...state.battlefield, bfCard],
    }
  }

  if (to === 'library' && libraryPosition === 'top') {
    return {
      ...state,
      [from]: source as PlaytestPlayerState[typeof from],
      library: [raw, ...state.library],
    }
  }

  return {
    ...state,
    [from]: source as PlaytestPlayerState[typeof from],
    [to]: [...state[to], raw] as PlaytestPlayerState[typeof to],
  }
}

export function drawCard(state: PlaytestPlayerState): PlaytestPlayerState {
  if (state.library.length === 0) return state
  const [top, ...rest] = state.library
  return { ...state, library: rest, hand: [...state.hand, top] }
}

export function nextTurn(state: PlaytestPlayerState): PlaytestPlayerState {
  const untapped: PlaytestPlayerState = {
    ...state,
    turn: state.turn + 1,
    battlefield: state.battlefield.map((c) => ({ ...c, tapped: false })),
    command: state.command.map((c) => ({ ...c, tapped: false })),
    hand: state.hand.map((c) => ({ ...c, tapped: false })),
  }
  return drawCard(untapped)
}

export function mulligan(state: PlaytestPlayerState): PlaytestPlayerState {
  const back = [
    ...state.hand,
    ...state.library,
    ...state.battlefield.filter((c) => !c.isToken).map(stripBattlefield),
    ...state.graveyard.filter((c) => !c.isToken),
    ...state.exile.filter((c) => !c.isToken),
  ]
  const library = shuffle(back)
  const hand = library.splice(0, 7)
  return {
    ...state,
    library,
    hand,
    battlefield: state.battlefield.filter((c) => c.isToken),
    graveyard: [],
    exile: [],
    turn: 1,
  }
}

