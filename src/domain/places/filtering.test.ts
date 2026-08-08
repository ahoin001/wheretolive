import { describe, expect, it } from 'vitest'
import {
  idsInTierDisplayOrder,
  placesInIdOrder,
  matchesPetsFilter,
  sortPlaces,
} from './filtering'

describe('placesInIdOrder', () => {
  it('preserves selection order', () => {
    const places = [
      { id: 'a', title: 'A' },
      { id: 'b', title: 'B' },
      { id: 'c', title: 'C' },
    ] as never
    expect(placesInIdOrder(places, ['c', 'a']).map((p) => p.id)).toEqual([
      'c',
      'a',
    ])
  })
})

describe('idsInTierDisplayOrder', () => {
  it('orders dream → pass then boardOrder', () => {
    const places = [
      { id: 'm1', tier: 'maybe', boardOrder: 1 },
      { id: 'd1', tier: 'dream', boardOrder: 0 },
      { id: 'm0', tier: 'maybe', boardOrder: 0 },
    ] as never
    expect(idsInTierDisplayOrder(places)).toEqual(['d1', 'm0', 'm1'])
  })
})

describe('matchesPetsFilter', () => {
  it('filters pets policies', () => {
    expect(matchesPetsFilter({ pets: 'yes' }, 'allowed')).toBe(true)
    expect(matchesPetsFilter({ pets: 'no' }, 'allowed')).toBe(false)
    expect(matchesPetsFilter({ pets: 'no' }, 'none')).toBe(true)
    expect(matchesPetsFilter({ pets: 'yes' }, 'all')).toBe(true)
  })
})

describe('sortPlaces', () => {
  it('applies recent sort after filters', () => {
    const places = [
      {
        id: 'old',
        createdAt: '2020-01-01T00:00:00.000Z',
        updatedAt: '2020-01-01T00:00:00.000Z',
        pets: 'no',
        homeType: null,
        sqft: null,
        city: 'Miami',
        location: '',
        listingKind: 'rent',
        monthlyEstimate: 1000,
        likedByMe: false,
        favorite: false,
      },
      {
        id: 'new',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        pets: 'yes',
        homeType: null,
        sqft: null,
        city: 'Miami',
        location: '',
        listingKind: 'rent',
        monthlyEstimate: 2000,
        likedByMe: false,
        favorite: false,
      },
    ] as never
    const sorted = sortPlaces(
      places,
      'recent',
      'all',
      'all',
      'all',
      [],
      false,
      { type: 'all' },
    )
    expect(sorted.map((p) => p.id)).toEqual(['new', 'old'])
  })
})
