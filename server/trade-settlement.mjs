const STARTING_MANA = 10

export function parseSaveData(raw) {
  if (!raw) {
    return { mana: STARTING_MANA, collection: [], folders: [], updatedAt: 0 }
  }

  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('Save data corrupted.')
  }

  return {
    mana: typeof parsed.mana === 'number' ? parsed.mana : STARTING_MANA,
    collection: Array.isArray(parsed.collection) ? parsed.collection : [],
    folders: Array.isArray(parsed.folders) ? parsed.folders : [],
    lastDailyLogin:
      typeof parsed.lastDailyLogin === 'string' ? parsed.lastDailyLogin : undefined,
    minigameManaCaps:
      parsed.minigameManaCaps && typeof parsed.minigameManaCaps === 'object'
        ? parsed.minigameManaCaps
        : undefined,
    updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0,
  }
}

export function serializeSave(save) {
  return JSON.stringify(save)
}

function findCardIndex(collection, entry, usedIds) {
  if (entry.instanceId) {
    const idx = collection.findIndex(
      (card) => card.instanceId === entry.instanceId && !usedIds.has(card.instanceId),
    )
    if (idx >= 0) return idx
  }

  return collection.findIndex(
    (card) =>
      !usedIds.has(card.instanceId) &&
      card.name === entry.name &&
      Boolean(card.foil) === Boolean(entry.foil) &&
      Boolean(card.ultrafoil) === Boolean(entry.ultrafoil),
  )
}

function removeCardsFromCollection(collection, entries) {
  const usedIds = new Set()
  const removed = []
  const remaining = [...collection]

  for (const entry of entries) {
    const idx = findCardIndex(remaining, entry, usedIds)
    if (idx < 0) {
      throw new Error(`Missing card: ${entry.name}`)
    }
    const [card] = remaining.splice(idx, 1)
    usedIds.add(card.instanceId)
    removed.push(card)
  }

  return { removed, remaining }
}

function cleanFolders(folders, removedInstanceIds) {
  if (!Array.isArray(folders) || removedInstanceIds.length === 0) return folders ?? []
  const removed = new Set(removedInstanceIds)
  return folders.map((folder) => ({
    ...folder,
    cardInstanceIds: Array.isArray(folder.cardInstanceIds)
      ? folder.cardInstanceIds.filter((id) => !removed.has(id))
      : [],
  }))
}

export function executeTradeAcceptance({
  sellerSave,
  buyerSave,
  listingCards,
  offerCards,
  offerMana,
}) {
  const mana = Math.max(0, Math.floor(Number(offerMana) || 0))
  if (buyerSave.mana < mana) {
    throw new Error('Offerer no longer has enough mana.')
  }

  const sellerRemoved = removeCardsFromCollection(sellerSave.collection, listingCards)
  const buyerRemoved = removeCardsFromCollection(buyerSave.collection, offerCards)
  const now = Date.now()

  const sellerRemovedIds = sellerRemoved.removed.map((card) => card.instanceId)
  const buyerRemovedIds = buyerRemoved.removed.map((card) => card.instanceId)

  const nextSellerSave = {
    ...sellerSave,
    mana: sellerSave.mana + mana,
    collection: [
      ...sellerRemoved.remaining,
      ...buyerRemoved.removed.map((card) => ({ ...card, collectedAt: now })),
    ],
    folders: cleanFolders(sellerSave.folders, sellerRemovedIds),
    updatedAt: now,
  }

  const nextBuyerSave = {
    ...buyerSave,
    mana: buyerSave.mana - mana,
    collection: [
      ...buyerRemoved.remaining,
      ...sellerRemoved.removed.map((card) => ({ ...card, collectedAt: now })),
    ],
    folders: cleanFolders(buyerSave.folders, buyerRemovedIds),
    updatedAt: now,
  }

  return { sellerSave: nextSellerSave, buyerSave: nextBuyerSave }
}
