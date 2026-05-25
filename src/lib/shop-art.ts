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
      'https://cards.scryfall.io/art_crop/front/b/4/b4f61b5e-9c53-40b1-b93e-3ffa351ff052.jpg?1775828602',
    focal: '50% 50%',
    accent: '#d4a017',
    tag: 'Commander',
  },
  'standard-pack': {
    image:
      'https://cards.scryfall.io/art_crop/front/5/2/52eef0d6-24b7-40b7-8403-e8e863d0cd55.jpg?1712355894',
    focal: '50% 35%',
    accent: '#16a34a',
    tag: 'Standard',
  },
  'commander-box': {
    image:
      'https://cards.scryfall.io/art_crop/front/8/6/861b5889-0183-4bee-afeb-a4b2aa700a8e.jpg?1689996018',
    focal: '50% 40%',
    accent: '#9333ea',
    tag: '10 packs',
  },
  'standard-box': {
    image:
      'https://cards.scryfall.io/art_crop/front/2/0/209c591a-4ab2-4e89-9523-a7b766cf4e51.jpg?1752947376',
    focal: '50% 40%',
    accent: '#dc2626',
    tag: '10 packs',
  },
}
