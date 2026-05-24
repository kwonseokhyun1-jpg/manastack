export function formatUsdPrice(value: string | null | undefined): string {
  if (value == null || value === '') return '—'
  const n = Number.parseFloat(value)
  if (!Number.isFinite(n)) return '—'
  return `$${n.toFixed(2)}`
}

export function tcgplayerProductUrl(tcgplayerId: number | undefined): string | null {
  if (!tcgplayerId) return null
  return `https://www.tcgplayer.com/product/${tcgplayerId}`
}
