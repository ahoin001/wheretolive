import type { PlaceTier } from '../types'
import {
  formatMonthLabel,
  placeAddedAt,
  startOfLocalDay,
} from './addedDate'

export type PlaceListSection<T> = {
  key: string
  label: string
  items: T[]
}

const TIER_ORDER: PlaceTier[] = ['dream', 'strong', 'maybe', 'pass']

const TIER_LABEL: Record<PlaceTier, string> = {
  dream: 'Dream',
  strong: 'Strong yes',
  maybe: 'Maybe',
  pass: 'Pass',
}

function daysBetween(a: Date, b: Date): number {
  const ms = startOfLocalDay(a).getTime() - startOfLocalDay(b).getTime()
  return Math.round(ms / 86_400_000)
}

/** Sticky-header sections for “Recently added” sort. */
export function groupPlacesByAdded<T extends { createdAt: string }>(
  places: T[],
  now = new Date(),
): PlaceListSection<T>[] {
  const today = startOfLocalDay(now)
  const buckets = new Map<string, PlaceListSection<T> & { order: number }>()

  for (const place of places) {
    const added = placeAddedAt(place.createdAt, now)
    const day = startOfLocalDay(added)
    const delta = daysBetween(today, day)

    let key: string
    let label: string
    let order: number

    if (delta === 0) {
      key = 'today'
      label = 'Today'
      order = 0
    } else if (delta === 1) {
      key = 'yesterday'
      label = 'Yesterday'
      order = 1
    } else if (delta >= 2 && delta < 7) {
      key = 'this_week'
      label = 'Earlier this week'
      order = 2
    } else if (
      day.getFullYear() === today.getFullYear() &&
      day.getMonth() === today.getMonth()
    ) {
      key = 'this_month'
      label = 'Earlier this month'
      order = 3
    } else {
      key = `month_${day.getFullYear()}_${day.getMonth()}`
      label = formatMonthLabel(day.getFullYear(), day.getMonth())
      // After relative buckets; newer months first
      order = 1_000_000 - (day.getFullYear() * 12 + day.getMonth())
    }

    const existing = buckets.get(key)
    if (existing) existing.items.push(place)
    else buckets.set(key, { key, label, items: [place], order })
  }

  return [...buckets.values()]
    .sort((a, b) => a.order - b.order)
    .map(({ key, label, items }) => ({ key, label, items }))
}

/** Sticky-header sections by board tier. */
export function groupPlacesByTier<T extends { tier: PlaceTier }>(
  places: T[],
): PlaceListSection<T>[] {
  const map = new Map<PlaceTier, T[]>()
  for (const tier of TIER_ORDER) map.set(tier, [])
  for (const place of places) {
    map.get(place.tier)?.push(place)
  }
  return TIER_ORDER.filter((tier) => (map.get(tier)?.length ?? 0) > 0).map(
    (tier) => ({
      key: tier,
      label: TIER_LABEL[tier],
      items: map.get(tier) ?? [],
    }),
  )
}

export const LIST_PAGE_SIZE = 12
