import { useCallback, useEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react'
import type {
  PlaytestCard,
  PlaytestPlayerState,
  PlaytestSide,
  PlaytestZone,
} from '../types/playtest'
import {
  applyZoneMove,
  drawCard as drawCardState,
  mulligan as mulliganState,
  nextTurn as nextTurnState,
  toPlaytestCard,
} from '../lib/playtest-state'
import {
  usePlaytestPointerDrag,
  type DragPayload,
} from './playtest-pointer-drag'

type CollapsibleZone = 'library' | 'graveyard' | 'exile'

type Props = {
  side: PlaytestSide
  label: string
  deckName: string
  subtitle?: string
  state: PlaytestPlayerState
  onChange: (state: PlaytestPlayerState) => void
  accent?: string
  /** When true, keyboard shortcuts (D/T/M/…) apply to this board. */
  shortcutsActive?: boolean
}

function CardFace({
  card,
  size = 'md',
  hovered = false,
}: {
  card: PlaytestCard
  size?: 'sm' | 'md'
  hovered?: boolean
}) {
  const width = size === 'sm' ? 'w-12' : 'w-16'
  return (
    <div
      className={`${width} shrink-0 transition-transform ${card.tapped ? 'rotate-90' : ''} ${hovered ? 'ring-2 ring-sky-400 rounded' : ''}`}
    >
      {card.image ? (
        <img
          src={card.image}
          alt={card.name}
          className={`${width} rounded shadow ${card.isCommander ? 'ring-2 ring-[var(--color-mtg-gold)]' : ''} ${card.tapped ? 'opacity-80' : ''}`}
          draggable={false}
        />
      ) : (
        <div
          className={`flex aspect-[488/680] ${width} items-center justify-center rounded border border-[var(--color-mtg-border)] bg-[var(--color-mtg-bg)] p-1 text-center text-[8px] leading-tight ${card.isCommander ? 'ring-2 ring-[var(--color-mtg-gold)]' : ''}`}
        >
          {card.name}
        </div>
      )}
    </div>
  )
}

function DraggableCard({
  card,
  zone,
  index,
  hovered,
  dragging,
  cardPointerProps,
  onHover,
  onClearHover,
  onToggleTap,
}: {
  card: PlaytestCard
  zone: Exclude<PlaytestZone, 'battlefield'>
  index: number
  hovered: boolean
  dragging: boolean
  cardPointerProps: (payload: DragPayload, style?: CSSProperties) => {
    onPointerDown: (e: React.PointerEvent) => void
    style: CSSProperties
  }
  onHover: (zone: PlaytestZone, index: number, uid: string) => void
  onClearHover: () => void
  onToggleTap: (zone: PlaytestZone, index: number) => void
}) {
  const payload = { zone, index } satisfies DragPayload
  return (
    <div
      {...cardPointerProps(payload)}
      onMouseEnter={() => onHover(zone, index, card.uid)}
      onMouseLeave={onClearHover}
      onDoubleClick={(e: MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        onToggleTap(zone, index)
      }}
      className={`cursor-grab select-none text-left transition hover:scale-105 active:cursor-grabbing ${
        hovered ? 'scale-105' : ''
      } ${dragging ? 'opacity-40' : ''}`}
      title={`${card.name} · double-click tap · drag to move`}
    >
      <CardFace card={card} hovered={hovered} />
      <p className="mt-1 max-w-[4rem] truncate text-[10px]">{card.name}</p>
    </div>
  )
}

function CollapsibleZonePanel({
  side,
  zone,
  zoneLabel,
  cards,
  expanded,
  isOver,
  onToggleExpanded,
  onOpenTutor,
  cardPointerProps,
  activeDrag,
  hoveredUid,
  hoveredZone,
  onHover,
  onClearHover,
  onToggleTap,
}: {
  side: PlaytestSide
  zone: CollapsibleZone
  zoneLabel: string
  cards: PlaytestCard[]
  expanded: boolean
  isOver: boolean
  onToggleExpanded: (zone: CollapsibleZone) => void
  onOpenTutor: () => void
  cardPointerProps: (payload: DragPayload, style?: CSSProperties) => {
    onPointerDown: (e: React.PointerEvent) => void
    style: CSSProperties
  }
  activeDrag: { payload: DragPayload } | null
  hoveredUid: string | null
  hoveredZone: PlaytestZone | null
  onHover: (zone: PlaytestZone, index: number, uid: string) => void
  onClearHover: () => void
  onToggleTap: (zone: PlaytestZone, index: number) => void
}) {
  return (
    <div className="shrink-0">
      <button
        type="button"
        onClick={() => onToggleExpanded(zone)}
        data-playtest-side={side}
        data-playtest-zone={zone}
        className={`flex items-center gap-2 rounded-lg border px-2.5 py-1 text-xs transition ${
          isOver
            ? 'border-[var(--color-mtg-gold)] bg-[var(--color-mtg-gold)]/10'
            : 'border-[var(--color-mtg-border)] bg-[var(--color-mtg-bg)]/60 hover:border-[var(--color-mtg-gold-dim)]'
        }`}
      >
        <span className="font-semibold text-[var(--color-mtg-muted)]">{zoneLabel}</span>
        <span className="text-[var(--color-mtg-gold)]">{cards.length}</span>
        <span className="text-[var(--color-mtg-muted)]">{expanded ? '▾' : '▸'}</span>
      </button>
      {expanded && (
        <div
          data-playtest-side={side}
          data-playtest-zone={zone}
          className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-dashed border-[var(--color-mtg-border)] p-2"
        >
          {zone === 'library' ? (
            <div className="space-y-2">
              <p className="text-[10px] text-[var(--color-mtg-muted)]">Face-down pile</p>
              <button
                type="button"
                onClick={onOpenTutor}
                disabled={cards.length === 0}
                className="rounded border border-[var(--color-mtg-gold-dim)] px-2 py-1 text-[10px] text-[var(--color-mtg-gold)] disabled:opacity-40"
              >
                Tutor for card
              </button>
            </div>
          ) : cards.length === 0 ? (
            <p className="text-[10px] text-[var(--color-mtg-muted)]">Empty</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {cards.map((card, i) => (
                <DraggableCard
                  key={card.uid}
                  card={card}
                  zone={zone}
                  index={i}
                  hovered={hoveredZone === zone && hoveredUid === card.uid}
                  dragging={
                    activeDrag?.payload.zone === zone && activeDrag.payload.index === i
                  }
                  cardPointerProps={cardPointerProps}
                  onHover={onHover}
                  onClearHover={onClearHover}
                  onToggleTap={onToggleTap}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function PlaytestPlayerBoard({
  side,
  label,
  deckName,
  subtitle,
  state,
  onChange,
  accent = 'var(--color-mtg-gold)',
  shortcutsActive = false,
}: Props) {
  const [expandedZones, setExpandedZones] = useState<Set<CollapsibleZone>>(new Set())
  const [tutorOpen, setTutorOpen] = useState(false)
  const [tutorSearch, setTutorSearch] = useState('')
  const [hovered, setHovered] = useState<{
    zone: PlaytestZone
    index: number
    uid: string
  } | null>(null)
  const hoveredRef = useRef(hovered)
  const bfRef = useRef<HTMLDivElement>(null)

  const handlePointerMove = useCallback(
    (from: DragPayload, to: PlaytestZone, bfPos?: { x: number; y: number }) => {
      onChange(applyZoneMove(state, from.zone, from.index, to, bfPos))
    },
    [state, onChange],
  )

  const handleBfReposition = useCallback(
    (index: number, pos: { x: number; y: number }) => {
      const bf = state.battlefield.map((c, i) =>
        i === index ? { ...c, x: pos.x, y: pos.y } : c,
      )
      onChange({ ...state, battlefield: bf })
    },
    [state, onChange],
  )

  const { activeDrag, dragOverZone, cardPointerProps, isDragging } = usePlaytestPointerDrag({
    side,
    playtest: state,
    bfRef,
    onMove: handlePointerMove,
    onReposition: handleBfReposition,
  })

  const draw = useCallback(() => onChange(drawCardState(state)), [state, onChange])
  const nextTurn = useCallback(() => onChange(nextTurnState(state)), [state, onChange])
  const mulligan = useCallback(() => onChange(mulliganState(state)), [state, onChange])

  const shuffleLibrary = useCallback(() => {
    const a = [...state.library]
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    onChange({ ...state, library: a })
  }, [state, onChange])

  const adjustLife = (delta: number) => {
    onChange({ ...state, life: Math.max(0, state.life + delta) })
  }

  const toggleTap = useCallback(
    (zone: PlaytestZone, index: number) => {
      if (zone === 'battlefield') {
        const bf = [...state.battlefield]
        const card = bf[index]
        if (!card) return
        bf[index] = { ...card, tapped: !card.tapped }
        onChange({ ...state, battlefield: bf })
        return
      }
      const list = [...state[zone]] as PlaytestCard[]
      const card = list[index]
      if (!card) return
      list[index] = { ...card, tapped: !card.tapped }
      onChange({ ...state, [zone]: list })
    },
    [state, onChange],
  )

  const moveHoveredTo = useCallback(
    (to: 'exile' | 'graveyard' | 'library') => {
      const target = hoveredRef.current
      if (!target) return
      const list = state[target.zone] as PlaytestCard[]
      const index = list.findIndex((c) => c.uid === target.uid)
      if (index === -1) return
      const card = list[index]
      if (card.isToken && target.zone === 'battlefield') {
        onChange({
          ...state,
          battlefield: state.battlefield.filter((c) => c.uid !== card.uid),
        })
      } else if (to === 'library') {
        onChange(applyZoneMove(state, target.zone, index, to, undefined, 'top'))
      } else {
        onChange(applyZoneMove(state, target.zone, index, to))
      }
      hoveredRef.current = null
      setHovered(null)
    },
    [state, onChange],
  )

  useEffect(() => {
    hoveredRef.current = hovered
  }, [hovered])

  useEffect(() => {
    if (!shortcutsActive) return
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      const key = e.key.toLowerCase()
      if (key === 'd') {
        e.preventDefault()
        draw()
      } else if (key === 't') {
        e.preventDefault()
        nextTurn()
      } else if (key === 'm') {
        e.preventDefault()
        mulligan()
      } else if (key === 's') {
        e.preventDefault()
        shuffleLibrary()
      } else if (key === 'e') {
        e.preventDefault()
        moveHoveredTo('exile')
      } else if (key === 'g') {
        e.preventDefault()
        moveHoveredTo('graveyard')
      } else if (key === 'l') {
        e.preventDefault()
        moveHoveredTo('library')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [shortcutsActive, draw, nextTurn, mulligan, shuffleLibrary, moveHoveredTo])

  const tutorFromLibrary = (uid: string) => {
    const idx = state.library.findIndex((c) => c.uid === uid)
    if (idx === -1) return
    const card = state.library[idx]
    onChange({
      ...state,
      library: state.library.filter((_, i) => i !== idx),
      hand: [...state.hand, card],
    })
    setTutorOpen(false)
    setTutorSearch('')
  }

  const filteredLibrary = state.library.filter((c) =>
    c.name.toLowerCase().includes(tutorSearch.trim().toLowerCase()),
  )

  const addToken = () => {
    const n = state.tokens + 1
    const pos = { x: 60 + (n % 8) * 70, y: 60 + Math.floor(n / 8) * 100 }
    onChange({
      ...state,
      tokens: n,
      battlefield: [
        ...state.battlefield,
        { ...toPlaytestCard({ name: 'Token' }, { isToken: true }), ...pos },
      ],
    })
  }

  const hoverCard = useCallback((zone: PlaytestZone, index: number, uid: string) => {
    const next = { zone, index, uid }
    hoveredRef.current = next
    setHovered(next)
  }, [])

  const clearHover = useCallback(() => {
    hoveredRef.current = null
    setHovered(null)
  }, [])

  const toggleExpanded = useCallback((zone: CollapsibleZone) => {
    setExpandedZones((prev) => {
      const next = new Set(prev)
      if (next.has(zone)) next.delete(zone)
      else next.add(zone)
      return next
    })
  }, [])

  const dragGhostCard =
    activeDrag != null
      ? (state[activeDrag.payload.zone] as PlaytestCard[])[activeDrag.payload.index]
      : null

  return (
    <section
      className={`rounded-xl border border-[var(--color-mtg-border)] bg-[var(--color-mtg-panel)]/80 p-3 sm:p-4 ${
        isDragging ? 'select-none' : ''
      }`}
      style={isDragging ? { touchAction: 'none' } : undefined}
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: accent }}>
            {label}
          </p>
          <h3 className="font-[family-name:var(--font-display)] text-lg text-white">{deckName}</h3>
          {subtitle && (
            <p className="text-xs text-[var(--color-mtg-muted)]">{subtitle}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => adjustLife(-1)}
            className="h-8 w-8 rounded border border-[var(--color-mtg-border)] text-sm hover:border-red-400"
          >
            −
          </button>
          <div className="min-w-[3.5rem] text-center">
            <p className="text-[10px] uppercase text-[var(--color-mtg-muted)]">Life</p>
            <p className="font-[family-name:var(--font-display)] text-2xl text-white">
              {state.life}
            </p>
          </div>
          <button
            type="button"
            onClick={() => adjustLife(1)}
            className="h-8 w-8 rounded border border-[var(--color-mtg-border)] text-sm hover:border-emerald-400"
          >
            +
          </button>
          <div className="ml-2 text-center">
            <p className="text-[10px] uppercase text-[var(--color-mtg-muted)]">Turn</p>
            <p className="text-lg text-[var(--color-mtg-gold)]">{state.turn}</p>
          </div>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={draw}
          className="rounded bg-[var(--color-mtg-gold)] px-3 py-1 text-sm text-black"
        >
          Draw
        </button>
        <button
          type="button"
          onClick={nextTurn}
          className="rounded border border-[var(--color-mtg-gold-dim)] px-3 py-1 text-sm text-[var(--color-mtg-gold)]"
        >
          Next turn
        </button>
        <button
          type="button"
          onClick={mulligan}
          className="rounded border border-[var(--color-mtg-border)] px-3 py-1 text-sm"
        >
          Mulligan
        </button>
        <button
          type="button"
          onClick={shuffleLibrary}
          className="rounded border border-[var(--color-mtg-border)] px-3 py-1 text-sm"
        >
          Shuffle
        </button>
        <button
          type="button"
          onClick={addToken}
          className="rounded border border-[var(--color-mtg-border)] px-3 py-1 text-sm"
        >
          Token
        </button>
      </div>

      <div className="mb-3 flex flex-wrap items-start gap-2">
        <CollapsibleZonePanel
          side={side}
          zone="library"
          zoneLabel="Library"
          cards={state.library}
          expanded={expandedZones.has('library')}
          isOver={dragOverZone === 'library'}
          onToggleExpanded={toggleExpanded}
          onOpenTutor={() => {
            setTutorSearch('')
            setTutorOpen(true)
          }}
          cardPointerProps={cardPointerProps}
          activeDrag={activeDrag}
          hoveredUid={hovered?.uid ?? null}
          hoveredZone={hovered?.zone ?? null}
          onHover={hoverCard}
          onClearHover={clearHover}
          onToggleTap={toggleTap}
        />
        <CollapsibleZonePanel
          side={side}
          zone="graveyard"
          zoneLabel="Graveyard"
          cards={state.graveyard}
          expanded={expandedZones.has('graveyard')}
          isOver={dragOverZone === 'graveyard'}
          onToggleExpanded={toggleExpanded}
          onOpenTutor={() => undefined}
          cardPointerProps={cardPointerProps}
          activeDrag={activeDrag}
          hoveredUid={hovered?.uid ?? null}
          hoveredZone={hovered?.zone ?? null}
          onHover={hoverCard}
          onClearHover={clearHover}
          onToggleTap={toggleTap}
        />
        <CollapsibleZonePanel
          side={side}
          zone="exile"
          zoneLabel="Exile"
          cards={state.exile}
          expanded={expandedZones.has('exile')}
          isOver={dragOverZone === 'exile'}
          onToggleExpanded={toggleExpanded}
          onOpenTutor={() => undefined}
          cardPointerProps={cardPointerProps}
          activeDrag={activeDrag}
          hoveredUid={hovered?.uid ?? null}
          hoveredZone={hovered?.zone ?? null}
          onHover={hoverCard}
          onClearHover={clearHover}
          onToggleTap={toggleTap}
        />
      </div>

      <div
        data-playtest-side={side}
        data-playtest-zone="command"
        className={`mb-3 rounded-lg border border-dashed p-2 transition ${
          dragOverZone === 'command'
            ? 'border-[var(--color-mtg-gold)] bg-[var(--color-mtg-gold)]/10'
            : 'border-[var(--color-mtg-border)] bg-[var(--color-mtg-bg)]/40'
        }`}
      >
        <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-mtg-muted)]">
          Command ({state.command.length})
        </h4>
        <div className="mt-2 flex flex-wrap gap-3">
          {state.command.length === 0 ? (
            <p className="text-xs text-[var(--color-mtg-muted)]">No commander</p>
          ) : (
            state.command.map((card, i) => (
              <DraggableCard
                key={card.uid}
                card={card}
                zone="command"
                index={i}
                hovered={hovered?.zone === 'command' && hovered.uid === card.uid}
                dragging={
                  activeDrag?.payload.zone === 'command' && activeDrag.payload.index === i
                }
                cardPointerProps={cardPointerProps}
                onHover={hoverCard}
                onClearHover={clearHover}
                onToggleTap={toggleTap}
              />
            ))
          )}
        </div>
      </div>

      <div
        ref={bfRef}
        data-playtest-side={side}
        data-playtest-zone="battlefield"
        className={`relative mb-3 min-h-[16rem] touch-none rounded-xl border-2 border-dashed transition sm:min-h-[20rem] ${
          dragOverZone === 'battlefield'
            ? 'border-[var(--color-mtg-gold)] bg-[var(--color-mtg-gold)]/5'
            : 'border-[var(--color-mtg-border)] bg-[var(--color-mtg-bg)]/30'
        }`}
      >
        <span className="absolute left-3 top-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-mtg-muted)]">
          Battlefield ({state.battlefield.length})
        </span>
        {state.battlefield.length === 0 && (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-[var(--color-mtg-muted)]">
            Drop cards here
          </p>
        )}
        {state.battlefield.map((card, i) => {
          const cardHovered = hovered?.zone === 'battlefield' && hovered.uid === card.uid
          const draggingThis =
            activeDrag?.payload.zone === 'battlefield' && activeDrag.payload.index === i
          return (
            <div
              key={card.uid}
              {...cardPointerProps(
                { zone: 'battlefield', index: i },
                { left: card.x, top: card.y },
              )}
              onMouseEnter={() => hoverCard('battlefield', i, card.uid)}
              onMouseLeave={clearHover}
              onDoubleClick={(e: MouseEvent) => {
                e.preventDefault()
                e.stopPropagation()
                toggleTap('battlefield', i)
              }}
              className={`absolute cursor-grab select-none active:cursor-grabbing ${
                cardHovered ? 'z-10 scale-105' : ''
              } ${draggingThis ? 'opacity-40' : ''}`}
            >
              <CardFace card={card} hovered={cardHovered} />
              <p className="mt-0.5 max-w-[4rem] truncate text-center text-[9px]">{card.name}</p>
            </div>
          )
        })}
      </div>

      <div
        data-playtest-side={side}
        data-playtest-zone="hand"
        className={`min-h-[5.5rem] touch-none rounded-lg border border-dashed p-3 transition ${
          dragOverZone === 'hand'
            ? 'border-[var(--color-mtg-gold)] bg-[var(--color-mtg-gold)]/10'
            : 'border-[var(--color-mtg-border)] bg-[var(--color-mtg-bg)]/40'
        }`}
      >
        <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-mtg-muted)]">
          Hand ({state.hand.length})
        </h4>
        <div className="mt-2 flex flex-wrap gap-3">
          {state.hand.length === 0 ? (
            <p className="text-xs text-[var(--color-mtg-muted)]">Empty</p>
          ) : (
            state.hand.map((card, i) => (
              <DraggableCard
                key={card.uid}
                card={card}
                zone="hand"
                index={i}
                hovered={hovered?.zone === 'hand' && hovered.uid === card.uid}
                dragging={
                  activeDrag?.payload.zone === 'hand' && activeDrag.payload.index === i
                }
                cardPointerProps={cardPointerProps}
                onHover={hoverCard}
                onClearHover={clearHover}
                onToggleTap={toggleTap}
              />
            ))
          )}
        </div>
      </div>

      {tutorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-[var(--color-mtg-border)] bg-[var(--color-mtg-panel)] p-5 shadow-xl">
            <h3 className="font-semibold text-[var(--color-mtg-gold)]">Tutor from library</h3>
            <input
              type="text"
              value={tutorSearch}
              onChange={(e) => setTutorSearch(e.target.value)}
              placeholder="Filter by name…"
              className="mt-3 w-full rounded-lg border border-[var(--color-mtg-border)] bg-[var(--color-mtg-bg)] px-3 py-2 text-sm"
              autoFocus
            />
            <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto">
              {filteredLibrary.length === 0 ? (
                <li className="text-xs text-[var(--color-mtg-muted)]">No matching cards.</li>
              ) : (
                filteredLibrary.map((card) => (
                  <li key={card.uid}>
                    <button
                      type="button"
                      onClick={() => tutorFromLibrary(card.uid)}
                      className="flex w-full items-center gap-2 rounded border border-transparent px-2 py-1.5 text-left text-sm hover:border-[var(--color-mtg-gold-dim)] hover:bg-[var(--color-mtg-bg)]"
                    >
                      {card.image && (
                        <img src={card.image} alt="" className="h-10 w-7 rounded object-cover" />
                      )}
                      {card.name}
                    </button>
                  </li>
                ))
              )}
            </ul>
            <button
              type="button"
              onClick={() => setTutorOpen(false)}
              className="mt-4 w-full rounded-lg border border-[var(--color-mtg-border)] py-2 text-sm text-[var(--color-mtg-muted)]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {activeDrag && dragGhostCard && (
        <div
          className="pointer-events-none fixed z-[100] w-16 opacity-90"
          style={{
            left: activeDrag.clientX - activeDrag.offsetX,
            top: activeDrag.clientY - activeDrag.offsetY,
          }}
          aria-hidden
        >
          <CardFace card={dragGhostCard} />
        </div>
      )}
    </section>
  )
}
