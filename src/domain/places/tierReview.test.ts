import { describe, expect, it } from 'vitest'
import type { SavedPlace } from '../types'
import {
  applyTierReview,
  DEFAULT_TIER_REVIEW,
  isTierReviewActive,
} from './tierReview'

function place(
  partial: Partial<SavedPlace> & Pick<SavedPlace, 'id'>,
): SavedPlace {
  return {
    createdAt: '2026-08-01T12:00:00.000Z',
    updatedAt: '2026-08-01T12:00:00.000Z',
    title: 'Place',
    url: '',
    listingKind: 'rent',
    homeType: null,
    price: null,
    monthlyEstimate: 2000,
    street: '',
    city: 'Tamarac',
    state: 'FL',
    zip: '',
    location: 'Tamarac, FL',
    bedrooms: 2,
    bathrooms: 2,
    sqft: 1100,
    notes: '',
    pets: 'no',
    petsNote: '',
    proTags: [],
    concernTags: [],
    tier: 'dream',
    status: 'none',
    favorite: false,
    images: [],
    tags: [],
    boardOrder: 0,
    ...partial,
  }
}

describe('applyTierReview', () => {
  const places = [
    place({
      id: 'a',
      boardOrder: 0,
      monthlyEstimate: 2500,
      sqft: 900,
      city: 'Miramar',
    }),
    place({
      id: 'b',
      boardOrder: 1,
      monthlyEstimate: 1800,
      sqft: 1400,
      city: 'Tamarac',
    }),
    place({
      id: 'c',
      boardOrder: 2,
      monthlyEstimate: 2100,
      sqft: 1200,
      city: 'Tamarac',
    }),
  ]

  it('preserves board order by default', () => {
    const next = applyTierReview(places, DEFAULT_TIER_REVIEW)
    expect(next.map((p) => p.id)).toEqual(['a', 'b', 'c'])
    expect(isTierReviewActive(DEFAULT_TIER_REVIEW)).toBe(false)
  })

  it('sorts by price without mutating saved order semantics of input', () => {
    const next = applyTierReview(places, {
      ...DEFAULT_TIER_REVIEW,
      sort: 'price_asc',
    })
    expect(next.map((p) => p.id)).toEqual(['b', 'c', 'a'])
    expect(places.map((p) => p.id)).toEqual(['a', 'b', 'c'])
  })

  it('filters by city and sqft band', () => {
    const next = applyTierReview(places, {
      sort: 'board',
      cityKey: 'tamarac',
      sqftFilter: '1200_1400',
    })
    expect(next.map((p) => p.id)).toEqual(['c'])
    expect(isTierReviewActive({
      sort: 'board',
      cityKey: 'tamarac',
      sqftFilter: 'all',
    })).toBe(true)
  })
})
