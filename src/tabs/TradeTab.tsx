import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useGame } from '../context/GameContext'
import { CreateTradeModal } from '../components/CreateTradeModal'
import { deleteTrade, fetchTrades } from '../lib/trade-api'
import type { TradeCardEntry, TradePost } from '../types/trade'

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(ts).toLocaleDateString()
}

function CardList({ label, cards }: { label: string; cards: TradeCardEntry[] }) {
  if (cards.length === 0) {
    return (
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-mtg-muted)]">
          {label}
        </p>
        <p className="mt-1 text-sm text-[var(--color-mtg-muted)]">—</p>
      </div>
    )
  }

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-mtg-muted)]">
        {label}
      </p>
      <ul className="mt-1 space-y-0.5">
        {cards.map((card, i) => (
          <li key={`${card.name}-${i}`} className="text-sm text-white">
            {card.name}
            {card.foil && <span className="ml-1 text-[var(--color-mtg-gold)]">✦</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}

function TradeCard({
  trade,
  isOwn,
  onDelete,
}: {
  trade: TradePost
  isOwn: boolean
  onDelete: (id: string) => void
}) {
  const [busy, setBusy] = useState(false)

  async function handleDelete() {
    if (!confirm('Remove this trade post?')) return
    setBusy(true)
    try {
      await deleteTrade(trade.id)
      onDelete(trade.id)
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className="rounded-xl border border-[var(--color-mtg-border)] bg-[var(--color-mtg-panel)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-white">{trade.username ?? 'Unknown player'}</p>
          <p className="text-xs text-[var(--color-mtg-muted)]">{formatRelativeTime(trade.createdAt)}</p>
        </div>
        {isOwn && (
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={busy}
            className="rounded-lg border border-[var(--color-mtg-border)] px-2 py-1 text-xs text-[var(--color-mtg-muted)] transition hover:border-red-500/50 hover:text-red-300 disabled:opacity-50"
          >
            {busy ? '…' : 'Delete'}
          </button>
        )}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <CardList label="Offering" cards={trade.offering} />
        <CardList label="Wanting" cards={trade.wanting} />
      </div>

      {trade.note && (
        <p className="mt-3 rounded-lg bg-[var(--color-mtg-bg)] px-3 py-2 text-sm text-[var(--color-mtg-muted)]">
          {trade.note}
        </p>
      )}
    </article>
  )
}

export function TradeTab() {
  const { user, openAuthModal } = useAuth()
  const { collection } = useGame()
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [trades, setTrades] = useState<TradePost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query), 300)
    return () => window.clearTimeout(timer)
  }, [query])

  const loadTrades = useCallback(async (search: string) => {
    setLoading(true)
    setError(null)
    try {
      const rows = await fetchTrades(search)
      setTrades(rows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load trades.')
      setTrades([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadTrades(debouncedQuery)
  }, [debouncedQuery, loadTrades])

  function handlePostClick() {
    if (!user) {
      openAuthModal()
      return
    }
    setModalOpen(true)
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--color-mtg-gold)]">
            Trade
          </h2>
          <p className="mt-1 text-sm text-[var(--color-mtg-muted)]">
            Post trades and browse what other players are offering.
          </p>
        </div>
        <button
          type="button"
          onClick={handlePostClick}
          className="rounded-lg bg-[var(--color-mtg-gold)] px-4 py-2 text-sm font-semibold text-black transition hover:brightness-110"
        >
          Post trade
        </button>
      </div>

      <label className="block">
        <span className="sr-only">Search trades</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by card name or username…"
          className="w-full rounded-lg border border-[var(--color-mtg-border)] bg-[var(--color-mtg-panel)] px-4 py-2.5 text-sm text-white placeholder:text-[var(--color-mtg-muted)] focus:border-[var(--color-mtg-gold)] focus:outline-none"
        />
      </label>

      {loading && (
        <p className="text-center text-sm text-[var(--color-mtg-muted)]">Loading trades…</p>
      )}

      {error && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      {!loading && !error && trades.length === 0 && (
        <p className="rounded-lg border border-[var(--color-mtg-border)] bg-[var(--color-mtg-panel)] px-4 py-8 text-center text-sm text-[var(--color-mtg-muted)]">
          {debouncedQuery
            ? 'No trades match your search.'
            : 'No trades posted yet. Be the first to post one!'}
        </p>
      )}

      <div className="flex flex-col gap-4">
        {trades.map((trade) => (
          <TradeCard
            key={trade.id}
            trade={trade}
            isOwn={user?.id === trade.userId}
            onDelete={(id) => setTrades((prev) => prev.filter((t) => t.id !== id))}
          />
        ))}
      </div>

      {modalOpen && (
        <CreateTradeModal
          collection={collection}
          onClose={() => setModalOpen(false)}
          onCreated={() => void loadTrades(debouncedQuery)}
        />
      )}
    </div>
  )
}
