import { describe, expect, it } from 'vitest'
import {
  normalizeSharedPlace,
  toSharedPlaceSnapshot,
} from './share'
import type { SavedPlace } from '../../domain/types'

function samplePlace(over: Partial<SavedPlace> = {}): SavedPlace {
  return {
    id: 'p1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    title: 'Sunny bungalow',
    url: 'https://example.com/listing',
    listingKind: 'rent',
    homeType: 'single_family',
    price: null,
    monthlyEstimate: 2400,
    street: '12 Oak St',
    city: 'Tampa',
    state: 'FL',
    zip: '33602',
    location: '12 Oak St, Tampa, FL 33602',
    bedrooms: 3,
    bathrooms: 2,
    sqft: 1400,
    notes: 'Private thoughts — must not leak',
    pets: 'yes',
    petsNote: 'Under 40 lbs',
    proTags: ['Yard'],
    concernTags: ['Traffic'],
    tier: 'dream',
    boardOrder: 0,
    status: 'visited',
    favorite: true,
    likedByMe: true,
    likedAt: '2026-01-02T00:00:00.000Z',
    likedByUserIds: ['u1'],
    likedBy: [{ userId: 'u1', displayName: 'You' }],
    images: ['https://example.com/a.jpg'],
    tags: ['hidden-tag'],
    ...over,
  }
}

describe('share snapshots', () => {
  it('strips private fields when building a guest snapshot', () => {
    const snap = toSharedPlaceSnapshot(samplePlace())
    expect(snap.title).toBe('Sunny bungalow')
    expect(snap.url).toBe('https://example.com/listing')
    expect(snap.images).toEqual(['https://example.com/a.jpg'])
    expect(snap).not.toHaveProperty('notes')
    expect(snap).not.toHaveProperty('favorite')
    expect(snap).not.toHaveProperty('likedBy')
    expect(snap).not.toHaveProperty('status')
    expect(snap).not.toHaveProperty('tags')
  })

  it('normalizes raw payload places from the API', () => {
    const snap = normalizeSharedPlace({
      id: 'x',
      title: 'Condo',
      listingKind: 'buy',
      price: 350000,
      pets: 'limited',
      tier: 'strong',
      images: ['https://example.com/b.jpg'],
      proTags: ['Patio'],
    })
    expect(snap?.listingKind).toBe('buy')
    expect(snap?.price).toBe(350000)
    expect(snap?.tier).toBe('strong')
    expect(snap?.proTags).toEqual(['Patio'])
  })
})
