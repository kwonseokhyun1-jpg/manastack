import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { ResolvedDeck } from '../types/playtest'
import type { GameAction, GameCard, GameState } from '../types/playtest-game'
import { runAiUntilHumanPriority } from '../lib/playtest-ai'
import {
  applyAction,
  canCastCard,
  canPlayLand,
  createGame,
  getLegalActions,
  legalAttackers,
  manaPoolLabel,
} from '../lib/playtest-engine'
import { isCreatureCard, isLandCard } from '../lib/playtest-card-stats'

type Props = {
  youDeck: ResolvedDeck
  oppDeck: ResolvedDeck
  bracketLabel: string
  onExit: () => void
  onNewOpponent: () => void
}

function stepLabel(step: GameState['step']): string {
  switch (step) {
    case 'mulligan':
      return 'Mulligan'
    case 'main1':
      return 'Main 1'
    case 'combat_attackers':
      return 'Attackers'
    case 'combat_blockers':
      return 'Blockers'
    case 'combat_damage':
      return 'Damage'
    case 'main2':
      return 'Main 2'
    case 'game_over':
      return 'Game over'
    default:
      return step
  }
}

function CardTile({
  card,
  dimmed,
  selected,
  onClick,
  size = 'md',
  showPt = true,
}: {
  card: GameCard
  dimmed?: boolean
  selected?: boolean
  onClick?: () => void
  size?: 'sm' | 'md' | 'hand'
  showPt?: boolean
}) {
  const sizeClass =
    size === 'hand'
      ? 'h-[7.25rem] w-[5.15rem] sm:h-32 sm:w-24'
      : size === 'sm'
        ? 'h-[4.5rem] w-12'
        : 'h-[5.75rem] w-16'

  return (
    <button
      type="button"
      disabled={!onClick}
      onClick={onClick}
      className={`relative shrink-0 overflow-hidden rounded-md border bg-black shadow-md transition ${sizeClass} ${
        selected ? 'border-sky-400 ring-2 ring-sky-400' : 'border-black/60'
      } ${dimmed ? 'opacity-45' : ''} ${card.tapped ? 'rotate-90' : ''} ${
        onClick ? 'cursor-pointer hover:-translate-y-0.5 hover:brightness-110' : 'cursor-default'
      }`}
      title={card.card.name}
    >
      {card.card.image ? (
        <img
          src={card.card.image}
          alt={card.card.name}
          className="h-full w-full object-cover"
          draggable={false}
        />
      ) : (
        <span className="flex h-full items-center justify-center bg-[#1c2128] p-1 text-center text-[8px] text-white">
          {card.card.name}
        </span>
      )}
      {showPt && isCreatureCard(card.card) && (
        <span className="absolute bottom-0 right-0 rounded-tl bg-black/85 px-1 text-[9px] font-semibold text-white">
          {card.power}/{card.toughness}
        </span>
      )}
      {card.isCommander && (
        <span className="absolute left-0 top-0 h-1 w-full bg-[var(--color-mtg-gold)]" />
      )}
    </button>
  )
}

function CardBack({ label }: { label?: string }) {
  return (
    <div
      className="relative h-[7.25rem] w-[5.15rem] shrink-0 overflow-hidden rounded-md border border-black/50 shadow-md sm:h-32 sm:w-24"
      title={label}
    >
      <div className="playtest-card-back h-full w-full" />
    </div>
  )
}

function ZoneMenu({
  label,
  count,
  open,
  onToggle,
  children,
}: {
  label: string
  count: number
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-1 text-xs font-medium text-[#c8cdd3] hover:text-white"
      >
        {label} ({count})
        <span className="text-[10px] text-[#8b949e]">{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div className="absolute bottom-full left-0 z-20 mb-2 max-h-56 min-w-[12rem] overflow-y-auto rounded-lg border border-[#30363d] bg-[#161b22] p-2 shadow-xl">
          {children}
        </div>
      )}
    </div>
  )
}

export function PlaytestGame({
  youDeck,
  oppDeck,
  bracketLabel,
  onExit,
  onNewOpponent,
}: Props) {
  const [game, setGame] = useState<GameState>(() => createGame(youDeck, oppDeck))
  const [selectedAttackers, setSelectedAttackers] = useState<Set<string>>(new Set())
  const [blockerPairs, setBlockerPairs] = useState<Record<string, string>>({})
  const [selectedAttackerForBlock, setSelectedAttackerForBlock] = useState<string | null>(null)
  const [showZones, setShowZones] = useState(false)
  const [actionsOpen, setActionsOpen] = useState(false)
  const [openZone, setOpenZone] = useState<'gy' | 'exile' | 'command' | null>(null)

  useEffect(() => {
    if (game.winner) return
    if (game.step === 'mulligan') return
    if (game.priority !== 'opponent') return

    const timer = window.setTimeout(() => {
      setGame((g) => runAiUntilHumanPriority(g))
      setSelectedAttackers(new Set())
      setBlockerPairs({})
      setSelectedAttackerForBlock(null)
    }, 500)
    return () => window.clearTimeout(timer)
  }, [game])

  const legal = useMemo(() => getLegalActions(game, 'you'), [game])
  const yourTurn = game.activePlayer === 'you' && game.priority === 'you'

  const dispatch = (action: GameAction) => {
    setGame((g) => {
      const next = applyAction(g, 'you', action)
      if (next.priority === 'opponent' && !next.winner) {
        return runAiUntilHumanPriority(next)
      }
      return next
    })
    if (action.type !== 'declare_attackers') setSelectedAttackers(new Set())
    setActionsOpen(false)
  }

  const onHandClick = (card: GameCard) => {
    if (game.priority !== 'you') return
    if (isLandCard(card.card) && canPlayLand(game, 'you', card.uid)) {
      dispatch({ type: 'play_land', cardUid: card.uid })
      return
    }
    if (canCastCard(game, 'you', card.uid)) {
      dispatch({ type: 'cast_spell', cardUid: card.uid })
    }
  }

  const toggleAttacker = (uid: string) => {
    if (game.step !== 'combat_attackers' || game.priority !== 'you') return
    setSelectedAttackers((prev) => {
      const next = new Set(prev)
      if (next.has(uid)) next.delete(uid)
      else next.add(uid)
      return next
    })
  }

  const onBlockerClick = (blockerUid: string) => {
    if (!selectedAttackerForBlock) return
    setBlockerPairs((prev) => {
      const next = { ...prev }
      for (const [atk, blk] of Object.entries(next)) {
        if (blk === blockerUid) delete next[atk]
      }
      next[selectedAttackerForBlock] = blockerUid
      return next
    })
  }

  const you = game.players.you
  const opp = game.players.opponent
  const attackable = new Set(legalAttackers(you).map((c) => c.uid))
  const oppThinking = game.priority === 'opponent' && !game.winner && game.step !== 'mulligan'

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-[#14181c] text-[#e6edf3]">
      {/* Top bar — Moxfield-style */}
      <header className="flex shrink-0 items-center gap-2 border-b border-black/40 bg-[#1c2128] px-2 py-1.5 sm:px-3">
        <div className="flex items-center gap-1 rounded-md bg-black/30 px-1.5 py-1">
          <span className="text-[10px] font-semibold uppercase text-red-300">Opp</span>
          <span className="min-w-[1.75rem] text-center font-[family-name:var(--font-display)] text-lg font-bold text-white">
            {opp.life}
          </span>
        </div>

        <div className="flex items-center gap-1 rounded-md bg-black/30 px-1.5 py-1">
          <span className="text-sm text-[var(--color-mtg-gold)]" aria-hidden>
            ✦
          </span>
          <span className="min-w-[1.75rem] text-center font-[family-name:var(--font-display)] text-lg font-bold">
            {you.life}
          </span>
        </div>

        <div className="hidden text-xs text-[#8b949e] sm:block">
          {oppDeck.name.split('(')[0].trim()}
          <span className="mx-1">·</span>
          {bracketLabel}
        </div>

        <div className="ml-auto flex items-center gap-2 text-xs">
          <span className="rounded bg-black/35 px-2 py-1 text-[#c8cdd3]">
            Turn {game.turn}
            <span className="mx-1 text-[#8b949e]">·</span>
            {stepLabel(game.step)}
          </span>
          {oppThinking && (
            <span className="animate-pulse text-[11px] text-sky-300">Opponent acting…</span>
          )}
          {game.winner && (
            <span className="font-semibold text-[var(--color-mtg-gold)]">
              {game.winner === 'you' ? 'You win!' : 'Opponent wins'}
            </span>
          )}
          <button
            type="button"
            onClick={onExit}
            className="flex h-8 w-8 items-center justify-center rounded text-[#8b949e] hover:bg-white/10 hover:text-white"
            aria-label="Exit playtest"
          >
            ✕
          </button>
        </div>
      </header>

      {/* Menu row */}
      <div className="relative flex shrink-0 items-center gap-3 border-b border-black/30 bg-[#1c2128]/70 px-3 py-1.5 text-xs">
        <button
          type="button"
          onClick={() => setActionsOpen((v) => !v)}
          className="text-[#c8cdd3] hover:text-white"
        >
          Actions ▾
        </button>
        <span className="text-[#8b949e]">
          Mana {manaPoolLabel(you.mana)}
        </span>
        <span className="ml-auto text-[#8b949e]">
          {game.activePlayer === 'you' ? 'Your turn' : "Opponent's turn"}
        </span>

        {actionsOpen && (
          <div className="absolute left-3 top-full z-30 mt-1 min-w-[10rem] rounded-lg border border-[#30363d] bg-[#161b22] py-1 shadow-xl">
            {(game.step === 'main1' || game.step === 'main2') && game.priority === 'you' && (
              <button
                type="button"
                className="block w-full px-3 py-2 text-left hover:bg-white/5"
                onClick={() => dispatch({ type: 'pass' })}
              >
                {game.step === 'main1' ? 'Go to combat' : 'End turn'}
              </button>
            )}
            {legal.some((a) => a.type === 'cast_commander') && (
              <button
                type="button"
                className="block w-full px-3 py-2 text-left hover:bg-white/5"
                onClick={() => dispatch({ type: 'cast_commander' })}
              >
                Cast commander
              </button>
            )}
            <button
              type="button"
              className="block w-full px-3 py-2 text-left hover:bg-white/5"
              onClick={() => {
                setGame(createGame(youDeck, oppDeck))
                setSelectedAttackers(new Set())
                setBlockerPairs({})
                setActionsOpen(false)
              }}
            >
              Rematch
            </button>
            <button
              type="button"
              className="block w-full px-3 py-2 text-left hover:bg-white/5"
              onClick={() => {
                onNewOpponent()
                setActionsOpen(false)
              }}
            >
              New opponent
            </button>
            {game.step !== 'game_over' && (
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-red-300 hover:bg-white/5"
                onClick={() => dispatch({ type: 'concede' })}
              >
                Concede
              </button>
            )}
          </div>
        )}
      </div>

      {/* Battlefield */}
      <div className="playtest-battlefield relative min-h-0 flex-1 overflow-hidden">
        {/* Opponent half */}
        <div className="absolute inset-x-0 top-0 flex h-1/2 flex-col border-b border-white/5 px-2 pb-1 pt-2 sm:px-4">
          <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wide text-[#8b949e]">
            <span>
              Opponent · Hand {opp.hand.length} · Library {opp.library.length}
            </span>
            {opp.command[0] && (
              <span className="normal-case text-[#c8cdd3]">
                Cmd: {opp.command[0].card.name}
              </span>
            )}
          </div>
          <div className="flex min-h-0 flex-1 flex-wrap content-start gap-2 overflow-y-auto">
            {opp.battlefield.length === 0 ? (
              <p className="m-auto text-xs text-[#5c6570]">Opponent battlefield</p>
            ) : (
              opp.battlefield.map((c) => <CardTile key={c.uid} card={c} />)
            )}
          </div>
        </div>

        {/* Your half */}
        <div className="absolute inset-x-0 bottom-0 flex h-1/2 flex-col px-2 pb-2 pt-1 sm:px-4">
          <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wide text-[#8b949e]">
            <span>You</span>
            {you.command[0] && (
              <button
                type="button"
                disabled={!legal.some((a) => a.type === 'cast_commander')}
                onClick={() => dispatch({ type: 'cast_commander' })}
                className="normal-case text-[var(--color-mtg-gold)] disabled:text-[#5c6570]"
              >
                Cast {you.command[0].card.name}
                {you.commanderCastCount > 0 ? ` (+${you.commanderCastCount * 2})` : ''}
              </button>
            )}
          </div>
          <div className="flex min-h-0 flex-1 flex-wrap content-start gap-2 overflow-y-auto">
            {you.battlefield.length === 0 ? (
              <p className="m-auto text-xs text-[#5c6570]">Your battlefield</p>
            ) : (
              you.battlefield.map((c) => (
                <CardTile
                  key={c.uid}
                  card={c}
                  selected={
                    selectedAttackers.has(c.uid) ||
                    Object.values(blockerPairs).includes(c.uid)
                  }
                  onClick={
                    game.step === 'combat_attackers' && yourTurn && attackable.has(c.uid)
                      ? () => toggleAttacker(c.uid)
                      : game.step === 'combat_blockers' && game.priority === 'you'
                        ? () => onBlockerClick(c.uid)
                        : undefined
                  }
                />
              ))
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowZones((v) => !v)}
          className="absolute bottom-2 right-3 z-10 text-xs text-[#8b949e] underline-offset-2 hover:text-white hover:underline"
        >
          {showZones ? 'Hide Other Zones' : 'Show Other Zones'}
        </button>
      </div>

      {/* Combat / mulligan prompts */}
      {game.step === 'mulligan' && (
        <div className="shrink-0 border-t border-black/40 bg-[#1c2128] px-3 py-2">
          <p className="mb-2 text-sm text-[#c8cdd3]">Keep or mulligan your opening hand.</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => dispatch({ type: 'keep_hand' })}
              className="rounded bg-[var(--color-mtg-gold)] px-4 py-2 text-sm font-semibold text-black"
            >
              Keep hand
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: 'mulligan' })}
              className="rounded border border-[#30363d] px-4 py-2 text-sm"
            >
              Mulligan
            </button>
          </div>
        </div>
      )}

      {game.step === 'combat_attackers' && yourTurn && (
        <div className="shrink-0 border-t border-[var(--color-mtg-gold)]/30 bg-[#1c2128] px-3 py-2">
          <p className="mb-2 text-sm text-[#c8cdd3]">Select attackers, then confirm.</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                dispatch({ type: 'declare_attackers', attackerUids: [...selectedAttackers] })
                setSelectedAttackers(new Set())
              }}
              className="rounded bg-[var(--color-mtg-gold)] px-3 py-1.5 text-sm font-semibold text-black"
            >
              Attack{selectedAttackers.size ? ` (${selectedAttackers.size})` : ' with none'}
            </button>
            <button
              type="button"
              onClick={() => setSelectedAttackers(new Set(attackable))}
              className="rounded border border-[#30363d] px-3 py-1.5 text-sm"
            >
              Select all
            </button>
          </div>
        </div>
      )}

      {game.step === 'combat_blockers' && game.priority === 'you' && (
        <div className="shrink-0 border-t border-sky-500/30 bg-[#1c2128] px-3 py-2">
          <p className="mb-2 text-sm text-[#c8cdd3]">
            Choose an attacker, then tap one of your creatures to block.
          </p>
          <div className="mb-2 flex flex-wrap gap-2">
            {game.combat.map((atk) => {
              const creature = opp.battlefield.find((c) => c.uid === atk.attackerUid)
              if (!creature) return null
              return (
                <button
                  key={atk.attackerUid}
                  type="button"
                  onClick={() => setSelectedAttackerForBlock(atk.attackerUid)}
                  className={`rounded border px-2 py-1 text-xs ${
                    selectedAttackerForBlock === atk.attackerUid
                      ? 'border-sky-400 text-sky-200'
                      : 'border-[#30363d]'
                  }`}
                >
                  Block {creature.card.name}
                  {blockerPairs[atk.attackerUid]
                    ? ` ← ${you.battlefield.find((c) => c.uid === blockerPairs[atk.attackerUid])?.card.name ?? ''}`
                    : ''}
                </button>
              )
            })}
          </div>
          <button
            type="button"
            onClick={() => {
              dispatch({
                type: 'declare_blockers',
                blocks: Object.entries(blockerPairs).map(([attackerUid, blockerUid]) => ({
                  attackerUid,
                  blockerUid,
                })),
              })
              setBlockerPairs({})
              setSelectedAttackerForBlock(null)
            }}
            className="rounded bg-[var(--color-mtg-gold)] px-3 py-1.5 text-sm font-semibold text-black"
          >
            Confirm blockers
          </button>
        </div>
      )}

      {(game.step === 'main1' || game.step === 'main2') && game.priority === 'you' && (
        <div className="flex shrink-0 justify-end border-t border-black/30 bg-[#1c2128]/80 px-3 py-1.5">
          <button
            type="button"
            onClick={() => dispatch({ type: 'pass' })}
            className="rounded bg-[var(--color-mtg-gold)] px-4 py-1.5 text-sm font-semibold text-black"
          >
            {game.step === 'main1' ? 'Go to combat' : 'End turn'}
          </button>
        </div>
      )}

      {/* Other zones drawer */}
      {showZones && (
        <div className="shrink-0 border-t border-black/40 bg-[#1c2128] px-3 py-2">
          <div className="flex flex-wrap gap-4">
            <ZoneMenu
              label="Graveyard"
              count={you.graveyard.length}
              open={openZone === 'gy'}
              onToggle={() => setOpenZone((z) => (z === 'gy' ? null : 'gy'))}
            >
              {you.graveyard.length === 0 ? (
                <p className="px-1 text-xs text-[#8b949e]">Empty</p>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {you.graveyard.map((c) => (
                    <CardTile key={c.uid} card={c} size="sm" showPt={false} />
                  ))}
                </div>
              )}
            </ZoneMenu>
            <ZoneMenu
              label="Exile"
              count={you.exile.length}
              open={openZone === 'exile'}
              onToggle={() => setOpenZone((z) => (z === 'exile' ? null : 'exile'))}
            >
              {you.exile.length === 0 ? (
                <p className="px-1 text-xs text-[#8b949e]">Empty</p>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {you.exile.map((c) => (
                    <CardTile key={c.uid} card={c} size="sm" showPt={false} />
                  ))}
                </div>
              )}
            </ZoneMenu>
            <ZoneMenu
              label="Command"
              count={you.command.length}
              open={openZone === 'command'}
              onToggle={() => setOpenZone((z) => (z === 'command' ? null : 'command'))}
            >
              {you.command.length === 0 ? (
                <p className="px-1 text-xs text-[#8b949e]">On battlefield</p>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {you.command.map((c) => (
                    <CardTile
                      key={c.uid}
                      card={c}
                      size="sm"
                      onClick={
                        legal.some((a) => a.type === 'cast_commander')
                          ? () => dispatch({ type: 'cast_commander' })
                          : undefined
                      }
                    />
                  ))}
                </div>
              )}
            </ZoneMenu>
            <div className="text-xs text-[#8b949e]">
              Opp GY {opp.graveyard.length} · Opp exile {opp.exile.length}
            </div>
          </div>
        </div>
      )}

      {/* Bottom: Hand + Library */}
      <footer className="shrink-0 border-t border-black/50 bg-[#1c2128] px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 sm:px-4">
        <div className="flex items-end gap-3">
          <div className="min-w-0 flex-1">
            <p className="mb-1 text-xs font-medium text-[#c8cdd3]">
              Hand ({you.hand.length})
            </p>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {you.hand.map((card) => {
                const playable =
                  (isLandCard(card.card) && canPlayLand(game, 'you', card.uid)) ||
                  canCastCard(game, 'you', card.uid)
                return (
                  <CardTile
                    key={card.uid}
                    card={card}
                    size="hand"
                    dimmed={game.priority === 'you' && !playable && game.step !== 'mulligan'}
                    onClick={
                      game.priority === 'you' && game.step !== 'mulligan'
                        ? () => onHandClick(card)
                        : undefined
                    }
                  />
                )
              })}
            </div>
          </div>
          <div className="shrink-0 text-center">
            <p className="mb-1 text-xs font-medium text-[#c8cdd3]">
              Library ({you.library.length})
            </p>
            <CardBack label={`${you.library.length} cards`} />
          </div>
        </div>
      </footer>
    </div>
  )
}
