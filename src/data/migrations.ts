import {
  DATA_VERSION,
  type AppData,
  type PetsPolicy,
  type PlaceListingKind,
  type PlaceStatus,
  type PlaceTier,
  type SavedPlace,
  type WizardStepId,
} from '../domain/types'
import { normalizeScenario } from '../domain/scenario/normalize'
import {
  formatPlaceAddress,
  resolvePlaceAddress,
} from '../domain/places/address'
import { createExampleScenario } from './exampleScenario'

const WIZARD_STEPS: readonly WizardStepId[] = [
  'welcome',
  'stay',
  'move',
  'picture',
]

/** Map pre-simplify step ids onto the 4-step stay/rent guide. */
const LEGACY_STEP_MAP: Record<string, WizardStepId> = {
  welcome: 'welcome',
  stay: 'stay',
  move: 'move',
  picture: 'picture',
  household: 'stay',
  today: 'stay',
  paths: 'move',
  peace: 'picture',
  easier: 'picture',
  talk: 'picture',
  summary: 'picture',
}

export function emptyAppData(): AppData {
  return {
    version: DATA_VERSION,
    scenario: null,
    places: [],
    ui: {
      activeStep: 'welcome',
      mode: 'places',
      completedSteps: [],
    },
  }
}

function splitLegacyTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String).map((s) => s.trim()).filter(Boolean)
  }
  if (typeof value === 'string' && value.trim()) {
    return value
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean)
  }
  return []
}

function normalizeStatus(raw: unknown): PlaceStatus {
  if (raw === 'visited' || raw === 'offer' || raw === 'none') return raw
  // legacy touring/saved/archived collapse to unmarked
  return 'none'
}

function normalizePets(raw: unknown, petAllowedFlag: unknown): PetsPolicy {
  if (raw === 'yes' || raw === 'no' || raw === 'limited') return raw
  if (raw === 'unknown') return 'no'
  if (petAllowedFlag === true) return 'yes'
  if (petAllowedFlag === false) return 'no'
  return 'no'
}

function normalizePlace(raw: unknown): SavedPlace | null {
  if (!raw || typeof raw !== 'object') return null
  const p = raw as Record<string, unknown>
  const now = new Date().toISOString()

  const images: string[] = []
  if (Array.isArray(p.images)) {
    for (const url of p.images) {
      if (typeof url === 'string' && url.trim()) images.push(url.trim())
    }
  }
  if (typeof p.thumbnailUrl === 'string' && p.thumbnailUrl.trim()) {
    const thumb = p.thumbnailUrl.trim()
    if (!images.includes(thumb)) images.unshift(thumb)
  }

  const listingKind: PlaceListingKind =
    p.listingKind === 'rent' || p.listingKind === 'buy'
      ? p.listingKind
      : p.price != null && Number(p.price) > 0
        ? 'buy'
        : 'rent'

  return {
    id: typeof p.id === 'string' ? p.id : crypto.randomUUID(),
    createdAt: typeof p.createdAt === 'string' ? p.createdAt : now,
    updatedAt: typeof p.updatedAt === 'string' ? p.updatedAt : now,
    title: typeof p.title === 'string' ? p.title : '',
    url: typeof p.url === 'string' ? p.url : '',
    listingKind,
    price:
      listingKind === 'buy' && p.price != null && p.price !== ''
        ? Number(p.price)
        : null,
    monthlyEstimate:
      p.monthlyEstimate != null && p.monthlyEstimate !== ''
        ? Number(p.monthlyEstimate)
        : null,
    ...(() => {
      const addr = resolvePlaceAddress({
        street: p.street,
        city: p.city,
        state: p.state,
        zip: p.zip,
        location: p.location,
      })
      return {
        street: addr.street,
        city: addr.city,
        state: addr.state,
        zip: addr.zip,
        location: formatPlaceAddress(addr),
      }
    })(),
    bedrooms: p.bedrooms != null && p.bedrooms !== '' ? Number(p.bedrooms) : null,
    bathrooms:
      p.bathrooms != null && p.bathrooms !== '' ? Number(p.bathrooms) : null,
    notes: typeof p.notes === 'string' ? p.notes : '',
    pets: normalizePets(p.pets, p.petsAllowed),
    petsNote: typeof p.petsNote === 'string' ? p.petsNote : '',
    proTags: splitLegacyTags(p.proTags ?? p.pros),
    concernTags: splitLegacyTags(p.concernTags ?? p.concerns),
    tier: (['dream', 'strong', 'maybe', 'pass'] as PlaceTier[]).includes(
      p.tier as PlaceTier,
    )
      ? (p.tier as PlaceTier)
      : 'maybe',
    status: normalizeStatus(p.status),
    favorite: Boolean(p.favorite ?? p.likedByMe),
    likedByMe:
      typeof p.likedByMe === 'boolean' ? p.likedByMe : Boolean(p.favorite),
    likedAt: typeof p.likedAt === 'string' ? p.likedAt : null,
    likedByUserIds: Array.isArray(p.likedByUserIds)
      ? p.likedByUserIds.map(String)
      : undefined,
    likedBy: Array.isArray(p.likedBy) ? (p.likedBy as SavedPlace['likedBy']) : undefined,
    images,
    tags: splitLegacyTags(p.tags),
  }
}

function normalizeWizardStep(raw: unknown): WizardStepId {
  if (typeof raw !== 'string') return 'welcome'
  return LEGACY_STEP_MAP[raw] ?? 'welcome'
}

function normalizeCompletedSteps(raw: unknown): WizardStepId[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<WizardStepId>()
  const out: WizardStepId[] = []
  for (const item of raw) {
    if (typeof item !== 'string') continue
    const mapped = LEGACY_STEP_MAP[item]
    if (!mapped || seen.has(mapped)) continue
    seen.add(mapped)
    out.push(mapped)
  }
  return out
}

/**
 * Future versions migrate here. Keep pure and deterministic.
 * Places and scenario (household included) both run through domain-safe coercers
 * so AppData never hands UI half-shaped questionnaire data.
 */
export function migrateAppData(raw: unknown): AppData {
  if (!raw || typeof raw !== 'object') return emptyAppData()
  const data = raw as Partial<AppData> & { version?: number }
  const version = typeof data.version === 'number' ? data.version : 0

  const places = Array.isArray(data.places)
    ? data.places
        .map(normalizePlace)
        .filter((p): p is SavedPlace => Boolean(p))
    : []

  let next: AppData = {
    version,
    scenario: data.scenario != null ? normalizeScenario(data.scenario) : null,
    places,
    ui: {
      activeStep: normalizeWizardStep(data.ui?.activeStep),
      mode: data.ui?.mode === 'guide' ? 'guide' : 'places',
      completedSteps: normalizeCompletedSteps(data.ui?.completedSteps),
    },
  }

  if (next.version < 1) {
    next = { ...next, version: 1 }
  }

  next.version = DATA_VERSION
  return next
}

export function seedExampleAppData(): AppData {
  return {
    ...emptyAppData(),
    scenario: createExampleScenario(),
    ui: {
      activeStep: 'stay',
      mode: 'guide',
      completedSteps: ['welcome'],
    },
  }
}
