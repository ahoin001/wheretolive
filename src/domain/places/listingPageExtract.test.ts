import { describe, expect, it } from 'vitest'
import {
  extractListingFromHtml,
  extractRealtorSlideImages,
  isBlockedListingHtml,
  upgradeRealtorImageUrl,
} from './listingPageExtract'
import realtorNextSlim from './fixtures/realtor-next-slim.json'

describe('upgradeRealtorImageUrl', () => {
  it('upgrades s.jpg thumbs to gallery webp', () => {
    expect(
      upgradeRealtorImageUrl(
        'https://ap.rdcpix.com/5fada078f2a845d37af6de1ed1527f43l-m3396764445s.jpg',
      ),
    ).toBe(
      'https://ap.rdcpix.com/5fada078f2a845d37af6de1ed1527f43l-m3396764445rd-w1280_h960.webp',
    )
  })

  it('upgrades od-w640 thumbs', () => {
    expect(
      upgradeRealtorImageUrl(
        'https://ap.rdcpix.com/abc123l-m4272763003od-w640_h480.jpg',
      ),
    ).toBe(
      'https://ap.rdcpix.com/abc123l-m4272763003rd-w1280_h960.webp',
    )
  })

  it('leaves gallery-sized urls alone', () => {
    const large =
      'https://ap.rdcpix.com/7b36f7160648c280de5ed24c4aee3ff3l-m4272763003rd-w1280_h960.webp'
    expect(upgradeRealtorImageUrl(large)).toBe(large)
  })
})

describe('extractRealtorSlideImages', () => {
  it('reads photo-slide-image srcs', () => {
    const html = `
      <img data-testid="photo-slide-image" alt=" featured at 12643 NW 32nd Ct"
        src="https://ap.rdcpix.com/7b36f7160648c280de5ed24c4aee3ff3l-m4272763003rd-w1280_h960.webp"
        fetchpriority="high">
      <img src="https://ap.rdcpix.com/otherl-m111s.jpg" data-testid="photo-slide-image" alt="2" />
    `
    const imgs = extractRealtorSlideImages(html)
    expect(imgs).toHaveLength(2)
    expect(imgs[0]).toContain('rd-w1280_h960.webp')
    expect(imgs[1]).toContain('m111')
  })
})

describe('extractListingFromHtml (Realtor fixture)', () => {
  it('reads rent, beds, pets, and gallery-sized photos', () => {
    const html = `<!doctype html><html><head>
      <meta property="og:title" content="20861 NW 3rd Ln Unit 20861, Pembroke Pines, FL 33029 | Realtor.com" />
      <script type="application/ld+json">${JSON.stringify({
        '@type': 'SingleFamilyResidence',
        description:
          'Active rental currently listed at $3000/mo. View 14 photos of this 3 bed, 2 bath, 1206 sqft. townhome',
        floorSize: { value: 1206, unitCode: 'FTK' },
        numberOfRooms: 3,
        address: {
          streetAddress: '20861 NW 3rd Ln Unit 20861',
          addressLocality: 'Pembroke Pines',
          addressRegion: 'FL',
          postalCode: '33029',
        },
        image:
          'https://ap.rdcpix.com/5fada078f2a845d37af6de1ed1527f43l-m3396764445od-w640_h480.jpg',
      })}</script>
      <script id="__NEXT_DATA__" type="application/json">${JSON.stringify(realtorNextSlim)}</script>
    </head><body>
      <img data-testid="photo-slide-image"
        src="https://ap.rdcpix.com/5fada078f2a845d37af6de1ed1527f43l-m3396764445rd-w1280_h960.webp"
        alt="featured" />
    </body></html>`

    const draft = extractListingFromHtml(
      html,
      'https://www.realtor.com/rentals/details/20861-NW-3rd-Ln_Pembroke-Pines_FL_33029_M51012-08008',
    )
    expect(draft).not.toBeNull()
    expect(draft!.fromPage).toBe(true)
    expect(draft!.listingKind).toBe('rent')
    expect(draft!.monthlyEstimate).toBe(3000)
    expect(draft!.bedrooms).toBe(3)
    expect(draft!.bathrooms).toBe(2)
    expect(draft!.sqft).toBe(1206)
    expect(draft!.homeType).toBe('townhome')
    expect(draft!.pets).toBe('yes')
    expect(draft!.city).toBe('Pembroke Pines')
    expect(draft!.images?.length).toBeGreaterThan(0)
    expect(
      draft!.images!.every((u) => u.includes('rd-w1280_h960.webp')),
    ).toBe(true)
    expect(draft!.images!.some((u) => /s\.jpe?g$/i.test(u))).toBe(false)
  })
})

describe('extractListingFromHtml (Zillow-shaped HTML)', () => {
  it('reads fields from __NEXT_DATA__ property blob', () => {
    const next = {
      props: {
        pageProps: {
          property: {
            zpid: 2109311881,
            price: 2700,
            bedrooms: 2,
            bathrooms: 2,
            livingArea: 1100,
            homeStatus: 'FOR_RENT',
            homeType: 'TOWNHOUSE',
            address: {
              streetAddress: '2900 Dorchester Ln #2900',
              city: 'Hollywood',
              state: 'FL',
              zipcode: '33026',
            },
            resoFacts: { hasPetsAllowed: true, petPolicy: 'Cats, Dogs OK' },
            responsivePhotos: [
              {
                url: 'https://photos.zillowstatic.com/fp/example1.jpg',
              },
              {
                url: 'https://photos.zillowstatic.com/fp/example2.jpg',
              },
            ],
          },
        },
      },
    }
    const html = `<!doctype html><html><head>
      <script id="__NEXT_DATA__" type="application/json">${JSON.stringify(next)}</script>
    </head><body>listing</body></html>`

    const draft = extractListingFromHtml(
      html,
      'https://www.zillow.com/homedetails/2900-Dorchester-Ln-2900-Hollywood-FL-33026/2109311881_zpid/',
    )
    expect(draft).not.toBeNull()
    expect(draft!.listingKind).toBe('rent')
    expect(draft!.monthlyEstimate).toBe(2700)
    expect(draft!.bedrooms).toBe(2)
    expect(draft!.city).toBe('Hollywood')
    expect(draft!.homeType).toBe('townhome')
    expect(draft!.images?.length).toBe(2)
  })

  it('detects PerimeterX block pages', () => {
    const html =
      '<!DOCTYPE html><html><head><meta name="description" content="px-captcha"><title>Access to this page has been denied</title></head><body></body></html>'
    expect(isBlockedListingHtml(html)).toBe(true)
    expect(
      extractListingFromHtml(
        html,
        'https://www.zillow.com/homedetails/x/1_zpid/',
      ),
    ).toBeNull()
  })
})
