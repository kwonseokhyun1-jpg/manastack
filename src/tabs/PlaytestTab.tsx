import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PlaytestGame } from '../components/PlaytestGame'
import { loadCommanderRankPool, loadMinigamePool } from '../lib/card-db'
import { parseDecklistText, parsedToResolved } from '../lib/decklist-parse'
import { generateBracketOpponentDeck } from '../lib/playtest-brackets'
import type { CardRecord } from '../types/card'
import type {
  CommanderBracket,
  ParsedDecklist,
  ResolvedDeck,
} from '../types/playtest'
import { BRACKETS } from '../types/playtest'

type Phase = 'setup' | 'play'

const SAMPLE_DECKLIST = `Commander
1 Atraxa, Praetors' Voice

Deck
1 Sol Ring
1 Arcane Signet
1 Command Tower
1 Reliquary Tower
1 Swords to Plowshares
1 Path to Exile
1 Counterspell
1 Cultivate
1 Kodama's Reach
1 Rhystic Study
1 Smothering Tithe
1 Beast Within
1 Chaos Warp
1 Birds of Paradise
1 Llanowar Elves
1 Sakura-Tribe Elder
1 Eternal Witness
1 Mulldrifter
1 Solemn Simulacrum
10 Plains
10 Island
10 Swamp
10 Forest
`

export function PlaytestTab() {
  const [phase, setPhase] = useState<Phase>('setup')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deckText, setDeckText] = useState('')
  const [deckName, setDeckName] = useState('My Deck')
  const [parsed, setParsed] = useState<ParsedDecklist | null>(null)
  const [bracket, setBracket] = useState<CommanderBracket>(3)
  const [opponentPreview, setOpponentPreview] = useState<ResolvedDeck | null>(null)
  const [youDeck, setYouDeck] = useState<ResolvedDeck | null>(null)
  const [oppDeck, setOppDeck] = useState<ResolvedDeck | null>(null)
  const [matchKey, setMatchKey] = useState(0)
  const [regenBusy, setRegenBusy] = useState(false)

  const allCardsRef = useRef<CardRecord[]>([])
  const commandersRef = useRef<CardRecord[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [cards, commanders] = await Promise.all([
          loadMinigamePool(),
          loadCommanderRankPool(),
        ])
        if (cancelled) return
        allCardsRef.current = cards
        commandersRef.current = commanders
        setOpponentPreview(generateBracketOpponentDeck(3, cards, commanders))
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load card data')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const regenerateOpponent = useCallback(
    (nextBracket: CommanderBracket = bracket) => {
      if (allCardsRef.current.length === 0 || commandersRef.current.length === 0) return
      setRegenBusy(true)
      try {
        const deck = generateBracketOpponentDeck(
          nextBracket,
          allCardsRef.current,
          commandersRef.current,
        )
        setOpponentPreview(deck)
        if (phase === 'play') {
          setOppDeck(deck)
          setMatchKey((k) => k + 1)
        }
      } finally {
        setRegenBusy(false)
      }
    },
    [bracket, phase],
  )

  const onBracketChange = (next: CommanderBracket) => {
    setBracket(next)
    regenerateOpponent(next)
  }

  const parseCurrentText = (text: string, name = deckName) => {
    if (!text.trim()) {
      setParsed(null)
      return
    }
    setParsed(parseDecklistText(text, name))
  }

  const onUploadFile = async (file: File) => {
    const text = await file.text()
    const nameFromFile = file.name.replace(/\.(txt|dek|cod|mtga?)$/i, '')
    setDeckName(nameFromFile || 'My Deck')
    setDeckText(text)
    parseCurrentText(text, nameFromFile || 'My Deck')
  }

  const resolvedYou = useMemo(
    () => (parsed ? parsedToResolved(parsed) : null),
    [parsed],
  )

  const canStart =
    !!resolvedYou && resolvedYou.mainboard.length >= 7 && !!opponentPreview

  const startPlaytest = () => {
    if (!resolvedYou || !opponentPreview) return
    setError(null)
    setYouDeck(resolvedYou)
    setOppDeck(opponentPreview)
    setMatchKey((k) => k + 1)
    setPhase('play')
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-[var(--color-mtg-muted)]">
        Loading card pool for playtest…
      </div>
    )
  }

  if (phase === 'play' && youDeck && oppDeck) {
    const bracketMeta = BRACKETS.find((b) => b.id === bracket)
    return (
      <PlaytestGame
        key={matchKey}
        youDeck={youDeck}
        oppDeck={oppDeck}
        bracketLabel={`Bracket ${bracket} · ${bracketMeta?.title ?? ''}`}
        onExit={() => setPhase('setup')}
        onNewOpponent={() => regenerateOpponent()}
      />
    )
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="text-center">
        <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--color-mtg-gold)]">
          Playtest
        </h2>
        <p className="mt-1 text-sm text-[var(--color-mtg-muted)]">
          Upload a decklist and duel on a shared playtest table — the AI opponent plays the far
          side each turn.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <section className="rounded-xl border border-[var(--color-mtg-border)] bg-[var(--color-mtg-panel)] p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-[family-name:var(--font-display)] text-lg text-white">
            Your decklist
          </h3>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-lg border border-[var(--color-mtg-gold-dim)] px-3 py-1.5 text-sm text-[var(--color-mtg-gold)]"
            >
              Upload file
            </button>
            <button
              type="button"
              onClick={() => {
                setDeckName('Sample Deck')
                setDeckText(SAMPLE_DECKLIST)
                parseCurrentText(SAMPLE_DECKLIST, 'Sample Deck')
              }}
              className="rounded-lg border border-[var(--color-mtg-border)] px-3 py-1.5 text-sm text-[var(--color-mtg-muted)]"
            >
              Load sample
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.dek,.cod,.mtga,text/plain"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void onUploadFile(file)
              e.target.value = ''
            }}
          />
        </div>

        <label className="mb-2 block text-xs text-[var(--color-mtg-muted)]">Deck name</label>
        <input
          type="text"
          value={deckName}
          onChange={(e) => setDeckName(e.target.value)}
          className="mb-3 w-full rounded-lg border border-[var(--color-mtg-border)] bg-[var(--color-mtg-bg)] px-3 py-2 text-sm"
        />

        <label className="mb-2 block text-xs text-[var(--color-mtg-muted)]">
          Paste decklist (Arena / MTGO / 1 Card Name)
        </label>
        <textarea
          value={deckText}
          onChange={(e) => {
            setDeckText(e.target.value)
            parseCurrentText(e.target.value)
          }}
          rows={12}
          placeholder={`Commander\n1 Your Commander\n\nDeck\n1 Sol Ring\n…`}
          className="w-full resize-y rounded-lg border border-[var(--color-mtg-border)] bg-[var(--color-mtg-bg)] px-3 py-2 font-mono text-xs leading-relaxed"
        />

        {parsed && (
          <div className="mt-3 rounded-lg border border-[var(--color-mtg-border)] bg-[var(--color-mtg-bg)]/60 p-3 text-sm">
            <p>
              <span className="text-[var(--color-mtg-muted)]">Cards:</span>{' '}
              <span className="text-white">{parsed.totalCards}</span>
              {parsed.commander && (
                <>
                  {' · '}
                  <span className="text-[var(--color-mtg-muted)]">Commander:</span>{' '}
                  <span className="text-[var(--color-mtg-gold)]">
                    {parsed.commander.name}
                    {parsed.commander.unresolved ? ' (unresolved)' : ''}
                  </span>
                </>
              )}
            </p>
            {parsed.unresolved.length > 0 ? (
              <p className="mt-1 text-amber-300">
                Placeholders ({parsed.unresolved.length}) — not in local pool:{' '}
                {parsed.unresolved.slice(0, 12).join(', ')}
                {parsed.unresolved.length > 12 ? '…' : ''}
              </p>
            ) : (
              <p className="mt-1 text-emerald-300/90">All cards resolved against the local pool.</p>
            )}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-[var(--color-mtg-border)] bg-[var(--color-mtg-panel)] p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-[family-name:var(--font-display)] text-lg text-white">
            Opponent bracket
          </h3>
          <button
            type="button"
            disabled={regenBusy}
            onClick={() => regenerateOpponent()}
            className="rounded-lg border border-[var(--color-mtg-border)] px-3 py-1.5 text-sm text-[var(--color-mtg-muted)] hover:text-white disabled:opacity-50"
          >
            Reroll deck
          </button>
        </div>

        <div className="grid gap-2 sm:grid-cols-5">
          {BRACKETS.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => onBracketChange(b.id)}
              className={`rounded-lg border px-3 py-3 text-left transition ${
                bracket === b.id
                  ? 'border-[var(--color-mtg-gold)] bg-[var(--color-mtg-gold)]/10'
                  : 'border-[var(--color-mtg-border)] hover:border-[var(--color-mtg-gold-dim)]'
              }`}
            >
              <p className="text-xs font-bold text-[var(--color-mtg-gold)]">{b.label}</p>
              <p className="text-sm font-semibold text-white">{b.title}</p>
              <p className="mt-1 text-[11px] leading-snug text-[var(--color-mtg-muted)]">
                {b.description}
              </p>
            </button>
          ))}
        </div>

        {opponentPreview && (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-[var(--color-mtg-border)] bg-[var(--color-mtg-bg)]/60 p-3">
            {opponentPreview.commander?.image && (
              <img
                src={opponentPreview.commander.image}
                alt=""
                className="h-16 w-12 rounded object-cover shadow"
              />
            )}
            <div>
              <p className="text-xs uppercase text-[var(--color-mtg-muted)]">Random opponent</p>
              <p className="font-semibold text-white">{opponentPreview.name}</p>
              <p className="text-xs text-[var(--color-mtg-muted)]">
                {opponentPreview.mainboard.length + (opponentPreview.commander ? 1 : 0)} cards ·
                identity{' '}
                {opponentPreview.colorIdentity.length
                  ? opponentPreview.colorIdentity.join('')
                  : 'C'}
              </p>
            </div>
          </div>
        )}
      </section>

      <button
        type="button"
        disabled={!canStart}
        onClick={startPlaytest}
        className="rounded-xl bg-[var(--color-mtg-gold)] py-3 text-sm font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Start duel
      </button>
      {!canStart && deckText.trim() && (
        <p className="text-center text-xs text-[var(--color-mtg-muted)]">
          Need at least 7 mainboard cards to start.
        </p>
      )}
    </div>
  )
}
