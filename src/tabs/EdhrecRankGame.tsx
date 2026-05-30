import { useCallback, useEffect, useMemo, useState } from 'react'
import { useGame } from '../context/GameContext'
import { loadCommanderRankPool, loadMinigamePool } from '../lib/card-db'
import {
  buildCardRankPool,
  buildCommanderRankPool,
  formatEdhrecRank,
  modeDescription,
  modePoolCaption,
  modePrompt,
  morePopularCard,
  pickRankPair,
  poolTooSmallMessage,
  rankLabel,
  type RankGameMode,
  type RankPair,
} from '../lib/edhrec-rank-game'
import type { CardRecord } from '../types/card'
import {
  MINIGAME_DAILY_MANA_CAP,
  RANK_GUESS_MANA_PER_CORRECT,
} from '../types/game'
import {
  getCardImage,
  MinigameError,
  MinigameLoading,
} from './minigame-shared'

type Phase = 'question' | 'revealed'

function RankModeToggle({
  mode,
  onSwitch,
  commanderCount,
  cardCount,
}: {
  mode: RankGameMode
  onSwitch: (mode: RankGameMode) => void
  commanderCount: number
  cardCount: number
}) {
  return (
    <>
      <div className="mt-4 inline-flex rounded-lg border border-[var(--color-mtg-border)] p-1">
        <button
          type="button"
          onClick={() => onSwitch('commanders')}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
            mode === 'commanders'
              ? 'bg-[var(--color-mtg-gold)] text-black'
              : 'text-[var(--color-mtg-muted)] hover:text-white'
          }`}
        >
          Commanders
        </button>
        <button
          type="button"
          onClick={() => onSwitch('cards')}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
            mode === 'cards'
              ? 'bg-[var(--color-mtg-gold)] text-black'
              : 'text-[var(--color-mtg-muted)] hover:text-white'
          }`}
        >
          Cards
        </button>
      </div>
      <p className="mt-2 text-xs text-[var(--color-mtg-muted)]">
        {modePoolCaption(mode, mode === 'commanders' ? commanderCount : cardCount)}
      </p>
    </>
  )
}

function CardChoice({
  card,
  side,
  disabled,
  onPick,
  highlight,
  rankPrefix,
}: {
  card: RankPair['left']
  side: 'left' | 'right'
  disabled: boolean
  onPick: (side: 'left' | 'right') => void
  highlight?: 'correct' | 'wrong' | 'dim'
  rankPrefix: string
}) {
  const image = getCardImage(card)
  let style =
    'border-[var(--color-mtg-border)] bg-[var(--color-mtg-panel)] hover:border-[var(--color-mtg-gold-dim)]'
  if (highlight === 'correct') style = 'border-green-500/60 bg-green-500/10'
  if (highlight === 'wrong') style = 'border-red-500/60 bg-red-500/10'
  if (highlight === 'dim') style = 'border-[var(--color-mtg-border)] opacity-50'

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onPick(side)}
      className={`flex flex-col overflow-hidden rounded-xl border transition disabled:cursor-default ${style}`}
    >
      <div className="aspect-[5/7] w-full overflow-hidden bg-black/40">
        {image ? (
          <img src={image} alt="" className="h-full w-full object-cover object-top" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-[var(--color-mtg-muted)]">
            No image
          </div>
        )}
      </div>
      <div className="p-3 text-left">
        <p className="line-clamp-2 text-sm font-semibold text-white">{card.name}</p>
        {highlight && highlight !== 'dim' && (
          <p className="mt-1 text-xs text-[var(--color-mtg-muted)]">
            {rankPrefix} {formatEdhrecRank(card.edhrec_rank)}
          </p>
        )}
      </div>
    </button>
  )
}

export function EdhrecRankGame() {
  const { awardMinigameMana, minigameManaRemainingToday } = useGame()
  const manaRemaining = minigameManaRemainingToday('edhrec-rank')
  const [allCards, setAllCards] = useState<CardRecord[]>([])
  const [allCommanders, setAllCommanders] = useState<CardRecord[]>([])
  const [mode, setMode] = useState<RankGameMode>('cards')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [pair, setPair] = useState<RankPair | null>(null)
  const [phase, setPhase] = useState<Phase>('question')
  const [picked, setPicked] = useState<'left' | 'right' | null>(null)
  const [sessionCorrect, setSessionCorrect] = useState(0)
  const [sessionWrong, setSessionWrong] = useState(0)
  const [justEarnedMana, setJustEarnedMana] = useState(false)
  const [atDailyCap, setAtDailyCap] = useState(false)

  const commanderPool = useMemo(
    () => buildCommanderRankPool(allCommanders),
    [allCommanders],
  )
  const cardPool = useMemo(() => buildCardRankPool(allCards), [allCards])
  const pool = mode === 'commanders' ? commanderPool : cardPool
  const rankPrefix = rankLabel(mode)

  useEffect(() => {
    let cancelled = false
    Promise.all([loadMinigamePool(), loadCommanderRankPool()])
      .then(([cards, commanders]) => {
        if (cancelled) return
        setAllCards(cards)
        setAllCommanders(commanders)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setLoadError('Could not load card database.')
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!loading && pool.length >= 2) {
      setPair(pickRankPair(pool))
      setPhase('question')
      setPicked(null)
      setJustEarnedMana(false)
      setAtDailyCap(false)
    } else {
      setPair(null)
    }
  }, [loading, pool, mode])

  const handleModeSwitch = useCallback((next: RankGameMode) => {
    setMode(next)
    setSessionCorrect(0)
    setSessionWrong(0)
  }, [])

  const advanceRound = useCallback(() => {
    if (pool.length < 2) return
    setPair((prev) => pickRankPair(pool, prev ?? undefined))
    setPhase('question')
    setPicked(null)
    setJustEarnedMana(false)
    setAtDailyCap(false)
  }, [pool])

  const handlePick = useCallback(
    (side: 'left' | 'right') => {
      if (phase !== 'question' || !pair) return

      setPicked(side)
      setPhase('revealed')

      const winner = morePopularCard(pair.left, pair.right)
      const correct = (side === 'left' ? pair.left : pair.right).id === winner.id

      if (!correct) {
        setSessionWrong((w) => w + 1)
        return
      }

      setSessionCorrect((c) => c + 1)

      const awarded = awardMinigameMana('edhrec-rank', RANK_GUESS_MANA_PER_CORRECT)
      if (awarded > 0) {
        setJustEarnedMana(true)
      } else {
        setAtDailyCap(true)
      }
    },
    [phase, pair, awardMinigameMana],
  )

  if (loading) return <MinigameLoading />
  if (loadError) return <MinigameError message={loadError} />
  if (commanderPool.length < 2 && cardPool.length < 2) {
    return <MinigameError message="Not enough ranked cards in the database." />
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="text-center">
        <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--color-mtg-gold)]">
          Higher/Lower
        </h2>
        <p className="mt-1 text-sm text-[var(--color-mtg-muted)]">{modeDescription(mode)}</p>
        <p className="mt-1 text-sm text-[var(--color-mtg-muted)]">
          +{RANK_GUESS_MANA_PER_CORRECT} mana per correct answer, up to {MINIGAME_DAILY_MANA_CAP}{' '}
          mana per day for this game.
        </p>
        <RankModeToggle
          mode={mode}
          onSwitch={handleModeSwitch}
          commanderCount={commanderPool.length}
          cardCount={cardPool.length}
        />
      </div>

      {pool.length < 2 ? (
        <MinigameError message={poolTooSmallMessage(mode)} />
      ) : pair ? (
        <>
          <div className="grid grid-cols-3 gap-3 text-center text-sm">
            <div className="rounded-lg border border-[var(--color-mtg-border)] bg-[var(--color-mtg-panel)] p-3">
              <p className="text-xs uppercase tracking-wide text-[var(--color-mtg-muted)]">Correct</p>
              <p className="text-xl font-bold text-green-400">{sessionCorrect}</p>
            </div>
            <div className="rounded-lg border border-[var(--color-mtg-border)] bg-[var(--color-mtg-panel)] p-3">
              <p className="text-xs uppercase tracking-wide text-[var(--color-mtg-muted)]">Wrong</p>
              <p className="text-xl font-bold text-red-400">{sessionWrong}</p>
            </div>
            <div
              className={`rounded-lg border bg-[var(--color-mtg-panel)] p-3 transition ${
                manaRemaining <= 0
                  ? 'border-[var(--color-mtg-border)] opacity-80'
                  : 'border-[var(--color-mana-u)]/40'
              }`}
            >
              <p className="text-xs uppercase tracking-wide text-[var(--color-mtg-muted)]">
                Mana today
              </p>
              <p className="text-xl font-bold text-[var(--color-mana-u)]">
                {MINIGAME_DAILY_MANA_CAP - manaRemaining}/{MINIGAME_DAILY_MANA_CAP}
              </p>
            </div>
          </div>

          {manaRemaining <= 0 && (
            <p className="rounded-lg border border-[var(--color-mtg-border)] bg-[var(--color-mtg-panel)] px-4 py-3 text-center text-sm text-[var(--color-mtg-muted)]">
              Daily mana cap reached — keep playing for practice. Resets tomorrow.
            </p>
          )}

          <p className="text-center text-sm font-medium text-white">
            {phase === 'question' ? modePrompt(mode) : 'Rank reveal'}
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <CardChoice
              card={pair.left}
              side="left"
              disabled={phase === 'revealed'}
              onPick={handlePick}
              rankPrefix={rankPrefix}
              highlight={
                phase === 'revealed'
                  ? pair.left.id === morePopularCard(pair.left, pair.right).id
                    ? 'correct'
                    : picked === 'left'
                      ? 'wrong'
                      : 'dim'
                  : undefined
              }
            />
            <CardChoice
              card={pair.right}
              side="right"
              disabled={phase === 'revealed'}
              onPick={handlePick}
              rankPrefix={rankPrefix}
              highlight={
                phase === 'revealed'
                  ? pair.right.id === morePopularCard(pair.left, pair.right).id
                    ? 'correct'
                    : picked === 'right'
                      ? 'wrong'
                      : 'dim'
                  : undefined
              }
            />
          </div>

          {phase === 'revealed' && (
            <RankReveal
              pair={pair}
              rankPrefix={rankPrefix}
              picked={picked}
              justEarnedMana={justEarnedMana}
              atDailyCap={atDailyCap}
              onNext={advanceRound}
            />
          )}
        </>
      ) : (
        <MinigameLoading />
      )}
    </div>
  )
}

function RankReveal({
  pair,
  rankPrefix,
  picked,
  justEarnedMana,
  atDailyCap,
  onNext,
}: {
  pair: RankPair
  rankPrefix: string
  picked: 'left' | 'right' | null
  justEarnedMana: boolean
  atDailyCap: boolean
  onNext: () => void
}) {
  const winner = morePopularCard(pair.left, pair.right)
  const isCorrect =
    picked != null && (picked === 'left' ? pair.left : pair.right).id === winner.id

  return (
    <div
      className={`rounded-lg border p-4 ${
        isCorrect ? 'border-green-500/40 bg-green-500/10' : 'border-red-500/40 bg-red-500/10'
      }`}
    >
      <p className={`font-semibold ${isCorrect ? 'text-green-300' : 'text-red-300'}`}>
        {isCorrect ? 'Correct!' : 'Incorrect'}
        {isCorrect && justEarnedMana && ` — +${RANK_GUESS_MANA_PER_CORRECT} mana!`}
        {isCorrect && atDailyCap && ' — daily cap reached, no mana earned.'}
      </p>
      <p className="mt-2 text-sm text-[var(--color-mtg-muted)]">
        {pair.left.name} ({rankPrefix} {formatEdhrecRank(pair.left.edhrec_rank)}) vs {pair.right.name}{' '}
        ({rankPrefix} {formatEdhrecRank(pair.right.edhrec_rank)}). More popular:{' '}
        <span className="text-white">{winner.name}</span>.
      </p>
      <button
        type="button"
        onClick={onNext}
        className="mt-4 w-full rounded-lg bg-[var(--color-mtg-gold)] py-2.5 text-sm font-semibold text-black transition hover:brightness-110"
      >
        Next round
      </button>
    </div>
  )
}
