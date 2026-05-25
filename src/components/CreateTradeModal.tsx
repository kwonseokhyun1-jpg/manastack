import { useMemo, useState } from 'react'
import { suggestCardNames } from '../lib/card-name-resolve'
import { createTrade } from '../lib/trade-api'
import type { CollectedCard } from '../types/game'
import type { TradeCardEntry } from '../types/trade'
import { SuggestionList } from '../tabs/minigame-shared'

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
      {entry.foil && <span className="text-[var(--color-mtg-gold)]">✦</span>}
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

function CardListEditor({
  label,
  cards,
  onChange,
  inventory,
}: {
  label: string
  cards: TradeCardEntry[]
  onChange: (next: TradeCardEntry[]) => void
  inventory?: CollectedCard[]
}) {
  const [query, setQuery] = useState('')
  const suggestions = useMemo(() => suggestCardNames(query), [query])

  function addCard(name: string, foil = false) {
    const trimmed = name.trim()
    if (!trimmed) return
    if (cards.some((c) => c.name.toLowerCase() === trimmed.toLowerCase() && Boolean(c.foil) === foil)) {
      return
    }
    onChange([...cards, { name: trimmed, foil: foil || undefined }])
    setQuery('')
  }

  return (
    <div className="rounded-lg border border-[var(--color-mtg-border)] bg-[var(--color-mtg-bg)] p-3">
      <p className="text-sm font-medium text-white">{label}</p>
      <div className="relative mt-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addCard(query)
            }
          }}
          placeholder="Search card name…"
          className="w-full rounded-lg border border-[var(--color-mtg-border)] bg-[var(--color-mtg-panel)] px-3 py-2 text-sm text-white focus:border-[var(--color-mtg-gold)] focus:outline-none"
        />
        <SuggestionList items={suggestions} onPick={(name) => addCard(name)} />
      </div>

      {inventory && inventory.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-[var(--color-mtg-muted)] hover:text-white">
            Pick from inventory
          </summary>
          <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto">
            {inventory.slice(0, 40).map((card) => (
              <li key={card.instanceId}>
                <button
                  type="button"
                  onClick={() => addCard(card.name, card.foil)}
                  className="w-full rounded px-2 py-1 text-left text-xs text-[var(--color-mtg-muted)] hover:bg-[var(--color-mtg-panel)] hover:text-white"
                >
                  {card.name}
                  {card.foil && <span className="ml-1 text-[var(--color-mtg-gold)]">✦</span>}
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {cards.length === 0 ? (
          <p className="text-xs text-[var(--color-mtg-muted)]">No cards added yet.</p>
        ) : (
          cards.map((entry, i) => (
            <CardChip
              key={`${entry.name}-${entry.foil ?? false}-${i}`}
              entry={entry}
              onRemove={() => onChange(cards.filter((_, idx) => idx !== i))}
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
  const [wanting, setWanting] = useState<TradeCardEntry[]>([])
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
        wanting,
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
              List what you have and what you want.
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
          <CardListEditor
            label="Offering"
            cards={offering}
            onChange={setOffering}
            inventory={collection}
          />
          <CardListEditor label="Wanting" cards={wanting} onChange={setWanting} />

          <label className="block text-sm">
            <span className="text-[var(--color-mtg-muted)]">Note (optional)</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="Ship to US, prefer NM, etc."
              className="mt-1 w-full rounded-lg border border-[var(--color-mtg-border)] bg-[var(--color-mtg-bg)] px-3 py-2 text-sm text-white focus:border-[var(--color-mtg-gold)] focus:outline-none"
            />
          </label>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={busy || (offering.length === 0 && wanting.length === 0)}
            className="w-full rounded-lg bg-[var(--color-mtg-gold)] py-2.5 text-sm font-semibold text-black transition hover:brightness-110 disabled:opacity-50"
          >
            {busy ? 'Posting…' : 'Post trade'}
          </button>
        </form>
      </div>
    </div>
  )
}
