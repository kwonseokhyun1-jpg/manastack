export type ShopArtId =
  | 'commander-pack'
  | 'standard-pack'
  | 'commander-box'
  | 'standard-box'

export type ShopArt = {
  image: string
  focal: string
  accent: string
  tag: string
}

/** Scryfall art_crop URLs for shop booster products. */
export const SHOP_ART: Record<ShopArtId, ShopArt> = {
  'commander-pack': {
    image:
      'https://cards.scryfall.io/art_crop/front/1/0/10d42b35-844f-4a64-9981-c6118d45e826.jpg?1689999317',
    focal: '50% 20%',
    accent: '#a78bfa',
    tag: 'Commander',
  },
  'standard-pack': {
    image:
      'https://cards.scryfall.io/art_crop/front/7/7/77c6fa74-5543-42ac-9ead-0e890b188e99.jpg?1706239968',
    focal: '50% 35%',
    accent: '#d3202a',
    tag: 'Standard',
  },
  'commander-box': {
    image:
      'https://cards.scryfall.io/art_crop/front/8/6/861b5889-0183-4bee-afeb-a4b2aa700a8e.jpg?1689996018',
    focal: '50% 40%',
    accent: '#c9a227',
    tag: '10 packs',
  },
  'standard-box': {
    image:
      'https://cards.scryfall.io/art_crop/front/2/4/24c0d87b-0049-4beb-b9cb-6f813b7aa7dc.jpg?1691108103',
    focal: '55% 35%',
    accent: '#0e68ab',
    tag: '10 packs',
  },
}
