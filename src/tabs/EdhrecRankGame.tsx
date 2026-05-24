import { useCallback, useEffect, useState } from 'react'
import { useGame } from '../context/GameContext'
import { loadCardDatabase } from '../lib/card-db'
import {
  buildRankGuessPool,
  formatEdhrecRank,
  morePopularCard,
  pickRankPair,
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

function CardChoice({
  card,
  side,
  disabled,
  onPick,
  highlight,
}: {
  card: RankPair['left']
  side: 'left' | 'right'
  disabled: boolean
  onPick: (side: 'left' | 'right') => void
  highlight?: 'correct' | 'wrong' | 'dim'
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
            EDHREC {formatEdhrecRank(card.edhrec_rank)}
          </p>
        )}
      </div>
    </button>
  )
}

export function EdhrecRankGame() {
  const { awardMinigameMana, minigameManaRemainingToday } = useGame()
  const manaRemaining = minigameManaRemainingToday('edhrec-rank')
  const [pool, setPool] = useState<CardRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [pair, setPair] = useState<RankPair | null>(null)
  const [phase, setPhase] = useState<Phase>('question')
  const [picked, setPicked] = useState<'left' | 'right' | null>(null)
  const [sessionCorrect, setSessionCorrect] = useState(0)
  const [sessionWrong, setSessionWrong] = useState(0)
  const [justEarnedMana, setJustEarnedMana] = useState(false)
  const [atDailyCap, setAtDailyCap] = useState(false)

  useEffect(() => {
    let cancelled = false
    loadCardDatabase()
      .then((db) => {
        if (cancelled) return
        setPool(buildRankGuessPool(db.cards))
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
    if (!loading && pool.length >= 2 && !pair) {
      setPair(pickRankPair(pool))
    }
  }, [loading, pool, pair])

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

      if (manaRemaining <= 0) {
        setAtDailyCap(true)
        return
      }

      const awarded = awardMinigameMana('edhrec-rank', RANK_GUESS_MANA_PER_CORRECT)
      if (awarded > 0) {
        setJustEarnedMana(true)
      } else {
        setAtDailyCap(true)
      }
    },
    [phase, pair, manaRemaining, awardMinigameMana],
  )

  if (loading) return <MinigameLoading />
  if (loadError) return <MinigameError message={loadError} />
  if (pool.length < 2) {
    return <MinigameError message="Not enough ranked commanders in the database." />
  }
  if (!pair) return <MinigameLoading />

  const winner = morePopularCard(pair.left, pair.right)
  const isCorrect = picked != null && (picked === 'left' ? pair.left : pair.right).id === winner.id
  const manaEarnedToday = MINIGAME_DAILY_MANA_CAP - manaRemaining

  const leftHighlight =
    phase === 'revealed'
      ? pair.left.id === winner.id
        ? 'correct'
        : picked === 'left'
          ? 'wrong'
          : 'dim'
      : undefined
  const rightHighlight =
    phase === 'revealed'
      ? pair.right.id === winner.id
        ? 'correct'
        : picked === 'right'
          ? 'wrong'
          : 'dim'
      : undefined

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="text-center">
        <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--color-mtg-gold)]">
          Higher/Lower
        </h2>
        <p className="mt-1 text-sm text-[var(--color-mtg-muted)]">
          Which commander is more popular? Higher rank wins.
        </p>
        <p className="mt-1 text-sm text-[var(--color-mtg-muted)]">
          +{RANK_GUESS_MANA_PER_CORRECT} mana per correct answer, up to {MINIGAME_DAILY_MANA_CAP}{' '}
          mana per day for this game.
        </p>
      </div>

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
            {manaEarnedToday}/{MINIGAME_DAILY_MANA_CAP}
          </p>
        </div>
      </div>

      {manaRemaining <= 0 && (
        <p className="rounded-lg border border-[var(--color-mtg-border)] bg-[var(--color-mtg-panel)] px-4 py-3 text-center text-sm text-[var(--color-mtg-muted)]">
          Daily mana cap reached — keep playing for practice. Resets tomorrow.
        </p>
      )}

      <p className="text-center text-sm font-medium text-white">
        {phase === 'question'
          ? 'Tap the commander with the higher rank'
          : 'Rank reveal'}
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <CardChoice
          card={pair.left}
          side="left"
          disabled={phase === 'revealed'}
          onPick={handlePick}
          highlight={leftHighlight}
        />
        <CardChoice
          card={pair.right}
          side="right"
          disabled={phase === 'revealed'}
          onPick={handlePick}
          highlight={rightHighlight}
        />
      </div>

      {phase === 'revealed' && (
        <div
          className={`rounded-lg border p-4 ${
            isCorrect
              ? 'border-green-500/40 bg-green-500/10'
              : 'border-red-500/40 bg-red-500/10'
          }`}
        >
          <p className={`font-semibold ${isCorrect ? 'text-green-300' : 'text-red-300'}`}>
            {isCorrect ? 'Correct!' : 'Incorrect'}
            {isCorrect && justEarnedMana && ` — +${RANK_GUESS_MANA_PER_CORRECT} mana!`}
            {isCorrect && atDailyCap && ' — daily cap reached, no mana earned.'}
          </p>
          <p className="mt-2 text-sm text-[var(--color-mtg-muted)]">
            {pair.left.name} ({formatEdhrecRank(pair.left.edhrec_rank)}) vs {pair.right.name} (
            {formatEdhrecRank(pair.right.edhrec_rank)}). More popular:{' '}
            <span className="text-white">{winner.name}</span>.
          </p>
          <button
            type="button"
            onClick={advanceRound}
            className="mt-4 w-full rounded-lg bg-[var(--color-mtg-gold)] py-2.5 text-sm font-semibold text-black transition hover:brightness-110"
          >
            Next round
          </button>
        </div>
      )}
    </div>
  )
}
