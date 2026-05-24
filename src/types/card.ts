import type { ManaColor } from './mtg'

export type CardFace = {
  name: string
  type_line: string
  oracle_text: string
  mana_cost?: string
  image?: string
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
  card_faces?: CardFace[]
}

export type CardDatabase = {
  updated_at: string
  count: number
  cards: CardRecord[]
}
