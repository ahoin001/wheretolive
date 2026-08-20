/**
 * Extract place fields from listing HTML (Realtor / Zillow).
 * Pure string parsing — used by tests and mirrored in the import-listing edge function.
 */

import type { PlaceHomeType, PetsPolicy } from '../types'
import {
  formatPlaceAddress,
  sanitizeAddress,
  sanitizeState,
  titleCasePlaceName,
} from './address'
import {
  listingDraftFilledLabels,
  type ListingImportDraft,
  type ListingImportSource,
} from './listingImport'

const MAX_IMAGES = 12

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return null
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value
  }
  if (typeof value === 'string') {
    const n = Number(value.replace(/[^0-9.]/g, ''))
    if (Number.isFinite(n) && n > 0) return n
  }
  return null
}

function metaContent(html: string, property: string): string | null {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`,
    'i',
  )
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`,
    'i',
  )
  return re.exec(html)?.[1] ?? re2.exec(html)?.[1] ?? null
}

function extractJsonLdBlocks(html: string): unknown[] {
  const out: unknown[] = []
  const re =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    try {
      const parsed = JSON.parse(m[1]!.trim())
      if (Array.isArray(parsed)) out.push(...parsed)
      else out.push(parsed)
    } catch {
      /* ignore bad ld+json */
    }
  }
  return out
}

function extractNextData(html: string): unknown | null {
  const m =
    /<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i.exec(
      html,
    )
  if (!m?.[1]) return null
  try {
    return JSON.parse(m[1])
  } catch {
    return null
  }
}

function mapHomeType(raw: string | null | undefined): PlaceHomeType | null {
  if (!raw) return null
  const s = raw.toLowerCase()
  if (/town\s*-?\s*home|townhouse|villa/.test(s)) return 'townhome'
  if (/condo|condominium/.test(s)) return 'condo'
  if (/apartment|multi\s*-?\s*family|plex/.test(s)) return 'apartment'
  if (/single\s*-?\s*family|house|detached|residential/.test(s)) {
    return 'single_family'
  }
  return null
}

function mapPets(
  cats: boolean | null | undefined,
  dogs: boolean | null | undefined,
  text: string | null | undefined,
  tags: string[] = [],
): { pets?: PetsPolicy; petsNote?: string } {
  const note = (text ?? '').trim()
  const tagPets = tags.some((t) => /pets?_allowed|pet.?friendly/i.test(t))
  const tagNo = tags.some((t) => /no_pets|pets?_not/i.test(t))
  if (tagNo || /\bno pets\b/i.test(note)) {
    return { pets: 'no', petsNote: note || undefined }
  }
  if (cats === true || dogs === true || tagPets) {
    const both = cats === true && dogs === true
    const limited = (cats === true) !== (dogs === true)
    return {
      pets: limited ? 'limited' : both || tagPets ? 'yes' : 'yes',
      petsNote:
        note ||
        [cats ? 'cats' : null, dogs ? 'dogs' : null].filter(Boolean).join(', ') ||
        undefined,
    }
  }
  if (cats === false && dogs === false) {
    return { pets: 'no', petsNote: note || undefined }
  }
  if (note) return { petsNote: note }
  return {}
}

/** Gallery-sized Realtor CDN suffix (matches photo-slide-image srcs). */
const REALTOR_GALLERY_SUFFIX = 'rd-w1280_h960.webp'

/**
 * Upgrade Realtor CDN thumbs (…s.jpg / …od-w640_h480.jpg) to gallery size.
 * Example: …l-m4272763003s.jpg → …l-m4272763003rd-w1280_h960.webp
 */
export function upgradeRealtorImageUrl(url: string): string {
  const t = url.trim()
  if (!/ap\.rdcpix\.com/i.test(t)) return t
  if (new RegExp(`${REALTOR_GALLERY_SUFFIX.replace(/\./g, '\\.')}$`, 'i').test(t)) {
    return t
  }
  const upgraded = t.replace(
    /(https?:\/\/ap\.rdcpix\.com\/[^?\s#]+?-m\d+)(?:s|od-w\d+_h\d+|rd-w\d+_h\d+)?\.(jpe?g|png|webp)(\?[^#]*)?(#.*)?$/i,
    `$1${REALTOR_GALLERY_SUFFIX}$3$4`,
  )
  return upgraded
}

/** Prefer large carousel srcs from the listing DOM when present. */
export function extractRealtorSlideImages(html: string): string[] {
  const out: string[] = []
  const tagRe = /<img\b[^>]*\bdata-testid=["']photo-slide-image["'][^>]*>/gi
  let m: RegExpExecArray | null
  while ((m = tagRe.exec(html))) {
    const src = /\bsrc=["']([^"']+)["']/i.exec(m[0])?.[1]
    if (src) out.push(src)
  }
  return out
}

function realtorPhotoKey(url: string): string {
  const m = /-m(\d+)/i.exec(url)
  return m?.[1] ? `m${m[1]}` : url
}

function uniqUrls(urls: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const u of urls) {
    const t = u.trim()
    if (!t || !/^https?:\/\//i.test(t)) continue
    if (seen.has(t)) continue
    seen.add(t)
    out.push(t)
    if (out.length >= MAX_IMAGES) break
  }
  return out
}

/** Dedupe by Realtor photo id (-m123); keep first (prefer upgraded / slide). */
function uniqRealtorImages(urls: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of urls) {
    const t = upgradeRealtorImageUrl(raw)
    if (!t || !/^https?:\/\//i.test(t)) continue
    const key = realtorPhotoKey(t)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(t)
    if (out.length >= MAX_IMAGES) break
  }
  return out
}

function collectDeepImages(value: unknown, into: string[], depth = 0): void {
  if (into.length >= MAX_IMAGES || depth > 8) return
  if (typeof value === 'string') {
    if (
      /^https?:\/\//i.test(value) &&
      /\.(jpe?g|png|webp)(\?|$)/i.test(value)
    ) {
      into.push(value)
    }
    return
  }
  if (Array.isArray(value)) {
    for (const item of value) collectDeepImages(item, into, depth + 1)
    return
  }
  const rec = asRecord(value)
  if (!rec) return
  for (const key of ['href', 'url', 'src', 'mixedSources', 'urlHighRes']) {
    if (key in rec) collectDeepImages(rec[key], into, depth + 1)
  }
  if ('photos' in rec) collectDeepImages(rec.photos, into, depth + 1)
  if ('image' in rec) collectDeepImages(rec.image, into, depth + 1)
}

function fromJsonLd(
  blocks: unknown[],
  source: ListingImportSource,
  url: string,
): Partial<ListingImportDraft> {
  const types = new Set([
    'SingleFamilyResidence',
    'Apartment',
    'House',
    'Residence',
    'ApartmentComplex',
    'Product',
    'RealEstateListing',
    'Offer',
  ])
  let best: Record<string, unknown> | null = null
  for (const block of blocks) {
    const rec = asRecord(block)
    if (!rec) continue
    const t = String(rec['@type'] ?? '')
    if (types.has(t)) {
      best = rec
      if (t === 'SingleFamilyResidence' || t === 'Apartment') break
    }
  }
  if (!best) return {}

  const addr = asRecord(best.address)
  const floor = asRecord(best.floorSize)
  const offer = asRecord(best.offers) ?? best
  const price =
    asNumber(offer.price) ??
    asNumber(best.price) ??
    asNumber(asRecord(best.offers)?.price)

  const desc = String(best.description ?? '')
  const rentHint = /\/\s*mo|per month|for rent|rental/i.test(desc)
  const bedsFromDesc = /(\d+)\s*(?:bed|bd|beds)\b/i.exec(desc)
  const bathsFromDesc = /(\d+(?:\.\d+)?)\s*(?:bath|ba|baths)\b/i.exec(desc)
  const sqftFromDesc = /([\d,]+)\s*sq\s*\.?\s*ft/i.exec(desc)

  const street = addr ? String(addr.streetAddress ?? '') : ''
  const city = addr ? String(addr.addressLocality ?? '') : ''
  const state = addr ? sanitizeState(String(addr.addressRegion ?? '')) : ''
  const zip = addr ? String(addr.postalCode ?? '').slice(0, 10) : ''
  const sanitized = sanitizeAddress({ street, city, state, zip })

  const images: string[] = []
  collectDeepImages(best.image, images)
  collectDeepImages(best.photo, images)
  const thumb = metaImageFromLd(best)
  if (thumb) images.unshift(thumb)

  const homeType =
    mapHomeType(String(best['@type'] ?? '')) ||
    mapHomeType(desc) ||
    mapHomeType(String(best.name ?? ''))

  return {
    url,
    source,
    listingKind: rentHint ? 'rent' : undefined,
    homeType: homeType ?? undefined,
    title: formatPlaceAddress(sanitized) || undefined,
    street: sanitized.street || undefined,
    city: sanitized.city || undefined,
    state: sanitized.state || undefined,
    zip: sanitized.zip || undefined,
    monthlyEstimate: rentHint ? price : undefined,
    price: rentHint ? undefined : price ?? undefined,
    bedrooms:
      asNumber(best.numberOfRooms) ??
      (bedsFromDesc ? Number(bedsFromDesc[1]) : null) ??
      undefined,
    bathrooms: bathsFromDesc ? Number(bathsFromDesc[1]) : undefined,
    sqft:
      asNumber(floor?.value) ??
      (sqftFromDesc
        ? Number(sqftFromDesc[1]!.replace(/,/g, ''))
        : null) ??
      undefined,
    images: uniqUrls(images),
  }
}

function metaImageFromLd(rec: Record<string, unknown>): string | null {
  if (typeof rec.image === 'string') return rec.image
  const img = asRecord(rec.image)
  if (img && typeof img.url === 'string') return img.url
  return null
}

function fromRealtorNext(
  next: unknown,
  url: string,
): Partial<ListingImportDraft> {
  const root = asRecord(next)
  const pp = asRecord(asRecord(root?.props)?.pageProps)
  const redux = asRecord(pp?.initialReduxState)
  const pd = asRecord(redux?.propertyDetails)
  if (!pd) return {}

  const desc = asRecord(pd.description) ?? {}
  const loc = asRecord(pd.location)
  const address = asRecord(loc?.address) ?? loc
  const listPrice = asNumber(pd.list_price)
  const status = String(pd.status ?? '').toLowerCase()
  const isRent =
    status.includes('rent') ||
    Boolean(pd.pet_policy) ||
    url.includes('/rentals/')

  const street = String(
    address?.line ?? address?.streetAddress ?? '',
  )
  const city = String(address?.city ?? address?.addressLocality ?? '')
  const state = sanitizeState(
    String(address?.state_code ?? address?.state ?? ''),
  )
  const zip = String(address?.postal_code ?? address?.postalCode ?? '')
  const sanitized = sanitizeAddress({ street, city, state, zip })

  const pet = asRecord(pd.pet_policy)
  const tags = Array.isArray(pd.tags) ? pd.tags.map(String) : []
  const petsMapped = mapPets(
    typeof pet?.cats === 'boolean' ? pet.cats : null,
    typeof pet?.dogs === 'boolean' ? pet.dogs : null,
    typeof pet?.text === 'string' ? pet.text : null,
    tags,
  )

  const images: string[] = []
  collectDeepImages(pd.photos, images)

  const homeType =
    mapHomeType(String(desc.type ?? '')) ||
    mapHomeType(String(desc.sub_type ?? '')) ||
    mapHomeType(String(desc.text ?? ''))

  const notes =
    typeof desc.text === 'string' && desc.text.trim()
      ? desc.text.trim().slice(0, 1200)
      : undefined

  return {
    url,
    source: 'realtor',
    listingKind: isRent ? 'rent' : 'buy',
    homeType: homeType ?? undefined,
    title: formatPlaceAddress(sanitized) || undefined,
    street: sanitized.street || undefined,
    city: sanitized.city || undefined,
    state: sanitized.state || undefined,
    zip: sanitized.zip || undefined,
    monthlyEstimate: isRent ? listPrice : undefined,
    price: isRent ? undefined : listPrice ?? undefined,
    bedrooms: asNumber(desc.beds) ?? undefined,
    bathrooms:
      asNumber(desc.baths) ??
      asNumber(desc.baths_consolidated) ??
      undefined,
    sqft: asNumber(desc.sqft) ?? undefined,
    ...petsMapped,
    images: uniqRealtorImages(images),
    notes,
  }
}

/** Walk Zillow __NEXT_DATA__ / embedded JSON for property fields. */
function fromZillowNext(
  next: unknown,
  url: string,
): Partial<ListingImportDraft> {
  const root = asRecord(next)
  const pp = asRecord(asRecord(root?.props)?.pageProps)
  const candidates: Record<string, unknown>[] = []

  const push = (v: unknown) => {
    const r = asRecord(v)
    if (r) candidates.push(r)
  }

  push(pp?.property)
  push(pp?.gdpClientCache)
  push(asRecord(pp?.componentProps)?.gdpClientCache)

  // gdpClientCache is often a map of query → { property: ... }
  for (const c of [...candidates]) {
    for (const v of Object.values(c)) {
      const rec = asRecord(v)
      if (rec?.property) push(rec.property)
      if (rec?.beds != null || rec?.bathrooms != null || rec?.price != null) {
        push(rec)
      }
    }
  }

  let best: Record<string, unknown> | null = null
  for (const c of candidates) {
    if (
      c.bedrooms != null ||
      c.beds != null ||
      c.price != null ||
      c.livingArea != null ||
      asRecord(c.address)
    ) {
      best = c
      break
    }
  }
  if (!best) {
    // Deep search for hdpType / zpid blobs
    const found = findZillowPropertyBlob(next)
    if (found) best = found
  }
  if (!best) return {}

  const addr = asRecord(best.address) ?? {}
  const street = String(
    addr.streetAddress ?? best.streetAddress ?? '',
  )
  const city = String(addr.city ?? best.city ?? '')
  const state = sanitizeState(String(addr.state ?? best.state ?? ''))
  const zip = String(addr.zipcode ?? addr.postalCode ?? best.zipcode ?? '')
  const sanitized = sanitizeAddress({ street, city, state, zip })

  const price =
    asNumber(best.price) ??
    asNumber(asRecord(best.price)?.value) ??
    asNumber(best.listPrice)

  const homeStatus = String(
    best.homeStatus ?? best.listingStatus ?? best.statusType ?? '',
  ).toUpperCase()
  const isRent =
    /RENT|FOR_RENT/.test(homeStatus) ||
    url.includes('/apartments/') ||
    Boolean(best.monthlyHoaFee && !best.price)

  const images: string[] = []
  collectDeepImages(best.responsivePhotos, images)
  collectDeepImages(best.hugePhotos, images)
  collectDeepImages(best.media, images)
  collectDeepImages(best.photos, images)

  const reso = asRecord(best.resoFacts)
  const petsText = [
    reso?.hasPetsAllowed,
    reso?.petPolicy,
    best.petsPolicy,
  ]
    .filter(Boolean)
    .map(String)
    .join(' ')
  const petsMapped = mapPets(
    /cats?\s*(ok|allowed|yes)/i.test(petsText) || null,
    /dogs?\s*(ok|allowed|yes)/i.test(petsText) || null,
    petsText || null,
  )

  const homeType =
    mapHomeType(String(best.homeType ?? '')) ||
    mapHomeType(String(reso?.homeType ?? '')) ||
    mapHomeType(String(best.propertyTypeDimension ?? ''))

  return {
    url,
    source: 'zillow',
    listingKind: isRent ? 'rent' : price ? 'buy' : undefined,
    homeType: homeType ?? undefined,
    title: formatPlaceAddress(sanitized) || undefined,
    street: sanitized.street || undefined,
    city: sanitized.city || undefined,
    state: sanitized.state || undefined,
    zip: sanitized.zip || undefined,
    monthlyEstimate: isRent ? price : undefined,
    price: isRent ? undefined : price ?? undefined,
    bedrooms: asNumber(best.bedrooms ?? best.beds) ?? undefined,
    bathrooms: asNumber(best.bathrooms ?? best.baths) ?? undefined,
    sqft: asNumber(best.livingArea ?? best.livingAreaValue) ?? undefined,
    ...petsMapped,
    images: uniqUrls(images),
  }
}

function findZillowPropertyBlob(
  value: unknown,
  depth = 0,
): Record<string, unknown> | null {
  if (depth > 10 || value == null) return null
  const rec = asRecord(value)
  if (rec) {
    if (
      (rec.zpid != null || rec.livingArea != null) &&
      (rec.bedrooms != null || rec.beds != null) &&
      (rec.address != null || rec.streetAddress != null)
    ) {
      return rec
    }
    for (const v of Object.values(rec)) {
      const found = findZillowPropertyBlob(v, depth + 1)
      if (found) return found
    }
  } else if (Array.isArray(value)) {
    for (const item of value) {
      const found = findZillowPropertyBlob(item, depth + 1)
      if (found) return found
    }
  }
  return null
}

function fromMetaAndRegex(
  html: string,
  source: ListingImportSource,
  url: string,
): Partial<ListingImportDraft> {
  const ogTitle = metaContent(html, 'og:title')
  const ogImage = metaContent(html, 'og:image')
  const desc =
    metaContent(html, 'og:description') ||
    metaContent(html, 'description') ||
    ''

  const rentMo = /\$([\d,]+)\s*\/\s*mo/i.exec(desc || html)
  const pricePlain = /\$([\d,]+)/.exec(ogTitle || desc)
  const beds = /(\d+)\s*(?:bed|bd|beds)\b/i.exec(desc || html)
  const baths = /(\d+(?:\.\d+)?)\s*(?:bath|ba|baths)\b/i.exec(desc || html)
  const sqft = /([\d,]+)\s*sq\s*\.?\s*ft/i.exec(desc || html)
  const isRent =
    Boolean(rentMo) ||
    /for rent|rental|\/mo/i.test(desc) ||
    url.includes('/rentals/')

  const images = uniqUrls(ogImage ? [ogImage] : [])

  // Title often: "20861 NW 3rd Ln Unit 20861, Pembroke Pines, FL 33029 | …"
  let street: string | undefined
  let city: string | undefined
  let state: string | undefined
  let zip: string | undefined
  if (ogTitle) {
    const core = ogTitle.split('|')[0]?.trim() ?? ''
    const m =
      /^(.+?),\s*([^,]+),\s*([A-Z]{2})\s+(\d{5})(?:-\d{4})?/i.exec(core)
    if (m) {
      street = titleCasePlaceName(m[1]!)
      city = titleCasePlaceName(m[2]!)
      state = sanitizeState(m[3]!)
      zip = m[4]!
    }
  }

  const priceNum = rentMo
    ? Number(rentMo[1]!.replace(/,/g, ''))
    : pricePlain
      ? Number(pricePlain[1]!.replace(/,/g, ''))
      : null

  return {
    url,
    source,
    listingKind: isRent ? 'rent' : priceNum ? 'buy' : undefined,
    homeType: mapHomeType(desc) ?? undefined,
    title: street
      ? formatPlaceAddress(
          sanitizeAddress({
            street: street ?? '',
            city: city ?? '',
            state: state ?? '',
            zip: zip ?? '',
          }),
        )
      : undefined,
    street,
    city,
    state,
    zip,
    monthlyEstimate: isRent ? priceNum : undefined,
    price: isRent ? undefined : priceNum ?? undefined,
    bedrooms: beds ? Number(beds[1]) : undefined,
    bathrooms: baths ? Number(baths[1]) : undefined,
    sqft: sqft ? Number(sqft[1]!.replace(/,/g, '')) : undefined,
    images,
  }
}

function mergePartials(
  ...parts: Partial<ListingImportDraft>[]
): Partial<ListingImportDraft> {
  const out: Partial<ListingImportDraft> = {}
  for (const p of parts) {
    for (const [k, v] of Object.entries(p)) {
      if (v === undefined || v === null || v === '') continue
      if (k === 'images') {
        const prev = (out.images as string[] | undefined) ?? []
        out.images = uniqUrls([...prev, ...(v as string[])])
        continue
      }
      if (out[k as keyof ListingImportDraft] == null) {
        ;(out as Record<string, unknown>)[k] = v
      }
    }
  }
  return out
}

export function isBlockedListingHtml(html: string): boolean {
  const head = html.slice(0, 4000).toLowerCase()
  return (
    head.includes('px-captcha') ||
    head.includes('access to this page has been denied') ||
    head.includes('cf-challenge') ||
    head.includes('just a moment') ||
    (html.length < 8000 && head.includes('captcha'))
  )
}

export function detectListingSource(url: string): ListingImportSource {
  try {
    const host = new URL(url).hostname.replace(/^www\./i, '').toLowerCase()
    if (host.includes('realtor.com')) return 'realtor'
    if (host.includes('zillow.com') || host.includes('trulia.com')) {
      return 'zillow'
    }
    if (host.includes('redfin.com')) return 'redfin'
    if (host.includes('apartments.com')) return 'apartments'
  } catch {
    /* ignore */
  }
  return 'generic'
}

/**
 * Build a listing draft from raw HTML.
 * Returns null when the page looks blocked or has nothing useful.
 */
export function extractListingFromHtml(
  html: string,
  url: string,
): ListingImportDraft | null {
  if (!html || isBlockedListingHtml(html)) return null

  const source = detectListingSource(url)
  const ld = extractJsonLdBlocks(html)
  const next = extractNextData(html)

  const parts: Partial<ListingImportDraft>[] = []
  if (source === 'realtor' && next) {
    parts.push(fromRealtorNext(next, url))
  }
  if (source === 'zillow' && next) {
    parts.push(fromZillowNext(next, url))
  }
  if (ld.length) parts.push(fromJsonLd(ld, source, url))
  parts.push(fromMetaAndRegex(html, source, url))

  const merged = mergePartials(...parts)

  if (source === 'realtor') {
    const slideImgs = extractRealtorSlideImages(html)
    merged.images = uniqRealtorImages([
      ...slideImgs,
      ...(merged.images ?? []),
    ])
  }

  const hasSignal =
    merged.street ||
    merged.city ||
    merged.monthlyEstimate != null ||
    merged.price != null ||
    merged.bedrooms != null ||
    (merged.images && merged.images.length > 0)

  if (!hasSignal) return null

  const draft: ListingImportDraft = {
    url,
    source,
    fromPage: true,
    listingKind: merged.listingKind,
    homeType: merged.homeType,
    title: merged.title,
    street: merged.street,
    city: merged.city,
    state: merged.state,
    zip: merged.zip,
    monthlyEstimate: merged.monthlyEstimate,
    price: merged.price,
    bedrooms: merged.bedrooms,
    bathrooms: merged.bathrooms,
    sqft: merged.sqft,
    pets: merged.pets,
    petsNote: merged.petsNote,
    images: merged.images,
    notes: merged.notes,
    filled: [],
  }
  draft.filled = listingDraftFilledLabels(draft)
  return draft
}
