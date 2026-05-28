import { useEffect, useState, type ReactNode } from 'react'
import { loadMinigamePool } from '../lib/card-db'
import { canonicalNameKey } from '../lib/card-names'
import { getCardImage, isLand } from '../lib/card-utils'
import { sortIdentity } from '../lib/color-filter'
import { getAllStaples } from '../lib/staples'
import type { CardRecord } from '../types/card'
import type { ManaColor } from '../types/mtg'

export const MAX_GUESSES = 5

export type GameMode = 'easy' | 'hard'
export type GamePhase = 'playing' | 'won' | 'lost'

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

export { getCardImage, isLand }

export function buildPool(cards: CardRecord[]): CardRecord[] {
  return cards.filter((c) => !isLand(c) && getCardImage(c))
}

export function buildUnscramblePool(cards: CardRecord[]): CardRecord[] {
  return cards.filter((c) => !isLand(c) && /[a-zA-Z]/.test(c.name))
}

export function pickRandomCard(pool: CardRecord[], avoid?: CardRecord): CardRecord {
  if (pool.length === 0) throw new Error('No cards available')
  if (pool.length === 1) return pool[0]

  let card = pool[Math.floor(Math.random() * pool.length)]
  if (avoid && pool.length > 1) {
    let attempts = 0
    while (card.id === avoid.id && attempts < 8) {
      card = pool[Math.floor(Math.random() * pool.length)]
      attempts += 1
    }
  }
  return card
}

export function scrambleName(name: string): string {
  const chars = name.split('')
  const letterIndices: number[] = []
  for (let i = 0; i < chars.length; i++) {
    if (/[a-zA-Z]/.test(chars[i])) letterIndices.push(i)
  }
  if (letterIndices.length < 2) return name

  const letters = letterIndices.map((i) => chars[i])
  let scrambled = [...letters]
  let attempts = 0
  do {
    for (let i = scrambled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[scrambled[i], scrambled[j]] = [scrambled[j], scrambled[i]]
    }
    attempts += 1
  } while (scrambled.join('') === letters.join('') && attempts < 12)

  const result = [...chars]
  letterIndices.forEach((idx, i) => {
    result[idx] = scrambled[i]
  })
  return result.join('')
}

function guessNamesForCard(card: CardRecord): Set<string> {
  const keys = new Set<string>()
  keys.add(canonicalNameKey(card.name))
  for (const part of card.name.split(/\s*\/\/\s*/)) {
    keys.add(canonicalNameKey(part))
  }
  for (const face of card.card_faces ?? []) {
    keys.add(canonicalNameKey(face.name))
  }
  return keys
}

export function isCorrectGuess(guess: string, card: CardRecord): boolean {
  return guessNamesForCard(card).has(canonicalNameKey(guess))
}

function formatCmc(cmc: number): string {
  if (cmc === 0) return '0'
  return String(cmc)
}

function formatUsdPrice(card: CardRecord): string {
  const usd = card.prices?.usd
  if (usd == null || usd === '') return 'Unknown'
  const n = parseFloat(usd)
  if (Number.isNaN(n)) return 'Unknown'
  return `$${n.toFixed(2)}`
}

export function CardHints({
  card,
  guessCount,
}: {
  card: CardRecord
  guessCount: number
}) {
  if (guessCount < 1) return null

  const colors = sortIdentity(card.color_identity)

  return (
    <div className="rounded-lg border border-[var(--color-mtg-gold-dim)]/50 bg-[var(--color-mtg-panel)] p-3">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--color-mtg-gold)]">
        Hints
      </p>
      <div className="space-y-2 text-sm">
        {guessCount >= 1 && (
          <p className="text-[var(--color-mtg-muted)]">
            <span className="font-medium text-white">CMC:</span> {formatCmc(card.cmc)}
          </p>
        )}
        {guessCount >= 2 && (
          <p className="text-[var(--color-mtg-muted)]">
            <span className="font-medium text-white">Type:</span> {card.type_line}
          </p>
        )}
        {guessCount >= 3 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-white">Colors:</span>
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
        )}
        {guessCount >= 4 && (
          <p className="text-[var(--color-mtg-muted)]">
            <span className="font-medium text-white">Price:</span> {formatUsdPrice(card)}
          </p>
        )}
      </div>
    </div>
  )
}

export function SuggestionList({
  items,
  onPick,
}: {
  items: string[]
  onPick: (value: string) => void
}) {
  if (items.length === 0) return null
  return (
    <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-[var(--color-mtg-border)] bg-[var(--color-mtg-bg)] shadow-lg">
      {items.map((item) => (
        <li key={item}>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(item)}
            className="block w-full px-3 py-2 text-left text-sm hover:bg-[var(--color-mtg-panel)]"
          >
            {item}
          </button>
        </li>
      ))}
    </ul>
  )
}

export function ModeToggle({
  mode,
  onSwitch,
  easyCount,
}: {
  mode: GameMode
  onSwitch: (mode: GameMode) => void
  easyCount: number
}) {
  return (
    <>
      <div className="mt-4 inline-flex rounded-lg border border-[var(--color-mtg-border)] p-1">
        <button
          type="button"
          onClick={() => onSwitch('easy')}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
            mode === 'easy'
              ? 'bg-[var(--color-mtg-gold)] text-black'
              : 'text-[var(--color-mtg-muted)] hover:text-white'
          }`}
        >
          Easy
        </button>
        <button
          type="button"
          onClick={() => onSwitch('hard')}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
            mode === 'hard'
              ? 'bg-[var(--color-mtg-gold)] text-black'
              : 'text-[var(--color-mtg-muted)] hover:text-white'
          }`}
        >
          Hard
        </button>
      </div>
      {mode === 'easy' && (
        <p className="mt-2 text-xs text-[var(--color-mtg-muted)]">
          EDHREC staples only · {easyCount.toLocaleString()} cards
        </p>
      )}
      {mode === 'hard' && (
        <p className="mt-2 text-xs text-[var(--color-mtg-muted)]">Full card pool</p>
      )}
    </>
  )
}

export function GuessesAndStreak({
  guessesLeft,
  streak,
}: {
  guessesLeft: number
  streak: number
}) {
  return (
    <div className="flex items-center justify-between text-sm text-[var(--color-mtg-muted)]">
      <span>
        Guesses left:{' '}
        <span className="font-medium text-white">{Math.max(guessesLeft, 0)}</span>
      </span>
      <span>
        Streak:{' '}
        <span className="font-medium text-[var(--color-mtg-gold)]">{streak}</span>
      </span>
    </div>
  )
}

export function GuessHistory({
  guesses,
  won,
}: {
  guesses: string[]
  won: boolean
}) {
  if (guesses.length === 0) return null
  return (
    <div className="rounded-lg border border-[var(--color-mtg-border)] bg-[var(--color-mtg-panel)] p-3">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--color-mtg-muted)]">
        Your guesses
      </p>
      <ul className="space-y-1">
        {guesses.map((g, i) => {
          const isLast = i === guesses.length - 1
          const correct = won && isLast
          return (
            <li key={`${g}-${i}`} className="text-sm text-[var(--color-mtg-muted)]">
              {i + 1}. {g}
              {correct ? (
                <span className="ml-2 text-green-400">✓</span>
              ) : (
                <span className="ml-2 text-red-400/80">✗</span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function WinBanner({
  cardName,
  image,
  onNext,
  manaReward,
}: {
  cardName: string
  image?: string
  onNext: () => void
  manaReward?: number
}) {
  return (
    <div className="rounded-lg border border-green-500/40 bg-green-500/10 p-4 text-center">
      <p className="text-lg font-semibold text-green-300">Correct!</p>
      {manaReward != null && manaReward > 0 && (
        <p className="mt-1 text-sm font-medium text-[var(--color-mana-u)]">
          +{manaReward} mana earned
        </p>
      )}
      <p className="mt-1 text-white">{cardName}</p>
      {image && (
        <div className="mx-auto mt-4 aspect-[5/7] w-48 overflow-hidden rounded-lg border border-[var(--color-mtg-border)]">
          <img src={image} alt={cardName} className="h-full w-full object-cover" />
        </div>
      )}
      <button
        type="button"
        onClick={onNext}
        className="mt-4 rounded-lg bg-[var(--color-mtg-gold)] px-6 py-2 text-sm font-semibold text-black transition hover:brightness-110"
      >
        Next card
      </button>
    </div>
  )
}

export function LoseBanner({
  cardName,
  image,
  onNext,
}: {
  cardName: string
  image?: string
  onNext: () => void
}) {
  return (
    <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-center">
      <p className="text-lg font-semibold text-red-300">Out of guesses</p>
      <p className="mt-1 text-white">{cardName}</p>
      {image && (
        <div className="mx-auto mt-4 aspect-[5/7] w-48 overflow-hidden rounded-lg border border-[var(--color-mtg-border)]">
          <img src={image} alt={cardName} className="h-full w-full object-cover" />
        </div>
      )}
      <button
        type="button"
        onClick={onNext}
        className="mt-4 rounded-lg bg-[var(--color-mtg-gold)] px-6 py-2 text-sm font-semibold text-black transition hover:brightness-110"
      >
        Try another
      </button>
    </div>
  )
}

export function GuessForm({
  guess,
  suggestions,
  onGuessChange,
  onShowSuggestions,
  onSubmit,
  inputRef,
}: {
  guess: string
  suggestions: string[]
  onGuessChange: (value: string) => void
  onShowSuggestions: (show: boolean) => void
  onSubmit: (value?: string) => void
  inputRef: React.RefObject<HTMLInputElement | null>
}) {
  return (
    <form
      className="relative"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
    >
      <input
        ref={inputRef}
        type="text"
        value={guess}
        onChange={(e) => {
          onGuessChange(e.target.value)
          onShowSuggestions(true)
        }}
        onFocus={() => onShowSuggestions(true)}
        onBlur={() => setTimeout(() => onShowSuggestions(false), 150)}
        placeholder="Type a card name…"
        autoComplete="off"
        className="w-full rounded-lg border border-[var(--color-mtg-border)] bg-[var(--color-mtg-panel)] px-4 py-3 text-white placeholder:text-[var(--color-mtg-muted)] focus:border-[var(--color-mtg-gold)] focus:outline-none"
      />
      <SuggestionList items={suggestions} onPick={(name) => onSubmit(name)} />
      <button
        type="submit"
        disabled={!guess.trim()}
        className="mt-3 w-full rounded-lg bg-[var(--color-mtg-gold)] py-2.5 text-sm font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Guess
      </button>
    </form>
  )
}

export type MinigamePools = {
  allCards: CardRecord[]
  easyPool: CardRecord[]
  loading: boolean
  loadError: string | null
}

export function useMinigamePools(
  filterPool: (cards: CardRecord[]) => CardRecord[] = buildPool,
): MinigamePools {
  const [allCards, setAllCards] = useState<CardRecord[]>([])
  const [easyPool, setEasyPool] = useState<CardRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    loadMinigamePool()
      .then((cards) => {
        if (cancelled) return
        const eligible = filterPool(cards)
        const staples = filterPool(getAllStaples(cards))
        setAllCards(eligible)
        setEasyPool(staples)
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
    // filterPool is always a stable module-level function (buildPool, buildUnscramblePool, etc.)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { allCards, easyPool, loading, loadError }
}

export function MinigameLoading({ children }: { children?: ReactNode }) {
  return (
    <p className="text-center text-[var(--color-mtg-muted)]">
      {children ?? 'Loading cards…'}
    </p>
  )
}

export function MinigameError({ message }: { message: string }) {
  return <p className="text-center text-red-400">{message}</p>
}
