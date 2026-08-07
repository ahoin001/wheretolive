import { describe, expect, it } from 'vitest'
import {
  addressesMatch,
  duplicatePlaceIds,
  findDuplicatePlace,
  formatPlaceAddress,
  normalizeStreetForMatch,
  parseLocationString,
  sanitizeCity,
  sanitizeState,
  sanitizeZip,
} from './address'

describe('parseLocationString', () => {
  it('parses full US street addresses into city/state/zip', () => {
    expect(
      parseLocationString(
        '10398 Orange Ct Unit 10398, Pembroke Pines, FL 33026',
      ),
    ).toEqual({
      street: '10398 Orange Ct Unit 10398',
      city: 'Pembroke Pines',
      state: 'FL',
      zip: '33026',
    })
  })

  it('parses city + state + zip without street', () => {
    expect(parseLocationString('Tamarac, FL 33321')).toEqual({
      street: '',
      city: 'Tamarac',
      state: 'FL',
      zip: '33321',
    })
  })

  it('does not treat the street as the city', () => {
    const parsed = parseLocationString(
      '1581 NW 98th Way Unit 1581, Pembroke Pines, FL 33024',
    )
    expect(parsed.city).toBe('Pembroke Pines')
    expect(parsed.street).toContain('1581')
  })

  it('handles city-only text', () => {
    expect(parseLocationString('miramar')).toEqual({
      street: '',
      city: 'Miramar',
      state: '',
      zip: '',
    })
  })
})

describe('sanitize helpers', () => {
  it('title-cases cities and strips trailing state', () => {
    expect(sanitizeCity('pembroke  pines FL')).toBe('Pembroke Pines')
  })

  it('normalizes state and zip', () => {
    expect(sanitizeState('fl')).toBe('FL')
    expect(sanitizeState('Florida')).toBe('FL')
    expect(sanitizeZip('33026-1234')).toBe('33026-1234')
    expect(sanitizeZip('330261234')).toBe('33026-1234')
  })

  it('formats display location', () => {
    expect(
      formatPlaceAddress({
        street: '1 Main St',
        city: 'Miramar',
        state: 'fl',
        zip: '33029',
      }),
    ).toBe('1 Main St, Miramar, FL 33029')
  })
})

describe('addressesMatch', () => {
  it('matches same street + zip despite unit wording', () => {
    expect(
      addressesMatch(
        {
          street: '10398 Orange Ct Unit 10398',
          city: 'Pembroke Pines',
          state: 'FL',
          zip: '33026',
        },
        {
          street: '10398 Orange Ct #10398',
          city: 'Pembroke Pines',
          state: 'FL',
          zip: '33026-1234',
        },
      ),
    ).toBe(true)
  })

  it('matches via legacy location strings', () => {
    expect(
      addressesMatch(
        { location: '1 Main St, Miramar, FL 33029' },
        {
          street: '1 Main St',
          city: 'Miramar',
          state: 'FL',
          zip: '33029',
        },
      ),
    ).toBe(true)
  })

  it('rejects different zips on the same street', () => {
    expect(
      addressesMatch(
        { street: '1 Main St', city: 'Miramar', state: 'FL', zip: '33029' },
        { street: '1 Main St', city: 'Miramar', state: 'FL', zip: '33025' },
      ),
    ).toBe(false)
  })

  it('rejects different cities when zip is missing', () => {
    expect(
      addressesMatch(
        { street: '1 Main St', city: 'Miramar', state: 'FL', zip: '' },
        { street: '1 Main St', city: 'Davie', state: 'FL', zip: '' },
      ),
    ).toBe(false)
  })

  it('does not match empty streets', () => {
    expect(
      addressesMatch(
        { street: '', city: 'Miramar', state: 'FL', zip: '33029' },
        { street: '', city: 'Miramar', state: 'FL', zip: '33029' },
      ),
    ).toBe(false)
  })

  it('normalizes unit prefixes on streets', () => {
    expect(normalizeStreetForMatch('12 Oak Apt. 3')).toBe('12 oak #3')
    expect(normalizeStreetForMatch('12 Oak Unit 3')).toBe('12 oak #3')
  })

  it('finds duplicates and collects source ids', () => {
    const list = [
      {
        id: 'a',
        street: '9 Palm Dr',
        city: 'Weston',
        state: 'FL',
        zip: '33326',
      },
      {
        id: 'b',
        street: 'Other',
        city: 'Weston',
        state: 'FL',
        zip: '33326',
      },
    ]
    expect(
      findDuplicatePlace(list, {
        street: '9 Palm Dr',
        city: 'Weston',
        state: 'FL',
        zip: '33326',
      })?.id,
    ).toBe('a')
    expect(
      duplicatePlaceIds(
        [
          {
            id: 'src1',
            street: '9 Palm Dr',
            city: 'Weston',
            state: 'FL',
            zip: '33326',
          },
          {
            id: 'src2',
            street: '99 New',
            city: 'Weston',
            state: 'FL',
            zip: '33326',
          },
        ],
        list,
      ),
    ).toEqual(new Set(['src1']))
  })
})
