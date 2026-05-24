import { useGame } from '../context/GameContext'
import { ManaIcon } from './ManaIcon'

export function ManaDisplay({ large }: { large?: boolean }) {
  const { mana } = useGame()

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border border-[var(--color-mana-u)]/40 bg-[var(--color-mana-u)]/10 ${
        large ? 'px-4 py-2' : 'px-3 py-1'
      }`}
    >
      <ManaIcon className={large ? 'h-7 w-7' : 'h-5 w-5'} />
      <span
        className={`font-[family-name:var(--font-display)] font-bold text-[var(--color-mana-u)] ${
          large ? 'text-2xl' : 'text-sm'
        }`}
      >
        {mana}
      </span>
      <span className={`text-[var(--color-mtg-muted)] ${large ? 'text-sm' : 'text-xs'}`}>
        mana
      </span>
    </div>
  )
}
