export type ManaColor = 'W' | 'U' | 'B' | 'R' | 'G'

export type ScryfallCard = {
  id: string
  name: string
  type_line: string
  oracle_text?: string
  mana_cost?: string
  cmc: number
  color_identity: string[]
  keywords?: string[]
  image_uris?: {
    normal?: string
    small?: string
    art_crop?: string
  }
  card_faces?: Array<{
    name: string
    type_line: string
    oracle_text?: string
    mana_cost?: string
    image_uris?: { normal?: string; small?: string; art_crop?: string }
  }>
  prices: {
    usd?: string | null
    usd_foil?: string | null
  }
  legalities: Record<string, string>
  edhrec_rank?: number
  set_name?: string
  collector_number?: string
  tcgplayer_id?: number
  scryfall_uri: string
}

export type ScryfallSearchResponse = {
  object: 'list'
  total_cards: number
  has_more: boolean
  next_page?: string
  data: ScryfallCard[]
}

export const MANA_COLORS: ManaColor[] = ['W', 'U', 'B', 'R', 'G']
