import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { TradeCollectionPicker } from './TradeCollectionPicker'
import { createTrade } from '../lib/trade-api'
import type { CollectedCard } from '../types/game'
import type { TradeCardEntry } from '../types/trade'

export function CreateTradeModal({
  collection,
  onClose,
  onCreated,
}: {
  collection: CollectedCard[]
  onClose: () => void
  onCreated: () => void
}) {
  const { token } = useAuth()
  const [offering, setOffering] = useState<TradeCardEntry[]>([])
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!token) {
      setError('Log in to post a trade.')
      return
    }
    if (offering.length === 0) {
      setError('Select at least one card from your collection.')
      return
    }

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
          <TradeCollectionPicker
            collection={collection}
            selected={offering}
            onChange={setOffering}
          />

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
            disabled={busy || offering.length === 0 || !token}
            className="w-full rounded-lg bg-[var(--color-mtg-gold)] py-2.5 text-sm font-semibold text-black transition hover:brightness-110 disabled:opacity-50"
          >
            {busy ? 'Posting…' : 'Post trade'}
          </button>
        </form>
      </div>
    </div>
  )
}
