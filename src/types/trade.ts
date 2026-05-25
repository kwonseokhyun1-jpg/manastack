export type TradeCardEntry = {
  name: string
  instanceId?: string
  foil?: boolean
  ultrafoil?: boolean
}

export type TradePost = {
  id: string
  userId: string
  username: string | null
  offering: TradeCardEntry[]
  wanting: TradeCardEntry[]
  note?: string
  createdAt: number
}

export type TradeOffer = {
  id: string
  tradeId: string
  userId: string
  username: string | null
  mana: number
  cards: TradeCardEntry[]
  note?: string
  createdAt: number
}
