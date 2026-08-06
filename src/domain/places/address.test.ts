import { describe, expect, it } from 'vitest'
import {
  formatPlaceAddress,
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
