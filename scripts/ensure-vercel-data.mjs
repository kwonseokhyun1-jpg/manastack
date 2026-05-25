import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const dataDir = path.join(root, 'public', 'data')
const cardsPath = path.join(dataDir, 'cards.json')
const minigamePath = path.join(dataDir, 'minigame-pool.json')

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

if (!fs.existsSync(cardsPath) && fs.existsSync(minigamePath)) {
  fs.copyFileSync(minigamePath, cardsPath)
  console.log('Created public/data/cards.json from minigame-pool.json for deployment.')
}
