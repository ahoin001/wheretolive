import type { PlaceTier, SavedPlace } from '../types'

export type BoardPlacement = {
  id: string
  tier: PlaceTier
  boardOrder: number
}

const TIERS: PlaceTier[] = ['dream', 'strong', 'maybe', 'pass']

export function isPlaceTier(value: string): value is PlaceTier {
  return (TIERS as string[]).includes(value)
}

/** Stable board sort: boardOrder, then createdAt, then id. */
export function compareBoardOrder(a: SavedPlace, b: SavedPlace): number {
  const ao = a.boardOrder ?? 0
  const bo = b.boardOrder ?? 0
  if (ao !== bo) return ao - bo
  const ac = Date.parse(a.createdAt) || 0
  const bc = Date.parse(b.createdAt) || 0
  if (ac !== bc) return ac - bc
  return a.id.localeCompare(b.id)
}

export function groupPlacesByTier(
  places: SavedPlace[],
): Record<PlaceTier, SavedPlace[]> {
  const map: Record<PlaceTier, SavedPlace[]> = {
    dream: [],
    strong: [],
    maybe: [],
    pass: [],
  }
  for (const place of places) {
    map[place.tier]?.push(place)
  }
  for (const tier of TIERS) {
    map[tier].sort(compareBoardOrder)
  }
  return map
}

/** Id lists per tier for sortable board state. */
export function itemsByTierFromPlaces(
  places: SavedPlace[],
): Record<PlaceTier, string[]> {
  const byTier = groupPlacesByTier(places)
  return {
    dream: byTier.dream.map((p) => p.id),
    strong: byTier.strong.map((p) => p.id),
    maybe: byTier.maybe.map((p) => p.id),
    pass: byTier.pass.map((p) => p.id),
  }
}

export function findBoardContainer(
  items: Record<PlaceTier, string[]>,
  id: string,
): PlaceTier | null {
  if (id.startsWith('tier:') && isPlaceTier(id.slice(5))) {
    return id.slice(5) as PlaceTier
  }
  for (const tier of TIERS) {
    if (items[tier].includes(id)) return tier
  }
  return null
}

/**
 * Live preview relocate for multi-container drag.
 * Same-container returns null (use arrayMove on drop instead).
 */
export function relocateBoardItem(
  items: Record<PlaceTier, string[]>,
  activeId: string,
  overId: string,
): Record<PlaceTier, string[]> | null {
  if (activeId === overId) return null

  const activeContainer = findBoardContainer(items, activeId)
  const overContainer = findBoardContainer(items, overId)
  if (!activeContainer || !overContainer) return null
  if (activeContainer === overContainer) return null

  const activeItems = [...items[activeContainer]]
  const overItems = [...items[overContainer]]
  const activeIndex = activeItems.indexOf(activeId)
  if (activeIndex < 0) return null

  activeItems.splice(activeIndex, 1)

  let newIndex: number
  if (overId.startsWith('tier:')) {
    newIndex = overItems.length
  } else {
    const overIndex = overItems.indexOf(overId)
    // Insert before the hovered item (after removal from source).
    newIndex = overIndex >= 0 ? overIndex : overItems.length
  }

  overItems.splice(newIndex, 0, activeId)

  return {
    ...items,
    [activeContainer]: activeItems,
    [overContainer]: overItems,
  }
}

function placementsForTier(
  byTier: Record<PlaceTier, SavedPlace[]>,
  tiers: PlaceTier[],
): BoardPlacement[] {
  const out: BoardPlacement[] = []
  for (const tier of tiers) {
    byTier[tier].forEach((place, index) => {
      out.push({ id: place.id, tier, boardOrder: index })
    })
  }
  return out
}

/**
 * Move `activeId` onto `overId` (another place) or into an empty tier
 * (`tier:<name>`). Returns placements for every place in affected tiers.
 *
 * Same-tier semantics match arrayMove: drop on a later item places after it;
 * drop on an earlier item places before it.
 */
export function movePlaceOnBoard(
  places: SavedPlace[],
  activeId: string,
  overId: string,
): BoardPlacement[] | null {
  if (activeId === overId) return null

  const original = groupPlacesByTier(places)
  let sourceTier: PlaceTier | null = null
  let fromIndex = -1
  let moving: SavedPlace | null = null

  for (const tier of TIERS) {
    const idx = original[tier].findIndex((p) => p.id === activeId)
    if (idx >= 0) {
      sourceTier = tier
      fromIndex = idx
      moving = original[tier][idx]!
      break
    }
  }
  if (!moving || !sourceTier) return null

  const next = groupPlacesByTier(places)
  next[sourceTier].splice(fromIndex, 1)

  let destTier: PlaceTier = sourceTier
  let destIndex = next[sourceTier].length

  if (overId.startsWith('tier:')) {
    const tierName = overId.slice(5)
    if (!isPlaceTier(tierName)) return null
    destTier = tierName
    destIndex = next[destTier].length
  } else {
    let overTier: PlaceTier | null = null
    let overIndexBefore = -1
    for (const tier of TIERS) {
      const idx = original[tier].findIndex((p) => p.id === overId)
      if (idx >= 0) {
        overTier = tier
        overIndexBefore = idx
        break
      }
    }
    if (!overTier || overIndexBefore < 0) return null
    destTier = overTier

    if (sourceTier === destTier) {
      // arrayMove-style: moving right uses the pre-removal over index;
      // moving left uses the over index (unchanged by removal after it).
      destIndex = overIndexBefore
    } else {
      destIndex = next[destTier].findIndex((p) => p.id === overId)
      if (destIndex < 0) destIndex = next[destTier].length
    }
  }

  next[destTier].splice(destIndex, 0, { ...moving, tier: destTier })

  return placementsForTier(next, [...new Set([sourceTier, destTier])])
}

/**
 * Move `placeId` to `destTier` (appended at the end of that tier).
 * Returns placements for affected tiers, or null if unchanged / missing.
 */
export function movePlaceToTier(
  places: SavedPlace[],
  placeId: string,
  destTier: PlaceTier,
): BoardPlacement[] | null {
  const place = places.find((p) => p.id === placeId)
  if (!place) return null
  if (place.tier === destTier) return null
  return movePlaceOnBoard(places, placeId, `tier:${destTier}`)
}
