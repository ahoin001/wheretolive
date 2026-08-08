import type { PetsPolicy, PlaceTier, SavedPlace } from '../../../domain/types'
import { formatMoney } from '../../../domain/finance/calculations'
import { placeImages } from '../../../domain/places/filtering'
import {
  DEFAULT_TIER_REVIEW,
  type TierReviewState,
} from '../../../domain/places/tierReview'

export const TIERS: PlaceTier[] = ['dream', 'strong', 'maybe', 'pass']

export const TIER_META: Record<
  PlaceTier,
  {
    label: string
    short: string
    rail: string
    /** Soft full-bleed wash behind a mobile tier panel / section. */
    wash: string
    /** Left accent bar / sticky cue for the active tier. */
    accentBar: string
    /** Readable ink on wash surfaces. */
    ink: string
    chip: string
    chipActive: string
    emptyHint: string
  }
> = {
  dream: {
    label: 'Dream',
    short: 'Dream',
    rail: 'bg-honey-soft text-[#8a5524]',
    wash: 'bg-honey-soft/55',
    accentBar: 'bg-honey',
    ink: 'text-[#8a5524]',
    chip: 'border-honey/35 text-[#8a5524]',
    chipActive: 'border-honey bg-honey text-white shadow-[var(--shadow-soft)]',
    emptyHint: 'Drop places here',
  },
  strong: {
    label: 'Strong yes',
    short: 'Strong',
    rail: 'bg-sea/15 text-sea-deep',
    wash: 'bg-sea/10',
    accentBar: 'bg-sea-deep',
    ink: 'text-sea-deep',
    chip: 'border-sea/40 text-sea-deep',
    chipActive: 'border-sea-deep bg-sea-deep text-white shadow-[var(--shadow-soft)]',
    emptyHint: 'Drop places here',
  },
  maybe: {
    label: 'Maybe',
    short: 'Maybe',
    rail: 'bg-keep/15 text-keep',
    wash: 'bg-keep/10',
    accentBar: 'bg-keep',
    ink: 'text-keep',
    chip: 'border-keep/35 text-keep',
    chipActive: 'border-keep bg-keep text-white shadow-[var(--shadow-soft)]',
    emptyHint: 'Drop places here',
  },
  pass: {
    label: 'Pass',
    short: 'Pass',
    rail: 'bg-line/70 text-ink-soft',
    wash: 'bg-line/45',
    accentBar: 'bg-ink-soft',
    ink: 'text-ink-soft',
    chip: 'border-line text-ink-soft',
    chipActive: 'border-ink bg-ink text-white shadow-[var(--shadow-soft)]',
    emptyHint: 'Drop places here',
  },
}

export const PETS_LABEL: Record<PetsPolicy, string> = {
  yes: 'Pets OK',
  limited: 'Pets limited',
  no: 'No pets',
}

export function emptyReviews(): Record<PlaceTier, TierReviewState> {
  return {
    dream: { ...DEFAULT_TIER_REVIEW },
    strong: { ...DEFAULT_TIER_REVIEW },
    maybe: { ...DEFAULT_TIER_REVIEW },
    pass: { ...DEFAULT_TIER_REVIEW },
  }
}

export function tierDropId(tier: PlaceTier): string {
  return `tier:${tier}`
}

export function primaryCostLabel(place: SavedPlace): string {
  if (place.listingKind === 'rent') {
    return place.monthlyEstimate != null
      ? `${formatMoney(place.monthlyEstimate)}/mo`
      : 'Rent not set'
  }
  if (place.price != null) return formatMoney(place.price)
  return 'Price not set'
}

export { placeImages }
export type { PlaceTier, SavedPlace, TierReviewState }
