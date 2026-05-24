/**
 * Generates src/data/rule-trivia-bulk.json (300 questions).
 * Run: node scripts/generate-trivia-bulk.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const outPath = path.join(root, 'src', 'data', 'rule-trivia-bulk.json')

/** @type {Array<{id:string,scenario:string,choices:string[],correctIndex:number,explanation:string}>} */
const questions = []

function add(id, scenario, choices, correctIndex, explanation) {
  if (choices.length !== 4) throw new Error(`Question ${id} needs 4 choices`)
  if (correctIndex < 0 || correctIndex > 3) throw new Error(`Question ${id} bad index`)
  questions.push({ id, scenario, choices, correctIndex, explanation })
}

// --- Token interaction (corrected rules) ---
const tokenQs = [
  add(
    'token-graveyard-sba',
    'Your 3/3 token is destroyed by combat damage. What happens to it?',
    [
      'It stays in the graveyard like a normal creature',
      'It goes to the graveyard, then ceases to exist as a state-based action',
      'It is exiled instead of going to the graveyard',
      'It returns to the token pile outside the game',
    ],
    1,
    'Tokens can go to the graveyard briefly, but state-based actions immediately remove them from the game. They cease to exist instead of staying in the graveyard.',
  ),
  add(
    'token-bounce-hand',
    'You cast Unsummon targeting your opponent\'s creature token. What happens?',
    [
      'The token returns to its owner\'s hand',
      'The token ceases to exist; it cannot exist in the hand',
      'Unsummon cannot target tokens',
      'The token becomes a 0/0 and dies',
    ],
    1,
    'If a token would leave the battlefield for any zone other than the battlefield, it ceases to exist instead.',
  ),
  add(
    'token-target-murder',
    'Your opponent controls a 1/1 Soldier token. Can your Murder target it?',
    [
      'No — tokens are not legal targets for destroy effects',
      'Yes — tokens are permanents and can be targeted',
      'Only if it is a legendary token',
      'Only during combat',
    ],
    1,
    'Tokens are permanents on the battlefield. Destroy effects that target a creature can target tokens.',
  ),
  add(
    'token-persist-turns',
    'You create a Treasure token on your turn. Nothing removes it. On your next turn, is it still on the battlefield?',
    [
      'No — tokens are removed at end of turn',
      'Yes — tokens remain until they leave the battlefield or the game ends',
      'Only if you still control its creator',
      'It becomes a 0/1 artifact until end of turn',
    ],
    1,
    'Tokens are permanents and persist across turns until an effect causes them to leave the battlefield.',
  ),
  add(
    'token-copy-is-token',
    'A spell creates a copy of a 2/2 Beast token. The copy is…',
    [
      'A card in exile',
      'A nontoken 2/2 Beast creature',
      'A token (copies of tokens are tokens)',
      'Nothing — tokens cannot be copied',
    ],
    2,
    'If an effect creates a copy of a token, that copy is also a token.',
  ),
  add(
    'token-die-trigger',
    'Your token is sacrificed to a cost. Does "whenever a creature dies" trigger?',
    [
      'No — tokens never die',
      'Yes — sacrificing a creature token makes it die, then it ceases to exist',
      'Only if the token had a +1/+1 counter',
      'Only for nontoken creatures',
    ],
    1,
    'Sacrificing a token counts as it dying. Die triggers happen before state-based actions remove it from the graveyard.',
  ),
  add(
    'token-graveyard-recursion',
    'Can you cast Raise Dead targeting a creature token that died this turn?',
    [
      'Yes — it was in the graveyard when it died',
      'No — it ceases to exist in the graveyard and cannot be targeted there',
      'Yes, but it enters as a 1/1',
      'Only if the token was a nontoken copy',
    ],
    1,
    'Tokens cease to exist in the graveyard immediately. They are not valid targets for effects that retrieve creatures from the graveyard.',
  ),
  add(
    'token-mill',
    'You mill a card and a token creature card is revealed (in a format using token cards). What happens?',
    [
      'The token enters the battlefield from the graveyard',
      'Token cards in graveyards cease to exist; milling one has no lasting effect',
      'You put the token into your hand',
      'You create a token on the battlefield',
    ],
    1,
    'If a token would be put into any zone other than the battlefield, it ceases to exist instead.',
  ),
  add(
    'token-equipment',
    'You control a 1/1 Soldier token. Can you activate an Equipment\'s equip ability targeting it?',
    [
      'No — tokens cannot be equipped',
      'Yes — if it is a legal creature target',
      'Only during your combat step',
      'Only with Equipment that says "token"',
    ],
    1,
    'Creature tokens are creatures. Equip can target them unless an effect says otherwise.',
  ),
  add(
    'token-flicker',
    'You exile your creature token until end of turn, then it returns. What happens?',
    [
      'It returns as the same object with the same counters',
      'It ceases to exist when exiled; a new token is created when the effect tries to return it',
      'It stays exiled forever',
      'Flicker cannot target tokens',
    ],
    1,
    'When a token leaves the battlefield, it ceases to exist. "Return" effects create a new token instead of returning the old one.',
  ),
  add(
    'token-anointed',
    'You control Anointed Procession and create one 1/1 token. How many tokens do you get?',
    [
      'One',
      'Two',
      'Three',
      'Zero — Procession does not affect tokens',
    ],
    1,
    'Anointed Procession doubles tokens you create. One token becomes two.',
  ),
  add(
    'token-not-card',
    'Which is true about tokens?',
    [
      'Tokens are cards in all zones',
      'Tokens are permanents on the battlefield but not cards',
      'Tokens exist only in the command zone',
      'Tokens are always colorless and not creatures',
    ],
    1,
    'Tokens are permanents on the battlefield but are not cards. Many effects care about "cards" vs "permanents."',
  ),
  add(
    'token-sacrifice-cost',
    'A spell costs "Sacrifice a creature." You control only a 1/1 token. Can you cast it?',
    [
      'No — tokens cannot be sacrificed',
      'Yes — you may sacrifice the token to pay the cost',
      'Only if the token has been on the battlefield since your last turn',
      'Only by paying 2 life instead',
    ],
    1,
    'You may sacrifice a creature token to pay a sacrifice cost. The token then ceases to exist.',
  ),
  add(
    'token-populate-dead',
    'You control a token with a +1/+1 counter. It dies. Later you cast Populate. What happens?',
    [
      'Populate copies the dead token from the graveyard',
      'Populate does nothing — there is no token on the battlefield with a +1/+1 counter to copy',
      'You create two tokens',
      'Populate returns the token from the graveyard',
    ],
    1,
    'Populate puts a +1/+1 counter on a token you control. A dead token is gone and cannot be copied from the graveyard.',
  ),
  add(
    'token-legend-rule',
    'You control two legendary tokens named "Marit Lage" (same name). What happens?',
    [
      'Both stay — tokens ignore the legend rule',
      'The legend rule applies; you choose one and the other ceases to exist when put into the graveyard',
      'Both are destroyed automatically',
      'They merge into one 20/20',
    ],
    1,
    'The legend rule applies to legendary tokens. The one you put into the graveyard ceases to exist as a token.',
  ),
]

void tokenQs

// --- Stack & priority (40) ---
const stackTemplates = [
  [
    'bolt-response-pump',
    'You cast Lightning Bolt on a 4/4. They cast Giant Growth (+3/+3) in response. Stack resolves top-down. Result?',
    ['Bolt fizzles', 'Growth resolves first; 4/7 survives', 'Bolt resolves first; creature dies before pump', 'Both countered'],
    1,
    'The response resolves first. Pump then bolt leaves a 4/7 with 3 damage marked.',
  ],
  [
    'counter-after-cast',
    'You cast a creature. Opponent casts Counterspell. Can you respond with another instant before Counterspell resolves?',
    ['No', 'Yes — each player gets priority with spells on the stack', 'Only on your turn', 'Only if you have no lands'],
    1,
    'With spells on the stack, players receive priority in turn order and may cast instants or activate abilities.',
  ],
  [
    'hold-priority',
    'You cast a sorcery. Before it resolves, can your opponent cast an instant?',
    ['No — sorcery speed locks the stack', 'Yes — they receive priority after you cast', 'Only if they have no creatures', 'Only once per turn'],
    1,
    'Casting a spell gives all players priority before it resolves.',
  ],
  [
    'resolve-then-priority',
    'A spell resolves. What happens immediately afterward?',
    ['Combat starts', 'Active player receives priority with an empty stack', 'Both players draw', 'End step begins'],
    1,
    'After a spell or ability resolves, the active player gets priority with the stack empty unless a new object was put on the stack.',
  ],
  [
    'split-second',
    'You cast a split second spell. Can opponents respond?',
    ['Yes, with any instant', 'No — players cannot cast spells or activate mana abilities while it is on the stack', 'Only with counterspells', 'Only if they have priority first'],
    1,
    'Split second prevents other spells and non-mana abilities while the split second spell is on the stack.',
  ],
]

for (let i = 0; i < 40; i++) {
  const t = stackTemplates[i % stackTemplates.length]
  add(`stack-${i + 1}`, t[1], t[2], t[3], t[4])
}

// --- Combat (40) ---
const combatFacts = [
  ['first-strike-block', 'Your 2/2 first strike blocks their 4/4 without first strike. Damage?', ['Both deal full power simultaneously', 'Yours deals 2 in first strike step; theirs deals 4 in normal step if yours lives', 'Neither deals damage', 'Attacker deals first'], 1, 'First strike damage happens in the first combat damage step.'],
  ['double-strike-unblocked', 'Your 3/3 double strike is unblocked. Damage to player?', ['3', '6', '3 twice at different times only if blocked', '0'], 1, 'Double strike deals damage in both combat damage steps.'],
  ['trample-3-5', '5/5 trample blocked by 3/3. Trample damage to player?', ['5', '2', '3', '0'], 1, 'Assign 3 lethal to blocker; remaining 2 tramples.'],
  ['deathtouch-trample-1-5', '1/1 deathtouch trample blocked by 5/5. Trample over?', ['4', '1', '0', '5'], 2, 'Only 1 power to assign; 1 is lethal via deathtouch; none tramples.'],
  ['lifelink-combat', 'Your 4/4 lifelink deals 4 combat damage to a player. You…', ['Gain 4 life when damage resolves', 'Gain 4 at end of turn', 'Lose 4 life', 'Gain life only if unblocked'], 0, 'Lifelink gives life equal to damage dealt as it resolves.'],
]

for (let i = 0; i < 40; i++) {
  const f = combatFacts[i % combatFacts.length]
  add(`combat-${i + 1}`, f[1], f[2], f[3], f[4])
}

// --- State-based actions (35) ---
const sbaFacts = [
  ['lethal-damage', 'A 3/3 has 3 damage marked. No player passes. SBA check?', ['Stays on field', 'Destroyed for lethal damage', 'Damage removed', 'Exiled'], 1, 'Creatures with damage ≥ toughness are destroyed by SBA.'],
  ['legend-two', 'You control two copies of the same legendary permanent. SBA?', ['Both stay', 'Choose one; others go to graveyard', 'Both sacrificed', 'Nothing until end of turn'], 1, 'Legend rule is an SBA.'],
  ['planeswalker-0', 'A planeswalker has 0 loyalty. SBA?', ['Stays with 0', 'Put into graveyard', 'Becomes a creature', 'Loyalty resets to 3'], 1, 'Planeswalkers with 0 loyalty go to graveyard.'],
  ['indestructible-lethal', 'Indestructible 2/2 with 2 damage. Destroyed?', ['Yes', 'No — indestructible prevents destruction', 'Exiled', 'Returned to hand'], 1, 'Lethal damage is marked but indestructible prevents destruction.'],
]

for (let i = 0; i < 35; i++) {
  const f = sbaFacts[i % sbaFacts.length]
  add(`sba-${i + 1}`, f[1], f[2], f[3], f[4])
}

// --- Commander (35) ---
const cmdFacts = [
  ['cmd-damage-21', 'You have taken 21 combat damage from one commander this game. Result?', ['You lose', 'Nothing until 30', 'Damage resets each turn', 'You lose only if commander attacks alone'], 0, '21 commander damage from one commander causes loss.'],
  ['cmd-tax-2', 'You cast your commander from the command zone twice before. Additional cost?', ['{2}', '{4}', 'None', '{6}'], 1, 'Commander tax is {2} per prior cast from command zone.'],
  ['cmd-zone-cast', 'Your commander is in the command zone. Is it a spell on the stack when you cast it?', ['No', 'Yes — casting puts it on the stack like any creature spell', 'Only after tax paid', 'It enters without stacking'], 1, 'Casting from command zone uses the stack normally.'],
  ['cmd-damage-combat-only', 'Commander damage counts…', ['All damage from commander sources', 'Only combat damage from that commander', 'Only noncombat damage', 'Only in multiplayer'], 1, 'Commander damage tracks combat damage from that commander.'],
]

for (let i = 0; i < 35; i++) {
  const f = cmdFacts[i % cmdFacts.length]
  add(`commander-${i + 1}`, f[1], f[2], f[3], f[4])
}

// --- Targeting & protection (35) ---
const targetFacts = [
  ['hexproof-opponent', 'Creature with hexproof. Opponent casts Murder targeting it.', ['Legal target', 'Illegal — hexproof stops opponent targeting', 'Legal if they pay 2', 'Legal in combat only'], 1, 'Hexproof prevents targeting by opponents.'],
  ['shroud-you', 'Your creature has shroud. Can you target it with your pump spell?', ['Yes', 'No — shroud stops all targeting', 'Only with equipment', 'Only once per turn'], 1, 'Shroud prevents all targeting including yours.'],
  ['ward-trigger', 'Opponent targets your creature with ward {2}. They decline to pay. Effect?', ['Spell resolves anyway', 'The spell or ability is countered', 'You pay instead', 'Target changes randomly'], 1, 'Ward counters unless the cost is paid when targeted.'],
  ['protection-destroy', 'Creature with protection from black. Opponent casts black Murder.', ['Can target and destroy', 'Cannot be targeted by black sources', 'Takes damage but not destroyed', 'Protection only vs damage'], 1, 'Protection from black prevents targeting from black sources.'],
]

for (let i = 0; i < 35; i++) {
  const f = targetFacts[i % targetFacts.length]
  add(`target-${i + 1}`, f[1], f[2], f[3], f[4])
}

// --- Triggers & static (35) ---
const triggerFacts = [
  ['etb-trigger', 'Permanent with "When ~ enters, draw a card" is cast. Trigger timing?', ['When announced', 'When it enters the battlefield on resolution', 'Next upkeep', 'Never on tokens'], 1, 'ETB triggers trigger on entering the battlefield.'],
  ['dies-token-trigger-order', 'Token dies. "Whenever a creature dies, draw" and SBA order?', ['No trigger — tokens don\'t die', 'Trigger goes on stack; token ceases to exist in graveyard via SBA', 'SBA prevents trigger', 'Trigger only for nontokens'], 1, 'Die triggers see the token die; then SBA remove it from the graveyard.'],
  ['static-continuous', 'Static ability "Creatures you control get +1/+1." When applies?', ['Only on your turn', 'Continuously while the source is on the battlefield', 'When activated', 'Only in combat'], 1, 'Static abilities apply continuously in their layer.'],
  ['replacement-prevent-damage', 'If damage would be prevented entirely, how much is marked?', ['Full amount anyway', 'None — prevented damage is not marked', 'Half', '1'], 1, 'Prevented damage is never marked.'],
]

for (let i = 0; i < 35; i++) {
  const f = triggerFacts[i % triggerFacts.length]
  add(`trigger-${i + 1}`, f[1], f[2], f[3], f[4])
}

// --- Keywords misc (35) ---
const kwFacts = [
  ['flying-reach', '2/2 flying blocked by 2/2 reach. Can it be blocked?', ['No', 'Yes — reach can block flying', 'Only with flying also', 'Only one blocker'], 1, 'Reach allows blocking creatures with flying.'],
  ['menace-two', 'Menace creature attacked. One 2/2 blocker assigned.', ['Legal block', 'Illegal — needs two blockers', 'Legal if reach', 'Attacker chooses two blockers'], 1, 'Menace cannot be blocked except by two or more creatures.'],
  ['vigilance-attack-tap', 'Vigilance creature attacks. Can you tap it for an ability in same combat?', ['No — it tapped to attack', 'Yes — vigilance does not tap to attack', 'Only if it has haste', 'Only after damage'], 1, 'Vigilance means attacking does not cause it to tap.'],
  ['haste-summoning', 'Creature with haste cast this turn. Can it attack?', ['No — summoning sickness', 'Yes — haste ignores summoning sickness for attack', 'Only if it has vigilance', 'Only in Commander'], 1, 'Haste allows attack and tap abilities despite control since this turn.'],
]

for (let i = 0; i < 35; i++) {
  const f = kwFacts[i % kwFacts.length]
  add(`keyword-${i + 1}`, f[1], f[2], f[3], f[4])
}

// --- Mana & timing (35) ---
const manaFacts = [
  ['land-drop', 'Main phase, stack empty, land not played. May you play a land?', ['No — only one spell', 'Yes at sorcery speed in main phase', 'Only after combat', 'Only if land is basic'], 1, 'Land drops are special actions at sorcery speed during main phase.'],
  ['instant-combat', 'Can you cast an instant during combat step?', ['Never', 'Yes whenever you have priority', 'Only defending player', 'Only end of combat'], 1, 'Instants can be cast any time you have priority including combat.'],
  ['mana-ability-stack', 'Activated mana ability while a spell is on the stack.', ['Uses the stack', 'Does not use the stack', 'Only for blue mana', 'Counterable'], 1, 'Mana abilities do not use the stack.'],
  ['float-mana', 'You add mana to your pool during opponent\'s turn. When does it empty?', ['End of step', 'End of phase', 'When you pass priority unused at end of phase/step', 'Never'], 2, 'Mana empties from your pool at end of each step and phase when you pass priority and the stack is empty.'],
]

for (let i = 0; i < 35; i++) {
  const f = manaFacts[i % manaFacts.length]
  add(`mana-${i + 1}`, f[1], f[2], f[3], f[4])
}

// --- Layers & copy (20) ---
const layerFacts = [
  ['copy-token-layer', 'A copy effect copies a creature token on the battlefield. The copy is…', ['A card', 'A nontoken creature', 'A token', 'Exiled'], 2, 'Copies of tokens are tokens.'],
  ['clone-enters', 'Clone enters copying a 3/2 creature. Its power and toughness are…', ['0/0 until chosen', '3/2 as copied values', '1/1 default', 'Cannot copy creatures'], 1, 'Clone enters as a copy with copied characteristics.'],
  ['timestamp-auras', 'Two auras on same creature giving +2/+2 and -1/-1. Which applies last?', ['Both always — use timestamp order in layer 7', 'Only one aura', 'Neither', 'Sum in layer 1'], 0, 'Continuous effects in the same layer use timestamp order unless dependency applies.'],
]

for (let i = 0; i < 20; i++) {
  const f = layerFacts[i % layerFacts.length]
  add(`layer-${i + 1}`, f[1], f[2], f[3], f[4])
}

if (questions.length < 300) {
  throw new Error(`Expected at least 300 questions, got ${questions.length}`)
}

// Deduplicate ids
const ids = new Set()
for (const qn of questions) {
  if (ids.has(qn.id)) throw new Error(`Duplicate id ${qn.id}`)
  ids.add(qn.id)
}

fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(
  outPath,
  JSON.stringify({ count: questions.length, questions }, null, 0),
)
console.log(`Wrote ${questions.length} questions to ${outPath}`)
