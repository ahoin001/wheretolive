/** Listing URL → place draft (slug parse + optional live page enrich). */

import type {
  PlaceHomeType,
  PlaceListingKind,
  PetsPolicy,
} from '../types'
import {
  formatPlaceAddress,
  sanitizeAddress,
  sanitizeState,
  titleCasePlaceName,
} from './address'

export type ListingImportSource =
  | 'realtor'
  | 'zillow'
  | 'redfin'
  | 'apartments'
  | 'generic'

export type ListingImportDraft = {
  url: string
  source: ListingImportSource
  listingKind?: PlaceListingKind
  homeType?: PlaceHomeType | null
  title?: string
  street?: string
  city?: string
  state?: string
  zip?: string
  monthlyEstimate?: number | null
  price?: number | null
  bedrooms?: number | null
  bathrooms?: number | null
  sqft?: number | null
  pets?: PetsPolicy
  petsNote?: string
  images?: string[]
  notes?: string
  /** Human labels for fields that were inferred */
  filled: string[]
  /** True when values came from fetched page HTML, not only the URL slug */
  fromPage?: boolean
}

export type ListingImportableFields = {
  url: string
  listingKind: PlaceListingKind
  homeType: PlaceHomeType | null
  title: string
  street: string
  city: string
  state: string
  zip: string
  monthlyEstimate: number | null
  price: number | null
  bedrooms: number | null
  bathrooms: number | null
  sqft: number | null
  pets: PetsPolicy
  petsNote: string
  images: string[]
  notes: string
}

const LISTING_HOST_HINT =
  /(realtor\.com|zillow\.com|redfin\.com|apartments\.com|trulia\.com|homes\.com|hotpads\.com)/i

export function looksLikeListingUrl(raw: string): boolean {
  const url = normalizeListingUrl(raw)
  if (!url) return false
  try {
    const host = new URL(url).hostname
    return LISTING_HOST_HINT.test(host)
  } catch {
    return false
  }
}

/** Trim and ensure https:// when a bare listing host was pasted. */
export function normalizeListingUrl(raw: string): string | null {
  let s = raw.trim()
  if (!s) return null
  if (!/^https?:\/\//i.test(s)) {
    if (/^(www\.)?(realtor|zillow|redfin|apartments)\./i.test(s)) {
      s = `https://${s}`
    } else {
      return null
    }
  }
  try {
    const u = new URL(s)
    if (!u.hostname.includes('.')) return null
    // Drop tracking query noise; keep path.
    u.hash = ''
    return u.toString()
  } catch {
    return null
  }
}

function dashToSpace(value: string): string {
  return value.replace(/-/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Light street casing from URL slugs (keeps NW / Ln looking right). */
function formatStreetFromSlug(value: string): string {
  const spaced = dashToSpace(value)
  if (!spaced) return ''
  const abbr: Record<string, string> = {
    nw: 'NW',
    ne: 'NE',
    sw: 'SW',
    se: 'SE',
    n: 'N',
    s: 'S',
    e: 'E',
    w: 'W',
    ln: 'Ln',
    st: 'St',
    ave: 'Ave',
    rd: 'Rd',
    dr: 'Dr',
    ct: 'Ct',
    blvd: 'Blvd',
    pkwy: 'Pkwy',
    hwy: 'Hwy',
    ter: 'Ter',
    cir: 'Cir',
    pl: 'Pl',
    unit: 'Unit',
    apt: 'Apt',
  }
  return spaced
    .split(' ')
    .map((word) => {
      const lower = word.toLowerCase()
      if (abbr[lower]) return abbr[lower]!
      if (/^\d/.test(word)) return word
      return titleCasePlaceName(word)
    })
    .join(' ')
}

function stripListingIdTail(slug: string): string {
  // Realtor: …_M51012-08008 or …_M12345
  return slug.replace(/_M[\w-]+$/i, '')
}

/**
 * Realtor detail slugs:
 * 20861-NW-3rd-Ln-Unit-20861_Pembroke-Pines_FL_33029_M51012-08008
 */
export function parseRealtorSlug(pathname: string): Partial<ListingImportDraft> | null {
  const rent = /\/rentals\/details\/([^/?#]+)/i.exec(pathname)
  const buy = /\/realestateandhomes-detail\/([^/?#]+)/i.exec(pathname)
  const match = rent ?? buy
  if (!match?.[1]) return null

  const listingKind: PlaceListingKind = rent ? 'rent' : 'buy'
  const raw = decodeURIComponent(match[1])
  const core = stripListingIdTail(raw)
  const parts = core.split('_').filter(Boolean)
  if (parts.length < 3) {
    return {
      listingKind,
      title: titleCasePlaceName(dashToSpace(core)),
    }
  }

  const zip = parts[parts.length - 1] ?? ''
  const state = sanitizeState(parts[parts.length - 2] ?? '')
  const city = titleCasePlaceName(dashToSpace(parts[parts.length - 3] ?? ''))
  const street = formatStreetFromSlug(parts.slice(0, -3).join(' '))
  const addr = sanitizeAddress({ street, city, state, zip })
  const title = formatPlaceAddress(addr) || street || city

  return {
    listingKind,
    title,
    street: addr.street,
    city: addr.city,
    state: addr.state,
    zip: addr.zip,
  }
}

const STREET_SUFFIXES = new Set([
  'st',
  'street',
  'ave',
  'avenue',
  'rd',
  'road',
  'ln',
  'lane',
  'dr',
  'drive',
  'ct',
  'court',
  'way',
  'blvd',
  'cir',
  'circle',
  'pl',
  'place',
  'ter',
  'terrace',
  'pkwy',
  'hwy',
  'trail',
  'trl',
  'loop',
  'pass',
  'run',
  'crossing',
  'xing',
])

const UNIT_MARKERS = new Set(['unit', 'apt', 'apartment', 'ste', 'suite', 'no', '#'])

/**
 * Split Zillow slug tokens (after peeling STATE-ZIP) into street (+ unit) and city.
 * Handles unit numbers jammed before the city: 2900-Dorchester-Ln-2900-Hollywood
 */
export function splitZillowStreetAndCity(tokens: string[]): {
  street: string
  city: string
} {
  if (tokens.length === 0) return { street: '', city: '' }
  if (tokens.length === 1) {
    return { street: formatStreetFromSlug(tokens[0]!), city: '' }
  }

  // Find the last street suffix that still leaves ≥1 token for the city.
  let suffixIdx = -1
  for (let i = tokens.length - 2; i >= 0; i--) {
    if (STREET_SUFFIXES.has((tokens[i] ?? '').toLowerCase())) {
      suffixIdx = i
      break
    }
  }

  let streetTokens: string[]
  let rest: string[]

  if (suffixIdx >= 0) {
    streetTokens = tokens.slice(0, suffixIdx + 1)
    rest = tokens.slice(suffixIdx + 1)
  } else {
    // No suffix — assume last 1–2 tokens are city (multi-word cities).
    const cityCount =
      tokens.length >= 4 ? 2 : tokens.length >= 3 ? 1 : 1
    streetTokens = tokens.slice(0, -cityCount)
    rest = tokens.slice(-cityCount)
  }

  // Optional unit after the street suffix: "2900", "Unit-4", "Apt-12B"
  if (rest.length >= 2) {
    const first = (rest[0] ?? '').toLowerCase()
    if (/^\d+[a-z]?$/i.test(rest[0] ?? '')) {
      streetTokens = [...streetTokens, 'Unit', rest[0]!]
      rest = rest.slice(1)
    } else if (UNIT_MARKERS.has(first) && rest[1]) {
      streetTokens = [...streetTokens, rest[0]!, rest[1]!]
      rest = rest.slice(2)
    }
  }

  return {
    street: formatStreetFromSlug(streetTokens.join(' ')),
    city: titleCasePlaceName(rest.join(' ')),
  }
}

/**
 * Zillow home details:
 * /homedetails/2900-Dorchester-Ln-2900-Hollywood-FL-33026/2109311881_zpid/
 * /homedetails/20861-NW-3rd-Ln-Pembroke-Pines-FL-33029/44102328_zpid/
 */
export function parseZillowSlug(pathname: string): Partial<ListingImportDraft> | null {
  const apartments = /\/apartments\//i.test(pathname)
  const m =
    /\/homedetails\/([^/]+?)(?:\/|$)/i.exec(pathname) ??
    /\/b\/([^/]+?)(?:\/|$)/i.exec(pathname)
  if (!m?.[1] && !apartments) return null

  const listingKind: PlaceListingKind | undefined = apartments
    ? 'rent'
    : undefined

  if (!m?.[1]) {
    return listingKind ? { listingKind } : null
  }

  const slug = decodeURIComponent(m[1])
  // Prefer …-FL-33029 at the end
  const tail = /^(.*)-([A-Z]{2})-(\d{5})(?:-\d{4})?$/i.exec(slug)
  if (!tail) {
    return {
      listingKind,
      title: titleCasePlaceName(dashToSpace(slug)),
    }
  }
  const before = tail[1] ?? ''
  const state = sanitizeState(tail[2] ?? '')
  const zip = tail[3] ?? ''
  const tokens = before.split('-').filter(Boolean)
  const { street, city } = splitZillowStreetAndCity(tokens)
  const addr = sanitizeAddress({ street, city, state, zip })
  return {
    listingKind,
    title: formatPlaceAddress(addr) || street || city,
    street: addr.street,
    city: addr.city,
    state: addr.state,
    zip: addr.zip,
  }
}

/** Redfin: /FL/Pembroke-Pines/20861-NW-3rd-Ln-33029/home/123 */
export function parseRedfinSlug(pathname: string): Partial<ListingImportDraft> | null {
  const m =
    /\/([A-Z]{2})\/([^/]+)\/([^/]+?)(?:-\d{5})?(?:\/home\/|$)/i.exec(pathname)
  if (!m) return null
  const state = sanitizeState(m[1] ?? '')
  const city = titleCasePlaceName(dashToSpace(m[2] ?? ''))
  const streetPart = m[3] ?? ''
  const zipMatch = /-(\d{5})$/.exec(streetPart)
  const zip = zipMatch?.[1] ?? ''
  const street = formatStreetFromSlug(streetPart.replace(/-\d{5}$/, ''))
  const addr = sanitizeAddress({ street, city, state, zip })
  return {
    title: formatPlaceAddress(addr) || street,
    street: addr.street,
    city: addr.city,
    state: addr.state,
    zip: addr.zip,
  }
}

/**
 * Parse a listing URL into a place draft.
 * Returns null when the string is not a usable URL.
 */
export function parseListingUrl(raw: string): ListingImportDraft | null {
  const url = normalizeListingUrl(raw)
  if (!url) return null

  let host = ''
  let pathname = ''
  try {
    const u = new URL(url)
    host = u.hostname.replace(/^www\./i, '').toLowerCase()
    pathname = u.pathname
  } catch {
    return null
  }

  let source: ListingImportSource = 'generic'
  let partial: Partial<ListingImportDraft> | null = null

  if (host.includes('realtor.com')) {
    source = 'realtor'
    partial = parseRealtorSlug(pathname)
  } else if (host.includes('zillow.com') || host.includes('trulia.com')) {
    source = 'zillow'
    partial = parseZillowSlug(pathname)
  } else if (host.includes('redfin.com')) {
    source = 'redfin'
    partial = parseRedfinSlug(pathname)
  } else if (host.includes('apartments.com')) {
    source = 'apartments'
    // /FL/Pembroke-Pines/...
    const m = /\/([A-Z]{2})\/([^/]+)/i.exec(pathname)
    if (m) {
      partial = {
        state: sanitizeState(m[1] ?? ''),
        city: titleCasePlaceName(dashToSpace(m[2] ?? '')),
        listingKind: 'rent',
      }
    }
  }

  if (pathname.includes('/rent') || pathname.includes('/rental')) {
    partial = { ...partial, listingKind: partial?.listingKind ?? 'rent' }
  }

  const draft: ListingImportDraft = {
    url,
    source,
    listingKind: partial?.listingKind,
    title: partial?.title,
    street: partial?.street,
    city: partial?.city,
    state: partial?.state,
    zip: partial?.zip,
    filled: [],
  }
  draft.filled = listingDraftFilledLabels(draft)
  return draft
}

/**
 * Merge import into a form: only fill empty fields (does not wipe user edits).
 * Always sets `url` when provided.
 * Listing kind from path/page is applied when present.
 * Pets only fills when still at the default (`no` + empty note).
 */
export function applyListingImport<T extends ListingImportableFields>(
  form: T,
  draft: ListingImportDraft,
): { next: T; applied: string[] } {
  const applied: string[] = []
  const next = { ...form }

  if (draft.url && draft.url !== form.url) {
    next.url = draft.url
    applied.push('listing URL')
  }

  if (draft.listingKind && draft.listingKind !== form.listingKind) {
    next.listingKind = draft.listingKind as T['listingKind']
    applied.push('listing type')
    if (draft.listingKind === 'rent') {
      next.price = null as T['price']
    } else {
      next.monthlyEstimate = null as T['monthlyEstimate']
    }
  }

  const fillText = (
    key: 'title' | 'street' | 'city' | 'state' | 'zip' | 'petsNote' | 'notes',
    value: string | undefined,
    label: string,
  ) => {
    if (value == null || value === '') return
    const cur = form[key]
    if (typeof cur === 'string' && cur.trim() !== '') return
    next[key] = value as T[typeof key]
    applied.push(label)
  }

  const fillNum = (
    key: 'monthlyEstimate' | 'price' | 'bedrooms' | 'bathrooms' | 'sqft',
    value: number | null | undefined,
    label: string,
  ) => {
    if (value == null || !Number.isFinite(value) || value <= 0) return
    if (form[key] != null) return
    next[key] = value as T[typeof key]
    applied.push(label)
  }

  fillText('title', draft.title, 'title')
  fillText('street', draft.street, 'street')
  fillText('city', draft.city, 'city')
  fillText('state', draft.state, 'state')
  fillText('zip', draft.zip, 'ZIP')
  fillText('petsNote', draft.petsNote, 'pet notes')
  fillText('notes', draft.notes, 'notes')

  fillNum('monthlyEstimate', draft.monthlyEstimate, 'rent')
  fillNum('price', draft.price, 'price')
  fillNum('bedrooms', draft.bedrooms, 'beds')
  fillNum('bathrooms', draft.bathrooms, 'baths')
  fillNum('sqft', draft.sqft, 'sqft')

  if (draft.homeType && form.homeType == null) {
    next.homeType = draft.homeType as T['homeType']
    applied.push('home type')
  }

  if (
    draft.pets &&
    form.pets === 'no' &&
    !(form.petsNote && form.petsNote.trim())
  ) {
    next.pets = draft.pets as T['pets']
    applied.push('pets')
  }

  if (
    Array.isArray(draft.images) &&
    draft.images.length > 0 &&
    (!Array.isArray(form.images) || form.images.length === 0)
  ) {
    next.images = draft.images.slice(0, 12) as T['images']
    applied.push('photos')
  }

  return { next, applied }
}

/** Prefer page fields; keep slug address when page omits it. */
export function mergeListingDrafts(
  slug: ListingImportDraft,
  page: ListingImportDraft,
): ListingImportDraft {
  const pick = <T>(a: T | undefined, b: T | undefined): T | undefined =>
    a !== undefined && a !== null && a !== '' ? a : b

  const images =
    page.images && page.images.length > 0
      ? page.images
      : slug.images && slug.images.length > 0
        ? slug.images
        : undefined

  const merged: ListingImportDraft = {
    url: page.url || slug.url,
    source: page.source !== 'generic' ? page.source : slug.source,
    fromPage: Boolean(page.fromPage || slug.fromPage),
    listingKind: pick(page.listingKind, slug.listingKind),
    homeType: pick(page.homeType, slug.homeType),
    title: pick(page.title, slug.title),
    street: pick(page.street, slug.street),
    city: pick(page.city, slug.city),
    state: pick(page.state, slug.state),
    zip: pick(page.zip, slug.zip),
    monthlyEstimate: pick(page.monthlyEstimate, slug.monthlyEstimate),
    price: pick(page.price, slug.price),
    bedrooms: pick(page.bedrooms, slug.bedrooms),
    bathrooms: pick(page.bathrooms, slug.bathrooms),
    sqft: pick(page.sqft, slug.sqft),
    pets: pick(page.pets, slug.pets),
    petsNote: pick(page.petsNote, slug.petsNote),
    notes: pick(page.notes, slug.notes),
    images,
    filled: [],
  }
  merged.filled = listingDraftFilledLabels(merged)
  return merged
}

export function listingDraftFilledLabels(draft: ListingImportDraft): string[] {
  const filled: string[] = []
  if (draft.listingKind) filled.push('listing type')
  if (draft.homeType) filled.push('home type')
  if (draft.street) filled.push('street')
  if (draft.city) filled.push('city')
  if (draft.state) filled.push('state')
  if (draft.zip) filled.push('ZIP')
  if (draft.title) filled.push('title')
  if (draft.monthlyEstimate != null) filled.push('rent')
  if (draft.price != null) filled.push('price')
  if (draft.bedrooms != null) filled.push('beds')
  if (draft.bathrooms != null) filled.push('baths')
  if (draft.sqft != null) filled.push('sqft')
  if (draft.pets) filled.push('pets')
  if (draft.petsNote) filled.push('pet notes')
  if (draft.images && draft.images.length > 0) filled.push('photos')
  if (draft.notes) filled.push('notes')
  return filled
}

export function listingImportSourceLabel(source: ListingImportSource): string {
  switch (source) {
    case 'realtor':
      return 'Realtor.com'
    case 'zillow':
      return 'Zillow'
    case 'redfin':
      return 'Redfin'
    case 'apartments':
      return 'Apartments.com'
    default:
      return 'listing link'
  }
}
