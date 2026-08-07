import { formatMoney } from '../finance/calculations'
import type { PetsPolicy, PlaceHomeType, PlaceTier, SavedPlace } from '../types'
import { PLACE_HOME_TYPE_OPTIONS } from '../types'
import {
  cityKey,
  formatPlaceAddress,
  sanitizeAddress,
  sanitizeStreet,
} from './address'

export type DuplicateGroup = {
  key: string
  label: string
  places: SavedPlace[]
}

export type PlaceDiffCell = {
  placeId: string
  display: string
}

export type PlaceDiffRow = {
  field: string
  label: string
  cells: PlaceDiffCell[]
  differs: boolean
}

const TIER_LABEL: Record<PlaceTier, string> = {
  dream: 'Dream',
  strong: 'Strong yes',
  maybe: 'Maybe',
  pass: 'Pass',
}

const STATUS_LABEL: Record<string, string> = {
  none: 'No status',
  visited: 'Visited',
  offer: 'Offer',
}

const PETS_LABEL: Record<PetsPolicy, string> = {
  yes: 'Pets OK',
  limited: 'Pets limited',
  no: 'No pets',
}

function homeTypeLabel(value: PlaceHomeType | null): string {
  if (!value) return 'Not set'
  return PLACE_HOME_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? value
}

/** Normalize street lines so “123 Main St” ≈ “123 Main Street, Unit 2” still differs by unit. */
export function normalizeStreetKey(street: string): string {
  let s = sanitizeStreet(street).toLowerCase()
  s = s.replace(/[.,#]/g, ' ')
  s = s.replace(/\b(apartment|apart|apt|unit|suite|ste|no|number)\b/g, ' ')
  s = s.replace(/\b(street|st|road|rd|avenue|ave|boulevard|blvd|drive|dr|lane|ln|court|ct|circle|cir|way|terrace|ter|place|pl)\b/g, (m) => {
    const map: Record<string, string> = {
      street: 'st',
      road: 'rd',
      avenue: 'ave',
      boulevard: 'blvd',
      drive: 'dr',
      lane: 'ln',
      court: 'ct',
      circle: 'cir',
      terrace: 'ter',
      place: 'pl',
    }
    return map[m] ?? m
  })
  return s.replace(/\s+/g, ' ').trim()
}

/**
 * Stable key for “same address”. Requires a street plus city or ZIP
 * so bare city-only places are not treated as duplicates.
 */
export function placeAddressKey(
  place: Pick<SavedPlace, 'street' | 'city' | 'state' | 'zip'>,
): string | null {
  const clean = sanitizeAddress({
    street: place.street,
    city: place.city,
    state: place.state,
    zip: place.zip,
  })
  const street = normalizeStreetKey(clean.street)
  if (!street) return null
  const city = cityKey(clean.city)
  const zip5 = clean.zip.replace(/\D/g, '').slice(0, 5)
  if (!city && !zip5) return null
  return [street, city, clean.state.toLowerCase(), zip5].join('|')
}

export function findDuplicateAddressGroups(
  places: SavedPlace[],
): DuplicateGroup[] {
  const map = new Map<string, SavedPlace[]>()
  for (const place of places) {
    const key = placeAddressKey(place)
    if (!key) continue
    const list = map.get(key)
    if (list) list.push(place)
    else map.set(key, [place])
  }

  const groups: DuplicateGroup[] = []
  for (const [key, group] of map) {
    if (group.length < 2) continue
    const sorted = [...group].sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime() ||
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    const label =
      formatPlaceAddress(sorted[0]!) ||
      sorted[0]!.location ||
      'Same address'
    groups.push({ key, label, places: sorted })
  }

  groups.sort((a, b) => b.places.length - a.places.length || a.label.localeCompare(b.label))
  return groups
}

export function duplicatePlacesSummary(places: SavedPlace[]): {
  groups: DuplicateGroup[]
  groupCount: number
  placeCount: number
} {
  const groups = findDuplicateAddressGroups(places)
  const placeCount = groups.reduce((n, g) => n + g.places.length, 0)
  return { groups, groupCount: groups.length, placeCount }
}

/** Prefer most recently edited as the suggested keep. */
export function suggestedKeepId(places: SavedPlace[]): string {
  const sorted = [...places].sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime() ||
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
  return sorted[0]?.id ?? places[0]!.id
}

function fmtNum(n: number | null | undefined, suffix = ''): string {
  if (n == null || !Number.isFinite(n)) return 'Not set'
  return `${n}${suffix}`
}

function fmtTags(tags: string[] | undefined): string {
  if (!tags?.length) return 'None'
  return [...tags].sort((a, b) => a.localeCompare(b)).join(', ')
}

function displayValue(field: string, place: SavedPlace): string {
  switch (field) {
    case 'title':
      return place.title.trim() || 'Untitled'
    case 'url':
      return place.url.trim() || 'None'
    case 'listingKind':
      return place.listingKind === 'rent' ? 'Rental' : 'Buy'
    case 'homeType':
      return homeTypeLabel(place.homeType)
    case 'price':
      return place.price != null ? formatMoney(place.price) : 'Not set'
    case 'monthlyEstimate':
      return place.monthlyEstimate != null
        ? `${formatMoney(place.monthlyEstimate)}/mo`
        : 'Not set'
    case 'address':
      return (
        formatPlaceAddress(place) ||
        place.location.trim() ||
        'Not set'
      )
    case 'bedrooms':
      return fmtNum(place.bedrooms)
    case 'bathrooms':
      return fmtNum(place.bathrooms)
    case 'sqft':
      return place.sqft != null && place.sqft > 0
        ? `${Math.round(place.sqft).toLocaleString()} sqft`
        : 'Not set'
    case 'pets':
      return PETS_LABEL[place.pets ?? 'no']
    case 'petsNote':
      return place.petsNote.trim() || 'None'
    case 'tier':
      return TIER_LABEL[place.tier]
    case 'status':
      return STATUS_LABEL[place.status] ?? place.status
    case 'proTags':
      return fmtTags(place.proTags)
    case 'concernTags':
      return fmtTags(place.concernTags)
    case 'notes':
      return place.notes.trim() || 'None'
    case 'images':
      return place.images?.length
        ? `${place.images.length} photo${place.images.length === 1 ? '' : 's'}`
        : 'No photos'
    default:
      return ''
  }
}

function comparableRaw(field: string, place: SavedPlace): string {
  switch (field) {
    case 'title':
      return place.title.trim().toLowerCase()
    case 'url':
      return place.url.trim().toLowerCase()
    case 'listingKind':
      return place.listingKind
    case 'homeType':
      return place.homeType ?? ''
    case 'price':
      return place.price == null ? '' : String(place.price)
    case 'monthlyEstimate':
      return place.monthlyEstimate == null ? '' : String(place.monthlyEstimate)
    case 'address':
      return placeAddressKey(place) ?? ''
    case 'bedrooms':
      return place.bedrooms == null ? '' : String(place.bedrooms)
    case 'bathrooms':
      return place.bathrooms == null ? '' : String(place.bathrooms)
    case 'sqft':
      return place.sqft == null ? '' : String(place.sqft)
    case 'pets':
      return place.pets ?? 'no'
    case 'petsNote':
      return place.petsNote.trim().toLowerCase()
    case 'tier':
      return place.tier
    case 'status':
      return place.status
    case 'proTags':
      return fmtTags(place.proTags).toLowerCase()
    case 'concernTags':
      return fmtTags(place.concernTags).toLowerCase()
    case 'notes':
      return place.notes.trim().toLowerCase()
    case 'images':
      return (place.images ?? []).join('\n')
    default:
      return ''
  }
}

const DIFF_FIELDS: { field: string; label: string }[] = [
  { field: 'title', label: 'Title' },
  { field: 'listingKind', label: 'Listing type' },
  { field: 'homeType', label: 'Home type' },
  { field: 'price', label: 'Purchase price' },
  { field: 'monthlyEstimate', label: 'Monthly rent' },
  { field: 'address', label: 'Address' },
  { field: 'bedrooms', label: 'Bedrooms' },
  { field: 'bathrooms', label: 'Bathrooms' },
  { field: 'sqft', label: 'Square feet' },
  { field: 'pets', label: 'Pets' },
  { field: 'petsNote', label: 'Pet notes' },
  { field: 'tier', label: 'Tier' },
  { field: 'status', label: 'Status' },
  { field: 'proTags', label: 'Pros' },
  { field: 'concernTags', label: 'Concerns' },
  { field: 'notes', label: 'Notes' },
  { field: 'url', label: 'Listing link' },
  { field: 'images', label: 'Photos' },
]

/** Field-by-field compare for a duplicate group (order = places order). */
export function buildPlaceDiffRows(places: SavedPlace[]): PlaceDiffRow[] {
  return DIFF_FIELDS.map(({ field, label }) => {
    const cells = places.map((place) => ({
      placeId: place.id,
      display: displayValue(field, place),
    }))
    const raws = places.map((p) => comparableRaw(field, p))
    const differs = new Set(raws).size > 1
    return { field, label, cells, differs }
  })
}

export function formatEditedAt(iso: string, now = new Date()): string {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return 'Unknown'
  const diffMs = now.getTime() - d.getTime()
  const mins = Math.round(diffMs / 60_000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 36) return `${hours} hr ago`
  const days = Math.round(hours / 24)
  if (days < 14) return `${days} day${days === 1 ? '' : 's'} ago`
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
