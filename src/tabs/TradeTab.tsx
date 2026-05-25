import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useGame } from '../context/GameContext'
import { CreateTradeModal } from '../components/CreateTradeModal'
import { TradeInboxPanel } from '../components/TradeInboxPanel'
import { TradeOfferModal } from '../components/TradeOfferModal'
import { TradeOfferingCards } from '../components/TradeOfferingCards'
import { deleteTrade, acceptTradeOffer, declineTradeOffer, fetchTradeInbox, fetchTrades } from '../lib/trade-api'
import type { CollectedCard } from '../types/game'
import type { TradeInbox, TradePost } from '../types/trade'

type TradeView = 'browse' | 'inbox' | 'my-offers'

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

function TradeCard({
  trade,
  isOwn,
  collection,
  onOpen,
  onDelete,
}: {
  trade: TradePost
  isOwn: boolean
  collection: CollectedCard[]
  onOpen: (trade: TradePost) => void
  onDelete: (id: string) => void
}) {
  const [busy, setBusy] = useState(false)

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
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
    <article
      className="cursor-pointer rounded-xl border border-[var(--color-mtg-border)] bg-[var(--color-mtg-panel)] p-4 transition hover:border-[var(--color-mtg-gold-dim)] hover:bg-[var(--color-mtg-panel)]/90"
      onClick={() => onOpen(trade)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen(trade)
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-white">{trade.username ?? 'Unknown player'}</p>
          <p className="text-xs text-[var(--color-mtg-muted)]">{formatRelativeTime(trade.createdAt)}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--color-mana-u)]">View / offer</span>
          {isOwn && (
            <button
              type="button"
              onClick={(e) => void handleDelete(e)}
              disabled={busy}
              className="rounded-lg border border-[var(--color-mtg-border)] px-2 py-1 text-xs text-[var(--color-mtg-muted)] transition hover:border-red-500/50 hover:text-red-300 disabled:opacity-50"
            >
              {busy ? '…' : 'Delete'}
            </button>
          )}
        </div>
      </div>

      <div className="mt-4">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-mtg-muted)]">
          Offering
        </p>
        <div className="mt-1">
          <TradeOfferingCards cards={trade.offering} collection={collection} />
        </div>
      </div>

      {trade.note && (
        <p className="mt-3 rounded-lg bg-[var(--color-mtg-bg)] px-3 py-2 text-sm">
          <span className="font-medium text-[var(--color-mtg-gold)]">Asking: </span>
          <span className="text-white">{trade.note}</span>
        </p>
      )}
    </article>
  )
}

export function TradeTab() {
  const { user, openAuthModal } = useAuth()
  const { collection, applyCloudSave } = useGame()
  const [view, setView] = useState<TradeView>('browse')
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [trades, setTrades] = useState<TradePost[]>([])
  const [inbox, setInbox] = useState<TradeInbox | null>(null)
  const [loading, setLoading] = useState(true)
  const [inboxLoading, setInboxLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [inboxError, setInboxError] = useState<string | null>(null)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [selectedTrade, setSelectedTrade] = useState<TradePost | null>(null)

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

  const loadInbox = useCallback(async () => {
    if (!user) {
      setInbox(null)
      setInboxError(null)
      setInboxLoading(false)
      return
    }

    setInboxLoading(true)
    setInboxError(null)
    try {
      const data = await fetchTradeInbox()
      setInbox(data)
    } catch (err) {
      setInboxError(err instanceof Error ? err.message : 'Could not load inbox.')
      setInbox(null)
    } finally {
      setInboxLoading(false)
    }
  }, [user])

  useEffect(() => {
    void loadTrades(debouncedQuery)
  }, [debouncedQuery, loadTrades])

  useEffect(() => {
    if (user) {
      void loadInbox()
    } else {
      setInbox(null)
    }
  }, [user, loadInbox])

  function handlePostClick() {
    if (!user) {
      openAuthModal()
      return
    }
    setCreateModalOpen(true)
  }

  function handleOpenTrade(trade: TradePost) {
    setSelectedTrade(trade)
  }

  function refreshAll() {
    void loadTrades(debouncedQuery)
    if (user) void loadInbox()
  }

  const handleAcceptOffer = useCallback(
    async (offerId: string) => {
      const save = await acceptTradeOffer(offerId)
      applyCloudSave(save)
      setSelectedTrade(null)
      void loadTrades(debouncedQuery)
      if (user) void loadInbox()
    },
    [applyCloudSave, debouncedQuery, loadInbox, loadTrades, user],
  )

  const handleDeclineOffer = useCallback(
    async (offerId: string) => {
      await declineTradeOffer(offerId)
      void loadTrades(debouncedQuery)
      if (user) void loadInbox()
    },
    [debouncedQuery, loadInbox, loadTrades, user],
  )

  const incomingCount = user ? (inbox?.incoming.length ?? 0) : 0
  const outgoingCount = user ? (inbox?.outgoing.length ?? 0) : 0

  function openTradeView(nextView: 'inbox' | 'my-offers') {
    if (!user) {
      openAuthModal()
      return
    }
    setView(nextView)
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--color-mtg-gold)]">
            Trade
          </h2>
          <p className="mt-1 text-sm text-[var(--color-mtg-muted)]">
            Browse listings, check your inbox for incoming offers, and track offers you&apos;ve sent.
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

      <div className="flex gap-2 rounded-lg border border-[var(--color-mtg-border)] bg-[var(--color-mtg-bg)] p-1">
        <button
          type="button"
          onClick={() => setView('browse')}
          className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
            view === 'browse'
              ? 'bg-[var(--color-mtg-gold)] text-black'
              : 'text-[var(--color-mtg-muted)] hover:text-white'
          }`}
        >
          Browse
        </button>
        <button
          type="button"
          onClick={() => openTradeView('inbox')}
          className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
            view === 'inbox'
              ? 'bg-[var(--color-mtg-gold)] text-black'
              : 'text-[var(--color-mtg-muted)] hover:text-white'
          }`}
        >
          Inbox{incomingCount > 0 ? ` (${incomingCount})` : ''}
        </button>
        <button
          type="button"
          onClick={() => openTradeView('my-offers')}
          className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
            view === 'my-offers'
              ? 'bg-[var(--color-mtg-gold)] text-black'
              : 'text-[var(--color-mtg-muted)] hover:text-white'
          }`}
        >
          My offers{outgoingCount > 0 ? ` (${outgoingCount})` : ''}
        </button>
      </div>

      {view === 'browse' && (
        <>
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
                collection={collection}
                onOpen={handleOpenTrade}
                onDelete={(id) => {
                  setTrades((prev) => prev.filter((t) => t.id !== id))
                  if (selectedTrade?.id === id) setSelectedTrade(null)
                }}
              />
            ))}
          </div>
        </>
      )}

      {view !== 'browse' && (
        <TradeInboxPanel
          inbox={inbox}
          loading={inboxLoading}
          error={inboxError}
          loggedIn={Boolean(user)}
          section={view === 'inbox' ? 'incoming' : 'outgoing'}
          onLogin={openAuthModal}
          onOpenTrade={handleOpenTrade}
          onAcceptOffer={handleAcceptOffer}
          onDeclineOffer={handleDeclineOffer}
        />
      )}

      {createModalOpen && (
        <CreateTradeModal
          collection={collection}
          onClose={() => setCreateModalOpen(false)}
          onCreated={refreshAll}
        />
      )}

      {selectedTrade && (
        <TradeOfferModal
          trade={selectedTrade}
          collection={collection}
          onClose={() => setSelectedTrade(null)}
          onOfferCreated={refreshAll}
        />
      )}
    </div>
  )
}
