import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { getMostPopularPrintingArt } from '../api/scryfall'
import { useGame } from '../context/GameContext'
import { suggestCardNames } from '../lib/card-name-resolve'
import { canonicalNameKey } from '../lib/card-names'
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
  buildPool,
  getCardImage,
  isCorrectGuess,
  pickRandomCard,
  useMinigamePools,
  type GameMode,
  type GamePhase,
} from './minigame-shared'

/** Percent of art visible per wrong guess — higher start = less zoomed in. */
const REVEAL_LEVELS = [22, 34, 48, 62, 78]

type RoundState = {
  card: CardRecord
  focalX: number
  focalY: number
  wrongGuesses: number
  guesses: string[]
  phase: GamePhase
  artImage?: string
  manaAwarded?: boolean
  manaEarned?: number
}

function getArtZoomImage(card: CardRecord): string | undefined {
  const image = getCardImage(card)
  return image ? toArtCropUrl(image) : undefined
}

function toArtCropUrl(image: string): string {
  if (image.includes('/art_crop/')) return image
  return image.replace(/\/(normal|large|png|small)\//, '/art_crop/')
}

function clampFocal(x: number, y: number, revealPct: number): { x: number; y: number } {
  const half = revealPct / 2
  return {
    x: Math.max(half, Math.min(100 - half, x)),
    y: Math.max(half, Math.min(100 - half, y)),
  }
}

function newRound(pool: CardRecord[], previous?: CardRecord): RoundState {
  const card = pickRandomCard(pool, previous)
  return {
    card,
    focalX: 20 + Math.random() * 60,
    focalY: 30 + Math.random() * 40,
    wrongGuesses: 0,
    guesses: [],
    phase: 'playing',
    artImage: getArtZoomImage(card),
  }
}

const popularArtCache = new Map<string, string | undefined>()

async function resolvePopularArt(card: CardRecord): Promise<string | undefined> {
  const key = canonicalNameKey(card.name)
  if (popularArtCache.has(key)) return popularArtCache.get(key)

  const remote = await getMostPopularPrintingArt(card.name)
  const raw = remote?.image ?? getCardImage(card)
  const image = raw ? toArtCropUrl(raw) : undefined
  popularArtCache.set(key, image)
  return image
}

function getRevealPercent(round: RoundState): number {
  if (round.phase === 'won' || round.phase === 'lost') return 100
  return REVEAL_LEVELS[Math.min(round.wrongGuesses, REVEAL_LEVELS.length - 1)]
}

function artBackgroundStyle(
  image: string,
  revealPct: number,
  focalX: number,
  focalY: number,
): CSSProperties {
  const zoom = 100 / revealPct
  const focal = clampFocal(focalX, focalY, revealPct)

  return {
    backgroundImage: `url(${image})`,
    backgroundSize: `${zoom * 100}%`,
    backgroundPosition: `${focal.x}% ${focal.y}%`,
    backgroundRepeat: 'no-repeat',
  }
}

export function ArtGuessGame() {
  const { awardMinigameMana } = useGame()
  const { allCards, easyPool, loading, loadError } = useMinigamePools(buildPool)
  const [mode, setMode] = useState<GameMode>('easy')
  const [round, setRound] = useState<RoundState | null>(null)
  const [guess, setGuess] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [streak, setStreak] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const roundIdRef = useRef(0)

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
      const awarded = awardMinigameMana('art-guess', manaRewardForAttempt(round.guesses.length))
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

  const loadRoundArt = useCallback(async (roundState: RoundState) => {
    const roundId = ++roundIdRef.current
    const localArt = getArtZoomImage(roundState.card)

    const popularArt = await Promise.race([
      resolvePopularArt(roundState.card),
      new Promise<string | undefined>((resolve) => {
        setTimeout(() => resolve(undefined), 5000)
      }),
    ])
    if (roundId !== roundIdRef.current || !popularArt || popularArt === localArt) return

    setRound((prev: RoundState | null) =>
      prev?.card.id === roundState.card.id
        ? { ...prev, artImage: popularArt }
        : prev,
    )
  }, [])

  useEffect(() => {
    if (!round) return
    void loadRoundArt(round)
  }, [round?.card.id, loadRoundArt])

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
        wrongGuesses: round.wrongGuesses + 1,
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

  const image = getCardImage(round.card)
  if (!image) {
    return <MinigameError message="No card art available for this round." />
  }

  const guessesLeft = MAX_GUESSES - round.guesses.length
  const revealPct = getRevealPercent(round)
  const artImage = round.artImage
  const hintCount = round.phase === 'playing' ? round.guesses.length : 0

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <div className="text-center">
        <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--color-mtg-gold)]">
          Art Guess
        </h2>
        <p className="mt-1 text-sm text-[var(--color-mtg-muted)]">
          Name the card from a zoomed-in art crop. {GUESS_MANA_REWARD_LABEL} (up to {MAX_GUESSES}{' '}
          tries).
        </p>
        <ModeToggle mode={mode} onSwitch={switchMode} easyCount={easyPool.length} />
      </div>

      <GuessesAndStreak guessesLeft={guessesLeft} streak={streak} />

      <div
        className={`relative aspect-[5/4] w-full overflow-hidden rounded-xl border-2 shadow-lg transition-colors ${
          round.phase === 'won'
            ? 'border-green-500/70'
            : round.phase === 'lost'
              ? 'border-red-500/70'
              : 'border-[var(--color-mtg-gold-dim)]'
        } ${!artImage ? 'bg-[var(--color-mtg-panel)]' : ''}`}
        style={
          artImage
            ? artBackgroundStyle(artImage, revealPct, round.focalX, round.focalY)
            : undefined
        }
        role="img"
        aria-label="Zoomed card art"
      />

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
          onNext={startNextRound}
          manaReward={round.manaEarned ?? 0}
        />
      )}

      {round.phase === 'lost' && (
        <LoseBanner
          cardName={round.card.name}
          image={toArtCropUrl(artImage ?? image)}
          onNext={startNextRound}
        />
      )}
    </div>
  )
}
