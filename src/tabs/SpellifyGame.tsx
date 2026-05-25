import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { SpellifyCardFace, SpellifyGuessTable } from '../components/SpellifyCard'
import { SpellifyKeyboard } from '../components/SpellifyKeyboard'
import { useGame } from '../context/GameContext'
import { loadMinigamePool } from '../lib/card-db'
import { suggestCardNames } from '../lib/card-name-resolve'
import { getCardImage } from '../lib/card-utils'
import { getAllStaples } from '../lib/staples'
import {
  buildSpellifyPool,
  guessHitsCard,
  normalizeGuessKey,
  SPELLIFY_MAX_GUESSES,
  type GuessEntry,
} from '../lib/spellify-engine'
import { SPELLIFY_HARD_MANA_REWARD_LABEL, SPELLIFY_MANA_REWARD_LABEL, spellifyManaReward } from '../types/game'
import type { CardRecord } from '../types/card'
import {
  isCorrectGuess,
  LoseBanner,
  MinigameError,
  MinigameLoading,
  pickRandomCard,
  SuggestionList,
  WinBanner,
  type GameMode,
  type GamePhase,
} from './minigame-shared'

type RoundState = {
  card: CardRecord
  guesses: GuessEntry[]
  successfulGuesses: Set<string>
  triedGuesses: Set<string>
  phase: GamePhase
  manaAwarded?: boolean
  manaEarned?: number
}

function newRound(pool: CardRecord[], previous?: CardRecord): RoundState {
  return {
    card: pickRandomCard(pool, previous),
    guesses: [],
    successfulGuesses: new Set(),
    triedGuesses: new Set(),
    phase: 'playing',
  }
}

function SpellifyModeToggle({
  mode,
  onSwitch,
}: {
  mode: GameMode
  onSwitch: (mode: GameMode) => void
}) {
  return (
    <div className="mt-4 inline-flex rounded-md border border-neutral-300 bg-neutral-50 p-0.5">
      <button
        type="button"
        onClick={() => onSwitch('easy')}
        className={`rounded px-3 py-1.5 text-sm font-medium transition ${
          mode === 'easy'
            ? 'bg-white text-neutral-900 shadow-sm'
            : 'text-neutral-500 hover:text-neutral-800'
        }`}
      >
        Easy
      </button>
      <button
        type="button"
        onClick={() => onSwitch('hard')}
        className={`rounded px-3 py-1.5 text-sm font-medium transition ${
          mode === 'hard'
            ? 'bg-white text-neutral-900 shadow-sm'
            : 'text-neutral-500 hover:text-neutral-800'
        }`}
      >
        Hard
      </button>
    </div>
  )
}

export function SpellifyGame() {
  const { awardMinigameMana } = useGame()
  const [allCards, setAllCards] = useState<CardRecord[]>([])
  const [easyPool, setEasyPool] = useState<CardRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [mode, setMode] = useState<GameMode>('easy')
  const [round, setRound] = useState<RoundState | null>(null)
  const [showNameGuess, setShowNameGuess] = useState(false)
  const [nameGuess, setNameGuess] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    loadMinigamePool()
      .then((cards) => {
        if (cancelled) return
        const eligible = buildSpellifyPool(cards)
        setAllCards(eligible)
        setEasyPool(buildSpellifyPool(getAllStaples(cards)))
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
      const awarded = awardMinigameMana(
        'spellify',
        spellifyManaReward(round.guesses.length, mode === 'hard'),
      )
      setRound((prev) =>
        prev ? { ...prev, manaAwarded: true, manaEarned: awarded } : prev,
      )
    }
  }, [round?.phase, round?.manaAwarded, round?.guesses.length, mode, awardMinigameMana])

  const switchMode = useCallback(
    (next: GameMode) => {
      if (next === mode) return
      const nextPool = next === 'easy' ? easyPool : allCards
      if (nextPool.length === 0) return
      setMode(next)
      setShowNameGuess(false)
      setNameGuess('')
      setRound(newRound(nextPool))
    },
    [mode, easyPool, allCards],
  )

  const guessesLeft = round ? SPELLIFY_MAX_GUESSES - round.guesses.length : SPELLIFY_MAX_GUESSES

  const submitCharacterGuess = useCallback(
    (rawGuess: string) => {
      if (!round || round.phase !== 'playing' || guessesLeft <= 0) return

      const key = normalizeGuessKey(rawGuess)
      if (!key || round.triedGuesses.has(key)) return

      const hit = guessHitsCard(round.card, rawGuess)
      const nextTried = new Set(round.triedGuesses)
      nextTried.add(key)

      const nextSuccessful = new Set(round.successfulGuesses)
      if (hit) nextSuccessful.add(key)

      const nextGuesses: GuessEntry[] = [...round.guesses, { guess: rawGuess, hit }]
      const exhausted = nextGuesses.length >= SPELLIFY_MAX_GUESSES

      setRound({
        ...round,
        guesses: nextGuesses,
        triedGuesses: nextTried,
        successfulGuesses: nextSuccessful,
        phase: exhausted ? 'lost' : 'playing',
      })
    },
    [round, guessesLeft],
  )

  const submitNameGuess = useCallback(
    (value?: string) => {
      const trimmed = (value ?? nameGuess).trim()
      if (!trimmed || !round || round.phase !== 'playing' || guessesLeft <= 0) return

      setShowSuggestions(false)
      setNameGuess('')
      setShowNameGuess(false)

      const correct = isCorrectGuess(trimmed, round.card)
      const nextGuesses: GuessEntry[] = [
        ...round.guesses,
        { guess: trimmed, hit: correct },
      ]
      const exhausted = nextGuesses.length >= SPELLIFY_MAX_GUESSES

      setRound({
        ...round,
        guesses: nextGuesses,
        phase: correct ? 'won' : exhausted ? 'lost' : 'playing',
      })
    },
    [nameGuess, round, guessesLeft],
  )

  const startNextRound = useCallback(() => {
    if (pool.length === 0) return
    setRound((prev) => newRound(pool, prev?.card))
    setShowNameGuess(false)
    setNameGuess('')
  }, [pool])

  useEffect(() => {
    if (!round || round.phase !== 'playing' || showNameGuess || guessesLeft <= 0) return

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return

      if (e.key.length === 1 && /[a-zA-Z0-9]/.test(e.key)) {
        e.preventDefault()
        submitCharacterGuess(e.key)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [round, showNameGuess, guessesLeft, submitCharacterGuess])

  const suggestions = useMemo(
    () => (showSuggestions ? suggestCardNames(nameGuess) : []),
    [nameGuess, showSuggestions],
  )

  if (loading) return <MinigameLoading />

  if (loadError) return <MinigameError message={loadError} />

  if (pool.length === 0) {
    return <MinigameError message="No cards available." />
  }

  if (!round) return <MinigameLoading />

  const image = getCardImage(round.card)
  const hardMode = mode === 'hard'
  const manaReward = round.phase === 'won' ? (round.manaEarned ?? 0) : 0
  const revealed = round.phase === 'won' || round.phase === 'lost'

  return (
    <div className="mx-auto max-w-xl">
      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-[#f3f4f6] shadow-sm">
        <div className="border-b border-neutral-200 bg-white px-5 py-6 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-neutral-900 text-lg font-bold text-white">
            S
          </div>
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight text-neutral-900">
            Spellify
          </h2>
          <p className="mt-1 text-sm italic text-neutral-500">
            Guess letters until you can name the Magic card
          </p>
          <SpellifyModeToggle mode={mode} onSwitch={switchMode} />
          {mode === 'hard' && (
            <p className="mt-2 text-xs text-neutral-500">
              Hard mode hides the mana cost and type line clues.
            </p>
          )}
          <p className="mt-3 text-xs text-neutral-400">
            {SPELLIFY_MAX_GUESSES} tries max · Win rewards:{' '}
            {mode === 'hard' ? SPELLIFY_HARD_MANA_REWARD_LABEL : SPELLIFY_MANA_REWARD_LABEL}
          </p>
        </div>

        <div className="space-y-4 px-4 py-5 sm:px-5">
          <SpellifyCardFace
            card={round.card}
            successfulGuesses={round.successfulGuesses}
            hardMode={hardMode}
            revealed={revealed}
          />

          <SpellifyGuessTable guesses={round.guesses} />

          <div className="flex items-center justify-between gap-3 px-1">
            <p className="text-sm font-medium text-neutral-700">
              {guessesLeft} guess{guessesLeft === 1 ? '' : 'es'} left
            </p>
            {round.phase === 'playing' && (
              <button
                type="button"
                onClick={() => {
                  setShowNameGuess(true)
                  setTimeout(() => inputRef.current?.focus(), 50)
                }}
                disabled={guessesLeft <= 0}
                className="rounded-md border border-emerald-600 px-4 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-40"
              >
                Guess card…
              </button>
            )}
          </div>

          {showNameGuess && round.phase === 'playing' && (
            <form
              className="relative rounded-md border border-neutral-200 bg-white p-4"
              onSubmit={(e) => {
                e.preventDefault()
                submitNameGuess()
              }}
            >
              <input
                ref={inputRef}
                type="text"
                value={nameGuess}
                onChange={(e) => {
                  setNameGuess(e.target.value)
                  setShowSuggestions(true)
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                placeholder="Type the full card name…"
                autoComplete="off"
                className="w-full rounded-md border border-neutral-300 bg-white px-4 py-3 text-neutral-900 placeholder:text-neutral-400 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
              <SuggestionList items={suggestions} onPick={(name) => submitNameGuess(name)} />
              <div className="mt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={!nameGuess.trim()}
                  className="flex-1 rounded-md bg-emerald-600 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-40"
                >
                  Submit name
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowNameGuess(false)
                    setNameGuess('')
                  }}
                  className="rounded-md border border-neutral-300 px-4 py-2.5 text-sm text-neutral-600 hover:bg-neutral-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {round.phase === 'playing' && !showNameGuess && (
            <>
              <p className="text-center text-xs text-neutral-500">
                Type a letter or number on your keyboard, or tap a key below
              </p>
              <SpellifyKeyboard
                usedGuesses={round.triedGuesses}
                disabled={guessesLeft <= 0}
                onGuess={submitCharacterGuess}
              />
            </>
          )}

          {round.phase === 'won' && (
            <WinBanner
              cardName={round.card.name}
              image={image}
              onNext={startNextRound}
              manaReward={manaReward}
            />
          )}

          {round.phase === 'lost' && (
            <LoseBanner cardName={round.card.name} image={image} onNext={startNextRound} />
          )}
        </div>
      </div>
    </div>
  )
}
