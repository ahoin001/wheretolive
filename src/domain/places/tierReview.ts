import type { SavedPlace } from '../types'
import { PLACE_SQFT_FILTER_OPTIONS } from '../types'
import { cityKey, placeCityLabel } from './address'
import { compareBoardOrder } from './boardOrder'

/** Temporary board review — never written to boardOrder. */
export type TierBoardSort =
  | 'board'
  | 'price_asc'
  | 'price_desc'
  | 'sqft_asc'
  | 'sqft_desc'
  | 'city_asc'

export type TierReviewState = {
  sort: TierBoardSort
  /** Empty = all cities in the tier */
  cityKey: string
  /** `all` or a PLACE_SQFT_FILTER_OPTIONS value */
  sqftFilter: string
}

export const DEFAULT_TIER_REVIEW: TierReviewState = {
  sort: 'board',
  cityKey: '',
  sqftFilter: 'all',
}

export const TIER_BOARD_SORT_OPTIONS: {
  value: TierBoardSort
  label: string
}[] = [
  { value: 'board', label: 'Your order' },
  { value: 'price_asc', label: 'Price · low–high' },
  { value: 'price_desc', label: 'Price · high–low' },
  { value: 'sqft_asc', label: 'Sqft · low–high' },
  { value: 'sqft_desc', label: 'Sqft · high–low' },
  { value: 'city_asc', label: 'City · A–Z' },
]

export function isTierReviewActive(state: TierReviewState): boolean {
  return (
    state.sort !== 'board' ||
    state.cityKey !== '' ||
    state.sqftFilter !== 'all'
  )
}

/** Rent → monthly; buy → list price. Missing values sort last. */
export function placePriceValue(place: SavedPlace): number | null {
  if (place.listingKind === 'rent') {
    return place.monthlyEstimate != null && Number.isFinite(place.monthlyEstimate)
      ? place.monthlyEstimate
      : null
  }
  return place.price != null && Number.isFinite(place.price) ? place.price : null
}

function matchesSqftBand(place: SavedPlace, filter: string): boolean {
  if (filter === 'all') return true
  const band = PLACE_SQFT_FILTER_OPTIONS.find((o) => o.value === filter)
  if (!band || place.sqft == null || place.sqft <= 0) return false
  if (place.sqft < band.min) return false
  if (band.max != null && place.sqft >= band.max) return false
  return true
}

function matchesCity(place: SavedPlace, key: string): boolean {
  if (!key) return true
  const label = placeCityLabel(place)
  return label != null && cityKey(label) === key
}

function compareNullable(
  a: number | null,
  b: number | null,
  dir: 1 | -1,
): number {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  return (a - b) * dir
}

/**
 * Filter + sort a tier’s places for temporary review.
 * Input should already be in saved board order; `board` sort preserves that.
 */
export function applyTierReview(
  places: SavedPlace[],
  state: TierReviewState,
): SavedPlace[] {
  let next = places.filter(
    (p) => matchesCity(p, state.cityKey) && matchesSqftBand(p, state.sqftFilter),
  )

  if (state.sort === 'board') return next

  next = [...next].sort((a, b) => {
    let cmp = 0
    if (state.sort === 'price_asc' || state.sort === 'price_desc') {
      const dir = state.sort === 'price_asc' ? 1 : -1
      cmp = compareNullable(placePriceValue(a), placePriceValue(b), dir)
    } else if (state.sort === 'sqft_asc' || state.sort === 'sqft_desc') {
      const dir = state.sort === 'sqft_asc' ? 1 : -1
      cmp = compareNullable(
        a.sqft != null && a.sqft > 0 ? a.sqft : null,
        b.sqft != null && b.sqft > 0 ? b.sqft : null,
        dir,
      )
    } else if (state.sort === 'city_asc') {
      const ca = placeCityLabel(a) ?? ''
      const cb = placeCityLabel(b) ?? ''
      cmp = ca.localeCompare(cb, undefined, { sensitivity: 'base' })
      if (cmp === 0 && !ca && !cb) {
        // both missing city — keep board order via fallback
      }
    }
    if (cmp !== 0) return cmp
    return compareBoardOrder(a, b)
  })

  return next
}

export function citiesInPlaces(
  places: SavedPlace[],
): { key: string; label: string; count: number }[] {
  const map = new Map<string, { label: string; count: number }>()
  for (const place of places) {
    const label = placeCityLabel(place)
    if (!label) continue
    const key = cityKey(label)
    const existing = map.get(key)
    if (existing) existing.count += 1
    else map.set(key, { label, count: 1 })
  }
  return [...map.entries()]
    .map(([key, value]) => ({ key, label: value.label, count: value.count }))
    .sort((a, b) =>
      a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }),
    )
}
