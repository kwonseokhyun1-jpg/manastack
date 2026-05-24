import type { GameSave } from '../types/game'
import { defaultSave, normalizeSave } from './storage'

export function stampSave(save: GameSave): GameSave {
  return { ...save, updatedAt: Date.now() }
}

export function mergeSaves(local: GameSave, cloud: GameSave | null): GameSave {
  if (!cloud) return local
  const localTs = local.updatedAt ?? 0
  const cloudTs = cloud.updatedAt ?? 0
  if (cloudTs > localTs) return normalizeSave(cloud)
  return local
}

export function emptyCloudSave(): GameSave {
  return { ...defaultSave(), updatedAt: 0 }
}
