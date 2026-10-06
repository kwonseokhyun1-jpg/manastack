import type { CardRecord } from './card'
import type { ManaColor } from './mtg'

/** Official-style Commander power brackets (1 = Exhibition … 5 = cEDH). */
export type CommanderBracket = 1 | 2 | 3 | 4 | 5

export type DeckEntry = {
  name: string
  quantity: number
  card?: CardRecord
  unresolved?: boolean
}

export type ParsedDecklist = {
  name: string
  commander?: DeckEntry
  cards: DeckEntry[]
  unresolved: string[]
  totalCards: number
}

export type ResolvedDeck = {
  name: string
  commander?: CardRecord
  /** 99 library cards (or full main deck if no commander). */
  mainboard: CardRecord[]
  colorIdentity: ManaColor[]
  bracket?: CommanderBracket
}

export type PlaytestCard = {
  uid: string
  name: string
  image?: string
  isToken?: boolean
  isCommander?: boolean
  tapped?: boolean
}

export type BattlefieldCard = PlaytestCard & {
  x: number
  y: number
}

export type PlaytestPlayerState = {
  library: PlaytestCard[]
  hand: PlaytestCard[]
  battlefield: BattlefieldCard[]
  graveyard: PlaytestCard[]
  exile: PlaytestCard[]
  command: PlaytestCard[]
  life: number
  tokens: number
  turn: number
}

export type PlaytestSide = 'you' | 'opponent'

export type PlaytestZone =
  | 'library'
  | 'hand'
  | 'battlefield'
  | 'graveyard'
  | 'exile'
  | 'command'

export const BRACKETS: {
  id: CommanderBracket
  label: string
  title: string
  description: string
}[] = [
  {
    id: 1,
    label: 'B1',
    title: 'Exhibition',
    description: 'Precon / jank power. Slow games, few tutors.',
  },
  {
    id: 2,
    label: 'B2',
    title: 'Core',
    description: 'Upgraded casual. Focused themes, limited fast mana.',
  },
  {
    id: 3,
    label: 'B3',
    title: 'Upgraded',
    description: 'Mid-power. Strong staples and efficient threats.',
  },
  {
    id: 4,
    label: 'B4',
    title: 'Optimized',
    description: 'High power. Fast mana, tutors, and sharp lists.',
  },
  {
    id: 5,
    label: 'B5',
    title: 'cEDH',
    description: 'Competitive. Lowest CMC and densest interaction.',
  },
]

export const STARTING_LIFE = 40
export const COMMANDER_DECK_SIZE = 100
