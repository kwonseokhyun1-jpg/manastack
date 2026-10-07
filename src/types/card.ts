import type { ManaColor } from './mtg'

export type CardRarity = 'common' | 'uncommon' | 'rare' | 'mythic'

export type CardFace = {
  name: string
  type_line: string
  oracle_text: string
  mana_cost?: string
  image?: string
  /** Printed power (creatures); may be "*" / "1+*" */
  power?: string
  /** Printed toughness (creatures); may be "*" / "1+*" */
  toughness?: string
}

export type CardRecord = {
  id: string
  name: string
  color_identity: ManaColor[]
  cmc: number
  mana_cost?: string
  type_line: string
  oracle_text: string
  keywords: string[]
  tags: string[]
  roles: string[]
  image?: string
  scryfall_uri: string
  edhrec_rank?: number
  game_changer?: boolean
  prices?: { usd?: string | null; usd_foil?: string | null }
  rarity?: CardRarity
  card_faces?: CardFace[]
  /** Printed power when known (from Scryfall oracle data). */
  power?: string
  /** Printed toughness when known (from Scryfall oracle data). */
  toughness?: string
}

export type CardDatabase = {
  updated_at: string
  count: number
  cards: CardRecord[]
}
