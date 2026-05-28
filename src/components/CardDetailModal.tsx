import { useEffect, useMemo, useState } from 'react'
import { getCardByName } from '../api/scryfall'
import { useGame } from '../context/GameContext'
import { buildCardLookup } from '../lib/inventory-sort'
import { canonicalNameKey } from '../lib/card-names'
import { formatUsdPrice, tcgplayerProductUrl } from '../lib/card-prices'
import { resolveCollectedCard } from '../lib/collected-card-resolve'
import { getCollectedCardRarity } from '../lib/card-rarity'
import { sortIdentity } from '../lib/color-filter'
import type { CollectedCard } from '../types/game'
import type { ManaColor } from '../types/mtg'
import type { ScryfallCard } from '../types/mtg'

const COLOR_LABEL: Record<ManaColor, string> = {
  W: 'White',
  U: 'Blue',
  B: 'Black',
  R: 'Red',
  G: 'Green',
}

const COLOR_BADGE: Record<ManaColor, string> = {
  W: 'bg-[#f8e7b9] text-black',
  U: 'bg-[#0e68ab] text-white',
  B: 'bg-[#3d3429] text-[#e6edf3]',
  R: 'bg-[#d3202a] text-white',
  G: 'bg-[#00733e] text-white',
}

const RARITY_LABEL = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  mythic: 'Mythic',
} as const

type CardDetailModalProps = {
  card: CollectedCard
  onClose: () => void
  activeFolderId?: string | null
}

export function CardDetailModal({ card, onClose, activeFolderId }: CardDetailModalProps) {
  const { collection, folders, cardPool, rarityMap, addCardToFolder, removeCardFromFolder } =
    useGame()
  const [liveCard, setLiveCard] = useState<ScryfallCard | null>(null)
  const [priceLoading, setPriceLoading] = useState(true)
  const [priceError, setPriceError] = useState(false)

  const resolved = useMemo(
    () => resolveCollectedCard(card, collection),
    [card, collection],
  )
  const inCollection = useMemo(
    () => collection.some((c) => c.instanceId === resolved.instanceId),
    [collection, resolved.instanceId],
  )

  const lookup = useMemo(() => buildCardLookup(cardPool), [cardPool])
  const record = lookup.get(canonicalNameKey(resolved.name))
  const rarity = getCollectedCardRarity(
    resolved.name,
    rarityMap,
    record,
    liveCard?.rarity,
  )
  const colors = sortIdentity(record?.color_identity ?? [])

  useEffect(() => {
    let cancelled = false
    setPriceLoading(true)
    setPriceError(false)

    getCardByName(resolved.name)
      .then((data) => {
        if (cancelled) return
        setLiveCard(data)
        setPriceLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setPriceError(true)
        setPriceLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [resolved.name])

  const marketNonfoil =
    liveCard?.prices?.usd ?? record?.prices?.usd ?? null
  const marketFoil =
    liveCard?.prices?.usd_foil ?? record?.prices?.usd_foil ?? null
  const tcgUrl = tcgplayerProductUrl(liveCard?.tcgplayer_id)
  const scryfallUrl = liveCard?.scryfall_uri ?? record?.scryfall_uri
  const setLabel = liveCard?.set_name
  const oracleText = record?.oracle_text || liveCard?.oracle_text
  const manaCost = record?.mana_cost ?? liveCard?.mana_cost
  const typeLine = resolved.typeLine || record?.type_line || liveCard?.type_line
  const keywords = record?.keywords?.length ? record.keywords : liveCard?.keywords ?? []
  const edhrec = record?.edhrec_rank ?? liveCard?.edhrec_rank

  const foldersWithCard = folders.filter((f) =>
    f.cardInstanceIds.includes(resolved.instanceId),
  )

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-xl border border-[var(--color-mtg-border)] bg-[var(--color-mtg-panel)] shadow-xl sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="card-detail-title"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-[var(--color-mtg-border)] bg-[var(--color-mtg-panel)] px-4 py-3">
          <div className="min-w-0">
            <h2
              id="card-detail-title"
              className="truncate font-[family-name:var(--font-display)] text-lg font-bold text-[var(--color-mtg-gold)]"
            >
              {resolved.name}
            </h2>
            {manaCost && (
              <p className="text-sm text-[var(--color-mtg-muted)]">{manaCost}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 text-xl text-[var(--color-mtg-muted)] hover:text-white"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="p-4">
          <div className="mx-auto max-w-[11rem] overflow-hidden rounded-lg border border-[var(--color-mtg-border)]">
            {resolved.image ? (
              <img
                src={resolved.image}
                alt={resolved.name}
                className={`aspect-[5/7] w-full object-cover ${resolved.ultrafoil ? 'ultrafoil-art' : ''}`}
              />
            ) : (
              <div className="flex aspect-[5/7] items-center justify-center bg-[var(--color-mtg-bg)] text-sm text-[var(--color-mtg-muted)]">
                No image
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {resolved.ultrafoil && (
              <span className="rounded bg-gradient-to-r from-fuchsia-500 via-cyan-400 to-amber-300 px-2 py-0.5 text-xs font-bold text-black">
                Ultrafoil
              </span>
            )}
            {resolved.foil && !resolved.ultrafoil && (
              <span className="rounded bg-black/70 px-2 py-0.5 text-xs font-bold text-yellow-300">
                Foil
              </span>
            )}
            <span className="rounded border border-[var(--color-mtg-border)] px-2 py-0.5 text-xs text-white">
              {RARITY_LABEL[rarity]}
            </span>
            {colors.length === 0 ? (
              <span className="rounded bg-[#9ca3af] px-2 py-0.5 text-xs font-semibold text-black">
                Colorless
              </span>
            ) : (
              colors.map((c) => (
                <span
                  key={c}
                  className={`rounded px-2 py-0.5 text-xs font-semibold ${COLOR_BADGE[c]}`}
                >
                  {COLOR_LABEL[c]}
                </span>
              ))
            )}
          </div>

          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wide text-[var(--color-mtg-muted)]">
                Type
              </dt>
              <dd className="mt-0.5 text-white">{typeLine}</dd>
            </div>
            {oracleText && (
              <div>
                <dt className="text-xs uppercase tracking-wide text-[var(--color-mtg-muted)]">
                  Oracle text
                </dt>
                <dd className="mt-0.5 whitespace-pre-wrap text-[var(--color-mtg-text)]">
                  {oracleText}
                </dd>
              </div>
            )}
            {keywords.length > 0 && (
              <div>
                <dt className="text-xs uppercase tracking-wide text-[var(--color-mtg-muted)]">
                  Keywords
                </dt>
                <dd className="mt-1 flex flex-wrap gap-1">
                  {keywords.map((kw) => (
                    <span
                      key={kw}
                      className="rounded bg-[var(--color-mtg-bg)] px-2 py-0.5 text-xs text-white"
                    >
                      {kw}
                    </span>
                  ))}
                </dd>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <dt className="text-xs uppercase tracking-wide text-[var(--color-mtg-muted)]">
                  CMC
                </dt>
                <dd className="mt-0.5 text-white">{record?.cmc ?? liveCard?.cmc ?? resolved.cmc}</dd>
              </div>
              {edhrec != null && (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-[var(--color-mtg-muted)]">
                    EDHREC rank
                  </dt>
                  <dd className="mt-0.5 text-white">#{edhrec.toLocaleString()}</dd>
                </div>
              )}
              {setLabel && (
                <div className="col-span-2">
                  <dt className="text-xs uppercase tracking-wide text-[var(--color-mtg-muted)]">
                    Printing
                  </dt>
                  <dd className="mt-0.5 text-white">
                    {setLabel}
                    {liveCard?.collector_number ? ` · #${liveCard.collector_number}` : ''}
                  </dd>
                </div>
              )}
            </div>
          </dl>

          <div className="mt-5 rounded-lg border border-[var(--color-mtg-border)] bg-[var(--color-mtg-bg)] p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-mtg-gold)]">
              TCGPlayer market price
            </h3>
            {priceLoading ? (
              <p className="mt-2 text-sm text-[var(--color-mtg-muted)]">Loading prices…</p>
            ) : (
              <dl className="mt-2 space-y-1 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-[var(--color-mtg-muted)]">Nonfoil</dt>
                  <dd className="font-semibold text-[var(--color-mana-u)]">
                    {formatUsdPrice(marketNonfoil)}
                  </dd>
                </div>
                {(resolved.foil || marketFoil) && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-[var(--color-mtg-muted)]">Foil</dt>
                    <dd className="font-semibold text-[var(--color-mana-u)]">
                      {formatUsdPrice(marketFoil)}
                    </dd>
                  </div>
                )}
              </dl>
            )}
            {priceError && !liveCard && (
              <p className="mt-2 text-xs text-[var(--color-mtg-muted)]">
                Live price unavailable — showing cached data when available.
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {tcgUrl && (
                <a
                  href={tcgUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-[var(--color-mtg-border)] px-3 py-1.5 text-xs text-[var(--color-mtg-gold)] transition hover:bg-[var(--color-mtg-gold)]/10"
                >
                  View on TCGPlayer
                </a>
              )}
              {scryfallUrl && (
                <a
                  href={scryfallUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-[var(--color-mtg-border)] px-3 py-1.5 text-xs text-[var(--color-mtg-muted)] transition hover:text-white"
                >
                  Scryfall
                </a>
              )}
            </div>
          </div>

          {inCollection && (
            <div className="mt-5 rounded-lg border border-[var(--color-mtg-border)] bg-[var(--color-mtg-bg)] p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-mtg-gold)]">
                Folders
              </h3>
              {activeFolderId && (
                <button
                  type="button"
                  onClick={() => {
                    removeCardFromFolder(activeFolderId, resolved.instanceId)
                    onClose()
                  }}
                  className="mt-3 w-full rounded-lg border border-red-500/40 px-3 py-2 text-sm text-red-300 transition hover:bg-red-500/10"
                >
                  Remove from this folder
                </button>
              )}
              {folders.length === 0 ? (
                <p className="mt-2 text-sm text-[var(--color-mtg-muted)]">
                  Create a folder in Inventory to organize cards.
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {folders.map((folder) => {
                    const already = folder.cardInstanceIds.includes(resolved.instanceId)
                    return (
                      <li key={folder.id}>
                        <button
                          type="button"
                          onClick={() => {
                            if (!already) addCardToFolder(folder.id, resolved.instanceId)
                          }}
                          disabled={already}
                          className="flex w-full items-center justify-between rounded-lg border border-[var(--color-mtg-border)] px-3 py-2 text-left text-sm transition hover:border-[var(--color-mtg-gold-dim)] disabled:opacity-50"
                        >
                          <span>📁 {folder.name}</span>
                          {already && (
                            <span className="text-xs text-green-400/90">In folder</span>
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
              {foldersWithCard.length > 0 && !activeFolderId && (
                <p className="mt-2 text-xs text-[var(--color-mtg-muted)]">
                  In {foldersWithCard.length} folder{foldersWithCard.length === 1 ? '' : 's'}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
