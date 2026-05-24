import type { CollectedCard } from '../types/game'

type CardTileProps = {
  card: CollectedCard
  onClick?: () => void
  selected?: boolean
  compact?: boolean
}

function foilClass(card: CollectedCard): string {
  if (card.ultrafoil) return 'ultrafoil-shimmer'
  if (card.foil) return 'foil-shimmer'
  return ''
}

export function CardTile({ card, onClick, selected, compact }: CardTileProps) {
  const Wrapper = onClick ? 'button' : 'div'

  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`group relative overflow-hidden rounded-lg border text-left transition ${
        card.ultrafoil
          ? 'ultrafoil-border border-2 shadow-[0_0_24px_rgba(168,85,247,0.45)]'
          : selected
            ? 'border-[var(--color-mtg-gold)] ring-2 ring-[var(--color-mtg-gold)]/40'
            : 'border-[var(--color-mtg-border)] hover:border-[var(--color-mtg-gold-dim)]'
      } ${onClick ? 'cursor-pointer hover:brightness-105' : ''}`}
      title={onClick ? 'View card details' : undefined}
    >
      <div
        className={`relative aspect-[5/7] w-full bg-[var(--color-mtg-panel)] ${foilClass(card)}`}
      >
        {card.image ? (
          <img
            src={card.image}
            alt={card.name}
            className={`relative z-[1] h-full w-full object-cover ${card.ultrafoil ? 'ultrafoil-art' : ''}`}
            loading="lazy"
          />
        ) : (
          <div className="relative z-[1] flex h-full items-center justify-center p-2 text-center text-xs text-[var(--color-mtg-muted)]">
            {card.name}
          </div>
        )}
        {card.ultrafoil ? (
          <span className="absolute left-1 top-1 z-[3] rounded bg-gradient-to-r from-fuchsia-500 via-cyan-400 to-amber-300 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-black shadow-lg">
            Ultrafoil
          </span>
        ) : card.foil ? (
          <span className="absolute left-1 top-1 z-[3] rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-yellow-300">
            Foil
          </span>
        ) : null}
      </div>
      {!compact && (
        <div className="border-t border-[var(--color-mtg-border)] bg-[var(--color-mtg-panel)] p-2">
          <p className="truncate text-xs font-medium text-white">{card.name}</p>
          <p className="truncate text-[10px] text-[var(--color-mtg-muted)]">{card.typeLine}</p>
        </div>
      )}
    </Wrapper>
  )
}
