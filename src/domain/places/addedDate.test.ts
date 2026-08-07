import { describe, expect, it } from 'vitest'
import {
  buildAddedBuckets,
  formatAddedFilterSummary,
  matchesAddedFilter,
  parseDateInputValue,
  toDateInputValue,
  type AddedFilter,
} from './addedDate'

describe('parseDateInputValue / toDateInputValue', () => {
  it('round-trips a local calendar day', () => {
    const d = parseDateInputValue('2026-08-07')
    expect(d).not.toBeNull()
    expect(toDateInputValue(d!)).toBe('2026-08-07')
  })

  it('rejects invalid calendar dates', () => {
    expect(parseDateInputValue('2026-02-31')).toBeNull()
    expect(parseDateInputValue('nope')).toBeNull()
  })
})

describe('matchesAddedFilter', () => {
  const now = new Date(2026, 7, 7, 15, 0, 0) // Aug 7 2026 local

  it('matches today / yesterday / last_days', () => {
    const today = { createdAt: new Date(2026, 7, 7, 9).toISOString() }
    const yesterday = { createdAt: new Date(2026, 7, 6, 20).toISOString() }
    const weekAgo = { createdAt: new Date(2026, 7, 1, 12).toISOString() }
    const old = { createdAt: new Date(2026, 6, 1, 12).toISOString() }

    expect(matchesAddedFilter(today, { type: 'today' }, now)).toBe(true)
    expect(matchesAddedFilter(yesterday, { type: 'today' }, now)).toBe(false)
    expect(matchesAddedFilter(yesterday, { type: 'yesterday' }, now)).toBe(true)
    expect(matchesAddedFilter(weekAgo, { type: 'last_days', days: 7 }, now)).toBe(
      true,
    )
    expect(matchesAddedFilter(old, { type: 'last_days', days: 7 }, now)).toBe(
      false,
    )
  })

  it('matches calendar month and inclusive custom range', () => {
    const place = { createdAt: new Date(2026, 6, 15, 10).toISOString() }
    expect(
      matchesAddedFilter(place, { type: 'month', year: 2026, month: 6 }, now),
    ).toBe(true)
    expect(
      matchesAddedFilter(place, { type: 'month', year: 2026, month: 7 }, now),
    ).toBe(false)
    expect(
      matchesAddedFilter(
        place,
        { type: 'range', from: '2026-07-01', to: '2026-07-31' },
        now,
      ),
    ).toBe(true)
    expect(
      matchesAddedFilter(
        place,
        { type: 'range', from: '2026-08-01', to: '2026-08-31' },
        now,
      ),
    ).toBe(false)
  })
})

describe('buildAddedBuckets', () => {
  it('only includes non-empty relative windows and lists months with counts', () => {
    const now = new Date(2026, 7, 7, 12)
    const places = [
      { createdAt: new Date(2026, 7, 7, 8).toISOString() },
      { createdAt: new Date(2026, 7, 7, 9).toISOString() },
      { createdAt: new Date(2026, 6, 3, 9).toISOString() },
    ]
    const buckets = buildAddedBuckets(places, now)
    const today = buckets.find((b) => b.id === 'today')
    expect(today?.count).toBe(2)
    expect(buckets.find((b) => b.id === 'yesterday')).toBeUndefined()
    const july = buckets.find((b) => b.id === 'month_2026_6')
    expect(july?.count).toBe(1)
    expect(july?.label).toMatch(/July/)
  })
})

describe('formatAddedFilterSummary', () => {
  it('labels presets and ranges', () => {
    expect(formatAddedFilterSummary({ type: 'all' })).toBe('Any time')
    expect(formatAddedFilterSummary({ type: 'last_days', days: 30 })).toBe(
      'Past 30 days',
    )
    const range: AddedFilter = {
      type: 'range',
      from: '2026-08-01',
      to: '2026-08-07',
    }
    expect(formatAddedFilterSummary(range)).toContain('–')
  })
})
