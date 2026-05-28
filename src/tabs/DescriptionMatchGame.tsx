import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useGame } from '../context/GameContext'
import { getCardByNameLocal, loadMinigamePool } from '../lib/card-db'
import {
  cardMatchesMission,
  DESCRIPTION_MATCH_MANA_MAX,
  DESCRIPTION_MATCH_TIME_SEC,
  manaRewardForDescriptionMatch,
  pickDescriptionMission,
  type DescriptionMission,
} from '../lib/description-match'
import { suggestCardNames } from '../lib/card-name-resolve'
import { canonicalNameKey } from '../lib/card-names'
import {
  MinigameError,
  MinigameLoading,
  SuggestionList,
} from './minigame-shared'

type Phase = 'playing' | 'won' | 'lost'

type MatchedCard = {
  name: string
  valid: true
}

type WrongGuess = {
  name: string
  reason: string
}

export function DescriptionMatchGame() {
  const { awardMinigameMana } = useGame()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [mission, setMission] = useState<DescriptionMission | null>(null)
  const [phase, setPhase] = useState<Phase>('playing')
  const [timeLeft, setTimeLeft] = useState(DESCRIPTION_MATCH_TIME_SEC)
  const [matched, setMatched] = useState<MatchedCard[]>([])
  const [wrongGuesses, setWrongGuesses] = useState<WrongGuess[]>([])
  const [guess, setGuess] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [manaAwarded, setManaAwarded] = useState(false)
  const [winMana, setWinMana] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const timeLeftRef = useRef(timeLeft)
  const phaseRef = useRef(phase)

  useEffect(() => {
    timeLeftRef.current = timeLeft
  }, [timeLeft])

  useEffect(() => {
    phaseRef.current = phase
  }, [phase])

  const startRound = useCallback((avoidId?: string) => {
    setLoading(true)
    setLoadError(null)
    loadMinigamePool()
      .then((cards) => {
        const next = pickDescriptionMission(cards, avoidId)
        if (!next) {
          setLoadError('Could not build a mission from the card pool.')
          setLoading(false)
          return
        }
        setMission(next)
        setPhase('playing')
        setTimeLeft(DESCRIPTION_MATCH_TIME_SEC)
        setMatched([])
        setWrongGuesses([])
        setGuess('')
        setManaAwarded(false)
        setWinMana(0)
        setLoading(false)
        setTimeout(() => inputRef.current?.focus(), 50)
      })
      .catch(() => {
        setLoadError('Could not load card database.')
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    startRound()
  }, [startRound])

  useEffect(() => {
    if (phase !== 'playing' || !mission) return

    const timer = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer)
          if (phaseRef.current === 'playing') {
            setPhase('lost')
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => window.clearInterval(timer)
  }, [phase, mission?.id])

  useEffect(() => {
    if (phase !== 'won' || manaAwarded || winMana <= 0) return
    const awarded = awardMinigameMana('description-match', winMana)
    setWinMana(awarded)
    setManaAwarded(true)
  }, [phase, manaAwarded, winMana, awardMinigameMana])

  const suggestions = useMemo(
    () => (showSuggestions ? suggestCardNames(guess) : []),
    [guess, showSuggestions],
  )

  const submitGuess = useCallback(
    (value?: string) => {
      const trimmed = (value ?? guess).trim()
      if (!trimmed || !mission || phase !== 'playing') return

      setShowSuggestions(false)
      setGuess('')

      const card = getCardByNameLocal(trimmed)
      if (!card) {
        setWrongGuesses((prev) => [
          { name: trimmed, reason: 'Unknown card name' },
          ...prev.slice(0, 4),
        ])
        return
      }

      const key = canonicalNameKey(card.name)
      if (matched.some((m) => canonicalNameKey(m.name) === key)) {
        setWrongGuesses((prev) => [
          { name: card.name, reason: 'Already listed' },
          ...prev.slice(0, 4),
        ])
        return
      }

      if (!cardMatchesMission(card, mission)) {
        setWrongGuesses((prev) => [
          { name: card.name, reason: 'Does not match the mission' },
          ...prev.slice(0, 4),
        ])
        return
      }

      const nextMatched = [...matched, { name: card.name, valid: true as const }]
      setMatched(nextMatched)

      if (nextMatched.length >= mission.count) {
        const remaining = timeLeftRef.current
        setWinMana(manaRewardForDescriptionMatch(remaining))
        setPhase('won')
      }
    },
    [guess, mission, phase, matched],
  )

  if (loading) return <MinigameLoading />

  if (loadError || !mission) {
    return <MinigameError message={loadError ?? 'No mission available.'} />
  }

  const timerPercent = (timeLeft / DESCRIPTION_MATCH_TIME_SEC) * 100
  const urgent = timeLeft <= 5 && phase === 'playing'

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <div className="text-center">
        <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--color-mtg-gold)]">
          Match the Description
        </h2>
        <p className="mt-1 text-sm text-[var(--color-mtg-muted)]">
          Name cards that fit the mission before time runs out. Up to {DESCRIPTION_MATCH_MANA_MAX}{' '}
          mana — faster wins pay more.
        </p>
      </div>

      <div
        className={`rounded-xl border-2 p-5 text-center transition-colors ${
          phase === 'won'
            ? 'border-green-500/60 bg-green-500/10'
            : phase === 'lost'
              ? 'border-red-500/60 bg-red-500/10'
              : 'border-[var(--color-mtg-gold-dim)] bg-[var(--color-mtg-panel)]'
        }`}
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-mtg-gold)]">
          Mission
        </p>
        <p className="mt-2 font-[family-name:var(--font-display)] text-xl font-bold text-white sm:text-2xl">
          {mission.description}
        </p>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-[var(--color-mtg-muted)]">
            Matched{' '}
            <span className="font-medium text-white">
              {matched.length}/{mission.count}
            </span>
          </span>
          <span
            className={`font-[family-name:var(--font-display)] text-lg font-bold tabular-nums ${
              urgent ? 'text-red-400' : 'text-[var(--color-mana-u)]'
            }`}
          >
            {phase === 'playing' ? `${timeLeft}s` : phase === 'won' ? 'Done!' : "Time's up"}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[var(--color-mtg-border)]">
          <div
            className={`h-full rounded-full transition-all duration-1000 ease-linear ${
              urgent ? 'bg-red-500' : 'bg-[var(--color-mana-u)]'
            }`}
            style={{ width: `${timerPercent}%` }}
          />
        </div>
      </div>

      {matched.length > 0 && (
        <ul className="space-y-2 rounded-lg border border-[var(--color-mtg-border)] bg-[var(--color-mtg-panel)] p-3">
          {matched.map((entry) => (
            <li key={entry.name} className="flex items-center gap-2 text-sm text-white">
              <span className="text-green-400">✓</span>
              {entry.name}
            </li>
          ))}
        </ul>
      )}

      {phase === 'playing' && (
        <form
          className="relative"
          onSubmit={(e) => {
            e.preventDefault()
            submitGuess()
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={guess}
            onChange={(e) => {
              setGuess(e.target.value)
              setShowSuggestions(true)
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            placeholder="Type a card name…"
            autoComplete="off"
            className="w-full rounded-lg border border-[var(--color-mtg-border)] bg-[var(--color-mtg-panel)] px-4 py-3 text-white placeholder:text-[var(--color-mtg-muted)] focus:border-[var(--color-mtg-gold)] focus:outline-none"
          />
          <SuggestionList items={suggestions} onPick={(name) => submitGuess(name)} />
          <button
            type="submit"
            disabled={!guess.trim()}
            className="mt-3 w-full rounded-lg bg-[var(--color-mtg-gold)] py-2.5 text-sm font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Submit
          </button>
        </form>
      )}

      {wrongGuesses.length > 0 && phase === 'playing' && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-red-300/80">
            Recent misses
          </p>
          <ul className="space-y-1 text-sm text-[var(--color-mtg-muted)]">
            {wrongGuesses.map((w) => (
              <li key={`${w.name}-${w.reason}`}>
                {w.name}
                <span className="ml-2 text-red-400/80">— {w.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {phase === 'won' && (
        <div className="rounded-lg border border-green-500/40 bg-green-500/10 p-4 text-center">
          <p className="text-lg font-semibold text-green-300">Mission complete!</p>
          <p className="mt-1 text-sm font-medium text-[var(--color-mana-u)]">+{winMana} mana</p>
          <button
            type="button"
            onClick={() => startRound(mission.id)}
            className="mt-4 rounded-lg bg-[var(--color-mtg-gold)] px-6 py-2 text-sm font-semibold text-black transition hover:brightness-110"
          >
            Next mission
          </button>
        </div>
      )}

      {phase === 'lost' && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-center">
          <p className="text-lg font-semibold text-red-300">Time ran out</p>
          <p className="mt-1 text-sm text-[var(--color-mtg-muted)]">
            You matched {matched.length} of {mission.count}.
          </p>
          <button
            type="button"
            onClick={() => startRound(mission.id)}
            className="mt-4 rounded-lg bg-[var(--color-mtg-gold)] px-6 py-2 text-sm font-semibold text-black transition hover:brightness-110"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  )
}
