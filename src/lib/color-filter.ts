import type { ManaColor } from '../types/mtg'
import { MANA_COLORS } from '../types/mtg'

export function sortIdentity(colors: ManaColor[]): ManaColor[] {
  return MANA_COLORS.filter((c) => colors.includes(c))
}
