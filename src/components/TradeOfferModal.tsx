import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useGame } from '../context/GameContext'
import { ManaIcon } from './ManaIcon'
import { TradeCardChip, TradeCollectionPicker } from './TradeCollectionPicker'
import { createTradeOffer, fetchTradeOffers } from '../lib/trade-api'
import type { CollectedCard } from '../types/game'
import type { TradeCardEntry, TradeOffer, TradePost } from '../types/trade'

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

function TradeCardList({ cards }: { cards: TradeCardEntry[] }) {
  if (cards.length === 0) {
    return <p className="text-sm text-[var(--color-mtg-muted)]">No cards listed.</p>
  }

  return (
    <ul className="space-y-0.5">
      {cards.map((card, i) => (
        <li key={`${card.instanceId ?? card.name}-${i}`} className="text-sm text-white">
          {card.name}
          {card.ultrafoil && <span className="ml-1 text-cyan-300">◈</span>}
          {card.foil && !card.ultrafoil && <span className="ml-1 text-[var(--color-mtg-gold)]">✦</span>}
        </li>
      ))}
    </ul>
  )
}

function OfferCard({ offer, isOwn }: { offer: TradeOffer; isOwn: boolean }) {
  return (
    <div className="rounded-lg border border-[var(--color-mtg-border)] bg-[var(--color-mtg-bg)] p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">
            {offer.username ?? 'Unknown player'}
            {isOwn && <span className="ml-2 text-xs text-[var(--color-mtg-gold)]">You</span>}
          </p>
          <p className="text-xs text-[var(--color-mtg-muted)]">
            {formatRelativeTime(offer.createdAt)}
          </p>
        </div>
        {offer.mana > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-mana-u)]/15 px-2.5 py-1 text-sm font-semibold text-[var(--color-mana-u)]">
            <ManaIcon className="h-4 w-4" />
            {offer.mana}
          </span>
        )}
      </div>

      {offer.cards.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {offer.cards.map((card, i) => (
            <TradeCardChip key={`${card.instanceId ?? card.name}-${i}`} entry={card} />
          ))}
        </div>
      )}

      {offer.note && (
        <p className="mt-3 text-sm text-[var(--color-mtg-muted)]">{offer.note}</p>
      )}
    </div>
  )
}

export function TradeOfferModal({
  trade,
  collection,
  onClose,
  onOfferCreated,
}: {
  trade: TradePost
  collection: CollectedCard[]
  onClose: () => void
  onOfferCreated: () => void
}) {
  const { user, token, openAuthModal } = useAuth()
  const { mana } = useGame()
  const [offers, setOffers] = useState<TradeOffer[]>([])
  const [loadingOffers, setLoadingOffers] = useState(true)
  const [offerCards, setOfferCards] = useState<TradeCardEntry[]>([])
  const [offerMana, setOfferMana] = useState('')
  const [offerNote, setOfferNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isOwnTrade = user?.id === trade.userId
  const canOffer = Boolean(user && token && !isOwnTrade)
  const parsedMana = offerMana.trim() === '' ? 0 : Number.parseInt(offerMana, 10)
  const validMana = Number.isFinite(parsedMana) && parsedMana >= 0 ? parsedMana : 0
  const hasOfferContent = validMana > 0 || offerCards.length > 0
  const manaTooHigh = validMana > mana

  useEffect(() => {
    let cancelled = false
    setLoadingOffers(true)
    fetchTradeOffers(trade.id)
      .then((rows) => {
        if (!cancelled) setOffers(rows)
      })
      .catch(() => {
        if (!cancelled) setOffers([])
      })
      .finally(() => {
        if (!cancelled) setLoadingOffers(false)
      })
    return () => {
      cancelled = true
    }
  }, [trade.id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!user || !token) {
      openAuthModal()
      return
    }
    if (isOwnTrade) return
    if (!hasOfferContent) {
      setError('Add mana, cards, or both to your offer.')
      return
    }
    if (manaTooHigh) {
      setError(`You only have ${mana} mana available.`)
      return
    }

    setBusy(true)
    try {
      const offer = await createTradeOffer(trade.id, {
        mana: validMana,
        cards: offerCards,
        note: offerNote.trim() || undefined,
      })
      setOffers((prev) => [offer, ...prev])
      setOfferCards([])
      setOfferMana('')
      setOfferNote('')
      onOfferCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit offer.')
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
              Trade listing
            </h2>
            <p className="mt-1 text-sm text-[var(--color-mtg-muted)]">
              Posted by {trade.username ?? 'Unknown player'} · {formatRelativeTime(trade.createdAt)}
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

        <div className="space-y-4">
          <div className="rounded-lg border border-[var(--color-mtg-border)] bg-[var(--color-mtg-bg)] p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-mtg-muted)]">
              They are offering
            </p>
            <div className="mt-2">
              <TradeCardList cards={trade.offering} />
            </div>
            {trade.note && (
              <p className="mt-3 rounded-lg bg-[var(--color-mtg-panel)] px-3 py-2 text-sm">
                <span className="font-medium text-[var(--color-mtg-gold)]">Asking: </span>
                <span className="text-white">{trade.note}</span>
              </p>
            )}
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-white">
              Offers {offers.length > 0 ? `(${offers.length})` : ''}
            </p>
            {loadingOffers ? (
              <p className="text-sm text-[var(--color-mtg-muted)]">Loading offers…</p>
            ) : offers.length === 0 ? (
              <p className="rounded-lg border border-[var(--color-mtg-border)] bg-[var(--color-mtg-bg)] px-3 py-4 text-sm text-[var(--color-mtg-muted)]">
                No offers yet.
              </p>
            ) : (
              <div className="space-y-2">
                {offers.map((offer) => (
                  <OfferCard
                    key={offer.id}
                    offer={offer}
                    isOwn={user?.id === offer.userId}
                  />
                ))}
              </div>
            )}
          </div>

          {isOwnTrade ? (
            <p className="text-sm text-[var(--color-mtg-muted)]">
              This is your trade. Other players can submit offers here.
            </p>
          ) : !user ? (
            <button
              type="button"
              onClick={openAuthModal}
              className="w-full rounded-lg bg-[var(--color-mtg-gold)] py-2.5 text-sm font-semibold text-black transition hover:brightness-110"
            >
              Log in to make an offer
            </button>
          ) : (
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              <div className="rounded-lg border border-[var(--color-mtg-border)] bg-[var(--color-mtg-bg)] p-3">
                <label className="block text-sm">
                  <span className="font-medium text-white">Mana in your offer</span>
                  <span className="mt-1 block text-xs text-[var(--color-mtg-muted)]">
                    You have {mana} mana available
                  </span>
                  <div className="relative mt-2">
                    <ManaIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
                    <input
                      type="number"
                      min={0}
                      max={mana}
                      step={1}
                      value={offerMana}
                      onChange={(e) => setOfferMana(e.target.value)}
                      placeholder="0"
                      className="w-full rounded-lg border border-[var(--color-mtg-border)] bg-[var(--color-mtg-panel)] py-2 pl-9 pr-3 text-sm text-white focus:border-[var(--color-mtg-gold)] focus:outline-none"
                    />
                  </div>
                </label>
              </div>

              <TradeCollectionPicker
                collection={collection}
                selected={offerCards}
                onChange={setOfferCards}
                label="Cards in your offer"
                emptySelectedMessage="No cards added yet."
              />

              <label className="block text-sm">
                <span className="text-[var(--color-mtg-muted)]">Message (optional)</span>
                <input
                  type="text"
                  value={offerNote}
                  onChange={(e) => setOfferNote(e.target.value)}
                  maxLength={500}
                  placeholder="Happy to negotiate…"
                  className="mt-1 w-full rounded-lg border border-[var(--color-mtg-border)] bg-[var(--color-mtg-bg)] px-3 py-2 text-sm text-white focus:border-[var(--color-mtg-gold)] focus:outline-none"
                />
              </label>

              {error && <p className="text-sm text-red-400">{error}</p>}

              <button
                type="submit"
                disabled={busy || !canOffer || !hasOfferContent || manaTooHigh}
                className="w-full rounded-lg bg-[var(--color-mtg-gold)] py-2.5 text-sm font-semibold text-black transition hover:brightness-110 disabled:opacity-50"
              >
                {busy ? 'Submitting…' : 'Submit offer'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
