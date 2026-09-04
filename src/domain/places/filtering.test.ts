import { describe, expect, it } from 'vitest'
import {
  idsInTierDisplayOrder,
  matchesPlaceSearch,
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

describe('matchesPlaceSearch', () => {
  const place = {
    title: 'Modern Town House',
    street: '10398 Orange Ct',
    city: 'Pembroke Pines',
    state: 'FL',
    zip: '33025',
    location: '10398 Orange Ct, Pembroke Pines, FL 33025',
  }

  it('matches empty query', () => {
    expect(matchesPlaceSearch(place, '')).toBe(true)
    expect(matchesPlaceSearch(place, '   ')).toBe(true)
  })

  it('matches title tokens', () => {
    expect(matchesPlaceSearch(place, 'town')).toBe(true)
    expect(matchesPlaceSearch(place, 'modern house')).toBe(true)
    expect(matchesPlaceSearch(place, 'cabin')).toBe(false)
  })

  it('matches address pieces', () => {
    expect(matchesPlaceSearch(place, 'orange')).toBe(true)
    expect(matchesPlaceSearch(place, 'pembroke 33025')).toBe(true)
    expect(matchesPlaceSearch(place, 'davie')).toBe(false)
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

  it('filters by search query', () => {
    const places = [
      {
        id: 'a',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        title: 'Lakeview Condo',
        street: '1 Main St',
        city: 'Miami',
        state: 'FL',
        zip: '33101',
        location: '1 Main St, Miami, FL 33101',
        pets: 'no',
        homeType: null,
        sqft: null,
        listingKind: 'rent',
        monthlyEstimate: 1000,
        likedByMe: false,
        favorite: false,
      },
      {
        id: 'b',
        createdAt: '2024-02-01T00:00:00.000Z',
        updatedAt: '2024-02-01T00:00:00.000Z',
        title: 'Yard Home',
        street: '9 Palm Dr',
        city: 'Davie',
        state: 'FL',
        zip: '33314',
        location: '9 Palm Dr, Davie, FL 33314',
        pets: 'yes',
        homeType: null,
        sqft: null,
        listingKind: 'rent',
        monthlyEstimate: 2000,
        likedByMe: false,
        favorite: false,
      },
    ] as never
    const found = sortPlaces(
      places,
      'recent',
      'all',
      'all',
      'all',
      [],
      false,
      { type: 'all' },
      false,
      'davie',
    )
    expect(found.map((p) => p.id)).toEqual(['b'])
  })

  it('filters to liked places only', () => {
    const places = [
      {
        id: 'liked',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        pets: 'no',
        homeType: null,
        sqft: null,
        city: 'Miami',
        location: '',
        listingKind: 'rent',
        monthlyEstimate: 1000,
        likedByMe: true,
        favorite: true,
      },
      {
        id: 'plain',
        createdAt: '2024-02-01T00:00:00.000Z',
        updatedAt: '2024-02-01T00:00:00.000Z',
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
    const liked = sortPlaces(
      places,
      'recent',
      'all',
      'all',
      'all',
      [],
      false,
      { type: 'all' },
      false,
      '',
      true,
    )
    expect(liked.map((p) => p.id)).toEqual(['liked'])
  })
})
