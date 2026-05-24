import { useMemo, useState } from 'react'
import { CardDetailModal } from '../components/CardDetailModal'
import { CardTile } from '../components/CardTile'
import { useGame } from '../context/GameContext'
import {
  buildCardLookup,
  INVENTORY_SORT_OPTIONS,
  sortCollectedCards,
  type InventorySortMode,
} from '../lib/inventory-sort'
import type { CollectedCard } from '../types/game'

type ViewId = 'all' | string

export function InventoryTab() {
  const {
    collection,
    folders,
    cardPool,
    rarityMap,
    createFolder,
    deleteFolder,
  } = useGame()

  const [view, setView] = useState<ViewId>('all')
  const [sortMode, setSortMode] = useState<InventorySortMode>('recent')
  const [newFolderName, setNewFolderName] = useState('')
  const [detailCard, setDetailCard] = useState<CollectedCard | null>(null)

  const cardLookup = useMemo(() => buildCardLookup(cardPool), [cardPool])

  const cardsById = useMemo(
    () => new Map(collection.map((c) => [c.instanceId, c])),
    [collection],
  )

  const displayedCards = useMemo(() => {
    let cards: CollectedCard[]
    if (view === 'all') {
      cards = collection
    } else {
      const folder = folders.find((f) => f.id === view)
      if (!folder) return []
      cards = folder.cardInstanceIds
        .map((id) => cardsById.get(id))
        .filter((c): c is CollectedCard => c != null)
    }
    return sortCollectedCards(cards, sortMode, cardLookup, rarityMap)
  }, [view, collection, folders, cardsById, sortMode, cardLookup, rarityMap])

  const uniqueCount = useMemo(() => {
    const names = new Set<string>()
    for (const c of collection) {
      if (!c.foil) names.add(c.name.toLowerCase())
    }
    return names.size
  }, [collection])

  function handleCreateFolder(e: React.FormEvent) {
    e.preventDefault()
    createFolder(newFolderName)
    setNewFolderName('')
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--color-mtg-gold)]">
            Inventory
          </h2>
          <p className="mt-1 text-sm text-[var(--color-mtg-muted)]">
            {collection.length} cards · {uniqueCount} unique · {folders.length} folders
          </p>
        </div>
        <label className="flex flex-col gap-1 text-xs text-[var(--color-mtg-muted)] sm:items-end">
          Sort by
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as InventorySortMode)}
            className="min-w-[10rem] rounded-lg border border-[var(--color-mtg-border)] bg-[var(--color-mtg-panel)] px-3 py-2 text-sm text-white focus:border-[var(--color-mtg-gold)] focus:outline-none"
          >
            {INVENTORY_SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setView('all')}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            view === 'all'
              ? 'bg-[var(--color-mtg-gold)] text-black'
              : 'border border-[var(--color-mtg-border)] text-[var(--color-mtg-muted)] hover:text-white'
          }`}
        >
          All cards
        </button>
        {folders.map((folder) => (
          <div key={folder.id} className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setView(folder.id)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                view === folder.id
                  ? 'bg-[var(--color-mtg-gold)] text-black'
                  : 'border border-[var(--color-mtg-border)] text-[var(--color-mtg-muted)] hover:text-white'
              }`}
            >
              📁 {folder.name} ({folder.cardInstanceIds.length})
            </button>
            <button
              type="button"
              onClick={() => {
                if (view === folder.id) setView('all')
                deleteFolder(folder.id)
              }}
              className="rounded px-1.5 py-1 text-xs text-red-400/80 hover:text-red-300"
              title="Delete folder"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <form onSubmit={handleCreateFolder} className="flex gap-2">
        <input
          type="text"
          value={newFolderName}
          onChange={(e) => setNewFolderName(e.target.value)}
          placeholder="New showcase folder name…"
          className="flex-1 rounded-lg border border-[var(--color-mtg-border)] bg-[var(--color-mtg-panel)] px-3 py-2 text-sm text-white placeholder:text-[var(--color-mtg-muted)] focus:border-[var(--color-mtg-gold)] focus:outline-none"
        />
        <button
          type="submit"
          disabled={!newFolderName.trim()}
          className="rounded-lg border border-[var(--color-mtg-gold-dim)] px-4 py-2 text-sm font-medium text-[var(--color-mtg-gold)] transition hover:bg-[var(--color-mtg-gold)]/10 disabled:opacity-40"
        >
          Create folder
        </button>
      </form>

      {displayedCards.length > 0 && (
        <p className="text-xs text-[var(--color-mtg-muted)]">
          Click a card for details, prices, and folder options.
        </p>
      )}

      {displayedCards.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-mtg-border)] py-16 text-center">
          <p className="text-[var(--color-mtg-muted)]">
            {view === 'all'
              ? 'No cards yet. Win minigames and open booster packs!'
              : 'This folder is empty. Add cards from your collection.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {displayedCards.map((card) => (
            <CardTile
              key={card.instanceId}
              card={card}
              onClick={() => setDetailCard(card)}
            />
          ))}
        </div>
      )}

      {detailCard && (
        <CardDetailModal
          card={detailCard}
          activeFolderId={view === 'all' ? null : view}
          onClose={() => setDetailCard(null)}
        />
      )}
    </div>
  )
}
