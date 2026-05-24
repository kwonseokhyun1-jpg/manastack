import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useGame } from '../context/GameContext'
import { suggestCardNames } from '../lib/card-name-resolve'
import { GUESS_MANA_REWARD_LABEL, manaRewardForAttempt } from '../types/game'
import type { CardRecord } from '../types/card'
import {
  CardHints,
  GuessForm,
  GuessHistory,
  GuessesAndStreak,
  LoseBanner,
  MAX_GUESSES,
  MinigameError,
  MinigameLoading,
  ModeToggle,
  WinBanner,
  buildUnscramblePool,
  getCardImage,
  isCorrectGuess,
  pickRandomCard,
  scrambleName,
  useMinigamePools,
  type GameMode,
  type GamePhase,
} from './minigame-shared'

type RoundState = {
  card: CardRecord
  scrambled: string
  guesses: string[]
  phase: GamePhase
  manaAwarded?: boolean
  manaEarned?: number
}

function newRound(pool: CardRecord[], previous?: CardRecord): RoundState {
  const card = pickRandomCard(pool, previous)
  return {
    card,
    scrambled: scrambleName(card.name),
    guesses: [],
    phase: 'playing',
  }
}

export function UnscrambleGame() {
  const { awardMinigameMana } = useGame()
  const { allCards, easyPool, loading, loadError } = useMinigamePools(buildUnscramblePool)
  const [mode, setMode] = useState<GameMode>('easy')
  const [round, setRound] = useState<RoundState | null>(null)
  const [guess, setGuess] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [streak, setStreak] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const pool = useMemo(
    () => (mode === 'easy' ? easyPool : allCards),
    [mode, easyPool, allCards],
  )

  useEffect(() => {
    if (!loading && easyPool.length > 0 && !round) {
      setRound(newRound(easyPool))
    }
  }, [loading, easyPool, round])

  useEffect(() => {
    if (round?.phase === 'won' && !round.manaAwarded) {
      const awarded = awardMinigameMana('unscramble', manaRewardForAttempt(round.guesses.length))
      setRound((prev) =>
        prev ? { ...prev, manaAwarded: true, manaEarned: awarded } : prev,
      )
    }
  }, [round?.phase, round?.manaAwarded, round?.guesses.length, awardMinigameMana])

  const switchMode = useCallback(
    (next: GameMode) => {
      if (next === mode) return
      const nextPool = next === 'easy' ? easyPool : allCards
      if (nextPool.length === 0) return
      setMode(next)
      setStreak(0)
      setGuess('')
      setShowSuggestions(false)
      setRound(newRound(nextPool))
    },
    [mode, easyPool, allCards],
  )

  const suggestions = useMemo(
    () => (showSuggestions ? suggestCardNames(guess) : []),
    [guess, showSuggestions],
  )

  const startNextRound = useCallback(() => {
    if (pool.length === 0) return
    setRound((prev: RoundState | null) => newRound(pool, prev?.card))
    setGuess('')
    setShowSuggestions(false)
    inputRef.current?.focus()
  }, [pool])

  const submitGuess = useCallback(
    (value?: string) => {
      const trimmed = (value ?? guess).trim()
      if (!trimmed || !round || round.phase !== 'playing') return

      setShowSuggestions(false)
      setGuess('')

      if (isCorrectGuess(trimmed, round.card)) {
        setStreak((s: number) => s + 1)
        setRound({ ...round, guesses: [...round.guesses, trimmed], phase: 'won' })
        return
      }

      const nextGuesses = [...round.guesses, trimmed]
      const exhausted = nextGuesses.length >= MAX_GUESSES
      setRound({
        ...round,
        guesses: nextGuesses,
        phase: exhausted ? 'lost' : 'playing',
      })
      if (exhausted) setStreak(0)
    },
    [guess, round],
  )

  if (loading) return <MinigameLoading />

  if (loadError) return <MinigameError message={loadError} />

  if (pool.length === 0) {
    return <MinigameError message="No cards available." />
  }

  if (!round) return <MinigameLoading />

  const guessesLeft = MAX_GUESSES - round.guesses.length
  const hintCount = round.phase === 'playing' ? round.guesses.length : 0
  const image = getCardImage(round.card)

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <div className="text-center">
        <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--color-mtg-gold)]">
          Unscramble
        </h2>
        <p className="mt-1 text-sm text-[var(--color-mtg-muted)]">
          Unscramble the card name. {GUESS_MANA_REWARD_LABEL} (up to {MAX_GUESSES} tries).
        </p>
        <ModeToggle mode={mode} onSwitch={switchMode} easyCount={easyPool.length} />
      </div>

      <GuessesAndStreak guessesLeft={guessesLeft} streak={streak} />

      <div
        className={`flex min-h-[8rem] items-center justify-center rounded-xl border-2 px-6 py-8 shadow-lg transition-colors ${
          round.phase === 'won'
            ? 'border-green-500/70 bg-green-500/5'
            : round.phase === 'lost'
              ? 'border-red-500/70 bg-red-500/5'
              : 'border-[var(--color-mtg-gold-dim)] bg-[var(--color-mtg-panel)]'
        }`}
      >
        <p
          className="text-center font-[family-name:var(--font-display)] text-2xl font-bold tracking-wide text-white sm:text-3xl"
          aria-label="Scrambled card name"
        >
          {round.scrambled}
        </p>
      </div>

      {hintCount > 0 && <CardHints card={round.card} guessCount={hintCount} />}

      {round.phase === 'playing' && (
        <GuessForm
          guess={guess}
          suggestions={suggestions}
          onGuessChange={setGuess}
          onShowSuggestions={setShowSuggestions}
          onSubmit={submitGuess}
          inputRef={inputRef}
        />
      )}

      <GuessHistory guesses={round.guesses} won={round.phase === 'won'} />

      {round.phase === 'won' && (
        <WinBanner
          cardName={round.card.name}
          image={image}
          onNext={startNextRound}
          manaReward={round.manaEarned ?? 0}
        />
      )}

      {round.phase === 'lost' && (
        <LoseBanner cardName={round.card.name} image={image} onNext={startNextRound} />
      )}
    </div>
  )
}
