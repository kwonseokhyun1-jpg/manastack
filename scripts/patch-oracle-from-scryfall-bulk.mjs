import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const dataDir = path.join(root, 'public', 'data')
const targets = ['minigame-pool.json', 'cards.json'].map((file) => path.join(dataDir, file))

function canonicalNameKey(name) {
  const trimmed = name.trim()
  const parts = trimmed.split(/\s*\/\/\s*/)
  if (parts.length === 2 && parts[0].toLowerCase() === parts[1].toLowerCase()) {
    return parts[0].trim().toLowerCase()
  }
  return trimmed.toLowerCase()
}

function composeOracleText(card) {
  if (Array.isArray(card.card_faces) && card.card_faces.length > 1) {
    return card.card_faces
      .map((face) => {
        const text = face.oracle_text?.trim()
        if (!text) return ''
        return `${face.name}\n${text}`
      })
      .filter(Boolean)
      .join('\n\n')
  }
  return card.oracle_text?.trim() ?? card.card_faces?.[0]?.oracle_text?.trim() ?? ''
}

async function fetchOracleBulkCards() {
  const metaRes = await fetch('https://api.scryfall.com/bulk-data')
  if (!metaRes.ok) throw new Error(`Bulk metadata failed (${metaRes.status})`)
  const meta = await metaRes.json()
  const oracle = meta.data.find((entry) => entry.type === 'oracle_cards')
  if (!oracle?.download_uri) throw new Error('oracle_cards bulk entry not found')

  console.log(`Downloading Scryfall oracle bulk (${oracle.updated_at})…`)
  const bulkRes = await fetch(oracle.download_uri)
  if (!bulkRes.ok) throw new Error(`Bulk download failed (${bulkRes.status})`)
  return bulkRes.json()
}

function buildOracleLookup(oracleCards) {
  const byName = new Map()
  for (const card of oracleCards) {
    const key = canonicalNameKey(card.name)
    const text = composeOracleText(card)
    if (!text) continue
    if (!byName.has(key)) byName.set(key, text)
  }
  return byName
}

function patchPoolFile(filePath, oracleByName) {
  if (!fs.existsSync(filePath)) {
    console.log(`Skipping missing file: ${path.basename(filePath)}`)
    return { patched: 0, eligible: 0 }
  }

  const pool = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  let patched = 0
  let eligible = 0

  pool.cards = pool.cards.map((card) => {
    const key = canonicalNameKey(card.name)
    const oracle = oracleByName.get(key)
    if (!oracle) return card

    eligible++
    if ((card.oracle_text?.trim().length ?? 0) > 0) return card

    patched++
    return { ...card, oracle_text: oracle }
  })

  pool.updated_at = new Date().toISOString()
  pool.oracle_text_patched = patched
  fs.writeFileSync(filePath, JSON.stringify(pool))
  console.log(`${path.basename(filePath)}: patched ${patched} cards (${eligible} with oracle data)`)
  return { patched, eligible }
}

async function main() {
  const existingPath = path.join(dataDir, 'minigame-pool.json')
  if (fs.existsSync(existingPath)) {
    const existing = JSON.parse(fs.readFileSync(existingPath, 'utf8'))
    const sample = existing.cards.slice(0, 200)
    const withOracle = sample.filter((card) => (card.oracle_text?.trim().length ?? 0) > 0).length
    if (withOracle >= sample.length * 0.8) {
      console.log('Oracle text already present in minigame pool; skipping patch.')
      return
    }
  }

  const oracleCards = await fetchOracleBulkCards()
  const oracleByName = buildOracleLookup(oracleCards)
  console.log(`Loaded oracle text for ${oracleByName.size} unique card names.`)

  let totalPatched = 0
  for (const filePath of targets) {
    const { patched } = patchPoolFile(filePath, oracleByName)
    totalPatched += patched
  }

  if (totalPatched === 0) {
    console.warn('No cards were patched.')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
