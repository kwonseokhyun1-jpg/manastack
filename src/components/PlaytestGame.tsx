import { useEffect, useMemo, useState } from 'react'
import type { ResolvedDeck } from '../types/playtest'
import type { GameAction, GameCard, GameState, PlayerId } from '../types/playtest-game'
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
    case 'untap':
      return 'Untap'
    case 'upkeep':
      return 'Upkeep'
    case 'draw':
      return 'Draw'
    case 'main1':
      return 'Main phase 1'
    case 'combat_attackers':
      return 'Declare attackers'
    case 'combat_blockers':
      return 'Declare blockers'
    case 'combat_damage':
      return 'Combat damage'
    case 'main2':
      return 'Main phase 2'
    case 'end':
      return 'End step'
    case 'game_over':
      return 'Game over'
    default:
      return step
  }
}

function CardArt({
  card,
  faceDown,
  dimmed,
  selected,
  onClick,
  badge,
}: {
  card?: GameCard
  faceDown?: boolean
  dimmed?: boolean
  selected?: boolean
  onClick?: () => void
  badge?: string
}) {
  if (faceDown || !card) {
    return (
      <button
        type="button"
        disabled={!onClick}
        onClick={onClick}
        className={`relative h-[5.5rem] w-16 shrink-0 rounded-md border border-[var(--color-mtg-border)] bg-gradient-to-br from-[#1a2740] to-[#0d1117] shadow ${
          onClick ? 'cursor-pointer hover:border-[var(--color-mtg-gold-dim)]' : ''
        }`}
        title="Face-down card"
      >
        <span className="absolute inset-0 flex items-center justify-center text-[10px] text-[var(--color-mtg-muted)]">
          MTG
        </span>
      </button>
    )
  }

  return (
    <button
      type="button"
      disabled={!onClick}
      onClick={onClick}
      className={`relative h-[5.5rem] w-16 shrink-0 overflow-hidden rounded-md border shadow transition ${
        selected
          ? 'border-sky-400 ring-2 ring-sky-400'
          : 'border-[var(--color-mtg-border)]'
      } ${dimmed ? 'opacity-50' : ''} ${
        card.tapped ? 'rotate-90' : ''
      } ${onClick ? 'cursor-pointer hover:scale-105' : 'cursor-default'}`}
      title={`${card.card.name}${card.isCommander ? ' (Commander)' : ''}`}
    >
      {card.card.image ? (
        <img
          src={card.card.image}
          alt={card.card.name}
          className="h-full w-full object-cover"
          draggable={false}
        />
      ) : (
        <span className="flex h-full items-center justify-center bg-[var(--color-mtg-bg)] p-1 text-center text-[8px]">
          {card.card.name}
        </span>
      )}
      {isCreatureCard(card.card) && (
        <span className="absolute bottom-0 right-0 rounded-tl bg-black/80 px-1 text-[9px] text-white">
          {card.power}/{card.toughness}
        </span>
      )}
      {badge && (
        <span className="absolute left-0 top-0 rounded-br bg-[var(--color-mtg-gold)] px-1 text-[8px] font-bold text-black">
          {badge}
        </span>
      )}
      {card.isCommander && (
        <span className="absolute left-0 top-0 h-1.5 w-full bg-[var(--color-mtg-gold)]" />
      )}
    </button>
  )
}

function PermanentRow({
  cards,
  hidden,
  selectedUids,
  onSelect,
}: {
  cards: GameCard[]
  hidden?: boolean
  selectedUids?: Set<string>
  onSelect?: (uid: string) => void
}) {
  if (cards.length === 0) {
    return <p className="text-xs text-[var(--color-mtg-muted)]">No permanents</p>
  }
  return (
    <div className="flex flex-wrap gap-2">
      {cards.map((c) => (
        <CardArt
          key={c.uid}
          card={c}
          faceDown={hidden}
          selected={selectedUids?.has(c.uid)}
          onClick={onSelect ? () => onSelect(c.uid) : undefined}
        />
      ))}
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

  // When it's the opponent's priority, run AI
  useEffect(() => {
    if (game.winner) return
    if (game.step === 'mulligan') return
    if (game.priority !== 'opponent') return

    const timer = window.setTimeout(() => {
      setGame((g) => runAiUntilHumanPriority(g))
      setSelectedAttackers(new Set())
      setBlockerPairs({})
      setSelectedAttackerForBlock(null)
    }, 450)
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
    if (action.type !== 'declare_attackers') {
      setSelectedAttackers(new Set())
    }
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

  const confirmAttackers = () => {
    dispatch({ type: 'declare_attackers', attackerUids: [...selectedAttackers] })
    setSelectedAttackers(new Set())
  }

  const onBlockerClick = (blockerUid: string) => {
    if (!selectedAttackerForBlock) return
    setBlockerPairs((prev) => {
      const next = { ...prev }
      // Remove if this blocker already assigned
      for (const [atk, blk] of Object.entries(next)) {
        if (blk === blockerUid) delete next[atk]
      }
      next[selectedAttackerForBlock] = blockerUid
      return next
    })
  }

  const confirmBlockers = () => {
    const blocks = Object.entries(blockerPairs).map(([attackerUid, blockerUid]) => ({
      attackerUid,
      blockerUid,
    }))
    dispatch({ type: 'declare_blockers', blocks })
    setBlockerPairs({})
    setSelectedAttackerForBlock(null)
  }

  const you = game.players.you
  const opp = game.players.opponent
  const attackable = new Set(legalAttackers(you).map((c) => c.uid))

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button
            type="button"
            onClick={onExit}
            className="text-sm text-[var(--color-mtg-muted)] transition hover:text-[var(--color-mtg-gold)]"
          >
            ← Back to deck setup
          </button>
          <h2 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--color-mtg-gold)]">
            Playtest duel
          </h2>
          <p className="text-sm text-[var(--color-mtg-muted)]">
            Rules-based 1v1 Commander. Opponent hand/library stay hidden — you only control your
            own cards.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onNewOpponent}
            className="rounded-lg border border-[var(--color-mtg-border)] px-3 py-1.5 text-xs text-[var(--color-mtg-muted)] hover:text-white"
          >
            New opponent ({bracketLabel})
          </button>
          <button
            type="button"
            onClick={() => {
              setGame(createGame(youDeck, oppDeck))
              setSelectedAttackers(new Set())
              setBlockerPairs({})
            }}
            className="rounded-lg border border-red-500/40 px-3 py-1.5 text-xs text-red-300"
          >
            Rematch
          </button>
          {game.step !== 'game_over' && (
            <button
              type="button"
              onClick={() => dispatch({ type: 'concede' })}
              className="rounded-lg border border-[var(--color-mtg-border)] px-3 py-1.5 text-xs text-[var(--color-mtg-muted)]"
            >
              Concede
            </button>
          )}
        </div>
      </div>

      {/* Status bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--color-mtg-border)] bg-[var(--color-mtg-panel)] px-4 py-3 text-sm">
        <span>
          Turn <span className="text-[var(--color-mtg-gold)]">{game.turn}</span>
        </span>
        <span className="text-[var(--color-mtg-muted)]">·</span>
        <span>
          Active:{' '}
          <span className="text-white">
            {game.players[game.activePlayer as PlayerId].name === you.name &&
            game.activePlayer === 'you'
              ? 'You'
              : game.activePlayer === 'you'
                ? 'You'
                : 'Opponent'}
          </span>
        </span>
        <span className="text-[var(--color-mtg-muted)]">·</span>
        <span>
          Step: <span className="text-sky-300">{stepLabel(game.step)}</span>
        </span>
        <span className="text-[var(--color-mtg-muted)]">·</span>
        <span>
          Mana: <span className="text-[var(--color-mtg-gold)]">{manaPoolLabel(you.mana)}</span>
        </span>
        {game.winner && (
          <>
            <span className="text-[var(--color-mtg-muted)]">·</span>
            <span className="font-semibold text-[var(--color-mtg-gold)]">
              {game.winner === 'you' ? 'You win!' : 'Opponent wins.'} {game.winReason}
            </span>
          </>
        )}
      </div>

      {/* Opponent */}
      <section className="rounded-xl border border-red-500/30 bg-[var(--color-mtg-panel)]/80 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-red-300">Opponent</p>
            <h3 className="font-[family-name:var(--font-display)] text-lg text-white">
              {oppDeck.name}
            </h3>
            <p className="text-xs text-[var(--color-mtg-muted)]">{bracketLabel}</p>
          </div>
          <div className="flex gap-4 text-center">
            <div>
              <p className="text-[10px] uppercase text-[var(--color-mtg-muted)]">Life</p>
              <p className="font-[family-name:var(--font-display)] text-2xl">{opp.life}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-[var(--color-mtg-muted)]">Hand</p>
              <p className="text-xl text-white">{opp.hand.length}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-[var(--color-mtg-muted)]">Library</p>
              <p className="text-xl text-white">{opp.library.length}</p>
            </div>
          </div>
        </div>

        <div className="mb-2 flex flex-wrap gap-2">
          {Array.from({ length: opp.hand.length }).map((_, i) => (
            <CardArt key={`oh-${i}`} faceDown />
          ))}
        </div>

        {opp.command[0] && (
          <div className="mb-3">
            <p className="mb-1 text-xs text-[var(--color-mtg-muted)]">Command zone</p>
            <CardArt card={opp.command[0]} badge="CMD" />
          </div>
        )}

        <p className="mb-1 text-xs uppercase text-[var(--color-mtg-muted)]">Battlefield</p>
        <PermanentRow cards={opp.battlefield} />
      </section>

      {/* Combat prompt */}
      {game.step === 'combat_attackers' && yourTurn && (
        <div className="rounded-lg border border-[var(--color-mtg-gold-dim)] bg-[var(--color-mtg-gold)]/10 px-4 py-3 text-sm">
          Select attackers, then confirm. Creatures with summoning sickness or defender cannot
          attack.
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={confirmAttackers}
              className="rounded bg-[var(--color-mtg-gold)] px-3 py-1.5 text-sm font-semibold text-black"
            >
              Attack{selectedAttackers.size ? ` (${selectedAttackers.size})` : ' with none'}
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedAttackers(new Set(attackable))
              }}
              className="rounded border border-[var(--color-mtg-border)] px-3 py-1.5 text-sm"
            >
              Select all
            </button>
          </div>
        </div>
      )}

      {game.step === 'combat_blockers' && game.priority === 'you' && (
        <div className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-4 py-3 text-sm">
          Choose an attacker, then a blocker. Confirm when done.
          <div className="mt-2 flex flex-wrap gap-2">
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
                      : 'border-[var(--color-mtg-border)]'
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
            onClick={confirmBlockers}
            className="mt-2 rounded bg-[var(--color-mtg-gold)] px-3 py-1.5 text-sm font-semibold text-black"
          >
            Confirm blockers
          </button>
        </div>
      )}

      {/* You */}
      <section className="rounded-xl border border-[var(--color-mtg-gold)]/30 bg-[var(--color-mtg-panel)]/80 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-mtg-gold)]">
              You
            </p>
            <h3 className="font-[family-name:var(--font-display)] text-lg text-white">
              {youDeck.name}
            </h3>
          </div>
          <div className="flex gap-4 text-center">
            <div>
              <p className="text-[10px] uppercase text-[var(--color-mtg-muted)]">Life</p>
              <p className="font-[family-name:var(--font-display)] text-2xl">{you.life}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-[var(--color-mtg-muted)]">Library</p>
              <p className="text-xl text-white">{you.library.length}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-[var(--color-mtg-muted)]">GY</p>
              <p className="text-xl text-white">{you.graveyard.length}</p>
            </div>
          </div>
        </div>

        <p className="mb-1 text-xs uppercase text-[var(--color-mtg-muted)]">Battlefield</p>
        <PermanentRow
          cards={you.battlefield}
          selectedUids={
            game.step === 'combat_attackers'
              ? selectedAttackers
              : selectedAttackerForBlock
                ? new Set(Object.values(blockerPairs))
                : undefined
          }
          onSelect={
            game.step === 'combat_attackers' && yourTurn
              ? (uid) => {
                  if (attackable.has(uid)) toggleAttacker(uid)
                }
              : game.step === 'combat_blockers' && game.priority === 'you'
                ? (uid) => onBlockerClick(uid)
                : undefined
          }
        />

        {you.command[0] && (
          <div className="mt-3">
            <p className="mb-1 text-xs text-[var(--color-mtg-muted)]">
              Command zone
              {you.commanderCastCount > 0 ? ` · tax {${you.commanderCastCount * 2}}` : ''}
            </p>
            <CardArt
              card={you.command[0]}
              badge="CMD"
              dimmed={!legal.some((a) => a.type === 'cast_commander')}
              onClick={
                legal.some((a) => a.type === 'cast_commander')
                  ? () => dispatch({ type: 'cast_commander' })
                  : undefined
              }
            />
          </div>
        )}

        <div className="mt-4">
          <p className="mb-1 text-xs uppercase text-[var(--color-mtg-muted)]">
            Hand ({you.hand.length}) — click a land to play or a spell you can afford to cast
          </p>
          <div className="flex flex-wrap gap-2">
            {you.hand.map((card) => {
              const playable =
                (isLandCard(card.card) && canPlayLand(game, 'you', card.uid)) ||
                canCastCard(game, 'you', card.uid)
              return (
                <CardArt
                  key={card.uid}
                  card={card}
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

        <div className="mt-4 flex flex-wrap gap-2">
          {game.step === 'mulligan' && (
            <>
              <button
                type="button"
                onClick={() => dispatch({ type: 'keep_hand' })}
                className="rounded-lg bg-[var(--color-mtg-gold)] px-4 py-2 text-sm font-semibold text-black"
              >
                Keep hand
              </button>
              <button
                type="button"
                onClick={() => dispatch({ type: 'mulligan' })}
                className="rounded-lg border border-[var(--color-mtg-border)] px-4 py-2 text-sm"
              >
                Mulligan
              </button>
            </>
          )}
          {(game.step === 'main1' || game.step === 'main2') && game.priority === 'you' && (
            <button
              type="button"
              onClick={() => dispatch({ type: 'pass' })}
              className="rounded-lg bg-[var(--color-mtg-gold)] px-4 py-2 text-sm font-semibold text-black"
            >
              {game.step === 'main1' ? 'Go to combat' : 'End turn'}
            </button>
          )}
        </div>
      </section>

      {/* Log */}
      <section className="max-h-48 overflow-y-auto rounded-xl border border-[var(--color-mtg-border)] bg-[var(--color-mtg-bg)]/60 p-3">
        <p className="mb-2 text-xs font-semibold uppercase text-[var(--color-mtg-muted)]">
          Game log
        </p>
        <ul className="space-y-1 text-xs text-[var(--color-mtg-muted)]">
          {[...game.log].reverse().map((e) => (
            <li key={e.id}>• {e.text}</li>
          ))}
        </ul>
      </section>
    </div>
  )
}
