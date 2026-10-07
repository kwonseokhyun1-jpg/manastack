import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { loadMinigamePool } from '../lib/card-db'
import { extractMainboardText, parseDecklistText } from '../lib/decklist-parse'
import {
  deleteSavedDeck,
  loadSavedDecks,
  upsertSavedDeck,
  type SavedDeck,
} from '../lib/saved-decks'
import type { ParsedDecklist } from '../types/playtest'

type DecksTabProps = {
  onPlaytest: (deckId: string) => void
}

export function DecksTab({ onPlaytest }: DecksTabProps) {
  const [ready, setReady] = useState(false)
  const [decks, setDecks] = useState<SavedDeck[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [commanderName, setCommanderName] = useState('')
  const [mainboardText, setMainboardText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [savedFlash, setSavedFlash] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const refresh = useCallback(() => {
    setDecks(loadSavedDecks())
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await loadMinigamePool()
        if (!cancelled) {
          refresh()
          setReady(true)
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load card pool')
          setReady(true)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [refresh])

  const parsed: ParsedDecklist | null = useMemo(() => {
    if (!ready) return null
    if (!mainboardText.trim() && !commanderName.trim()) return null
    return parseDecklistText(mainboardText, name || 'Untitled Deck', {
      commanderName: commanderName.trim() || undefined,
    })
  }, [ready, mainboardText, commanderName, name])

  const resetForm = () => {
    setEditingId(null)
    setName('')
    setCommanderName('')
    setMainboardText('')
    setSavedFlash(false)
  }

  const loadIntoForm = (deck: SavedDeck) => {
    setEditingId(deck.id)
    setName(deck.name)
    setCommanderName(deck.commanderName)
    setMainboardText(deck.mainboardText)
    setSavedFlash(false)
    setError(null)
  }

  const onUploadFile = async (file: File) => {
    const text = await file.text()
    const nameFromFile = file.name.replace(/\.(txt|dek|cod|mtga?)$/i, '')
    if (!name.trim()) setName(nameFromFile || 'My Deck')

    // Pull commander from a Commander section if the separate field is empty.
    const preview = parseDecklistText(text, nameFromFile || 'My Deck')
    if (!commanderName.trim() && preview.commander?.name) {
      setCommanderName(preview.commander.name)
    }

    setMainboardText(extractMainboardText(text))
  }

  const saveDeck = () => {
    if (!mainboardText.trim() && !commanderName.trim()) {
      setError('Add a commander and/or mainboard list before saving.')
      return
    }
    const saved = upsertSavedDeck({
      id: editingId ?? undefined,
      name: name.trim() || 'Untitled Deck',
      commanderName: commanderName.trim(),
      mainboardText,
    })
    refresh()
    setEditingId(saved.id)
    setName(saved.name)
    setError(null)
    setSavedFlash(true)
    window.setTimeout(() => setSavedFlash(false), 1600)
  }

  const removeDeck = (id: string) => {
    deleteSavedDeck(id)
    if (editingId === id) resetForm()
    refresh()
  }

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-[var(--color-mtg-muted)]">
        Loading decks…
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="text-center">
        <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--color-mtg-gold)]">
          Decks
        </h2>
        <p className="mt-1 text-sm text-[var(--color-mtg-muted)]">
          Upload or paste decklists here, then pick them in Playtest instead of pasting every time.
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
            {editingId ? 'Edit deck' : 'Add deck'}
          </h3>
          <div className="flex flex-wrap gap-2">
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border border-[var(--color-mtg-border)] px-3 py-1.5 text-sm text-[var(--color-mtg-muted)]"
              >
                New deck
              </button>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-lg border border-[var(--color-mtg-gold-dim)] px-3 py-1.5 text-sm text-[var(--color-mtg-gold)]"
            >
              Upload file
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
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My Deck"
          className="mb-3 w-full rounded-lg border border-[var(--color-mtg-border)] bg-[var(--color-mtg-bg)] px-3 py-2 text-sm"
        />

        <label className="mb-2 block text-xs text-[var(--color-mtg-muted)]">Commander</label>
        <input
          type="text"
          value={commanderName}
          onChange={(e) => setCommanderName(e.target.value)}
          placeholder="Atraxa, Praetors' Voice"
          className="mb-3 w-full rounded-lg border border-[var(--color-mtg-border)] bg-[var(--color-mtg-bg)] px-3 py-2 text-sm"
        />

        <label className="mb-2 block text-xs text-[var(--color-mtg-muted)]">
          Mainboard (99) — paste lines like <span className="font-mono">1 Sol Ring</span>
        </label>
        <textarea
          value={mainboardText}
          onChange={(e) => setMainboardText(e.target.value)}
          rows={12}
          placeholder={`1 Sol Ring\n1 Arcane Signet\n1 Command Tower\n…`}
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
                Placeholders ({parsed.unresolved.length}):{' '}
                {parsed.unresolved.slice(0, 12).join(', ')}
                {parsed.unresolved.length > 12 ? '…' : ''}
              </p>
            ) : (
              <p className="mt-1 text-emerald-300/90">All cards resolved against the local pool.</p>
            )}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={saveDeck}
            className="rounded-xl bg-[var(--color-mtg-gold)] px-4 py-2.5 text-sm font-semibold text-black transition hover:brightness-110"
          >
            {editingId ? 'Update deck' : 'Save deck'}
          </button>
          {savedFlash && (
            <span className="text-sm text-emerald-300/90">Saved to your Decks library.</span>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-[var(--color-mtg-border)] bg-[var(--color-mtg-panel)] p-4 sm:p-5">
        <h3 className="mb-3 font-[family-name:var(--font-display)] text-lg text-white">
          Saved decks ({decks.length})
        </h3>
        {decks.length === 0 ? (
          <p className="text-sm text-[var(--color-mtg-muted)]">
            No decks yet. Upload a file or paste a list above.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {decks.map((deck) => {
              const summary = ready
                ? parseDecklistText(deck.mainboardText, deck.name, {
                    commanderName: deck.commanderName || undefined,
                  })
                : null
              return (
                <li
                  key={deck.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--color-mtg-border)] bg-[var(--color-mtg-bg)]/50 px-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-white">{deck.name}</p>
                    <p className="text-xs text-[var(--color-mtg-muted)]">
                      {deck.commanderName || summary?.commander?.name || 'No commander'}
                      {summary ? ` · ${summary.totalCards} cards` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onPlaytest(deck.id)}
                      className="rounded-lg bg-[var(--color-mtg-gold)] px-3 py-1.5 text-sm font-semibold text-black"
                    >
                      Playtest
                    </button>
                    <button
                      type="button"
                      onClick={() => loadIntoForm(deck)}
                      className="rounded-lg border border-[var(--color-mtg-border)] px-3 py-1.5 text-sm text-[var(--color-mtg-muted)] hover:text-white"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => removeDeck(deck.id)}
                      className="rounded-lg border border-red-500/40 px-3 py-1.5 text-sm text-red-200/90 hover:bg-red-500/10"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
