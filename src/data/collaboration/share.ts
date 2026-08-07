import type {
  PetsPolicy,
  PlaceHomeType,
  PlaceListingKind,
  PlaceTier,
  SavedPlace,
} from '../../domain/types'

/** Public snapshot of a place — no private notes, likes, or status. */
export type SharedPlaceSnapshot = {
  id: string
  title: string
  url: string
  listingKind: PlaceListingKind
  homeType: PlaceHomeType | null
  price: number | null
  monthlyEstimate: number | null
  street: string
  city: string
  state: string
  zip: string
  location: string
  bedrooms: number | null
  bathrooms: number | null
  sqft: number | null
  pets: PetsPolicy
  petsNote: string
  proTags: string[]
  concernTags: string[]
  tier: PlaceTier
  images: string[]
}

export type ShareKind = 'place' | 'collection'

export type PublicSharePayload = {
  version: number
  kind: ShareKind
  title: string | null
  places: SharedPlaceSnapshot[]
}

export type PublicShareRecord = {
  token: string
  kind: ShareKind
  title: string | null
  createdAt: string
  expiresAt: string | null
  payload: PublicSharePayload
}

export type CreatedShareLink = {
  id: string
  token: string
  kind: ShareKind
  path: string
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map(String).filter(Boolean)
}

function asNumberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/** Build a guest-safe snapshot from a saved place (client-side mirror of SQL sanitize). */
export function toSharedPlaceSnapshot(place: SavedPlace): SharedPlaceSnapshot {
  return {
    id: place.id,
    title: place.title || 'Untitled place',
    url: place.url || '',
    listingKind: place.listingKind === 'buy' ? 'buy' : 'rent',
    homeType:
      place.homeType === 'apartment' ||
      place.homeType === 'condo' ||
      place.homeType === 'single_family' ||
      place.homeType === 'townhome'
        ? place.homeType
        : null,
    price: place.price,
    monthlyEstimate: place.monthlyEstimate,
    street: place.street || '',
    city: place.city || '',
    state: place.state || '',
    zip: place.zip || '',
    location: place.location || '',
    bedrooms: place.bedrooms,
    bathrooms: place.bathrooms,
    sqft: place.sqft,
    pets:
      place.pets === 'yes' || place.pets === 'limited' || place.pets === 'no'
        ? place.pets
        : 'no',
    petsNote: place.petsNote || '',
    proTags: Array.isArray(place.proTags) ? place.proTags.filter(Boolean) : [],
    concernTags: Array.isArray(place.concernTags)
      ? place.concernTags.filter(Boolean)
      : [],
    tier: (['dream', 'strong', 'maybe', 'pass'] as PlaceTier[]).includes(
      place.tier,
    )
      ? place.tier
      : 'maybe',
    images: Array.isArray(place.images) ? place.images.filter(Boolean) : [],
  }
}

export function normalizeSharedPlace(raw: unknown): SharedPlaceSnapshot | null {
  if (!raw || typeof raw !== 'object') return null
  const p = raw as Record<string, unknown>
  return {
    id: String(p.id ?? 'shared'),
    title: String(p.title ?? 'Untitled place'),
    url: String(p.url ?? ''),
    listingKind: p.listingKind === 'buy' ? 'buy' : 'rent',
    homeType:
      p.homeType === 'apartment' ||
      p.homeType === 'condo' ||
      p.homeType === 'single_family' ||
      p.homeType === 'townhome'
        ? p.homeType
        : null,
    price: asNumberOrNull(p.price),
    monthlyEstimate: asNumberOrNull(p.monthlyEstimate),
    street: String(p.street ?? ''),
    city: String(p.city ?? ''),
    state: String(p.state ?? ''),
    zip: String(p.zip ?? ''),
    location: String(p.location ?? ''),
    bedrooms: asNumberOrNull(p.bedrooms),
    bathrooms: asNumberOrNull(p.bathrooms),
    sqft: asNumberOrNull(p.sqft),
    pets:
      p.pets === 'yes' || p.pets === 'limited' || p.pets === 'no'
        ? p.pets
        : 'no',
    petsNote: String(p.petsNote ?? ''),
    proTags: asStringArray(p.proTags),
    concernTags: asStringArray(p.concernTags),
    tier: (['dream', 'strong', 'maybe', 'pass'] as PlaceTier[]).includes(
      p.tier as PlaceTier,
    )
      ? (p.tier as PlaceTier)
      : 'maybe',
    images: asStringArray(p.images),
  }
}

export function sharePathForToken(token: string): string {
  return `/s/${token}`
}

export function absoluteShareUrl(token: string): string {
  const path = sharePathForToken(token)
  if (typeof window === 'undefined') return path
  return `${window.location.origin}${path}`
}

/** Match `/s/:token` from the current pathname. */
export function readShareTokenFromPath(
  pathname = typeof window !== 'undefined' ? window.location.pathname : '',
): string | null {
  const match = pathname.match(/^\/s\/([A-Za-z0-9_-]{16,})$/)
  return match?.[1] ?? null
}
