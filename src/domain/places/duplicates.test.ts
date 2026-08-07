import { describe, expect, it } from 'vitest'
import type { SavedPlace } from '../types'
import {
  buildPlaceDiffRows,
  findDuplicateAddressGroups,
  normalizeStreetKey,
  placeAddressKey,
  suggestedKeepId,
} from './duplicates'

function place(partial: Partial<SavedPlace> & Pick<SavedPlace, 'id'>): SavedPlace {
  return {
    createdAt: '2026-08-01T12:00:00.000Z',
    updatedAt: '2026-08-01T12:00:00.000Z',
    title: 'Place',
    url: '',
    listingKind: 'rent',
    homeType: null,
    price: null,
    monthlyEstimate: 2000,
    street: '123 Main St',
    city: 'Tamarac',
    state: 'FL',
    zip: '33321',
    location: '123 Main St, Tamarac, FL 33321',
    bedrooms: 2,
    bathrooms: 2,
    sqft: 1100,
    notes: '',
    pets: 'no',
    petsNote: '',
    proTags: [],
    concernTags: [],
    tier: 'maybe',
    boardOrder: 0,
    status: 'none',
    favorite: false,
    images: [],
    tags: [],
    ...partial,
  }
}

describe('normalizeStreetKey / placeAddressKey', () => {
  it('treats St and Street as the same', () => {
    expect(normalizeStreetKey('123 Main Street')).toBe(
      normalizeStreetKey('123 Main St'),
    )
  })

  it('requires street plus city or zip', () => {
    expect(
      placeAddressKey({ street: '', city: 'Tamarac', state: 'FL', zip: '33321' }),
    ).toBeNull()
    expect(
      placeAddressKey({
        street: '123 Main St',
        city: 'Tamarac',
        state: 'FL',
        zip: '33321',
      }),
    ).toBeTruthy()
  })
})

describe('findDuplicateAddressGroups', () => {
  it('groups matching addresses and sorts by last edited', () => {
    const a = place({
      id: 'a',
      title: 'Older',
      updatedAt: '2026-08-01T10:00:00.000Z',
    })
    const b = place({
      id: 'b',
      title: 'Newer',
      street: '123 Main Street',
      updatedAt: '2026-08-07T10:00:00.000Z',
    })
    const c = place({
      id: 'c',
      street: '999 Other Ave',
      title: 'Unique',
    })
    const groups = findDuplicateAddressGroups([a, b, c])
    expect(groups).toHaveLength(1)
    expect(groups[0]!.places.map((p) => p.id)).toEqual(['b', 'a'])
    expect(suggestedKeepId(groups[0]!.places)).toBe('b')
  })
})

describe('buildPlaceDiffRows', () => {
  it('flags differing fields', () => {
    const a = place({ id: 'a', title: 'Alpha', monthlyEstimate: 2000 })
    const b = place({ id: 'b', title: 'Beta', monthlyEstimate: 2200 })
    const rows = buildPlaceDiffRows([a, b])
    const title = rows.find((r) => r.field === 'title')
    const rent = rows.find((r) => r.field === 'monthlyEstimate')
    const beds = rows.find((r) => r.field === 'bedrooms')
    expect(title?.differs).toBe(true)
    expect(rent?.differs).toBe(true)
    expect(beds?.differs).toBe(false)
  })
})
