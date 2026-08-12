import { describe, expect, it } from 'vitest'
import {
  applyListingImport,
  looksLikeListingUrl,
  parseListingUrl,
  parseRealtorSlug,
  parseZillowSlug,
  splitZillowStreetAndCity,
} from './listingImport'

describe('parseRealtorSlug', () => {
  it('parses rental detail slug into address parts', () => {
    const parsed = parseRealtorSlug(
      '/rentals/details/20861-NW-3rd-Ln-Unit-20861_Pembroke-Pines_FL_33029_M51012-08008',
    )
    expect(parsed?.listingKind).toBe('rent')
    expect(parsed?.city).toBe('Pembroke Pines')
    expect(parsed?.state).toBe('FL')
    expect(parsed?.zip).toBe('33029')
    expect(parsed?.street?.toLowerCase()).toContain('20861')
    expect(parsed?.street?.toLowerCase()).toContain('3rd')
  })
})

describe('splitZillowStreetAndCity', () => {
  it('keeps unit numbers out of the city', () => {
    const { street, city } = splitZillowStreetAndCity([
      '2900',
      'Dorchester',
      'Ln',
      '2900',
      'Hollywood',
    ])
    expect(city).toBe('Hollywood')
    expect(street.toLowerCase()).toContain('dorchester')
    expect(street).toMatch(/2900/)
    expect(street.toLowerCase()).toContain('unit')
  })

  it('keeps multi-word cities after the street suffix', () => {
    const { street, city } = splitZillowStreetAndCity([
      '20861',
      'NW',
      '3rd',
      'Ln',
      'Pembroke',
      'Pines',
    ])
    expect(city).toBe('Pembroke Pines')
    expect(street.toLowerCase()).toContain('3rd')
    expect(street.toLowerCase()).not.toContain('pembroke')
  })
})

describe('parseZillowSlug', () => {
  it('parses unit-in-slug Hollywood rental URL', () => {
    const parsed = parseZillowSlug(
      '/homedetails/2900-Dorchester-Ln-2900-Hollywood-FL-33026/2109311881_zpid/',
    )
    expect(parsed?.city).toBe('Hollywood')
    expect(parsed?.state).toBe('FL')
    expect(parsed?.zip).toBe('33026')
    expect(parsed?.street?.toLowerCase()).toContain('dorchester')
    expect(parsed?.street).toMatch(/Unit 2900/i)
  })

  it('parses multi-word city without a unit', () => {
    const parsed = parseZillowSlug(
      '/homedetails/20861-NW-3rd-Ln-Pembroke-Pines-FL-33029/44102328_zpid/',
    )
    expect(parsed?.city).toBe('Pembroke Pines')
    expect(parsed?.zip).toBe('33029')
    expect(parsed?.street?.toLowerCase()).toContain('20861')
  })
})

describe('parseListingUrl', () => {
  it('fills a Realtor rentals URL', () => {
    const draft = parseListingUrl(
      'https://www.realtor.com/rentals/details/20861-NW-3rd-Ln_Pembroke-Pines_FL_33029_M51012-08008',
    )
    expect(draft).not.toBeNull()
    expect(draft!.source).toBe('realtor')
    expect(draft!.listingKind).toBe('rent')
    expect(draft!.city).toBe('Pembroke Pines')
    expect(draft!.zip).toBe('33029')
    expect(draft!.filled.length).toBeGreaterThan(2)
  })

  it('fills a Zillow homedetails URL like Realtor quality', () => {
    const draft = parseListingUrl(
      'https://www.zillow.com/homedetails/2900-Dorchester-Ln-2900-Hollywood-FL-33026/2109311881_zpid/',
    )
    expect(draft?.source).toBe('zillow')
    expect(draft?.city).toBe('Hollywood')
    expect(draft?.state).toBe('FL')
    expect(draft?.zip).toBe('33026')
    expect(draft?.street).toMatch(/Dorchester/i)
    expect(draft?.street).toMatch(/Unit 2900/i)
    expect(draft?.title).toMatch(/Hollywood/i)
    expect(draft?.filled).toEqual(
      expect.arrayContaining(['street', 'city', 'state', 'ZIP', 'title']),
    )
  })

  it('normalizes urls without protocol', () => {
    const draft = parseListingUrl(
      'www.realtor.com/rentals/details/1-Main-St_Miami_FL_33101_M1',
    )
    expect(draft?.url.startsWith('https://')).toBe(true)
  })

  it('returns null for non-urls', () => {
    expect(parseListingUrl('just some text')).toBeNull()
  })
})

describe('looksLikeListingUrl', () => {
  it('detects known hosts', () => {
    expect(
      looksLikeListingUrl('https://www.zillow.com/homedetails/foo/1_zpid/'),
    ).toBe(true)
    expect(looksLikeListingUrl('https://example.com/page')).toBe(false)
  })
})

describe('applyListingImport', () => {
  it('fills empty fields and applies listing kind from URL', () => {
    const form = {
      url: '',
      listingKind: 'buy' as const,
      homeType: null,
      title: 'Keep me',
      street: '',
      city: '',
      state: '',
      zip: '',
      monthlyEstimate: null,
      price: 400000,
      bedrooms: null,
      bathrooms: null,
      sqft: null,
      pets: 'no' as const,
      petsNote: '',
      images: [] as string[],
      notes: '',
    }
    const draft = parseListingUrl(
      'https://www.realtor.com/rentals/details/20861-NW-3rd-Ln_Pembroke-Pines_FL_33029_M51012-08008',
    )!
    const { next, applied } = applyListingImport(form, draft)
    expect(next.title).toBe('Keep me')
    expect(next.listingKind).toBe('rent')
    expect(next.price).toBeNull()
    expect(next.city).toBe('Pembroke Pines')
    expect(next.url).toContain('realtor.com')
    expect(applied).toContain('city')
    expect(applied).toContain('listing type')
    expect(applied).not.toContain('title')
  })
})
