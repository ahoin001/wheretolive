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
