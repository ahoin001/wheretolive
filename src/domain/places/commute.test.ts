import { describe, expect, it } from 'vitest'
import {
  commuteBadgeLabel,
  commuteBand,
  commuteQueryFromAddress,
  DEFAULT_COMMUTE_SETTINGS,
  formatCommuteMinutes,
  hasCommuteAddress,
  isWithinCommuteBudget,
  normalizeCommuteSettings,
} from './commute'
import {
  DEFAULT_COMMUTE_FILTER,
  matchesCommuteFilter,
} from './filtering'

describe('commuteBand', () => {
  it('classifies ideal, within, and over', () => {
    expect(commuteBand(28)).toBe('ideal')
    expect(commuteBand(30)).toBe('ideal')
    expect(commuteBand(33)).toBe('within')
    expect(commuteBand(35)).toBe('within')
    expect(commuteBand(36)).toBe('over')
    expect(commuteBand(null)).toBe('unknown')
  })

  it('respects custom thresholds', () => {
    const custom = { ...DEFAULT_COMMUTE_SETTINGS, idealMaxMin: 20, budgetMaxMin: 25 }
    expect(commuteBand(20, custom)).toBe('ideal')
    expect(commuteBand(24, custom)).toBe('within')
    expect(commuteBand(26, custom)).toBe('over')
  })
})

describe('normalizeCommuteSettings', () => {
  it('keeps budget at or above ideal', () => {
    const s = normalizeCommuteSettings({
      ...DEFAULT_COMMUTE_SETTINGS,
      idealMaxMin: 40,
      budgetMaxMin: 30,
    })
    expect(s.budgetMaxMin).toBeGreaterThanOrEqual(s.idealMaxMin)
  })
})

describe('commuteQueryFromAddress', () => {
  it('requires city and state', () => {
    expect(hasCommuteAddress({ city: 'Hollywood', state: '' })).toBe(false)
    expect(
      hasCommuteAddress({
        street: '2900 Dorchester Ln',
        city: 'Hollywood',
        state: 'FL',
        zip: '33026',
      }),
    ).toBe(true)
    expect(
      commuteQueryFromAddress({
        street: '2900 Dorchester Ln',
        city: 'Hollywood',
        state: 'FL',
        zip: '33026',
      }),
    ).toContain('Hollywood')
  })
})

describe('matchesCommuteFilter', () => {
  it('filters within budget and over', () => {
    const within = { minutes: 33, band: 'within' as const }
    const over = { minutes: 40, band: 'over' as const }
    expect(matchesCommuteFilter(within, DEFAULT_COMMUTE_FILTER)).toBe(true)
    expect(matchesCommuteFilter(within, 'within_budget')).toBe(true)
    expect(matchesCommuteFilter(within, 'over_budget')).toBe(false)
    expect(matchesCommuteFilter(over, 'over_budget')).toBe(true)
    expect(isWithinCommuteBudget(within)).toBe(true)
    expect(isWithinCommuteBudget(over)).toBe(false)
  })
})

describe('formatCommuteMinutes', () => {
  it('rounds to whole minutes', () => {
    expect(formatCommuteMinutes(32.4)).toBe('~32 min')
    expect(commuteBadgeLabel({ minutes: 32, band: 'within' })).toBe('~32 min')
  })
})
