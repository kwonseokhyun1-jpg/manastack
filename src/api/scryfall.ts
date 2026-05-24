import type { ScryfallCard, ScryfallSearchResponse } from '../types/mtg'

const BASE = 'https://api.scryfall.com'

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(
      (err as { details?: string }).details ?? `Scryfall error ${res.status}`,
    )
  }
  return res.json() as Promise<T>
}

export function cardImage(card: ScryfallCard): string | undefined {
  return (
    card.image_uris?.normal ??
    card.card_faces?.[0]?.image_uris?.normal ??
    card.image_uris?.art_crop
  )
}

export async function searchCards(
  query: string,
  options?: {
    order?: string
    dir?: 'asc' | 'desc'
    unique?: 'cards' | 'art' | 'prints'
  },
): Promise<ScryfallSearchResponse> {
  const params = new URLSearchParams({ q: query })
  if (options?.order) params.set('order', options.order)
  if (options?.dir) params.set('dir', options.dir)
  if (options?.unique) params.set('unique', options.unique)
  return fetchJson(`${BASE}/cards/search?${params}`)
}

export async function getCardByName(name: string): Promise<ScryfallCard> {
  const params = new URLSearchParams({ exact: name, fuzzy: '' })
  return fetchJson(`${BASE}/cards/named?${params}`)
}

export async function getMostPopularPrintingArt(
  name: string,
): Promise<{ image?: string; set_name?: string; id?: string } | null> {
  const escaped = name.replace(/"/g, '\\"')
  try {
    const res = await searchCards(`!"${escaped}"`, {
      unique: 'art',
      order: 'edhrec',
    })
    const card = res.data[0]
    if (!card) return null
    return {
      image: cardImage(card),
      set_name: card.set_name,
      id: card.id,
    }
  } catch {
    try {
      const card = await getCardByName(name)
      return {
        image: cardImage(card),
        set_name: card.set_name,
        id: card.id,
      }
    } catch {
      return null
    }
  }
}
