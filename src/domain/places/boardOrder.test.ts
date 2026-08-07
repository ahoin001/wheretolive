import { describe, expect, it } from 'vitest'
import type { SavedPlace } from '../types'
import { movePlaceOnBoard, compareBoardOrder } from './boardOrder'

function place(
  partial: Partial<SavedPlace> & Pick<SavedPlace, 'id' | 'tier'>,
): SavedPlace {
  return {
    createdAt: '2026-08-01T12:00:00.000Z',
    updatedAt: '2026-08-01T12:00:00.000Z',
    title: partial.id,
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
    boardOrder: 0,
    status: 'none',
    favorite: false,
    images: [],
    tags: [],
    ...partial,
  }
}

describe('movePlaceOnBoard', () => {
  const board = [
    place({ id: 'a', tier: 'dream', boardOrder: 0 }),
    place({ id: 'b', tier: 'dream', boardOrder: 1 }),
    place({ id: 'c', tier: 'strong', boardOrder: 0 }),
  ]

  it('reorders within a tier', () => {
    const next = movePlaceOnBoard(board, 'a', 'b')
    expect(next).toEqual([
      { id: 'b', tier: 'dream', boardOrder: 0 },
      { id: 'a', tier: 'dream', boardOrder: 1 },
    ])
  })

  it('promotes into another tier before a target', () => {
    const next = movePlaceOnBoard(board, 'c', 'a')
    expect(next).toEqual([
      { id: 'c', tier: 'dream', boardOrder: 0 },
      { id: 'a', tier: 'dream', boardOrder: 1 },
      { id: 'b', tier: 'dream', boardOrder: 2 },
    ])
  })

  it('moves onto an empty tier drop target', () => {
    const next = movePlaceOnBoard(board, 'a', 'tier:pass')
    expect(next).toContainEqual({ id: 'a', tier: 'pass', boardOrder: 0 })
    expect(next).toContainEqual({ id: 'b', tier: 'dream', boardOrder: 0 })
  })
})

describe('compareBoardOrder', () => {
  it('sorts by boardOrder then createdAt', () => {
    const a = place({
      id: 'a',
      tier: 'maybe',
      boardOrder: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
    })
    const b = place({
      id: 'b',
      tier: 'maybe',
      boardOrder: 0,
      createdAt: '2026-02-01T00:00:00.000Z',
    })
    expect([a, b].sort(compareBoardOrder).map((p) => p.id)).toEqual([
      'b',
      'a',
    ])
  })
})
