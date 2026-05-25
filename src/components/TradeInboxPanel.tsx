import { useState } from 'react'
import { ManaIcon } from './ManaIcon'
import { TradeCardChip } from './TradeCollectionPicker'
import { TradeOfferingCards } from './TradeOfferingCards'
import type { TradeInbox, TradeInboxEntry, TradePost } from '../types/trade'

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

function OfferSummary({ entry }: { entry: TradeInboxEntry }) {
  return (
    <div className="mt-3 space-y-2">
      {entry.offer.mana > 0 && (
        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-mana-u)]/15 px-2.5 py-1 text-sm font-semibold text-[var(--color-mana-u)]">
          <ManaIcon className="h-4 w-4" />
          {entry.offer.mana} mana
        </span>
      )}
      {entry.offer.cards.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {entry.offer.cards.map((card, i) => (
            <TradeCardChip key={`${card.instanceId ?? card.name}-${i}`} entry={card} />
          ))}
        </div>
      )}
      {entry.offer.note && (
        <p className="text-sm text-[var(--color-mtg-muted)]">{entry.offer.note}</p>
      )}
    </div>
  )
}

function IncomingInboxCard({
  entry,
  title,
  subtitle,
  onOpen,
  onAccept,
  onDecline,
}: {
  entry: TradeInboxEntry
  title: string
  subtitle: string
  onOpen: (trade: TradePost) => void
  onAccept: (offerId: string) => Promise<void>
  onDecline: (offerId: string) => Promise<void>
}) {
  const [busyAction, setBusyAction] = useState<'accept' | 'decline' | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  async function handleAccept() {
    if (
      !confirm(
        `Accept this offer from ${entry.offer.username ?? 'this player'}? Cards and mana will be exchanged immediately.`,
      )
    ) {
      return
    }

    setBusyAction('accept')
    setActionError(null)
    try {
      await onAccept(entry.offer.id)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not accept offer.')
    } finally {
      setBusyAction(null)
    }
  }

  async function handleDecline() {
    setBusyAction('decline')
    setActionError(null)
    try {
      await onDecline(entry.offer.id)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not decline offer.')
    } finally {
      setBusyAction(null)
    }
  }

  return (
    <article className="rounded-xl border border-[var(--color-mtg-border)] bg-[var(--color-mtg-panel)] p-4">
      <button
        type="button"
        onClick={() => onOpen(entry.trade)}
        className="w-full text-left transition hover:opacity-90"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-white">{title}</p>
            <p className="mt-1 text-xs text-[var(--color-mtg-muted)]">{subtitle}</p>
          </div>
          <span className="text-xs text-[var(--color-mana-u)]">
            {formatRelativeTime(entry.offer.createdAt)}
          </span>
        </div>

        <OfferSummary entry={entry} />

        <p className="mt-3 text-xs text-[var(--color-mtg-muted)]">For listing:</p>
        <div className="mt-1.5">
          <TradeOfferingCards cards={entry.trade.offering} compact />
        </div>
        {entry.trade.note && (
          <p className="mt-2 text-xs text-[var(--color-mtg-muted)]">
            Asking: {entry.trade.note}
          </p>
        )}
      </button>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => void handleAccept()}
          disabled={busyAction !== null}
          className="flex-1 rounded-lg bg-emerald-600 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
        >
          {busyAction === 'accept' ? 'Accepting…' : 'Accept'}
        </button>
        <button
          type="button"
          onClick={() => void handleDecline()}
          disabled={busyAction !== null}
          className="flex-1 rounded-lg border border-[var(--color-mtg-border)] py-2 text-sm font-semibold text-white transition hover:border-red-400 hover:text-red-300 disabled:opacity-50"
        >
          {busyAction === 'decline' ? 'Declining…' : 'Decline'}
        </button>
      </div>

      {actionError && <p className="mt-3 text-sm text-red-400">{actionError}</p>}
    </article>
  )
}

function OutgoingInboxCard({
  entry,
  title,
  subtitle,
  onOpen,
}: {
  entry: TradeInboxEntry
  title: string
  subtitle: string
  onOpen: (trade: TradePost) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(entry.trade)}
      className="w-full rounded-xl border border-[var(--color-mtg-border)] bg-[var(--color-mtg-panel)] p-4 text-left transition hover:border-[var(--color-mtg-gold-dim)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-white">{title}</p>
          <p className="mt-1 text-xs text-[var(--color-mtg-muted)]">{subtitle}</p>
        </div>
        <span className="text-xs text-[var(--color-mana-u)]">
          {formatRelativeTime(entry.offer.createdAt)}
        </span>
      </div>

      <OfferSummary entry={entry} />

      <p className="mt-3 text-xs text-[var(--color-mtg-muted)]">For listing:</p>
      <div className="mt-1.5">
        <TradeOfferingCards cards={entry.trade.offering} compact />
      </div>
      {entry.trade.note && (
        <p className="mt-2 text-xs text-[var(--color-mtg-muted)]">
          Asking: {entry.trade.note}
        </p>
      )}
    </button>
  )
}

function InboxSection({
  title,
  emptyMessage,
  entries,
  renderTitle,
  renderSubtitle,
  onOpenTrade,
  onAccept,
  onDecline,
}: {
  title: string
  emptyMessage: string
  entries: TradeInboxEntry[]
  renderTitle: (entry: TradeInboxEntry) => string
  renderSubtitle: (entry: TradeInboxEntry) => string
  onOpenTrade: (trade: TradePost) => void
  onAccept?: (offerId: string) => Promise<void>
  onDecline?: (offerId: string) => Promise<void>
}) {
  return (
    <section>
      <h3 className="mb-3 font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--color-mtg-gold)]">
        {title}
        {entries.length > 0 ? ` (${entries.length})` : ''}
      </h3>
      {entries.length === 0 ? (
        <p className="rounded-lg border border-[var(--color-mtg-border)] bg-[var(--color-mtg-panel)] px-4 py-6 text-sm text-[var(--color-mtg-muted)]">
          {emptyMessage}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {entries.map((entry) =>
            onAccept && onDecline ? (
              <IncomingInboxCard
                key={entry.offer.id}
                entry={entry}
                title={renderTitle(entry)}
                subtitle={renderSubtitle(entry)}
                onOpen={onOpenTrade}
                onAccept={onAccept}
                onDecline={onDecline}
              />
            ) : (
              <OutgoingInboxCard
                key={entry.offer.id}
                entry={entry}
                title={renderTitle(entry)}
                subtitle={renderSubtitle(entry)}
                onOpen={onOpenTrade}
              />
            ),
          )}
        </div>
      )}
    </section>
  )
}

export function TradeInboxPanel({
  inbox,
  loading,
  error,
  loggedIn,
  section,
  onLogin,
  onOpenTrade,
  onAcceptOffer,
  onDeclineOffer,
}: {
  inbox: TradeInbox | null
  loading: boolean
  error: string | null
  loggedIn: boolean
  section: 'incoming' | 'outgoing'
  onLogin: () => void
  onOpenTrade: (trade: TradePost) => void
  onAcceptOffer: (offerId: string) => Promise<void>
  onDeclineOffer: (offerId: string) => Promise<void>
}) {
  if (!loggedIn) {
    const loginHint =
      section === 'incoming'
        ? 'Log in to see offers on your trade listings.'
        : 'Log in to see offers you have sent.'
    return (
      <div className="rounded-lg border border-[var(--color-mtg-border)] bg-[var(--color-mtg-panel)] px-4 py-8 text-center">
        <p className="text-sm text-[var(--color-mtg-muted)]">{loginHint}</p>
        <button
          type="button"
          onClick={onLogin}
          className="mt-4 rounded-lg bg-[var(--color-mtg-gold)] px-4 py-2 text-sm font-semibold text-black transition hover:brightness-110"
        >
          Log in
        </button>
      </div>
    )
  }

  if (loading) {
    return (
      <p className="text-center text-sm text-[var(--color-mtg-muted)]">
        {section === 'incoming' ? 'Loading inbox…' : 'Loading your offers…'}
      </p>
    )
  }

  if (error) {
    return (
      <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
        {error}
      </p>
    )
  }

  if (!inbox) return null

  if (section === 'incoming') {
    return (
      <InboxSection
        title="Inbox"
        emptyMessage="No offers on your listings yet."
        entries={inbox.incoming}
        renderTitle={(entry) => `${entry.offer.username ?? 'Unknown player'} made an offer`}
        renderSubtitle={() => 'On your trade listing'}
        onOpenTrade={onOpenTrade}
        onAccept={onAcceptOffer}
        onDecline={onDeclineOffer}
      />
    )
  }

  return (
    <InboxSection
      title="My offers"
      emptyMessage="You haven't sent any offers yet."
      entries={inbox.outgoing}
      renderTitle={(entry) => `Your offer to ${entry.trade.username ?? 'Unknown player'}`}
      renderSubtitle={() => 'Tap to view the listing and update your offer'}
      onOpenTrade={onOpenTrade}
    />
  )
}
