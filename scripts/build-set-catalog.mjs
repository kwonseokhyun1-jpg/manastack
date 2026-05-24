import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const cardsPath = path.join(root, 'public', 'data', 'cards.json')
const outPath = path.join(root, 'public', 'set-catalog.json')

function canonicalNameKey(name) {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
}

if (!fs.existsSync(cardsPath)) {
  console.error('Missing public/data/cards.json — run npm run ensure-data first.')
  process.exit(1)
}

const { cards } = JSON.parse(fs.readFileSync(cardsPath, 'utf8'))
const setMeta = new Map()
const setNames = new Map()

for (const card of cards) {
  const nameKey = canonicalNameKey(card.name)
  for (const printing of card.printings ?? []) {
    const code = printing.set
    if (!code) continue
    if (!setMeta.has(code)) {
      setMeta.set(code, { name: printing.set_name ?? code, names: new Set() })
    }
    setMeta.get(code).names.add(nameKey)
    setNames.set(nameKey, nameKey)
  }
}

const sets = [...setMeta.entries()]
  .map(([code, meta]) => ({
    code,
    name: meta.name,
    total: meta.names.size,
  }))
  .sort((a, b) => a.name.localeCompare(b.name))

const nameToSets = {}
for (const [code, meta] of setMeta.entries()) {
  for (const nameKey of meta.names) {
    if (!nameToSets[nameKey]) nameToSets[nameKey] = []
    nameToSets[nameKey].push(code)
  }
}

const payload = {
  updated_at: new Date().toISOString(),
  set_count: sets.length,
  sets,
  nameToSets,
}

fs.writeFileSync(outPath, JSON.stringify(payload))
console.log(`Wrote ${sets.length} sets to public/set-catalog.json`)
