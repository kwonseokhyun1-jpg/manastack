import type { CardRecord } from '../types/card'
import type { ManaColor } from '../types/mtg'
import type { ResolvedDeck } from '../types/playtest'
import type {
  CombatAttacker,
  GameAction,
  GameCard,
  GameState,
  PlayerGameState,
  PlayerId,
  TurnStep,
} from '../types/playtest-game'
import { COMMANDER_DAMAGE_TO_LOSE, STARTING_LIFE } from '../types/playtest-game'
import {
  addMana,
  canPayCost,
  emptyManaPool,
  payCost,
  poolTotal,
  type ManaPool,
} from './playtest-mana'
import {
  estimatePowerToughness,
  hasKeyword,
  isCreatureCard,
  isInstantOrSorcery,
  isLandCard,
  isManaRock,
  isPermanentSpell,
  landProduces,
  spellCost,
} from './playtest-card-stats'
import { shuffle } from './playtest-state'

let uidSeq = 0
let logSeq = 0

function newUid(): string {
  uidSeq += 1
  return `gc-${uidSeq}`
}

function toGameCard(card: CardRecord, opts?: { isCommander?: boolean }): GameCard {
  const pt = estimatePowerToughness(card)
  return {
    uid: newUid(),
    card,
    isCommander: opts?.isCommander,
    tapped: false,
    summoningSickness: true,
    damageMarked: 0,
    power: pt.power,
    toughness: pt.toughness,
  }
}

function opponentOf(id: PlayerId): PlayerId {
  return id === 'you' ? 'opponent' : 'you'
}

function pushLog(state: GameState, text: string): GameState {
  logSeq += 1
  return {
    ...state,
    log: [...state.log.slice(-80), { id: logSeq, text }],
  }
}

function createPlayer(id: PlayerId, deck: ResolvedDeck): PlayerGameState {
  const library = shuffle(deck.mainboard.map((c) => toGameCard(c)))
  const hand = library.splice(0, 7)
  const command = deck.commander
    ? [toGameCard(deck.commander, { isCommander: true })]
    : []
  return {
    id,
    name: id === 'you' ? deck.name : deck.name,
    library,
    hand,
    battlefield: [],
    graveyard: [],
    exile: [],
    command,
    life: STARTING_LIFE,
    landsPlayedThisTurn: 0,
    commanderCastCount: 0,
    commanderDamage: {},
    mana: emptyManaPool(),
    deck,
  }
}

export function createGame(youDeck: ResolvedDeck, oppDeck: ResolvedDeck): GameState {
  uidSeq = 0
  logSeq = 0
  const youFirst = Math.random() < 0.5
  const activePlayer: PlayerId = youFirst ? 'you' : 'opponent'
  let state: GameState = {
    players: {
      you: createPlayer('you', youDeck),
      opponent: createPlayer('opponent', oppDeck),
    },
    activePlayer,
    priority: 'you',
    step: 'mulligan',
    turn: 1,
    isFirstTurn: true,
    combat: [],
    log: [],
    winner: null,
    winReason: null,
    awaitingBlockers: false,
  }
  state = pushLog(
    state,
    `${state.players[activePlayer].name} plays first. Mulligan phase — keep or mulligan your hand.`,
  )
  // Opponent auto-keeps for simplicity after player decides; handled in mulligan flow
  return state
}

function updatePlayer(
  state: GameState,
  id: PlayerId,
  updater: (p: PlayerGameState) => PlayerGameState,
): GameState {
  return {
    ...state,
    players: {
      ...state.players,
      [id]: updater(state.players[id]),
    },
  }
}

function draw(state: GameState, id: PlayerId, n = 1): GameState {
  let next = state
  for (let i = 0; i < n; i++) {
    const p = next.players[id]
    if (p.library.length === 0) {
      return {
        ...next,
        winner: opponentOf(id),
        winReason: `${p.name} draws from an empty library.`,
        step: 'game_over',
      }
    }
    const [top, ...rest] = p.library
    next = updatePlayer(next, id, (pl) => ({
      ...pl,
      library: rest,
      hand: [...pl.hand, top],
    }))
  }
  return next
}

function clearMana(state: GameState, id: PlayerId): GameState {
  return updatePlayer(state, id, (p) => ({ ...p, mana: emptyManaPool() }))
}

function checkWin(state: GameState): GameState {
  if (state.winner) return state
  for (const id of ['you', 'opponent'] as PlayerId[]) {
    const p = state.players[id]
    if (p.life <= 0) {
      return {
        ...state,
        winner: opponentOf(id),
        winReason: `${p.name} reached 0 life.`,
        step: 'game_over',
      }
    }
    for (const [cmdUid, dmg] of Object.entries(p.commanderDamage)) {
      if (dmg >= COMMANDER_DAMAGE_TO_LOSE) {
        return {
          ...state,
          winner: opponentOf(id),
          winReason: `${p.name} took ${COMMANDER_DAMAGE_TO_LOSE}+ commander damage.`,
          step: 'game_over',
        }
      }
      void cmdUid
    }
  }
  return state
}

function removeFromHand(player: PlayerGameState, uid: string): {
  player: PlayerGameState
  card: GameCard | null
} {
  const idx = player.hand.findIndex((c) => c.uid === uid)
  if (idx === -1) return { player, card: null }
  const card = player.hand[idx]
  const hand = player.hand.filter((_, i) => i !== idx)
  return { player: { ...player, hand }, card }
}

function putIntoPlay(player: PlayerGameState, card: GameCard): PlayerGameState {
  const entering: GameCard = {
    ...card,
    tapped: false,
    summoningSickness: isCreatureCard(card.card),
    damageMarked: 0,
  }
  if (hasKeyword(card.card, 'haste')) {
    entering.summoningSickness = false
  }
  return {
    ...player,
    battlefield: [...player.battlefield, entering],
  }
}

/** Float mana from untapped lands + mana rocks (auto-tap). */
export function floatAllMana(state: GameState, id: PlayerId): GameState {
  let next = state
  let pool: ManaPool = { ...next.players[id].mana }
  const bf = next.players[id].battlefield.map((perm) => {
    if (perm.tapped) return perm
    if (isLandCard(perm.card)) {
      const colors = landProduces({
        ...perm.card,
        color_identity:
          perm.card.color_identity.length > 0
            ? perm.card.color_identity
            : next.players[id].deck.colorIdentity,
      })
      const color = colors[0] ?? 'C'
      pool = addMana(pool, color, colors.length > 1 && colors[0] === colors[1] ? 2 : 1)
      // Ancient Tomb style double C
      if (colors.length === 2 && colors[0] === 'C' && colors[1] === 'C') {
        // already added 2 if we pass amount — fix: landProduces returns ['C','C']
      }
      return { ...perm, tapped: true }
    }
    if (isManaRock(perm.card)) {
      // Includes mana dorks — tap for mana abilities during float
      if (isCreatureCard(perm.card) && perm.summoningSickness && !hasKeyword(perm.card, 'haste')) {
        return perm
      }
      const text = perm.card.oracle_text ?? ''
      if (/add \{c\}\{c\}/i.test(text)) {
        pool = addMana(pool, 'C', 2)
      } else if (/any color/i.test(text)) {
        const idColors = next.players[id].deck.colorIdentity
        pool = addMana(pool, idColors[0] ?? 'C')
      } else {
        const m = text.match(/add \{([WUBRGC])\}/i)
        pool = addMana(pool, (m?.[1]?.toUpperCase() as ManaColor | 'C') ?? 'C')
      }
      return { ...perm, tapped: true }
    }
    return perm
  })
  next = updatePlayer(next, id, (p) => ({ ...p, battlefield: bf, mana: pool }))
  return next
}

function autoPay(state: GameState, id: PlayerId, cost: ReturnType<typeof spellCost>): GameState | null {
  const next = floatAllMana(state, id)
  const paid = payCost(next.players[id].mana, cost)
  if (!paid) return null
  return updatePlayer(next, id, (p) => ({ ...p, mana: paid }))
}

function resolveInstantOrSorcery(
  state: GameState,
  caster: PlayerId,
  card: GameCard,
): GameState {
  const opp = opponentOf(caster)
  let next = state
  const text = (card.card.oracle_text ?? '').toLowerCase()
  const cmc = Math.max(1, card.card.cmc)

  // Damage
  if (/deals \d+ damage|deal .* damage/.test(text) || /\blightning\b|shock|bolt/.test(card.card.name.toLowerCase())) {
    const m = text.match(/deals (\d+) damage/)
    const dmg = m ? Number(m[1]) : Math.max(2, cmc)
    next = updatePlayer(next, opp, (p) => ({ ...p, life: p.life - dmg }))
    next = pushLog(next, `${card.card.name} deals ${dmg} damage to ${next.players[opp].name}.`)
  } else if (/draw .* card|draw a card|draw two|draw three/.test(text)) {
    const m = text.match(/draw (\w+)/)
    let n = 1
    if (m?.[1] === 'two' || m?.[1] === '2') n = 2
    if (m?.[1] === 'three' || m?.[1] === '3') n = 3
    if (/\d+/.test(m?.[1] ?? '')) n = Number(m![1])
    next = draw(next, caster, n)
    next = pushLog(next, `${next.players[caster].name} draws ${n} card(s) from ${card.card.name}.`)
  } else if (/destroy target creature|exile target creature|destroy all creatures/.test(text)) {
    const targets = next.players[opp].battlefield.filter((c) => isCreatureCard(c.card))
    if (targets.length > 0) {
      const victim = [...targets].sort((a, b) => b.power - a.power)[0]
      next = updatePlayer(next, opp, (p) => ({
        ...p,
        battlefield: p.battlefield.filter((c) => c.uid !== victim.uid),
        graveyard: victim.isCommander
          ? p.graveyard
          : [...p.graveyard, { ...victim, tapped: false, damageMarked: 0 }],
        command: victim.isCommander
          ? [...p.command, { ...victim, tapped: false, damageMarked: 0, summoningSickness: true }]
          : p.command,
      }))
      next = pushLog(next, `${card.card.name} removes ${victim.card.name}.`)
    } else {
      next = pushLog(next, `${card.card.name} resolves with no target.`)
    }
  } else if (/search your library for .* land|put .* land .* battlefield/.test(text)) {
    const p = next.players[caster]
    const landIdx = p.library.findIndex((c) => isLandCard(c.card))
    if (landIdx >= 0) {
      const land = p.library[landIdx]
      next = updatePlayer(next, caster, (pl) => {
        const library = pl.library.filter((_, i) => i !== landIdx)
        return putIntoPlay({ ...pl, library }, { ...land, summoningSickness: false })
      })
      next = pushLog(next, `${card.card.name} ramps a land onto the battlefield.`)
    }
  } else if (/you gain \d+ life|gain .* life/.test(text)) {
    const m = text.match(/gain (\d+) life/)
    const gain = m ? Number(m[1]) : cmc
    next = updatePlayer(next, caster, (p) => ({ ...p, life: p.life + gain }))
    next = pushLog(next, `${next.players[caster].name} gains ${gain} life.`)
  } else {
    // Generic value spell: ping opponent for 1 or dig
    next = updatePlayer(next, opp, (p) => ({ ...p, life: p.life - 1 }))
    next = pushLog(
      next,
      `${card.card.name} resolves (simplified effect) — ${next.players[opp].name} loses 1 life.`,
    )
  }

  next = updatePlayer(next, caster, (p) => ({
    ...p,
    graveyard: [...p.graveyard, { ...card, tapped: false, damageMarked: 0 }],
  }))
  return checkWin(next)
}

function castFromHand(state: GameState, id: PlayerId, cardUid: string): GameState | null {
  const player = state.players[id]
  const found = removeFromHand(player, cardUid)
  if (!found.card) return null
  const card = found.card
  if (isLandCard(card.card)) return null

  const cost = spellCost(card.card)
  let next = { ...state, players: { ...state.players, [id]: found.player } }
  const paid = autoPay(next, id, cost)
  if (!paid) return null
  next = paid
  next = pushLog(next, `${next.players[id].name} casts ${card.card.name}.`)

  if (isPermanentSpell(card.card)) {
    next = updatePlayer(next, id, (p) => putIntoPlay(p, card))
    return next
  }
  if (isInstantOrSorcery(card.card)) {
    return resolveInstantOrSorcery(next, id, card)
  }
  // Fallback: treat as permanent
  next = updatePlayer(next, id, (p) => putIntoPlay(p, card))
  return next
}

function castCommander(state: GameState, id: PlayerId): GameState | null {
  const player = state.players[id]
  const commander = player.command[0]
  if (!commander) return null
  const tax = player.commanderCastCount * 2
  const cost = spellCost(commander.card, tax)
  const paid = autoPay(state, id, cost)
  if (!paid) return null
  let next = paid
  next = updatePlayer(next, id, (p) => ({
    ...p,
    command: p.command.filter((c) => c.uid !== commander.uid),
    commanderCastCount: p.commanderCastCount + 1,
  }))
  next = updatePlayer(next, id, (p) => putIntoPlay(p, commander))
  next = pushLog(
    next,
    `${next.players[id].name} casts commander ${commander.card.name}${tax ? ` (tax {${tax}})` : ''}.`,
  )
  return next
}

function playLand(state: GameState, id: PlayerId, cardUid: string): GameState | null {
  const player = state.players[id]
  if (player.landsPlayedThisTurn >= 1) return null
  const found = removeFromHand(player, cardUid)
  if (!found.card || !isLandCard(found.card.card)) return null
  let next = updatePlayer(state, id, () =>
    putIntoPlay(
      { ...found.player, landsPlayedThisTurn: found.player.landsPlayedThisTurn + 1 },
      { ...found.card!, summoningSickness: false },
    ),
  )
  next = pushLog(next, `${next.players[id].name} plays ${found.card.card.name}.`)
  return next
}

function legalAttackers(player: PlayerGameState): GameCard[] {
  return player.battlefield.filter(
    (c) =>
      isCreatureCard(c.card) &&
      !c.tapped &&
      !c.summoningSickness &&
      !hasKeyword(c.card, 'defender'),
  )
}

function applyAttackers(state: GameState, uids: string[]): GameState {
  const active = state.activePlayer
  const legal = new Set(legalAttackers(state.players[active]).map((c) => c.uid))
  const chosen = uids.filter((u) => legal.has(u))
  let next = updatePlayer(state, active, (p) => ({
    ...p,
    battlefield: p.battlefield.map((c) =>
      chosen.includes(c.uid) ? { ...c, tapped: true } : c,
    ),
  }))
  const combat: CombatAttacker[] = chosen.map((attackerUid) => ({
    attackerUid,
    blockerUids: [],
  }))
  next = { ...next, combat, step: 'combat_blockers', awaitingBlockers: true }
  next = {
    ...next,
    priority: opponentOf(active),
  }
  if (chosen.length === 0) {
    next = pushLog(next, `${next.players[active].name} does not attack.`)
    next = { ...next, priority: active, awaitingBlockers: false, combat: [] }
    return advanceTo(next, 'main2')
  }
  next = pushLog(
    next,
    `${next.players[active].name} attacks with ${chosen.length} creature(s).`,
  )
  return next
}

function applyBlockers(
  state: GameState,
  blocks: Array<{ attackerUid: string; blockerUid: string }>,
): GameState {
  const defender = opponentOf(state.activePlayer)
  const defenderBf = state.players[defender].battlefield
  const used = new Set<string>()
  const combat = state.combat.map((atk) => ({ ...atk, blockerUids: [] as string[] }))

  for (const b of blocks) {
    const atk = combat.find((c) => c.attackerUid === b.attackerUid)
    if (!atk) continue
    if (used.has(b.blockerUid)) continue
    const blocker = defenderBf.find((c) => c.uid === b.blockerUid)
    if (!blocker || !isCreatureCard(blocker.card) || blocker.tapped) continue
    atk.blockerUids = [b.blockerUid]
    used.add(b.blockerUid)
  }

  let next: GameState = {
    ...state,
    combat,
    awaitingBlockers: false,
    priority: state.activePlayer,
    step: 'combat_damage',
  }
  next = pushLog(next, `${next.players[defender].name} declares blockers.`)
  return resolveCombatDamage(next)
}

function resolveCombatDamage(state: GameState): GameState {
  const atkId = state.activePlayer
  const defId = opponentOf(atkId)
  let next = state

  for (const pair of state.combat) {
    const attacker = next.players[atkId].battlefield.find((c) => c.uid === pair.attackerUid)
    if (!attacker) continue

    if (pair.blockerUids.length === 0) {
      const dmg = attacker.power
      next = updatePlayer(next, defId, (p) => {
        const commanderDamage = { ...p.commanderDamage }
        if (attacker.isCommander) {
          commanderDamage[attacker.uid] = (commanderDamage[attacker.uid] ?? 0) + dmg
        }
        return { ...p, life: p.life - dmg, commanderDamage }
      })
      next = pushLog(
        next,
        `${attacker.card.name} deals ${dmg} combat damage to ${next.players[defId].name}.`,
      )
      continue
    }

    const blockerUid = pair.blockerUids[0]
    const blocker = next.players[defId].battlefield.find((c) => c.uid === blockerUid)
    if (!blocker) continue

    // Simultaneous damage
    const atkDmg = attacker.power
    const blkDmg = blocker.power
    let atkDead = atkDmg >= blocker.toughness && !hasKeyword(blocker.card, 'indestructible')
    let blkDead = blkDmg >= attacker.toughness && !hasKeyword(attacker.card, 'indestructible')
    // Assign damage marked
    void atkDead
    void blkDead
    atkDead = attacker.power >= blocker.toughness && !hasKeyword(blocker.card, 'indestructible')
    blkDead = blocker.power >= attacker.toughness && !hasKeyword(attacker.card, 'indestructible')

    next = pushLog(
      next,
      `${attacker.card.name} (${atkDmg}) vs ${blocker.card.name} (${blkDmg}).`,
    )

    if (hasKeyword(attacker.card, 'trample') && attacker.power > blocker.toughness) {
      const overflow = attacker.power - blocker.toughness
      next = updatePlayer(next, defId, (p) => ({ ...p, life: p.life - overflow }))
      next = pushLog(next, `Trample: ${overflow} to ${next.players[defId].name}.`)
    }

    if (atkDead) {
      next = moveToGraveyardOrCommand(next, defId, blockerUid)
    }
    if (blkDead) {
      next = moveToGraveyardOrCommand(next, atkId, pair.attackerUid)
    }
  }

  next = { ...next, combat: [] }
  next = checkWin(next)
  if (next.winner) return next
  return advanceTo(next, 'main2')
}

function moveToGraveyardOrCommand(state: GameState, owner: PlayerId, uid: string): GameState {
  const card = state.players[owner].battlefield.find((c) => c.uid === uid)
  if (!card) return state
  return updatePlayer(state, owner, (p) => {
    const battlefield = p.battlefield.filter((c) => c.uid !== uid)
    if (card.isCommander) {
      return {
        ...p,
        battlefield,
        command: [...p.command, { ...card, tapped: false, damageMarked: 0, summoningSickness: true }],
      }
    }
    return {
      ...p,
      battlefield,
      graveyard: [...p.graveyard, { ...card, tapped: false, damageMarked: 0 }],
    }
  })
}

function advanceTo(state: GameState, step: TurnStep): GameState {
  let next: GameState = { ...state, step, awaitingBlockers: false }
  const active = next.activePlayer

  if (step === 'untap') {
    next = updatePlayer(next, active, (p) => ({
      ...p,
      mana: emptyManaPool(),
      landsPlayedThisTurn: 0,
      battlefield: p.battlefield.map((c) => ({
        ...c,
        tapped: false,
        summoningSickness: false,
        damageMarked: 0,
      })),
    }))
    next = clearMana(next, opponentOf(active))
    next = pushLog(next, `Turn ${next.turn} — ${next.players[active].name}'s untap step.`)
    return advanceTo(next, 'upkeep')
  }

  if (step === 'upkeep') {
    return advanceTo(next, 'draw')
  }

  if (step === 'draw') {
    if (!(next.isFirstTurn && next.turn === 1)) {
      next = draw(next, active)
      if (next.winner) return next
      next = pushLog(next, `${next.players[active].name} draws a card.`)
    } else {
      next = pushLog(next, `${next.players[active].name} skips draw on the first turn.`)
    }
    next = { ...next, priority: active, step: 'main1' }
    return next
  }

  if (step === 'main2') {
    next = { ...next, priority: active, step: 'main2', combat: [] }
    return next
  }

  if (step === 'end') {
    next = clearMana(next, active)
    next = clearMana(next, opponentOf(active))
    const nextActive = opponentOf(active)
    next = {
      ...next,
      activePlayer: nextActive,
      priority: nextActive,
      turn: next.turn + 1,
      isFirstTurn: false,
      combat: [],
      step: 'untap',
    }
    return advanceTo(next, 'untap')
  }

  return next
}

function passFrom(state: GameState): GameState {
  if (state.step === 'main1') {
    return { ...state, step: 'combat_attackers', priority: state.activePlayer }
  }
  if (state.step === 'combat_attackers') {
    // Passing without declaring = no attackers
    return applyAttackers(state, [])
  }
  if (state.step === 'main2') {
    return advanceTo(state, 'end')
  }
  return state
}

export function getLegalActions(state: GameState, actor: PlayerId): GameAction[] {
  if (state.winner || state.step === 'game_over') return []
  if (state.priority !== actor) return []

  const actions: GameAction[] = []
  const player = state.players[actor]

  if (state.step === 'mulligan') {
    if (actor === 'you') {
      actions.push({ type: 'keep_hand' }, { type: 'mulligan' })
    }
    return actions
  }

  if (state.awaitingBlockers && state.step === 'combat_blockers' && actor === opponentOf(state.activePlayer)) {
    actions.push({ type: 'declare_blockers', blocks: [] })
    return actions
  }

  if (state.activePlayer !== actor) return actions

  if (state.step === 'main1' || state.step === 'main2') {
    actions.push({ type: 'auto_float_mana' })
    for (const card of player.hand) {
      if (isLandCard(card.card) && player.landsPlayedThisTurn < 1) {
        actions.push({ type: 'play_land', cardUid: card.uid })
      } else if (!isLandCard(card.card)) {
        const floated = floatAllMana(state, actor)
        if (canPayCost(floated.players[actor].mana, spellCost(card.card))) {
          actions.push({ type: 'cast_spell', cardUid: card.uid })
        }
      }
    }
    if (player.command[0]) {
      const tax = player.commanderCastCount * 2
      const floated = floatAllMana(state, actor)
      if (canPayCost(floated.players[actor].mana, spellCost(player.command[0].card, tax))) {
        actions.push({ type: 'cast_commander' })
      }
    }
    actions.push({ type: 'pass' })
  }

  if (state.step === 'combat_attackers' && actor === state.activePlayer) {
    actions.push({ type: 'declare_attackers', attackerUids: [] })
    actions.push({ type: 'pass' })
  }

  actions.push({ type: 'concede' })
  return actions
}

export function applyAction(state: GameState, actor: PlayerId, action: GameAction): GameState {
  if (state.winner) return state

  if (action.type === 'concede') {
    return {
      ...state,
      winner: opponentOf(actor),
      winReason: `${state.players[actor].name} concedes.`,
      step: 'game_over',
    }
  }

  if (state.step === 'mulligan' && actor === 'you') {
    if (action.type === 'mulligan') {
      let next = updatePlayer(state, 'you', (p) => {
        const library = shuffle([...p.hand, ...p.library])
        const hand = library.splice(0, Math.max(1, p.hand.length - 1))
        return { ...p, library, hand }
      })
      next = pushLog(next, `You mulligan to ${next.players.you.hand.length}.`)
      return next
    }
    if (action.type === 'keep_hand') {
      let next = pushLog(state, 'You keep your hand.')
      // Opponent keeps
      next = pushLog(next, `${next.players.opponent.name} keeps their hand.`)
      next = {
        ...next,
        priority: next.activePlayer,
        step: 'untap',
      }
      return advanceTo(next, 'untap')
    }
  }

  if (action.type === 'auto_float_mana' && state.priority === actor) {
    const next = floatAllMana(state, actor)
    return pushLog(next, `${next.players[actor].name} taps mana sources.`)
  }

  if (action.type === 'play_land' && state.priority === actor) {
    return playLand(state, actor, action.cardUid) ?? state
  }

  if (action.type === 'cast_spell' && state.priority === actor) {
    return castFromHand(state, actor, action.cardUid) ?? state
  }

  if (action.type === 'cast_commander' && state.priority === actor) {
    return castCommander(state, actor) ?? state
  }

  if (action.type === 'tap_for_mana' && state.priority === actor) {
    const perm = state.players[actor].battlefield.find((c) => c.uid === action.permanentUid)
    if (!perm || perm.tapped) return state
    return updatePlayer(state, actor, (p) => ({
      ...p,
      battlefield: p.battlefield.map((c) =>
        c.uid === action.permanentUid ? { ...c, tapped: true } : c,
      ),
      mana: addMana(p.mana, action.color),
    }))
  }

  if (action.type === 'declare_attackers' && state.step === 'combat_attackers') {
    return applyAttackers(state, action.attackerUids)
  }

  if (action.type === 'declare_blockers' && state.step === 'combat_blockers') {
    return applyBlockers(state, action.blocks)
  }

  if (action.type === 'pass' && state.priority === actor) {
    return passFrom(state)
  }

  return state
}

export function canCastCard(state: GameState, actor: PlayerId, cardUid: string): boolean {
  return getLegalActions(state, actor).some(
    (a) => a.type === 'cast_spell' && a.cardUid === cardUid,
  )
}

export function canPlayLand(state: GameState, actor: PlayerId, cardUid: string): boolean {
  return getLegalActions(state, actor).some(
    (a) => a.type === 'play_land' && a.cardUid === cardUid,
  )
}

export function manaPoolLabel(pool: ManaPool): string {
  if (poolTotal(pool) === 0) return '∅'
  const parts: string[] = []
  for (const c of ['W', 'U', 'B', 'R', 'G', 'C'] as const) {
    if (pool[c] > 0) parts.push(`${pool[c]}${c}`)
  }
  return parts.join(' ')
}

export { legalAttackers, opponentOf }
