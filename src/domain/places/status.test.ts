import { describe, expect, it } from 'vitest'
import {
  availablePlacesIn,
  isPlaceTaken,
  takenPlacesIn,
} from './status'
import type { SavedPlace } from '../types'

function stub(status: SavedPlace['status']): SavedPlace {
  return {
    id: crypto.randomUUID(),
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    title: 'Place',
    url: '',
    listingKind: 'rent',
    homeType: null,
    price: null,
    monthlyEstimate: null,
    street: '',
    city: '',
    state: '',
    zip: '',
    location: '',
    bedrooms: null,
    bathrooms: null,
    sqft: null,
    notes: '',
    pets: 'no',
    petsNote: '',
    proTags: [],
    concernTags: [],
    images: [],
    tags: [],
    tier: 'maybe',
    boardOrder: 0,
    status,
    favorite: false,
  }
}

describe('place status taken', () => {
  it('detects taken places', () => {
    expect(isPlaceTaken(stub('taken'))).toBe(true)
    expect(isPlaceTaken(stub('visited'))).toBe(false)
  })

  it('splits taken vs available', () => {
    const places = [stub('taken'), stub('none'), stub('offer')]
    expect(takenPlacesIn(places)).toHaveLength(1)
    expect(availablePlacesIn(places)).toHaveLength(2)
  })
})
