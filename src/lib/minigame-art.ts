export type MinigameArtId =
  | 'art-guess'
  | 'unscramble'
  | 'spellify'
  | 'description-match'
  | 'rule-trivia'
  | 'edhrec-rank'

export type MinigameArt = {
  image: string
  /** CSS object-position for art_crop framing */
  focal: string
  /** Accent glow / gradient tint */
  accent: string
  /** Short flavor tag shown on the banner */
  tag: string
}

/** Scryfall art_crop URLs — iconic cards that match each minigame theme. */
export const MINIGAME_ART: Record<MinigameArtId, MinigameArt> = {
  'art-guess': {
    image:
      'https://cards.scryfall.io/art_crop/front/7/7/77c6fa74-5543-42ac-9ead-0e890b188e99.jpg?1706239968',
    focal: '50% 35%',
    accent: '#d3202a',
    tag: 'Art crop',
  },
  unscramble: {
    image:
      'https://cards.scryfall.io/art_crop/front/4/f/4f616706-ec97-4923-bb1e-11a69fbaa1f8.jpg?1751282477',
    focal: '60% 45%',
    accent: '#0e68ab',
    tag: 'Name puzzle',
  },
  spellify: {
    image:
      'https://cards.scryfall.io/art_crop/front/9/5/95f27eeb-6f14-4db3-adb9-9be5ed76b34b.jpg?1753711947',
    focal: '50% 40%',
    accent: '#8a7020',
    tag: 'Letter by letter',
  },
  'description-match': {
    image:
      'https://cards.scryfall.io/art_crop/front/9/f/9f37c5b6-a59c-45cd-9a99-e9357fe9ea1b.jpg?1777041694',
    focal: '55% 30%',
    accent: '#00733e',
    tag: 'Beat the clock',
  },
  'rule-trivia': {
    image:
      'https://cards.scryfall.io/art_crop/front/8/7/870ec754-a76c-40ea-9b81-81b3dca1f62c.jpg?1775940518',
    focal: '50% 50%',
    accent: '#c9a227',
    tag: 'Rules judge',
  },
  'edhrec-rank': {
    image:
      'https://cards.scryfall.io/art_crop/front/1/0/10d42b35-844f-4a64-9981-c6118d45e826.jpg?1689999317',
    focal: '50% 20%',
    accent: '#a78bfa',
    tag: 'EDHREC ranks',
  },
}
