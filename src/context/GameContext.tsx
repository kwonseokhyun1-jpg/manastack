import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { CardRecord } from '../types/card'
import type { MinigameManaId, BoosterCard, CollectedCard, GameSave, ShowcaseFolder } from '../types/game'
import {
  BOOSTER_BOX_COST,
  BOOSTER_COST,
  CARDS_PER_PACK,
  PACKS_PER_BOX,
  STANDARD_BOOSTER_COST,
  STANDARD_BOOSTER_BOX_COST,
  STARTING_MANA,
} from '../types/game'
import { buildBoosterPack, cardToCollectedFields } from '../lib/booster'
import type { CardRarity } from '../lib/card-rarity'
import { canonicalNameKey } from '../lib/card-names'
import { loadCardDatabase, loadStandardPool } from '../lib/card-db'
import { loadRarityMap } from '../lib/rarity-db'
import { createId, defaultSave, loadSave, normalizeSave, persistSave } from '../lib/storage'
import { applyDailyLoginClaim, canClaimDailyLogin } from '../lib/daily-login'
import { fetchCloudSave, uploadCloudSave } from '../lib/auth-api'
import { mergeSaves, stampSave } from '../lib/save-sync'
import {
  applyMinigameManaReward,
  minigameManaRemainingToday as getMinigameManaRemainingToday,
} from '../lib/minigame-daily'
import { useAuth } from './AuthContext'

export type SyncStatus = 'idle' | 'syncing' | 'saved' | 'error'

type BoosterFormat = 'commander' | 'standard'

type GameContextValue = {
  mana: number
  collection: CollectedCard[]
  folders: ShowcaseFolder[]
  ownedNonFoilKeys: Set<string>
  cardPool: CardRecord[]
  cardPoolLoading: boolean
  cardPoolError: string | null
  standardPool: CardRecord[]
  standardPoolLoading: boolean
  standardPoolError: string | null
  rarityMap: Map<string, CardRarity>
  rarityMapLoading: boolean
  rarityMapError: string | null
  dailyLoginAvailable: boolean
  claimDailyLogin: () => void
  addMana: (amount?: number) => void
  openBooster: () => Promise<{ cards: BoosterCard[]; error?: string }>
  openStandardBooster: () => Promise<{ cards: BoosterCard[]; error?: string }>
  openBoosterBox: () => Promise<{ packs: BoosterCard[][]; error?: string }>
  openStandardBoosterBox: () => Promise<{ packs: BoosterCard[][]; error?: string }>
  createFolder: (name: string) => void
  deleteFolder: (folderId: string) => void
  addCardToFolder: (folderId: string, instanceId: string) => void
  removeCardFromFolder: (folderId: string, instanceId: string) => void
  resetProgress: () => void
  saveReady: boolean
  syncStatus: SyncStatus
  minigameManaRemainingToday: (gameId: MinigameManaId) => number
  awardMinigameMana: (gameId: MinigameManaId, amount: number) => number
}

const GameContext = createContext<GameContextValue | null>(null)

export function GameProvider({ children }: { children: ReactNode }) {
  const { authReady, token } = useAuth()
  const [save, setSave] = useState<GameSave>(defaultSave())
  const [saveReady, setSaveReady] = useState(false)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [cardPool, setCardPool] = useState<CardRecord[]>([])
  const [cardPoolLoading, setCardPoolLoading] = useState(true)
  const [cardPoolError, setCardPoolError] = useState<string | null>(null)
  const [standardPool, setStandardPool] = useState<CardRecord[]>([])
  const [standardPoolLoading, setStandardPoolLoading] = useState(true)
  const [standardPoolError, setStandardPoolError] = useState<string | null>(null)
  const [rarityMap, setRarityMap] = useState<Map<string, CardRarity>>(new Map())
  const [rarityMapLoading, setRarityMapLoading] = useState(true)
  const [rarityMapError, setRarityMapError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    loadCardDatabase()
      .then((db) => {
        if (cancelled) return
        setCardPool(db.cards)
        setCardPoolLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setCardPoolError('Could not load card database for booster packs.')
        setCardPoolLoading(false)
      })

    loadStandardPool()
      .then((cards) => {
        if (cancelled) return
        setStandardPool(cards)
        setStandardPoolLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        setStandardPoolError(
          err instanceof Error
            ? err.message
            : 'Could not load Standard card pool. Run npm run build:standard.',
        )
        setStandardPoolLoading(false)
      })

    loadRarityMap()
      .then((rarities) => {
        if (cancelled) return
        setRarityMap(rarities)
        setRarityMapLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        setRarityMapError(
          err instanceof Error
            ? err.message
            : 'Could not load Gatherer rarity data. Run npm run build:rarity.',
        )
        setRarityMapLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!authReady) return

    let cancelled = false

    async function bootstrapSave() {
      setSaveReady(false)
      try {
        let next = loadSave()

        if (token) {
          const cloud = await fetchCloudSave(token)
          next = mergeSaves(next, cloud.save ? normalizeSave(cloud.save) : null)
        }

        persistSave(next)

        if (token) {
          setSyncStatus('syncing')
          await uploadCloudSave(token, next)
          if (!cancelled) setSyncStatus('saved')
        } else if (!cancelled) {
          setSyncStatus('idle')
        }

        if (cancelled) return
        setSave(next)
      } catch {
        if (cancelled) return
        const fallback = loadSave()
        persistSave(fallback)
        setSave(fallback)
        setSyncStatus('error')
      } finally {
        if (!cancelled) setSaveReady(true)
      }
    }

    void bootstrapSave()

    return () => {
      cancelled = true
    }
  }, [authReady, token])

  const dailyLoginAvailable = useMemo(
    () => canClaimDailyLogin(save),
    [save.lastDailyLogin],
  )

  const queueCloudSync = useCallback(
    (next: GameSave) => {
      if (!token) return
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current)
      setSyncStatus('syncing')
      syncTimerRef.current = setTimeout(() => {
        uploadCloudSave(token, next)
          .then(() => setSyncStatus('saved'))
          .catch(() => setSyncStatus('error'))
      }, 600)
    },
    [token],
  )

  useEffect(() => {
    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current)
    }
  }, [])

  const updateSave = useCallback(
    (updater: (prev: GameSave) => GameSave) => {
      setSave((prev) => {
        const next = stampSave(updater(prev))
        persistSave(next)
        queueCloudSync(next)
        return next
      })
    },
    [queueCloudSync],
  )

  const ownedNonFoilKeys = useMemo(() => {
    const keys = new Set<string>()
    for (const card of save.collection) {
      if (!card.foil) keys.add(canonicalNameKey(card.name))
    }
    return keys
  }, [save.collection])

  const addMana = useCallback(
    (amount = 1) => {
      updateSave((prev) => ({ ...prev, mana: prev.mana + amount }))
    },
    [updateSave],
  )

  const minigameManaRemainingToday = useCallback(
    (gameId: MinigameManaId) => getMinigameManaRemainingToday(save, gameId),
    [save.minigameManaCaps],
  )

  const awardMinigameMana = useCallback(
    (gameId: MinigameManaId, amount: number): number => {
      let awarded = 0
      updateSave((prev) => {
        const result = applyMinigameManaReward(prev, gameId, amount)
        if (!result) return prev
        awarded = result.awarded
        return result.save
      })
      return awarded
    },
    [updateSave],
  )

  const claimDailyLogin = useCallback(() => {
    updateSave((prev) => {
      if (!canClaimDailyLogin(prev)) return prev
      return applyDailyLoginClaim(prev)
    })
  }, [updateSave])

  const openPacks = useCallback(
    async (packCount: number, manaCost: number, format: BoosterFormat) => {
      if (save.mana < manaCost) {
        return {
          packs: [] as BoosterCard[][],
          error: `Need ${manaCost} mana (${packCount === 1 ? 'a pack' : 'a box'}).`,
        }
      }

      let pool = format === 'commander' ? cardPool : standardPool
      let rarities = rarityMap

      try {
        if (pool.length === 0) {
          pool =
            format === 'commander'
              ? (await loadCardDatabase()).cards
              : await loadStandardPool()
          if (format === 'commander') setCardPool(pool)
          else setStandardPool(pool)
        }
        if (rarities.size === 0) {
          rarities = await loadRarityMap()
          setRarityMap(rarities)
          setRarityMapError(null)
        }
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : format === 'commander'
              ? 'Card database not available.'
              : 'Standard card pool not available. Run npm run build:standard.'
        return { packs: [], error: message }
      }

      if (rarities.size === 0) {
        return {
          packs: [],
          error: 'Rarity data not loaded. Run npm run build:rarity and refresh the page.',
        }
      }

      if (pool.length === 0) {
        return {
          packs: [],
          error:
            format === 'standard'
              ? 'Standard card pool is empty. Run npm run build:standard.'
              : 'Card database not available.',
        }
      }

      const ownedKeys = new Set(ownedNonFoilKeys)
      const nonFoilNeeded = (CARDS_PER_PACK - 1) * packCount
      const unownedCount = pool.filter(
        (c) => !ownedKeys.has(canonicalNameKey(c.name)),
      ).length

      if (unownedCount < nonFoilNeeded) {
        return {
          packs: [],
          error: `Not enough new cards left. Need ${nonFoilNeeded} unowned non-foils (${unownedCount} available).`,
        }
      }

      const packs: BoosterCard[][] = []
      const newCards: CollectedCard[] = []
      const now = Date.now()

      for (let i = 0; i < packCount; i++) {
        const result = buildBoosterPack(pool, ownedKeys, rarities)
        if (result.error || result.cards.length === 0) {
          return { packs: [], error: result.error ?? 'Could not build pack.' }
        }
        packs.push(result.cards)
        for (const entry of result.cards) {
          if (!entry.foil) ownedKeys.add(canonicalNameKey(entry.card.name))
          newCards.push({
            instanceId: createId(),
            ...cardToCollectedFields(entry.card, {
              foil: entry.foil,
              ultrafoil: entry.ultrafoil,
            }),
            collectedAt: now,
          })
        }
      }

      updateSave((prev) => ({
        ...prev,
        mana: prev.mana - manaCost,
        collection: [...prev.collection, ...newCards],
      }))

      return { packs }
    },
    [save.mana, cardPool, standardPool, rarityMap, ownedNonFoilKeys, updateSave],
  )

  const openBooster = useCallback(async () => {
    const result = await openPacks(1, BOOSTER_COST, 'commander')
    return { cards: result.packs[0] ?? [], error: result.error }
  }, [openPacks])

  const openStandardBooster = useCallback(async () => {
    const result = await openPacks(1, STANDARD_BOOSTER_COST, 'standard')
    return { cards: result.packs[0] ?? [], error: result.error }
  }, [openPacks])

  const openBoosterBox = useCallback(async () => {
    return openPacks(PACKS_PER_BOX, BOOSTER_BOX_COST, 'commander')
  }, [openPacks])

  const openStandardBoosterBox = useCallback(async () => {
    return openPacks(PACKS_PER_BOX, STANDARD_BOOSTER_BOX_COST, 'standard')
  }, [openPacks])

  const createFolder = useCallback(
    (name: string) => {
      const trimmed = name.trim()
      if (!trimmed) return
      const folder: ShowcaseFolder = {
        id: createId(),
        name: trimmed,
        cardInstanceIds: [],
        createdAt: Date.now(),
      }
      updateSave((prev) => ({ ...prev, folders: [...prev.folders, folder] }))
    },
    [updateSave],
  )

  const deleteFolder = useCallback(
    (folderId: string) => {
      updateSave((prev) => ({
        ...prev,
        folders: prev.folders.filter((f) => f.id !== folderId),
      }))
    },
    [updateSave],
  )

  const addCardToFolder = useCallback(
    (folderId: string, instanceId: string) => {
      updateSave((prev) => ({
        ...prev,
        folders: prev.folders.map((f) =>
          f.id === folderId && !f.cardInstanceIds.includes(instanceId)
            ? { ...f, cardInstanceIds: [...f.cardInstanceIds, instanceId] }
            : f,
        ),
      }))
    },
    [updateSave],
  )

  const removeCardFromFolder = useCallback(
    (folderId: string, instanceId: string) => {
      updateSave((prev) => ({
        ...prev,
        folders: prev.folders.map((f) =>
          f.id === folderId
            ? { ...f, cardInstanceIds: f.cardInstanceIds.filter((id) => id !== instanceId) }
            : f,
        ),
      }))
    },
    [updateSave],
  )

  const resetProgress = useCallback(() => {
    const fresh = stampSave({ mana: STARTING_MANA, collection: [], folders: [] })
    persistSave(fresh)
    setSave(fresh)
    queueCloudSync(fresh)
  }, [queueCloudSync])

  const value = useMemo(
    () => ({
      mana: save.mana,
      collection: save.collection,
      folders: save.folders,
      ownedNonFoilKeys,
      cardPool,
      cardPoolLoading,
      cardPoolError,
      standardPool,
      standardPoolLoading,
      standardPoolError,
      rarityMap,
      rarityMapLoading,
      rarityMapError,
      dailyLoginAvailable,
      claimDailyLogin,
      addMana,
      openBooster,
      openStandardBooster,
      openBoosterBox,
      openStandardBoosterBox,
      createFolder,
      deleteFolder,
      addCardToFolder,
      removeCardFromFolder,
      resetProgress,
      saveReady,
      syncStatus,
      minigameManaRemainingToday,
      awardMinigameMana,
    }),
    [
      save,
      ownedNonFoilKeys,
      cardPool,
      cardPoolLoading,
      cardPoolError,
      standardPool,
      standardPoolLoading,
      standardPoolError,
      rarityMap,
      rarityMapLoading,
      rarityMapError,
      dailyLoginAvailable,
      claimDailyLogin,
      addMana,
      openBooster,
      openStandardBooster,
      openBoosterBox,
      openStandardBoosterBox,
      createFolder,
      deleteFolder,
      addCardToFolder,
      removeCardFromFolder,
      resetProgress,
      saveReady,
      syncStatus,
      minigameManaRemainingToday,
      awardMinigameMana,
    ],
  )

  if (!saveReady) {
    return (
      <div className="flex min-h-screen items-center justify-center text-[var(--color-mtg-muted)]">
        Loading save…
      </div>
    )
  }

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>
}

export function useGame() {
  const ctx = useContext(GameContext)
  if (!ctx) throw new Error('useGame must be used within GameProvider')
  return ctx
}
