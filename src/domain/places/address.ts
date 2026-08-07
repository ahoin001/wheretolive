/** US place address helpers: parse legacy free-text, sanitize, format. */

export interface PlaceAddress {
  street: string
  city: string
  state: string
  zip: string
}

export const emptyAddress = (): PlaceAddress => ({
  street: '',
  city: '',
  state: '',
  zip: '',
})

/** South Florida + nearby defaults for city combobox. Custom cities still allowed. */
export const SUGGESTED_CITIES = [
  'Aventura',
  'Boca Raton',
  'Boynton Beach',
  'Coconut Creek',
  'Cooper City',
  'Coral Gables',
  'Coral Springs',
  'Cutler Bay',
  'Dania Beach',
  'Davie',
  'Deerfield Beach',
  'Delray Beach',
  'Doral',
  'Fort Lauderdale',
  'Hallandale Beach',
  'Hialeah',
  'Hollywood',
  'Homestead',
  'Jupiter',
  'Kendall',
  'Key Biscayne',
  'Lake Worth',
  'Lauderdale Lakes',
  'Lauderhill',
  'Lighthouse Point',
  'Margate',
  'Miami',
  'Miami Beach',
  'Miami Gardens',
  'Miami Lakes',
  'Miami Shores',
  'Miramar',
  'North Lauderdale',
  'North Miami',
  'North Miami Beach',
  'Oakland Park',
  'Parkland',
  'Pembroke Park',
  'Pembroke Pines',
  'Plantation',
  'Pompano Beach',
  'Royal Palm Beach',
  'Southwest Ranches',
  'Sunrise',
  'Tamarac',
  'West Palm Beach',
  'Weston',
  'Wilton Manors',
] as const

const US_STATE_CODES = new Set(
  'AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC'
    .split(/\s+/),
)

export function cityKey(city: string): string {
  return city.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Collapse whitespace and trim. */
export function collapseSpace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

/** Title-case city / place names (keeps short conjunctions lowercase mid-phrase). */
export function titleCasePlaceName(value: string): string {
  const cleaned = collapseSpace(value)
  if (!cleaned) return ''
  const small = new Set(['of', 'the', 'and', 'de', 'la', 'del'])
  return cleaned
    .split(' ')
    .map((word, i) => {
      const lower = word.toLowerCase()
      if (i > 0 && small.has(lower)) return lower
      // Preserve Mc/Mac-ish capitals lightly: mcdonald -> Mcdonald (simple is fine)
      if (/^[a-z]/i.test(word)) {
        return lower.charAt(0).toUpperCase() + lower.slice(1)
      }
      return word
    })
    .join(' ')
}

export function sanitizeStreet(value: string): string {
  return collapseSpace(value)
}

export function sanitizeCity(value: string): string {
  // Strip trailing state-ish tokens if user typed "City FL" into city field
  let s = collapseSpace(value)
  s = s.replace(/,+\s*$/, '')
  s = s.replace(/\s+[A-Za-z]{2}\s*$/, (m) => {
    const code = m.trim().toUpperCase()
    return US_STATE_CODES.has(code) ? '' : m
  })
  s = s.replace(/\s+\d{5}(?:-\d{4})?\s*$/, '')
  return titleCasePlaceName(s)
}

export function sanitizeState(value: string): string {
  const raw = collapseSpace(value).toUpperCase()
  if (!raw) return ''
  // Allow full names for a few common typos → code
  const aliases: Record<string, string> = {
    FLORIDA: 'FL',
    CALIFORNIA: 'CA',
    TEXAS: 'TX',
    NEWYORK: 'NY',
    'NEW YORK': 'NY',
  }
  if (aliases[raw]) return aliases[raw]
  if (raw.length === 2 && US_STATE_CODES.has(raw)) return raw
  // Take first 2 letters if looks like a code start
  const two = raw.slice(0, 2)
  return US_STATE_CODES.has(two) ? two : raw.slice(0, 2)
}

export function sanitizeZip(value: string): string {
  const digits = value.replace(/[^\d]/g, '')
  if (digits.length <= 5) return digits
  return `${digits.slice(0, 5)}-${digits.slice(5, 9)}`
}

export function sanitizeAddress(addr: PlaceAddress): PlaceAddress {
  return {
    street: sanitizeStreet(addr.street),
    city: sanitizeCity(addr.city),
    state: sanitizeState(addr.state),
    zip: sanitizeZip(addr.zip),
  }
}

/** Format for UI (cards, compare). */
export function formatPlaceAddress(addr: PlaceAddress): string {
  const clean = sanitizeAddress(addr)
  const cityState = [clean.city, clean.state].filter(Boolean).join(', ')
  const cityStateZip = [cityState, clean.zip].filter(Boolean).join(' ')
  return [clean.street, cityStateZip].filter(Boolean).join(', ')
}

const STATE_ZIP_RE = /^([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/
const STATE_ONLY_RE = /^([A-Za-z]{2})$/
const ZIP_ONLY_RE = /^(\d{5}(?:-\d{4})?)$/

function parseStateZipTail(tail: string): { state: string; zip: string } | null {
  const t = collapseSpace(tail)
  let m = t.match(STATE_ZIP_RE)
  if (m) return { state: m[1].toUpperCase(), zip: m[2] }
  m = t.match(STATE_ONLY_RE)
  if (m && US_STATE_CODES.has(m[1].toUpperCase())) {
    return { state: m[1].toUpperCase(), zip: '' }
  }
  m = t.match(ZIP_ONLY_RE)
  if (m) return { state: '', zip: m[1] }
  // "FL33026" without space
  m = t.match(/^([A-Za-z]{2})(\d{5}(?:-\d{4})?)$/)
  if (m && US_STATE_CODES.has(m[1].toUpperCase())) {
    return { state: m[1].toUpperCase(), zip: m[2] }
  }
  return null
}

/**
 * Parse free-text locations from listings / legacy data.
 * Handles: "123 Main St, City, ST 12345", "City, ST 12345", city-only, street-only.
 */
export function parseLocationString(raw: string | null | undefined): PlaceAddress {
  const input = collapseSpace(raw ?? '')
  if (!input) return emptyAddress()

  const parts = input
    .split(',')
    .map((p) => collapseSpace(p))
    .filter(Boolean)

  if (parts.length >= 3) {
    const tail = parseStateZipTail(parts[parts.length - 1]!)
    if (tail) {
      const city = sanitizeCity(parts[parts.length - 2]!)
      const street = sanitizeStreet(parts.slice(0, -2).join(', '))
      return sanitizeAddress({ street, city, state: tail.state, zip: tail.zip })
    }
    // "street, city, something else"
    return sanitizeAddress({
      street: parts.slice(0, -2).join(', '),
      city: parts[parts.length - 2]!,
      state: '',
      zip: '',
    })
  }

  if (parts.length === 2) {
    const [left, right] = parts as [string, string]
    const tail = parseStateZipTail(right)
    if (tail) {
      // "City, ST ZIP" | "City, ST" | "123 Main St, FL 33321"
      return sanitizeAddress(buildTwoPart(left, tail))
    }
    // "street, city" without state
    return sanitizeAddress({
      street: left,
      city: sanitizeCity(right),
      state: '',
      zip: '',
    })
  }

  // Single segment
  const only = parts[0] ?? input
  if (ZIP_ONLY_RE.test(only)) {
    return sanitizeAddress({ street: '', city: '', state: '', zip: only })
  }
  // Street-like vs city-like
  if (
    /^\d/.test(only) ||
    /\b(st|street|ave|avenue|rd|road|ln|lane|dr|drive|ct|court|way|blvd|unit)\b/i.test(
      only,
    )
  ) {
    return sanitizeAddress({ street: only, city: '', state: '', zip: '' })
  }
  return sanitizeAddress({ street: '', city: only, state: '', zip: '' })
}

function looksLikeStreetLine(value: string): boolean {
  return (
    /^\d/.test(value) ||
    /\b(st|street|ave|avenue|rd|road|ln|lane|dr|drive|ct|court|way|blvd|boulevard|pkwy|unit|#)\b/i.test(
      value,
    )
  )
}

function buildTwoPart(
  left: string,
  tail: { state: string; zip: string },
): PlaceAddress {
  if (looksLikeStreetLine(left)) {
    return {
      street: left,
      city: '',
      state: tail.state,
      zip: tail.zip,
    }
  }
  return {
    street: '',
    city: left,
    state: tail.state,
    zip: tail.zip,
  }
}

/** Build address from structured fields, falling back to parse of legacy location. */
export function resolvePlaceAddress(raw: {
  street?: unknown
  city?: unknown
  state?: unknown
  zip?: unknown
  location?: unknown
}): PlaceAddress {
  const hasStructured =
    (typeof raw.street === 'string' && raw.street.trim()) ||
    (typeof raw.city === 'string' && raw.city.trim()) ||
    (typeof raw.state === 'string' && raw.state.trim()) ||
    (typeof raw.zip === 'string' && raw.zip.trim())

  if (hasStructured) {
    return sanitizeAddress({
      street: typeof raw.street === 'string' ? raw.street : '',
      city: typeof raw.city === 'string' ? raw.city : '',
      state: typeof raw.state === 'string' ? raw.state : '',
      zip: typeof raw.zip === 'string' ? raw.zip : '',
    })
  }

  if (typeof raw.location === 'string' && raw.location.trim()) {
    return parseLocationString(raw.location)
  }

  return emptyAddress()
}

export function placeCityLabel(place: { city?: string; location?: string }): string | null {
  const city = (place.city ?? '').trim()
  if (city) return sanitizeCity(city)
  if (place.location) {
    const parsed = parseLocationString(place.location)
    return parsed.city || null
  }
  return null
}

export function mergeCitySuggestions(
  extra: Iterable<string> = [],
): string[] {
  const map = new Map<string, string>()
  for (const c of SUGGESTED_CITIES) {
    map.set(cityKey(c), c)
  }
  for (const c of extra) {
    const clean = sanitizeCity(c)
    if (!clean) continue
    const key = cityKey(clean)
    if (!map.has(key)) map.set(key, clean)
  }
  return [...map.values()].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' }),
  )
}

export function filterCitySuggestions(
  query: string,
  options: string[],
  limit = 8,
): string[] {
  const q = cityKey(query)
  if (!q) return options.slice(0, limit)
  const starts: string[] = []
  const includes: string[] = []
  for (const opt of options) {
    const k = cityKey(opt)
    if (k === q) continue
    if (k.startsWith(q)) starts.push(opt)
    else if (k.includes(q)) includes.push(opt)
  }
  return [...starts, ...includes].slice(0, limit)
}

/** Lowercase street with collapsed space, light punct strip, unit/# normalized. */
export function normalizeStreetForMatch(street: string): string {
  let s = collapseSpace(street).toLowerCase()
  if (!s) return ''
  s = s.replace(/[.,]/g, ' ')
  s = collapseSpace(s)
  s = s.replace(/\b(apartment|apt\.?|unit|suite|ste\.?)\s*#?\s*/gi, '#')
  s = s.replace(/#\s+/g, '#')
  return s
}

function zip5(zip: string): string {
  const digits = zip.replace(/\D/g, '')
  return digits.length >= 5 ? digits.slice(0, 5) : ''
}

type AddressLike = PlaceAddress | {
  street?: string
  city?: string
  state?: string
  zip?: string
  location?: string
}

/**
 * True when two places likely refer to the same physical address.
 * Requires a non-empty street match; ZIP / city / state corroborate and
 * conflict when both sides have values that disagree.
 */
export function addressesMatch(a: AddressLike, b: AddressLike): boolean {
  const aa = resolvePlaceAddress(a)
  const bb = resolvePlaceAddress(b)
  const sa = normalizeStreetForMatch(aa.street)
  const sb = normalizeStreetForMatch(bb.street)
  if (!sa || !sb || sa !== sb) return false

  const za = zip5(aa.zip)
  const zb = zip5(bb.zip)
  if (za && zb) return za === zb

  const ca = cityKey(aa.city)
  const cb = cityKey(bb.city)
  if (ca && cb && ca !== cb) return false

  const sta = aa.state.toUpperCase()
  const stb = bb.state.toUpperCase()
  if (sta && stb && sta !== stb) return false

  // Same street with no conflicting city/state/zip.
  return true
}

/** First place on the list with a matching address, if any. */
export function findDuplicatePlace<T extends AddressLike & { id?: string }>(
  places: Iterable<T>,
  candidate: AddressLike,
  options?: { excludeId?: string | null },
): T | null {
  const excludeId = options?.excludeId ?? null
  for (const place of places) {
    if (excludeId && place.id === excludeId) continue
    if (addressesMatch(place, candidate)) return place
  }
  return null
}

/** Source place ids whose address already appears in `targetPlaces`. */
export function duplicatePlaceIds(
  sourcePlaces: Array<AddressLike & { id: string }>,
  targetPlaces: Iterable<AddressLike>,
): Set<string> {
  const target = [...targetPlaces]
  const dupes = new Set<string>()
  for (const src of sourcePlaces) {
    if (findDuplicatePlace(target, src)) dupes.add(src.id)
  }
  return dupes
}
