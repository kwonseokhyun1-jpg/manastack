import type { CardRecord } from '../types/card'
import type { ManaColor } from '../types/mtg'
import { canonicalNameKey } from './card-names'

/** Minimal land stubs for playtest when the minigame pool omits lands. */
const LAND_STUBS: Array<{
  id: string
  name: string
  color_identity: ManaColor[]
  type_line: string
  oracle_text: string
  image: string
  edhrec_rank?: number
}> = [
  {
    id: '8ab0f4c0-b331-4c57-b68f-2e24bb5ba06c',
    name: 'Plains',
    color_identity: ['W'],
    type_line: 'Basic Land — Plains',
    oracle_text: '({T}: Add {W}.)',
    image:
      'https://cards.scryfall.io/normal/front/8/a/8ab0f4c0-b331-4c57-b68f-2e24bb5ba06c.jpg?1785981632',
    edhrec_rank: 50,
  },
  {
    id: 'f3cc07cd-cc79-4745-b0b7-eade60175cc3',
    name: 'Island',
    color_identity: ['U'],
    type_line: 'Basic Land — Island',
    oracle_text: '({T}: Add {U}.)',
    image:
      'https://cards.scryfall.io/normal/front/f/3/f3cc07cd-cc79-4745-b0b7-eade60175cc3.jpg?1785981645',
    edhrec_rank: 50,
  },
  {
    id: 'b7387103-1df1-4fd0-9e91-1544509792c7',
    name: 'Swamp',
    color_identity: ['B'],
    type_line: 'Basic Land — Swamp',
    oracle_text: '({T}: Add {B}.)',
    image:
      'https://cards.scryfall.io/normal/front/b/7/b7387103-1df1-4fd0-9e91-1544509792c7.jpg?1785981659',
    edhrec_rank: 50,
  },
  {
    id: '2a844b96-6616-4c39-8f4f-5d14a3b2bd55',
    name: 'Mountain',
    color_identity: ['R'],
    type_line: 'Basic Land — Mountain',
    oracle_text: '({T}: Add {R}.)',
    image:
      'https://cards.scryfall.io/normal/front/2/a/2a844b96-6616-4c39-8f4f-5d14a3b2bd55.jpg?1785981666',
    edhrec_rank: 50,
  },
  {
    id: 'dce15387-4114-4b3e-91aa-5b42b45c44ac',
    name: 'Forest',
    color_identity: ['G'],
    type_line: 'Basic Land — Forest',
    oracle_text: '({T}: Add {G}.)',
    image:
      'https://cards.scryfall.io/normal/front/d/c/dce15387-4114-4b3e-91aa-5b42b45c44ac.jpg?1785981675',
    edhrec_rank: 50,
  },
  {
    id: 'baf8f4f2-9f25-4cd2-8d78-1041e134aeac',
    name: 'Wastes',
    color_identity: [],
    type_line: 'Basic Land',
    oracle_text: '({T}: Add {C}.)',
    image:
      'https://cards.scryfall.io/normal/front/b/a/baf8f4f2-9f25-4cd2-8d78-1041e134aeac.jpg?1783906001',
    edhrec_rank: 200,
  },
  {
    id: '1ac6cb62-45da-4e9a-84c6-09e6eacf0664',
    name: 'Command Tower',
    color_identity: [],
    type_line: 'Land',
    oracle_text:
      "{T}: Add one mana of any color in your commander's color identity.",
    image:
      'https://cards.scryfall.io/normal/front/1/a/1ac6cb62-45da-4e9a-84c6-09e6eacf0664.jpg?1789644465',
    edhrec_rank: 2,
  },
  {
    id: 'e2a27742-08c1-4153-af7f-25a7a98f585e',
    name: 'Reliquary Tower',
    color_identity: [],
    type_line: 'Land',
    oracle_text: 'You have no maximum hand size.\n{T}: Add {C}.',
    image:
      'https://cards.scryfall.io/normal/front/e/2/e2a27742-08c1-4153-af7f-25a7a98f585e.jpg?1783903721',
    edhrec_rank: 10,
  },
  {
    id: 'd11c5fe0-1528-4c94-a8cc-42bcab9d7487',
    name: 'Exotic Orchard',
    color_identity: [],
    type_line: 'Land',
    oracle_text:
      '{T}: Add one mana of any color that a land an opponent controls could produce.',
    image:
      'https://cards.scryfall.io/normal/front/d/1/d11c5fe0-1528-4c94-a8cc-42bcab9d7487.jpg?1787743263',
    edhrec_rank: 20,
  },
  {
    id: 'b1aaa7b0-1cac-4a92-b880-7ef1ac00618f',
    name: 'Path of Ancestry',
    color_identity: [],
    type_line: 'Land',
    oracle_text:
      "Path of Ancestry enters tapped.\n{T}: Add one mana of any color in your commander's color identity. When that mana is spent to cast a creature spell that shares a creature type with your commander, scry 1.",
    image:
      'https://cards.scryfall.io/normal/front/b/1/b1aaa7b0-1cac-4a92-b880-7ef1ac00618f.jpg?1785759407',
    edhrec_rank: 30,
  },
  {
    id: 'c0318a48-30e4-4ef7-be3d-5e561c5ce428',
    name: 'Evolving Wilds',
    color_identity: [],
    type_line: 'Land',
    oracle_text:
      '{T}, Sacrifice Evolving Wilds: Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.',
    image:
      'https://cards.scryfall.io/normal/front/c/0/c0318a48-30e4-4ef7-be3d-5e561c5ce428.jpg?1783903203',
    edhrec_rank: 40,
  },
  {
    id: 'a81f924b-0527-4311-8120-9bfff71524f6',
    name: 'Terramorphic Expanse',
    color_identity: [],
    type_line: 'Land',
    oracle_text:
      '{T}, Sacrifice Terramorphic Expanse: Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.',
    image:
      'https://cards.scryfall.io/normal/front/a/8/a81f924b-0527-4311-8120-9bfff71524f6.jpg?1783903191',
    edhrec_rank: 45,
  },
  {
    id: 'a0e2098f-1d94-491a-a7e9-a45a9f69e3a8',
    name: 'Myriad Landscape',
    color_identity: [],
    type_line: 'Land',
    oracle_text:
      'Myriad Landscape enters tapped.\n{T}: Add {C}.\n{2}, {T}, Sacrifice Myriad Landscape: Search your library for up to two basic land cards that share a land type, put them onto the battlefield tapped, then shuffle.',
    image:
      'https://cards.scryfall.io/normal/front/a/0/a0e2098f-1d94-491a-a7e9-a45a9f69e3a8.jpg?1783906009',
    edhrec_rank: 60,
  },
  {
    id: 'bd3d4b4b-cf31-4f89-8140-9650edb03c7b',
    name: 'Ancient Tomb',
    color_identity: [],
    type_line: 'Land',
    oracle_text: '{T}: Add {C}{C}. Ancient Tomb deals 2 damage to you.',
    image:
      'https://cards.scryfall.io/normal/front/b/d/bd3d4b4b-cf31-4f89-8140-9650edb03c7b.jpg?1783933762',
    edhrec_rank: 80,
  },
  {
    id: '55b5b094-9d2d-4d96-b90c-78fecdae725a',
    name: 'Bojuka Bog',
    color_identity: ['B'],
    type_line: 'Land',
    oracle_text:
      "Bojuka Bog enters tapped.\nWhen Bojuka Bog enters, exile target player's graveyard.\n{T}: Add {B}.",
    image:
      'https://cards.scryfall.io/normal/front/5/5/55b5b094-9d2d-4d96-b90c-78fecdae725a.jpg?1783903734',
    edhrec_rank: 70,
  },
]

function toRecord(stub: (typeof LAND_STUBS)[number]): CardRecord {
  return {
    id: stub.id,
    name: stub.name,
    color_identity: stub.color_identity,
    cmc: 0,
    type_line: stub.type_line,
    oracle_text: stub.oracle_text,
    keywords: [],
    tags: [],
    roles: [],
    image: stub.image,
    scryfall_uri: `https://scryfall.com/search?q=${encodeURIComponent('!"' + stub.name + '"')}`,
    edhrec_rank: stub.edhrec_rank,
  }
}

const LAND_BY_KEY = new Map(
  LAND_STUBS.map((s) => [canonicalNameKey(s.name), toRecord(s)]),
)

export function getPlaytestLandByName(name: string): CardRecord | undefined {
  return LAND_BY_KEY.get(canonicalNameKey(name))
}

export function getAllPlaytestLands(): CardRecord[] {
  return [...LAND_BY_KEY.values()]
}

/** Placeholder for unresolved cards so playtest can still run. */
export function makePlaceholderCard(name: string): CardRecord {
  return {
    id: `playtest-placeholder-${canonicalNameKey(name).replace(/\s+/g, '-')}`,
    name,
    color_identity: [],
    cmc: 0,
    type_line: 'Unknown',
    oracle_text: '',
    keywords: [],
    tags: [],
    roles: [],
    scryfall_uri: `https://scryfall.com/search?q=${encodeURIComponent('!"' + name + '"')}`,
  }
}
