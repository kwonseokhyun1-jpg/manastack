import { useMemo, useState } from 'react'
import { createTrade } from '../lib/trade-api'
import type { CollectedCard } from '../types/game'
import type { TradeCardEntry } from '../types/trade'

function cardKey(entry: Pick<TradeCardEntry, 'instanceId' | 'name' | 'foil' | 'ultrafoil'>) {
  return entry.instanceId ?? `${entry.name}:${entry.foil}:${entry.ultrafoil}`
}

function CardChip({
  entry,
  onRemove,
}: {
  entry: TradeCardEntry
  onRemove: () => void
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-mtg-border)] bg-[var(--color-mtg-bg)] px-2.5 py-1 text-xs text-white">
      {entry.name}
      {entry.ultrafoil && <span className="text-cyan-300">◈</span>}
      {entry.foil && !entry.ultrafoil && <span className="text-[var(--color-mtg-gold)]">✦</span>}
      <button
        type="button"
        onClick={onRemove}
        className="ml-0.5 text-[var(--color-mtg-muted)] hover:text-white"
        aria-label={`Remove ${entry.name}`}
      >
        ×
      </button>
    </span>
  )
}

function CollectionPicker({
  collection,
  selected,
  onChange,
}: {
  collection: CollectedCard[]
  selected: TradeCardEntry[]
  onChange: (next: TradeCardEntry[]) => void
}) {
  const selectedIds = useMemo(
    () => new Set(selected.map((entry) => entry.instanceId).filter(Boolean)),
    [selected],
  )

  const available = useMemo(
    () => collection.filter((card) => !selectedIds.has(card.instanceId)),
    [collection, selectedIds],
  )

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
      <p className="text-sm font-medium text-white">Select from collection</p>

      {collection.length === 0 ? (
        <p className="mt-2 text-xs text-[var(--color-mtg-muted)]">
          Your collection is empty. Open packs in the Shop first.
        </p>
      ) : available.length === 0 ? (
        <p className="mt-2 text-xs text-[var(--color-mtg-muted)]">
          All collection cards are already in this trade.
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
                {card.foil && !card.ultrafoil && <span className="ml-1 text-[var(--color-mtg-gold)]">✦</span>}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {selected.length === 0 ? (
          <p className="text-xs text-[var(--color-mtg-muted)]">No cards selected yet.</p>
        ) : (
          selected.map((entry) => (
            <CardChip
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

export function CreateTradeModal({
  collection,
  onClose,
  onCreated,
}: {
  collection: CollectedCard[]
  onClose: () => void
  onCreated: () => void
}) {
  const [offering, setOffering] = useState<TradeCardEntry[]>([])
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await createTrade({
        offering,
        note: note.trim() || undefined,
      })
      onCreated()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not post trade.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-[var(--color-mtg-border)] bg-[var(--color-mtg-panel)] p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-bold text-[var(--color-mtg-gold)]">
              Post a trade
            </h2>
            <p className="mt-1 text-sm text-[var(--color-mtg-muted)]">
              List cards from your collection and what you want for them.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--color-mtg-muted)] hover:text-white"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <CollectionPicker collection={collection} selected={offering} onChange={setOffering} />

          <label className="block text-sm">
            <span className="text-[var(--color-mtg-muted)]">Asking (optional)</span>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              placeholder="1000 mana, ultrafoil only, etc."
              className="mt-1 w-full rounded-lg border border-[var(--color-mtg-border)] bg-[var(--color-mtg-bg)] px-3 py-2 text-sm text-white focus:border-[var(--color-mtg-gold)] focus:outline-none"
            />
          </label>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={busy || offering.length === 0}
            className="w-full rounded-lg bg-[var(--color-mtg-gold)] py-2.5 text-sm font-semibold text-black transition hover:brightness-110 disabled:opacity-50"
          >
            {busy ? 'Posting…' : 'Post trade'}
          </button>
        </form>
      </div>
    </div>
  )
}
