import { describe, expect, it } from 'vitest'
import { groupPlacesByAdded, groupPlacesByTier } from './listGrouping'

describe('groupPlacesByAdded', () => {
  const now = new Date(2026, 7, 7, 15)

  it('buckets today, yesterday, and older months', () => {
    const places = [
      { id: 'a', createdAt: new Date(2026, 7, 7, 10).toISOString() },
      { id: 'b', createdAt: new Date(2026, 7, 6, 10).toISOString() },
      { id: 'c', createdAt: new Date(2026, 6, 2, 10).toISOString() },
    ]
    const sections = groupPlacesByAdded(places, now)
    expect(sections.map((s) => s.key)).toEqual([
      'today',
      'yesterday',
      'month_2026_6',
    ])
    expect(sections[0]?.items.map((p) => p.id)).toEqual(['a'])
  })
})

describe('groupPlacesByTier', () => {
  it('keeps dream → pass order and skips empty tiers', () => {
    const places = [
      { id: '1', tier: 'maybe' as const },
      { id: '2', tier: 'dream' as const },
      { id: '3', tier: 'dream' as const },
    ]
    const sections = groupPlacesByTier(places)
    expect(sections.map((s) => s.key)).toEqual(['dream', 'maybe'])
    expect(sections[0]?.items).toHaveLength(2)
  })
})
