import { useMemo } from 'react'
import { useGame } from '../context/GameContext'
import { canonicalNameKey } from '../lib/card-names'
import { getCardImage } from '../lib/card-utils'
import { buildCardLookup } from '../lib/inventory-sort'
import type { CollectedCard } from '../types/game'
import type { TradeCardEntry } from '../types/trade'

function foilFrameClass(entry: TradeCardEntry): string {
  if (entry.ultrafoil) return 'ring-1 ring-cyan-400/70'
  if (entry.foil) return 'ring-1 ring-[var(--color-mtg-gold)]/60'
  return ''
}

function TradeOfferingCard({
  entry,
  image,
  compact,
}: {
  entry: TradeCardEntry
  image?: string
  compact?: boolean
}) {
  return (
    <div
      className={`flex min-w-0 items-center gap-2 rounded-md border border-[var(--color-mtg-border)] bg-[var(--color-mtg-bg)] ${
        compact ? 'px-1 py-0.5' : 'px-1.5 py-1'
      }`}
      title={entry.name}
    >
      <div
        className={`relative shrink-0 overflow-hidden rounded border border-[var(--color-mtg-border)] bg-[var(--color-mtg-panel)] ${foilFrameClass(entry)} ${
          compact ? 'h-9 w-7' : 'h-11 w-8'
        }`}
      >
        {image ? (
          <img
            src={image}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center px-0.5 text-center text-[8px] leading-tight text-[var(--color-mtg-muted)]">
            ?
          </div>
        )}
      </div>
      {!compact && (
        <span className="min-w-0 truncate text-xs text-white">
          {entry.name}
          {entry.ultrafoil && <span className="ml-1 text-cyan-300">◈</span>}
          {entry.foil && !entry.ultrafoil && (
            <span className="ml-1 text-[var(--color-mtg-gold)]">✦</span>
          )}
        </span>
      )}
    </div>
  )
}

export function TradeOfferingCards({
  cards,
  collection,
  compact = false,
  emptyMessage = 'No cards listed.',
}: {
  cards: TradeCardEntry[]
  collection?: CollectedCard[]
  compact?: boolean
  emptyMessage?: string
}) {
  const { cardPool, standardPool } = useGame()

  const lookup = useMemo(() => {
    const map = buildCardLookup(cardPool)
    for (const card of standardPool) {
      const key = canonicalNameKey(card.name)
      if (!map.has(key)) map.set(key, card)
    }
    return map
  }, [cardPool, standardPool])

  const collectionById = useMemo(
    () => new Map((collection ?? []).map((card) => [card.instanceId, card])),
    [collection],
  )

  const images = useMemo(() => {
    return cards.map((entry) => {
      if (entry.instanceId) {
        const owned = collectionById.get(entry.instanceId)
        if (owned?.image) return owned.image
      }
      const record = lookup.get(canonicalNameKey(entry.name))
      return record ? getCardImage(record) : undefined
    })
  }, [cards, collectionById, lookup])

  if (cards.length === 0) {
    return <p className="text-sm text-[var(--color-mtg-muted)]">{emptyMessage}</p>
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {cards.map((entry, index) => (
        <TradeOfferingCard
          key={`${entry.instanceId ?? entry.name}-${index}`}
          entry={entry}
          image={images[index]}
          compact={compact}
        />
      ))}
    </div>
  )
}
