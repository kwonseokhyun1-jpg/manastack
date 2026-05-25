import { useMemo, useState } from 'react'
import { useGame } from '../context/GameContext'
import {
  buildCardLookup,
  filterCollectedCardsByQuery,
  INVENTORY_SORT_OPTIONS,
  sortCollectedCards,
  type InventorySortMode,
} from '../lib/inventory-sort'
import type { CollectedCard } from '../types/game'
import type { TradeCardEntry } from '../types/trade'

function cardKey(entry: Pick<TradeCardEntry, 'instanceId' | 'name' | 'foil' | 'ultrafoil'>) {
  return entry.instanceId ?? `${entry.name}:${entry.foil}:${entry.ultrafoil}`
}

export function TradeCardChip({
  entry,
  onRemove,
}: {
  entry: TradeCardEntry
  onRemove?: () => void
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-mtg-border)] bg-[var(--color-mtg-bg)] px-2.5 py-1 text-xs text-white">
      {entry.name}
      {entry.ultrafoil && <span className="text-cyan-300">◈</span>}
      {entry.foil && !entry.ultrafoil && <span className="text-[var(--color-mtg-gold)]">✦</span>}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-0.5 text-[var(--color-mtg-muted)] hover:text-white"
          aria-label={`Remove ${entry.name}`}
        >
          ×
        </button>
      )}
    </span>
  )
}

export function TradeCollectionPicker({
  collection,
  selected,
  onChange,
  label = 'Select from collection',
  emptySelectedMessage = 'No cards selected yet.',
}: {
  collection: CollectedCard[]
  selected: TradeCardEntry[]
  onChange: (next: TradeCardEntry[]) => void
  label?: string
  emptySelectedMessage?: string
}) {
  const { cardPool, rarityMap } = useGame()
  const [query, setQuery] = useState('')
  const [sortMode, setSortMode] = useState<InventorySortMode>('name')

  const cardLookup = useMemo(() => buildCardLookup(cardPool), [cardPool])

  const selectedIds = useMemo(
    () => new Set(selected.map((entry) => entry.instanceId).filter(Boolean)),
    [selected],
  )

  const available = useMemo(() => {
    const unselected = collection.filter((card) => !selectedIds.has(card.instanceId))
    const filtered = filterCollectedCardsByQuery(unselected, query)
    return sortCollectedCards(filtered, sortMode, cardLookup, rarityMap)
  }, [collection, selectedIds, query, sortMode, cardLookup, rarityMap])

  function addFromCollection(card: CollectedCard) {
    onChange([
      ...selected,
      {
        name: card.name,
        instanceId: card.instanceId,
        foil: card.foil || undefined,
        ultrafoil: card.ultrafoil || undefined,
      },
    ])
  }

  return (
    <div className="rounded-lg border border-[var(--color-mtg-border)] bg-[var(--color-mtg-bg)] p-3">
      <p className="text-sm font-medium text-white">{label}</p>

      {collection.length === 0 ? (
        <p className="mt-2 text-xs text-[var(--color-mtg-muted)]">
          Your collection is empty. Open packs in the Shop first.
        </p>
      ) : (
        <>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <label className="flex-1">
              <span className="sr-only">Search collection</span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search cards…"
                className="w-full rounded-lg border border-[var(--color-mtg-border)] bg-[var(--color-mtg-panel)] px-3 py-2 text-sm text-white placeholder:text-[var(--color-mtg-muted)] focus:border-[var(--color-mtg-gold)] focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-[var(--color-mtg-muted)] sm:w-40">
              Sort by
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as InventorySortMode)}
                className="rounded-lg border border-[var(--color-mtg-border)] bg-[var(--color-mtg-panel)] px-2 py-2 text-sm text-white focus:border-[var(--color-mtg-gold)] focus:outline-none"
              >
                {INVENTORY_SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {available.length === 0 ? (
            <p className="mt-2 text-xs text-[var(--color-mtg-muted)]">
              {query.trim()
                ? 'No cards match your search.'
                : 'All matching cards are already selected.'}
            </p>
          ) : (
            <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-lg border border-[var(--color-mtg-border)] bg-[var(--color-mtg-panel)] p-1">
              {available.map((card) => (
                <li key={card.instanceId}>
                  <button
                    type="button"
                    onClick={() => addFromCollection(card)}
                    className="w-full rounded px-2 py-1.5 text-left text-sm text-[var(--color-mtg-muted)] hover:bg-[var(--color-mtg-bg)] hover:text-white"
                  >
                    {card.name}
                    {card.ultrafoil && <span className="ml-1 text-cyan-300">◈</span>}
                    {card.foil && !card.ultrafoil && (
                      <span className="ml-1 text-[var(--color-mtg-gold)]">✦</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {selected.length === 0 ? (
          <p className="text-xs text-[var(--color-mtg-muted)]">{emptySelectedMessage}</p>
        ) : (
          selected.map((entry) => (
            <TradeCardChip
              key={cardKey(entry)}
              entry={entry}
              onRemove={() =>
                onChange(selected.filter((item) => cardKey(item) !== cardKey(entry)))
              }
            />
          ))
        )}
      </div>
    </div>
  )
}
