import type { GameAction, GameState, PlayerId } from '../types/playtest-game'
import {
  applyAction,
  floatAllMana,
  getLegalActions,
  legalAttackers,
  opponentOf,
} from './playtest-engine'
import { canPayCost } from './playtest-mana'
import {
  isCreatureCard,
  isLandCard,
  isManaRock,
  isPermanentSpell,
  spellCost,
} from './playtest-card-stats'

/**
 * Choose and apply one AI action. Returns the same state if nothing to do.
 * Call in a loop until priority returns to the human or the game ends.
 */
export function pickAiAction(state: GameState, ai: PlayerId = 'opponent'): GameAction | null {
  if (state.winner || state.priority !== ai) return null

  const actions = getLegalActions(state, ai)
  if (actions.length === 0) return null

  // Blocking
  if (state.step === 'combat_blockers' && state.awaitingBlockers) {
    return { type: 'declare_blockers', blocks: chooseBlocks(state, ai) }
  }

  // Declare attackers
  if (state.step === 'combat_attackers' && state.activePlayer === ai) {
    const atk = legalAttackers(state.players[ai]).map((c) => c.uid)
    return { type: 'declare_attackers', attackerUids: atk }
  }

  if (state.step === 'main1' || state.step === 'main2') {
    const player = state.players[ai]

    // 1) Play a land
    const landAct = actions.find((a) => a.type === 'play_land')
    if (landAct) return landAct

    const floated = floatAllMana(state, ai)
    const mana = floated.players[ai].mana

    // 2) Cast cheapest mana rock
    const rocks = player.hand
      .filter((c) => isManaRock(c.card))
      .sort((a, b) => a.card.cmc - b.card.cmc)
    for (const rock of rocks) {
      if (canPayCost(mana, spellCost(rock.card))) {
        return { type: 'cast_spell', cardUid: rock.uid }
      }
    }

    // 3) Cast commander if we can and it's strong enough / board needs it
    const cmd = actions.find((a) => a.type === 'cast_commander')
    if (cmd) {
      const creatures = player.battlefield.filter((c) => isCreatureCard(c.card)).length
      if (creatures <= 2 || player.commanderCastCount === 0) return cmd
    }

    // 4) Cast cheapest creature, then other permanents, then spells
    const castable = player.hand
      .filter((c) => !isLandCard(c.card) && canPayCost(mana, spellCost(c.card)))
      .sort((a, b) => {
        const score = (c: typeof a) => {
          let s = -c.card.cmc
          if (isCreatureCard(c.card)) s += 10
          else if (isPermanentSpell(c.card)) s += 5
          return s
        }
        return score(b) - score(a)
      })

    if (castable[0]) {
      return { type: 'cast_spell', cardUid: castable[0].uid }
    }

    return { type: 'pass' }
  }

  const pass = actions.find((a) => a.type === 'pass')
  return pass ?? actions[0] ?? null
}

function chooseBlocks(
  state: GameState,
  defender: PlayerId,
): Array<{ attackerUid: string; blockerUid: string }> {
  const attackers = state.combat
    .map((c) => state.players[opponentOf(defender)].battlefield.find((x) => x.uid === c.attackerUid))
    .filter(Boolean)

  const blockers = state.players[defender].battlefield.filter(
    (c) => isCreatureCard(c.card) && !c.tapped,
  )
  const blocks: Array<{ attackerUid: string; blockerUid: string }> = []
  const used = new Set<string>()

  const sortedAtk = [...attackers].sort((a, b) => (b!.power) - (a!.power))
  const available = [...blockers].sort((a, b) => a.power - b.power)

  const lethal =
    sortedAtk.reduce((s, a) => s + (a?.power ?? 0), 0) >= state.players[defender].life

  for (const atk of sortedAtk) {
    if (!atk) continue
    // Prefer a blocker that survives and kills, else chump if lethal
    let choice = available.find(
      (b) =>
        !used.has(b.uid) &&
        b.power >= atk.toughness &&
        b.toughness > atk.power,
    )
    if (!choice && lethal) {
      choice = available.find((b) => !used.has(b.uid))
    }
    if (!choice) {
      // Trade if we can kill the attacker
      choice = available.find((b) => !used.has(b.uid) && b.power >= atk.toughness)
    }
    if (choice) {
      used.add(choice.uid)
      blocks.push({ attackerUid: atk.uid, blockerUid: choice.uid })
    }
  }
  return blocks
}

/** Run the AI until the human has priority or the game ends. Caps steps to avoid loops. */
export function runAiUntilHumanPriority(state: GameState): GameState {
  let next = state
  for (let i = 0; i < 40; i++) {
    if (next.winner) return next
    if (next.priority === 'you' && next.step !== 'mulligan') return next
    if (next.step === 'mulligan') return next

    const action = pickAiAction(next, 'opponent')
    if (!action) {
      // If AI has priority but no action, force a pass when legal
      if (next.priority === 'opponent') {
        const forced = applyAction(next, 'opponent', { type: 'pass' })
        if (forced === next) return next
        next = forced
        continue
      }
      return next
    }
    next = applyAction(next, 'opponent', action)
  }
  return next
}
