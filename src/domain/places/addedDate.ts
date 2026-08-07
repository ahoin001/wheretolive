/** Local-calendar helpers for “date added” place filters. */

export type AddedFilter =
  | { type: 'all' }
  | { type: 'today' }
  | { type: 'yesterday' }
  | { type: 'last_days'; days: 7 | 30 }
  | { type: 'month'; year: number; month: number }
  | { type: 'range'; from: string; to: string }

export const DEFAULT_ADDED_FILTER: AddedFilter = { type: 'all' }

export type AddedBucket = {
  id: string
  label: string
  count: number
  filter: Exclude<AddedFilter, { type: 'all' } | { type: 'range' }>
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

/** Local YYYY-MM-DD */
export function toDateInputValue(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

export function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function endOfLocalDay(date: Date): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    23,
    59,
    59,
    999,
  )
}

/** Parse YYYY-MM-DD as a local calendar day (not UTC midnight). */
export function parseDateInputValue(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2]) - 1
  const day = Number(m[3])
  const d = new Date(year, month, day)
  if (
    d.getFullYear() !== year ||
    d.getMonth() !== month ||
    d.getDate() !== day
  ) {
    return null
  }
  return d
}

export function placeAddedAt(iso: string, now = new Date()): Date {
  const d = new Date(iso)
  return Number.isFinite(d.getTime()) ? d : now
}

function inInclusiveRange(ms: number, from: Date, to: Date): boolean {
  return ms >= from.getTime() && ms <= to.getTime()
}

export function addedFilterBounds(
  filter: AddedFilter,
  now = new Date(),
): { from: Date; to: Date } | null {
  if (filter.type === 'all') return null

  const todayStart = startOfLocalDay(now)
  const todayEnd = endOfLocalDay(now)

  if (filter.type === 'today') {
    return { from: todayStart, to: todayEnd }
  }

  if (filter.type === 'yesterday') {
    const y = new Date(todayStart)
    y.setDate(y.getDate() - 1)
    return { from: startOfLocalDay(y), to: endOfLocalDay(y) }
  }

  if (filter.type === 'last_days') {
    const from = new Date(todayStart)
    from.setDate(from.getDate() - (filter.days - 1))
    return { from: startOfLocalDay(from), to: todayEnd }
  }

  if (filter.type === 'month') {
    const from = new Date(filter.year, filter.month, 1)
    const to = endOfLocalDay(new Date(filter.year, filter.month + 1, 0))
    return { from, to }
  }

  const fromParsed = parseDateInputValue(filter.from)
  const toParsed = parseDateInputValue(filter.to)
  if (!fromParsed && !toParsed) return null
  const from = fromParsed ? startOfLocalDay(fromParsed) : new Date(0)
  const to = toParsed ? endOfLocalDay(toParsed) : endOfLocalDay(now)
  if (from.getTime() > to.getTime()) {
    return { from: startOfLocalDay(to), to: endOfLocalDay(from) }
  }
  return { from, to }
}

export function matchesAddedFilter(
  place: { createdAt: string },
  filter: AddedFilter,
  now = new Date(),
): boolean {
  const bounds = addedFilterBounds(filter, now)
  if (!bounds) return true
  const ms = placeAddedAt(place.createdAt, now).getTime()
  return inInclusiveRange(ms, bounds.from, bounds.to)
}

export function isAddedFilterActive(filter: AddedFilter): boolean {
  return filter.type !== 'all'
}

export function formatMonthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })
}

export function formatAddedFilterSummary(filter: AddedFilter): string {
  switch (filter.type) {
    case 'all':
      return 'Any time'
    case 'today':
      return 'Today'
    case 'yesterday':
      return 'Yesterday'
    case 'last_days':
      return filter.days === 7 ? 'Past 7 days' : 'Past 30 days'
    case 'month':
      return formatMonthLabel(filter.year, filter.month)
    case 'range': {
      const from = parseDateInputValue(filter.from)
      const to = parseDateInputValue(filter.to)
      const fmt = (d: Date) =>
        d.toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      if (from && to) {
        if (toDateInputValue(from) === toDateInputValue(to)) return fmt(from)
        return `${fmt(from)} – ${fmt(to)}`
      }
      if (from) return `From ${fmt(from)}`
      if (to) return `Through ${fmt(to)}`
      return 'Custom range'
    }
  }
}

function sameAddedFilter(a: AddedFilter, b: AddedFilter): boolean {
  if (a.type !== b.type) return false
  if (a.type === 'last_days' && b.type === 'last_days') return a.days === b.days
  if (a.type === 'month' && b.type === 'month') {
    return a.year === b.year && a.month === b.month
  }
  if (a.type === 'range' && b.type === 'range') {
    return a.from === b.from && a.to === b.to
  }
  return true
}

export function addedFiltersEqual(a: AddedFilter, b: AddedFilter): boolean {
  return sameAddedFilter(a, b)
}

/**
 * Live buckets from saved places: relative windows (only if non-empty)
 * plus calendar months that appear in the data (newest first).
 */
export function buildAddedBuckets(
  places: { createdAt: string }[],
  now = new Date(),
): AddedBucket[] {
  const relative: AddedBucket['filter'][] = [
    { type: 'today' },
    { type: 'yesterday' },
    { type: 'last_days', days: 7 },
    { type: 'last_days', days: 30 },
  ]

  const buckets: AddedBucket[] = []

  for (const filter of relative) {
    const count = places.filter((p) => matchesAddedFilter(p, filter, now)).length
    if (count === 0) continue
    buckets.push({
      id:
        filter.type === 'last_days'
          ? `last_${filter.days}`
          : filter.type,
      label: formatAddedFilterSummary(filter),
      count,
      filter,
    })
  }

  const monthCounts = new Map<string, { year: number; month: number; count: number }>()
  for (const place of places) {
    const d = placeAddedAt(place.createdAt, now)
    const year = d.getFullYear()
    const month = d.getMonth()
    const key = `${year}-${month}`
    const existing = monthCounts.get(key)
    if (existing) existing.count += 1
    else monthCounts.set(key, { year, month, count: 1 })
  }

  const months = [...monthCounts.values()].sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year
    return b.month - a.month
  })

  for (const m of months) {
    const filter: AddedFilter = {
      type: 'month',
      year: m.year,
      month: m.month,
    }
    buckets.push({
      id: `month_${m.year}_${m.month}`,
      label: formatMonthLabel(m.year, m.month),
      count: m.count,
      filter,
    })
  }

  return buckets
}

export function bucketSelected(
  filter: AddedFilter,
  bucket: AddedBucket,
): boolean {
  return sameAddedFilter(filter, bucket.filter)
}
