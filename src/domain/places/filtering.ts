import type { CommuteSettings } from '../types'
import {
  PLACE_SQFT_FILTER_OPTIONS,
  type PlaceHomeType,
  type PlaceTier,
  type SavedPlace,
} from '../types'
import { cityKey, placeCityLabel } from './address'
import {
  DEFAULT_COMMUTE_SETTINGS,
  isWithinCommuteBudget,
  type CommuteEstimate,
} from './commute'
import {
  matchesAddedFilter,
  type AddedFilter,
} from './addedDate'
import { isPlaceTaken } from './status'

export type CommuteFilter = 'all' | 'ideal' | 'within_budget' | 'over_budget'
export const DEFAULT_COMMUTE_FILTER: CommuteFilter = 'all'

export function matchesCommuteFilter(
  estimate: CommuteEstimate | null | undefined,
  filter: CommuteFilter,
  settings: CommuteSettings = DEFAULT_COMMUTE_SETTINGS,
): boolean {
  if (filter === 'all') return true
  const minutes = estimate?.minutes
  if (minutes == null || !Number.isFinite(minutes)) return false
  if (filter === 'ideal') return minutes <= settings.idealMaxMin
  if (filter === 'within_budget') {
    return isWithinCommuteBudget(estimate, settings)
  }
  if (filter === 'over_budget') return minutes > settings.budgetMaxMin
  return true
}

export const PLACE_TIERS: PlaceTier[] = ['dream', 'strong', 'maybe', 'pass']

/** List filter: show every place until the user narrows by pets. */
export type PetsFilter = 'allowed' | 'none' | 'all'
export const DEFAULT_PETS_FILTER: PetsFilter = 'all'

/** Home-type filter; options after Any are alphabetical via PLACE_HOME_TYPE_OPTIONS */
export type HomeTypeFilter = 'all' | PlaceHomeType
export const DEFAULT_HOME_TYPE_FILTER: HomeTypeFilter = 'all'

/** Sqft band filter; `all` or a PLACE_SQFT_FILTER_OPTIONS value */
export type SqftFilter = 'all' | string
export const DEFAULT_SQFT_FILTER: SqftFilter = 'all'

export type ListSort = 'recent' | 'liked' | 'monthly_asc' | 'monthly_desc'

export function allowsPets(place: Pick<SavedPlace, 'pets'>): boolean {
  return place.pets === 'yes' || place.pets === 'limited'
}

export function matchesPetsFilter(
  place: Pick<SavedPlace, 'pets'>,
  filter: PetsFilter,
): boolean {
  if (filter === 'all') return true
  if (filter === 'allowed') return allowsPets(place)
  return !allowsPets(place)
}

export function matchesHomeTypeFilter(
  place: Pick<SavedPlace, 'homeType'>,
  filter: HomeTypeFilter,
): boolean {
  if (filter === 'all') return true
  return place.homeType === filter
}

export function matchesSqftFilter(
  place: Pick<SavedPlace, 'sqft'>,
  filter: SqftFilter,
): boolean {
  if (filter === 'all') return true
  const band = PLACE_SQFT_FILTER_OPTIONS.find((o) => o.value === filter)
  if (!band || place.sqft == null || place.sqft <= 0) return false
  if (place.sqft < band.min) return false
  if (band.max != null && place.sqft >= band.max) return false
  return true
}

export function isLikedByMe(place: SavedPlace): boolean {
  return Boolean(place.likedByMe ?? place.favorite)
}

export function isMutualLike(place: SavedPlace): boolean {
  const ids = place.likedByUserIds ?? place.likedBy?.map((l) => l.userId) ?? []
  return ids.length >= 2
}

/** Collapse whitespace and lowercase for place name / address search. */
export function normalizePlaceSearchQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Match title or address fields (street, city, state, zip, location display).
 * Empty query matches everything. Multi-word queries require every token.
 */
export function matchesPlaceSearch(
  place: Pick<
    SavedPlace,
    'title' | 'street' | 'city' | 'state' | 'zip' | 'location'
  >,
  query: string,
): boolean {
  const q = normalizePlaceSearchQuery(query)
  if (!q) return true
  const haystack = [
    place.title,
    place.street,
    place.city,
    place.state,
    place.zip,
    place.location,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  const tokens = q.split(' ').filter(Boolean)
  return tokens.every((token) => haystack.includes(token))
}

export function ms(iso: string | null | undefined): number {
  if (!iso) return 0
  const n = Date.parse(iso)
  return Number.isFinite(n) ? n : 0
}

/** Newest place first (default list order — ignores likes). */
export function sortByRecentlyAdded(a: SavedPlace, b: SavedPlace): number {
  return ms(b.createdAt) - ms(a.createdAt) || ms(b.updatedAt) - ms(a.updatedAt)
}

/**
 * Most recent heart wins. Shared boards use the latest member like;
 * solo boards use the current user’s likedAt.
 */
export function lastLikedMs(place: SavedPlace): number {
  if (place.likedBy?.length) {
    let best = 0
    for (const liker of place.likedBy) {
      best = Math.max(best, ms(liker.likedAt))
    }
    if (best > 0) return best
  }
  if (isLikedByMe(place)) {
    return ms(place.likedAt) || ms(place.updatedAt)
  }
  return 0
}

/** Liked places first, ordered by most recently liked; then recently added. */
export function sortByRecentlyLiked(a: SavedPlace, b: SavedPlace): number {
  const aLike = lastLikedMs(a)
  const bLike = lastLikedMs(b)
  if (aLike !== bLike) return bLike - aLike
  const aHas = aLike > 0 || isLikedByMe(a)
  const bHas = bLike > 0 || isLikedByMe(b)
  if (aHas !== bHas) return aHas ? -1 : 1
  return sortByRecentlyAdded(a, b)
}

export function countActiveFilters(
  listSort: ListSort,
  petsFilter: PetsFilter,
  homeTypeFilter: HomeTypeFilter,
  sqftFilter: SqftFilter,
  mutualOnly: boolean,
  cityFilterActive: boolean,
  addedFilterActive: boolean,
  hideTaken = false,
  commuteFilter: CommuteFilter = 'all',
  likedOnly = false,
): number {
  return (
    (listSort !== 'recent' ? 1 : 0) +
    (petsFilter !== 'all' ? 1 : 0) +
    (homeTypeFilter !== 'all' ? 1 : 0) +
    (sqftFilter !== 'all' ? 1 : 0) +
    (mutualOnly ? 1 : 0) +
    (likedOnly ? 1 : 0) +
    (cityFilterActive ? 1 : 0) +
    (addedFilterActive ? 1 : 0) +
    (hideTaken ? 1 : 0) +
    (commuteFilter !== 'all' ? 1 : 0)
  )
}

/** Monthly rent for pricing sorts (rental-first product). Buy list prices are not used. */
export function monthlyCost(place: SavedPlace): number | null {
  if (place.listingKind === 'buy') return null
  return place.monthlyEstimate != null && Number.isFinite(place.monthlyEstimate)
    ? place.monthlyEstimate
    : null
}

export function placeCityKey(
  place: Pick<SavedPlace, 'city' | 'location'>,
): string | null {
  const city = placeCityLabel(place)
  return city ? cityKey(city) : null
}

export function citiesFromPlaces(
  places: SavedPlace[],
): { key: string; label: string; count: number }[] {
  const map = new Map<string, { label: string; count: number }>()
  for (const place of places) {
    const city = placeCityLabel(place)
    if (!city) continue
    const key = cityKey(city)
    const existing = map.get(key)
    if (existing) {
      existing.count += 1
    } else {
      map.set(key, { label: city, count: 1 })
    }
  }
  return [...map.entries()]
    .map(([key, value]) => ({ key, label: value.label, count: value.count }))
    .sort((a, b) =>
      a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }),
    )
}

export function placeMatchesCities(
  place: SavedPlace,
  selectedKeys: string[],
): boolean {
  if (!selectedKeys.length) return true
  const key = placeCityKey(place)
  return key != null && selectedKeys.includes(key)
}

export function sortPlaces(
  places: SavedPlace[],
  sort: ListSort,
  petsFilter: PetsFilter,
  homeTypeFilter: HomeTypeFilter,
  sqftFilter: SqftFilter,
  cityKeys: string[],
  mutualOnly: boolean,
  addedFilter: AddedFilter,
  hideTaken = false,
  searchQuery = '',
  likedOnly = false,
): SavedPlace[] {
  let next = places.filter((p) => {
    if (!matchesPetsFilter(p, petsFilter)) return false
    if (!matchesHomeTypeFilter(p, homeTypeFilter)) return false
    if (!matchesSqftFilter(p, sqftFilter)) return false
    if (!placeMatchesCities(p, cityKeys)) return false
    if (mutualOnly && !isMutualLike(p)) return false
    if (likedOnly && !isLikedByMe(p)) return false
    if (!matchesAddedFilter(p, addedFilter)) return false
    if (hideTaken && isPlaceTaken(p)) return false
    if (!matchesPlaceSearch(p, searchQuery)) return false
    return true
  })

  const byMissingLast = (value: number | null, dir: 1 | -1) => {
    if (value == null) return Number.POSITIVE_INFINITY
    return dir === 1 ? value : -value
  }

  next = [...next].sort((a, b) => {
    if (sort === 'monthly_asc' || sort === 'monthly_desc') {
      const dir = sort === 'monthly_asc' ? 1 : -1
      const byRent =
        byMissingLast(monthlyCost(a), dir as 1 | -1) -
        byMissingLast(monthlyCost(b), dir as 1 | -1)
      if (byRent !== 0) return byRent
      if (a.listingKind !== b.listingKind) {
        return a.listingKind === 'rent' ? -1 : 1
      }
      if (lastLikedMs(a) || lastLikedMs(b)) {
        return sortByRecentlyLiked(a, b)
      }
      return sortByRecentlyAdded(a, b)
    }
    if (sort === 'liked' || mutualOnly) {
      return sortByRecentlyLiked(a, b)
    }
    return sortByRecentlyAdded(a, b)
  })

  return next
}

/** Resolve places in the exact order of `ids` (selection / share order). */
export function placesInIdOrder(
  places: Iterable<SavedPlace>,
  ids: string[],
): SavedPlace[] {
  const byId = new Map<string, SavedPlace>()
  for (const place of places) byId.set(place.id, place)
  const ordered: SavedPlace[] = []
  for (const id of ids) {
    const place = byId.get(id)
    if (place) ordered.push(place)
  }
  return ordered
}

/** Tier board left→right / top→bottom order for “select all shown”. */
export function idsInTierDisplayOrder(places: SavedPlace[]): string[] {
  const buckets: Record<PlaceTier, SavedPlace[]> = {
    dream: [],
    strong: [],
    maybe: [],
    pass: [],
  }
  for (const place of places) {
    const tier = buckets[place.tier] ? place.tier : 'maybe'
    buckets[tier].push(place)
  }
  for (const tier of PLACE_TIERS) {
    buckets[tier].sort(
      (a, b) => (a.boardOrder ?? 0) - (b.boardOrder ?? 0),
    )
  }
  return PLACE_TIERS.flatMap((tier) => buckets[tier].map((p) => p.id))
}

export function placeImages(place: SavedPlace): string[] {
  return Array.isArray(place.images) ? place.images.filter(Boolean) : []
}
