import { useEffect, useRef, useState } from 'react'
import { CardDetailModal } from '../components/CardDetailModal'
import { CardTile } from '../components/CardTile'
import { ManaDisplay } from '../components/ManaDisplay'
import { useGame } from '../context/GameContext'
import { cardToCollectedFields } from '../lib/booster'
import { getCardImage } from '../lib/card-utils'
import { SHOP_ART, type ShopArtId } from '../lib/shop-art'
import type { BoosterCard, CollectedCard } from '../types/game'
import {
  BOOSTER_BOX_COST,
  BOOSTER_COST,
  CARDS_PER_PACK,
  PACKS_PER_BOX,
  STANDARD_BOOSTER_COST,
  STANDARD_BOOSTER_BOX_COST,
} from '../types/game'

type RevealState =
  | { kind: 'pack'; cards: BoosterCard[]; index: number; label?: string }
  | { kind: 'box'; packs: BoosterCard[][]; packIndex: number; cardIndex: number; label?: string }

function ShopProduct({
  artId,
  title,
  bullets,
  cost,
  costLabel,
  canAfford,
  disabled,
  busy,
  busyLabel,
  needMore,
  onBuy,
}: {
  artId: ShopArtId
  title: string
  bullets: string[]
  cost: number
  costLabel?: string
  canAfford: boolean
  disabled: boolean
  busy: boolean
  busyLabel: string
  needMore: string
  onBuy: () => void
}) {
  const art = SHOP_ART[artId]

  return (
    <div
      className="group flex flex-col overflow-hidden rounded-xl border border-[var(--color-mtg-border)] bg-[var(--color-mtg-panel)] text-left transition hover:border-[var(--color-mtg-gold-dim)] hover:shadow-[0_0_24px_-4px_var(--glow-color)]"
      style={{ ['--glow-color' as string]: `${art.accent}66` }}
    >
      <div className="relative h-32 overflow-hidden">
        <img
          src={art.image}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          style={{ objectPosition: art.focal }}
        />
        <div
          className="absolute inset-0 opacity-40 mix-blend-color"
          style={{
            background: `linear-gradient(135deg, ${art.accent}88 0%, transparent 60%)`,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-mtg-panel)] via-[var(--color-mtg-panel)]/40 to-black/20" />
        <span
          className="absolute left-3 top-3 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider backdrop-blur-sm"
          style={{
            borderColor: `${art.accent}99`,
            backgroundColor: `${art.accent}22`,
            color: art.accent,
          }}
        >
          {art.tag}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-white">
          {title}
        </h3>
        <ul className="mt-3 flex-1 space-y-1 text-sm text-[var(--color-mtg-muted)]">
          {bullets.map((line) => (
            <li key={line}>• {line}</li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-[var(--color-mtg-muted)]">
          Cost:{' '}
          <span className="font-semibold text-[var(--color-mana-u)]">
            {costLabel ?? `${cost} mana`}
          </span>
        </p>
        <button
          type="button"
          onClick={onBuy}
          disabled={!canAfford || disabled || busy}
          className="mt-4 w-full rounded-lg bg-[var(--color-mtg-gold)] py-3 text-sm font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? busyLabel : canAfford ? `Open ${title}` : needMore}
        </button>
      </div>
    </div>
  )
}

export function ShopTab() {
  const {
    mana,
    openBooster,
    openStandardBooster,
    openBoosterBox,
    openStandardBoosterBox,
    cardPoolLoading,
    cardPoolError,
    standardPoolLoading,
    standardPoolError,
    rarityMapLoading,
    rarityMapError,
  } = useGame()
  const [opening, setOpening] = useState(false)
  const [reveal, setReveal] = useState<RevealState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [detailCard, setDetailCard] = useState<CollectedCard | null>(null)
  const revealRef = useRef<HTMLDivElement>(null)
  const shouldScrollRevealRef = useRef(false)

  useEffect(() => {
    if (!reveal) {
      shouldScrollRevealRef.current = false
      return
    }
    if (!shouldScrollRevealRef.current) {
      shouldScrollRevealRef.current = true
      requestAnimationFrame(() => {
        revealRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    }
  }, [reveal])

  const shopLoading = cardPoolLoading || standardPoolLoading || rarityMapLoading
  const shopDisabled = shopLoading || !!rarityMapError

  async function animatePack(cards: BoosterCard[], label?: string) {
    setReveal({ kind: 'pack', cards, index: -1, label })
    for (let i = 0; i < cards.length; i++) {
      await new Promise((r) => setTimeout(r, 300))
      setReveal({ kind: 'pack', cards, index: i })
    }
  }

  async function animateBox(packs: BoosterCard[][], label?: string) {
    setReveal({ kind: 'box', packs, packIndex: 0, cardIndex: -1, label })
    for (let p = 0; p < packs.length; p++) {
      for (let c = 0; c < packs[p].length; c++) {
        await new Promise((r) => setTimeout(r, 200))
        setReveal({ kind: 'box', packs, packIndex: p, cardIndex: c })
      }
    }
  }

  async function handleOpenPack() {
    setError(null)
    setOpening(true)
    setReveal(null)

    const result = await openBooster()
    if (result.error) {
      setError(result.error)
      setOpening(false)
      return
    }

    setOpening(false)
    await animatePack(result.cards)
  }

  async function handleOpenStandardPack() {
    setError(null)
    setOpening(true)
    setReveal(null)

    const result = await openStandardBooster()
    if (result.error) {
      setError(result.error)
      setOpening(false)
      return
    }

    setOpening(false)
    await animatePack(result.cards, 'Standard pack opened!')
  }

  async function handleOpenBox() {
    setError(null)
    setOpening(true)
    setReveal(null)

    const result = await openBoosterBox()
    if (result.error) {
      setError(result.error)
      setOpening(false)
      return
    }

    setOpening(false)
    await animateBox(result.packs, 'Commander booster box opened!')
  }

  async function handleOpenStandardBox() {
    setError(null)
    setOpening(true)
    setReveal(null)

    const result = await openStandardBoosterBox()
    if (result.error) {
      setError(result.error)
      setOpening(false)
      return
    }

    setOpening(false)
    await animateBox(result.packs, 'Standard booster box opened!')
  }

  function handleCloseReveal() {
    setReveal(null)
  }

  const boxDone =
    reveal?.kind === 'box' &&
    reveal.packIndex >= reveal.packs.length - 1 &&
    reveal.cardIndex >= reveal.packs[reveal.packIndex].length - 1

  const packDone = reveal?.kind === 'pack' && reveal.index >= reveal.cards.length - 1

  const revealPanel =
    reveal?.kind === 'pack' ? (
      <div className="rounded-xl border border-[var(--color-mtg-gold-dim)] bg-[var(--color-mtg-panel)] p-4">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--color-mtg-gold)]">
            {reveal.label ?? 'Pack opened!'}
          </h3>
          {packDone && (
            <button
              type="button"
              onClick={handleCloseReveal}
              className="text-sm text-[var(--color-mtg-muted)] hover:text-white"
            >
              Done
            </button>
          )}
        </div>
        <div className="mx-auto grid max-w-2xl grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
          {reveal.cards.map((entry, i) => {
            const visible = i <= reveal.index
            const preview = {
              instanceId: `${entry.card.id}-${i}`,
              ...cardToCollectedFields(entry.card, {
                foil: entry.foil,
                ultrafoil: entry.ultrafoil,
              }),
              collectedAt: Date.now(),
            }
            return (
              <div
                key={`${entry.card.id}-${i}`}
                className={`mx-auto w-full max-w-[8.5rem] transition-all duration-300 ${
                  visible ? 'scale-100 opacity-100' : 'scale-90 opacity-0'
                }`}
              >
                <CardTile
                  compact
                  card={{
                    ...preview,
                    image: preview.image ?? getCardImage(entry.card),
                  }}
                  onClick={() =>
                    setDetailCard({
                      ...preview,
                      image: preview.image ?? getCardImage(entry.card),
                    })
                  }
                />
              </div>
            )
          })}
        </div>
      </div>
    ) : reveal?.kind === 'box' ? (
      <div className="rounded-xl border border-[var(--color-mtg-gold-dim)] bg-[var(--color-mtg-panel)] p-4">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--color-mtg-gold)]">
            {reveal.label ?? 'Booster box opened!'}
          </h3>
          {boxDone && (
            <button
              type="button"
              onClick={handleCloseReveal}
              className="text-sm text-[var(--color-mtg-muted)] hover:text-white"
            >
              Done
            </button>
          )}
        </div>
        <div className="flex max-h-[70vh] flex-col gap-6 overflow-y-auto">
          {reveal.packs.map((pack, packIdx) => {
            const isFuturePack = packIdx > reveal.packIndex
            const isCurrentPack = packIdx === reveal.packIndex
            if (isFuturePack) return null

            return (
              <div key={packIdx}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-mtg-gold)]">
                  Pack {packIdx + 1} of {reveal.packs.length}
                </p>
                <div className="mx-auto grid max-w-2xl grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
                  {pack.map((entry, cardIdx) => {
                    const visible = !isCurrentPack || cardIdx <= reveal.cardIndex
                    const preview = {
                      instanceId: `${entry.card.id}-${packIdx}-${cardIdx}`,
                      ...cardToCollectedFields(entry.card, {
                        foil: entry.foil,
                        ultrafoil: entry.ultrafoil,
                      }),
                      collectedAt: Date.now(),
                    }
                    return (
                      <div
                        key={`${entry.card.id}-${packIdx}-${cardIdx}`}
                        className={`mx-auto w-full max-w-[8.5rem] transition-all duration-300 ${
                          visible ? 'scale-100 opacity-100' : 'scale-90 opacity-0'
                        }`}
                      >
                        <CardTile
                          compact
                          card={{
                            ...preview,
                            image: preview.image ?? getCardImage(entry.card),
                          }}
                          onClick={() =>
                            setDetailCard({
                              ...preview,
                              image: preview.image ?? getCardImage(entry.card),
                            })
                          }
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    ) : null

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <div className="text-center">
        <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--color-mtg-gold)]">
          Shop
        </h2>
        <p className="mt-1 text-sm text-[var(--color-mtg-muted)]">
          Spend mana on booster packs — Commander or Standard. Each pack has {CARDS_PER_PACK}{' '}
          random legal cards with 1 foil guaranteed.
        </p>
      </div>

      {reveal && (
        <div ref={revealRef} className="scroll-mt-24">
          {revealPanel}
        </div>
      )}

      <div className="flex flex-col items-center gap-6">
        <ManaDisplay large />

        <div className="grid w-full gap-4 sm:grid-cols-2">
          <ShopProduct
            artId="commander-pack"
            title="Commander Pack"
            bullets={[
              `${CARDS_PER_PACK} random Commander-legal cards`,
              '1 foil guaranteed',
              '5% chance pack foil is Ultrafoil',
              'Max 2 rares/mythics per pack',
              'No duplicate non-foils',
            ]}
            cost={BOOSTER_COST}
            canAfford={mana >= BOOSTER_COST}
            disabled={shopDisabled || !!cardPoolError}
            busy={opening}
            busyLabel="Opening…"
            needMore={`Need ${BOOSTER_COST - mana} more mana`}
            onBuy={() => void handleOpenPack()}
          />
          <ShopProduct
            artId="standard-pack"
            title="Standard Pack"
            bullets={[
              `${CARDS_PER_PACK} random Standard-legal cards`,
              '1 foil guaranteed',
              '5% chance pack foil is Ultrafoil',
              'Max 2 rares/mythics per pack',
              'No duplicate non-foils',
            ]}
            cost={STANDARD_BOOSTER_COST}
            canAfford={mana >= STANDARD_BOOSTER_COST}
            disabled={shopDisabled || !!standardPoolError}
            busy={opening}
            busyLabel="Opening…"
            needMore={`Need ${STANDARD_BOOSTER_COST - mana} more mana`}
            onBuy={() => void handleOpenStandardPack()}
          />
          <ShopProduct
            artId="commander-box"
            title="Commander Box"
            bullets={[
              `${PACKS_PER_BOX} booster packs (${PACKS_PER_BOX * CARDS_PER_PACK} cards total)`,
              '1 foil guaranteed per pack',
              '5% chance pack foil is Ultrafoil',
              'Max 2 rares/mythics per pack',
              'Best value — save 10 mana vs singles',
            ]}
            cost={BOOSTER_BOX_COST}
            canAfford={mana >= BOOSTER_BOX_COST}
            disabled={shopDisabled || !!cardPoolError}
            busy={opening}
            busyLabel="Opening…"
            needMore={`Need ${BOOSTER_BOX_COST - mana} more mana`}
            onBuy={() => void handleOpenBox()}
          />
          <ShopProduct
            artId="standard-box"
            title="Standard Box"
            bullets={[
              `${PACKS_PER_BOX} Standard packs (${PACKS_PER_BOX * CARDS_PER_PACK} cards total)`,
              '1 foil guaranteed per pack',
              '5% chance pack foil is Ultrafoil',
              'Max 2 rares/mythics per pack',
              'Best value — save 10 mana vs singles',
            ]}
            cost={STANDARD_BOOSTER_BOX_COST}
            canAfford={mana >= STANDARD_BOOSTER_BOX_COST}
            disabled={shopDisabled || !!standardPoolError}
            busy={opening}
            busyLabel="Opening…"
            needMore={`Need ${STANDARD_BOOSTER_BOX_COST - mana} more mana`}
            onBuy={() => void handleOpenStandardBox()}
          />
        </div>

        {cardPoolError && <p className="text-xs text-red-400">{cardPoolError}</p>}
        {standardPoolError && <p className="text-xs text-red-400">{standardPoolError}</p>}
        {rarityMapError && <p className="text-xs text-red-400">{rarityMapError}</p>}
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>

      {detailCard && (
        <CardDetailModal card={detailCard} onClose={() => setDetailCard(null)} />
      )}
    </div>
  )
}
