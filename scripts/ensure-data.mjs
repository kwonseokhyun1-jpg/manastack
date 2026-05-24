import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const target = path.join(root, 'public', 'data')
const rarityMap = path.join(root, 'public', 'rarity-map.json')
const standardPool = path.join(root, 'public', 'standard-pool.json')
const source = path.resolve(root, '..', 'website', 'mtg', 'public', 'data')
const setCatalog = path.join(root, 'public', 'set-catalog.json')
const buildRarityScript = path.join(root, 'scripts', 'build-rarity-map.mjs')
const buildStandardScript = path.join(root, 'scripts', 'build-standard-pool.mjs')
const buildSetCatalogScript = path.join(root, 'scripts', 'build-set-catalog.mjs')

const required = ['cards.json', 'minigame-pool.json']

function hasRequiredData(dir) {
  return required.every((file) => fs.existsSync(path.join(dir, file)))
}

function ensureRarityMap() {
  if (!hasRequiredData(target)) return
  if (fs.existsSync(rarityMap)) return

  console.log('Building Gatherer rarity map (first run only)…')
  const result = spawnSync(process.execPath, [buildRarityScript], {
    cwd: root,
    stdio: 'inherit',
  })
  if (result.status !== 0) {
    console.warn('Could not build rarity-map.json. Run npm run build:rarity manually.')
  }
}

function ensureStandardPool() {
  if (!hasRequiredData(target)) return
  if (fs.existsSync(standardPool)) return

  console.log('Building Standard card pool (first run only)…')
  const result = spawnSync(process.execPath, [buildStandardScript], {
    cwd: root,
    stdio: 'inherit',
  })
  if (result.status !== 0) {
    console.warn('Could not build standard-pool.json. Run npm run build:standard manually.')
  }
}

function ensureSetCatalog() {
  if (!hasRequiredData(target)) return
  if (fs.existsSync(setCatalog)) return

  console.log('Building set catalog (first run only)…')
  const result = spawnSync(process.execPath, [buildSetCatalogScript], {
    cwd: root,
    stdio: 'inherit',
  })
  if (result.status !== 0) {
    console.warn('Could not build set-catalog.json. Run npm run build:sets manually.')
  }
}

if (!fs.existsSync(source) || !hasRequiredData(source)) {
  console.warn(
    'Card data not found. Run `npm run build:data` in ../website/mtg first.',
  )
  process.exit(0)
}

if (hasRequiredData(target)) {
  ensureRarityMap()
  ensureStandardPool()
  ensureSetCatalog()
  process.exit(0)
}

fs.mkdirSync(path.join(root, 'public'), { recursive: true })

try {
  fs.symlinkSync(source, target, 'junction')
  console.log('Linked card data from website/mtg')
} catch {
  fs.cpSync(source, target, { recursive: true })
  console.log('Copied card data from website/mtg')
}

ensureRarityMap()
ensureStandardPool()
ensureSetCatalog()
