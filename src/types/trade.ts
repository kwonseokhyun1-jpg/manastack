export type TradeCardEntry = {
  name: string
  foil?: boolean
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
