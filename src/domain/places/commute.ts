/** Drive-time commute budget from a configurable anchor. */

import {
  formatPlaceAddress,
  sanitizeAddress,
  sanitizeState,
  type PlaceAddress,
} from './address'
import type { CommuteSettings } from '../types'

export const COMMUTE_PRO_TAG = 'Within commute'

/** Default anchor: 16401 Miramar Pkwy, Miramar, FL 33027 */
export const DEFAULT_COMMUTE_SETTINGS: CommuteSettings = {
  street: '16401 Miramar Pkwy',
  city: 'Miramar',
  state: 'FL',
  zip: '33027',
  idealMaxMin: 30,
  budgetMaxMin: 35,
}

/** @deprecated use DEFAULT_COMMUTE_SETTINGS */
export const COMMUTE_ANCHOR = DEFAULT_COMMUTE_SETTINGS

/** @deprecated use commuteAnchorLine(settings) */
export const COMMUTE_ANCHOR_LINE = formatPlaceAddress(DEFAULT_COMMUTE_SETTINGS)

/** @deprecated use settings.idealMaxMin */
export const COMMUTE_IDEAL_MAX_MIN = DEFAULT_COMMUTE_SETTINGS.idealMaxMin

/** @deprecated use settings.budgetMaxMin */
export const COMMUTE_BUDGET_MAX_MIN = DEFAULT_COMMUTE_SETTINGS.budgetMaxMin

export type CommuteBand = 'ideal' | 'within' | 'over' | 'unknown'

export type CommuteEstimate = {
  minutes: number | null
  distanceMiles?: number | null
  band: CommuteBand
  loading?: boolean
  error?: string
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min
  return Math.min(max, Math.max(min, Math.round(n)))
}

export function normalizeCommuteSettings(raw: unknown): CommuteSettings {
  const def = DEFAULT_COMMUTE_SETTINGS
  if (!raw || typeof raw !== 'object') return { ...def }
  const r = raw as Partial<CommuteSettings>
  const addr = sanitizeAddress({
    street: String(r.street ?? def.street),
    city: String(r.city ?? def.city),
    state: sanitizeState(String(r.state ?? def.state)),
    zip: String(r.zip ?? def.zip),
  })
  const idealMaxMin = clamp(Number(r.idealMaxMin ?? def.idealMaxMin), 5, 120)
  const budgetMaxMin = clamp(
    Number(r.budgetMaxMin ?? def.budgetMaxMin),
    idealMaxMin,
    180,
  )
  return { ...addr, idealMaxMin, budgetMaxMin }
}

export function commuteAnchorLine(settings: CommuteSettings): string {
  return formatPlaceAddress(settings)
}

export function commuteBand(
  minutes: number | null | undefined,
  settings: Pick<CommuteSettings, 'idealMaxMin' | 'budgetMaxMin'> = DEFAULT_COMMUTE_SETTINGS,
): CommuteBand {
  if (minutes == null || !Number.isFinite(minutes) || minutes < 0) {
    return 'unknown'
  }
  if (minutes <= settings.idealMaxMin) return 'ideal'
  if (minutes <= settings.budgetMaxMin) return 'within'
  return 'over'
}

export function formatCommuteMinutes(minutes: number): string {
  const rounded = Math.max(1, Math.round(minutes))
  return `~${rounded} min`
}

export function commuteBadgeLabel(estimate: CommuteEstimate): string {
  if (estimate.loading) return 'Commute…'
  if (estimate.minutes == null) return 'Commute —'
  return formatCommuteMinutes(estimate.minutes)
}

export function commuteBadgeTitle(
  estimate: CommuteEstimate,
  settings: CommuteSettings = DEFAULT_COMMUTE_SETTINGS,
): string {
  const anchor = commuteAnchorLine(settings)
  if (estimate.loading) {
    return `Estimating drive time from ${anchor}`
  }
  if (estimate.minutes == null) {
    return estimate.error
      ? `Commute unavailable: ${estimate.error}`
      : `Add city and state for drive time from ${anchor}`
  }
  const mins = Math.round(estimate.minutes)
  switch (estimate.band) {
    case 'ideal':
      return `${mins} min drive from ${anchor} — within ideal commute (≤${settings.idealMaxMin} min)`
    case 'within':
      return `${mins} min drive from ${anchor} — within commute budget (≤${settings.budgetMaxMin} min)`
    case 'over':
      return `${mins} min drive from ${anchor} — over commute budget (>${settings.budgetMaxMin} min)`
    default:
      return `${mins} min drive from ${anchor}`
  }
}

export function commuteBadgeTone(band: CommuteBand): string {
  switch (band) {
    case 'ideal':
      return 'bg-move/15 text-move'
    case 'within':
      return 'bg-honey-soft text-honey'
    case 'over':
      return 'bg-warn/15 text-warn'
    default:
      return 'bg-line/60 text-ink-soft'
  }
}

/** Enough address to geocode a destination. */
export function hasCommuteAddress(
  addr: Partial<PlaceAddress> | null | undefined,
): boolean {
  if (!addr) return false
  const clean = sanitizeAddress({
    street: addr.street ?? '',
    city: addr.city ?? '',
    state: addr.state ?? '',
    zip: addr.zip ?? '',
  })
  return Boolean(clean.city.trim() && clean.state.trim())
}

/** Normalized destination line for routing APIs + cache keys. */
export function commuteQueryFromAddress(
  addr: Partial<PlaceAddress> | null | undefined,
): string | null {
  if (!addr || !hasCommuteAddress(addr)) return null
  const clean = sanitizeAddress({
    street: addr.street ?? '',
    city: addr.city ?? '',
    state: addr.state ?? '',
    zip: addr.zip ?? '',
  })
  const line = formatPlaceAddress(clean)
  return line || null
}

export function commuteEstimateFromMinutes(
  minutes: number | null,
  settings: Pick<CommuteSettings, 'idealMaxMin' | 'budgetMaxMin'> = DEFAULT_COMMUTE_SETTINGS,
  partial?: Pick<CommuteEstimate, 'loading' | 'error' | 'distanceMiles'>,
): CommuteEstimate {
  return {
    minutes,
    distanceMiles: partial?.distanceMiles ?? null,
    band: commuteBand(minutes, settings),
    loading: partial?.loading,
    error: partial?.error,
  }
}

export function isWithinCommuteBudget(
  estimate: CommuteEstimate | null | undefined,
  settings: CommuteSettings = DEFAULT_COMMUTE_SETTINGS,
): boolean {
  if (estimate?.minutes == null || !Number.isFinite(estimate.minutes)) {
    return false
  }
  return estimate.minutes <= settings.budgetMaxMin
}

export const COMMUTE_LOADING: CommuteEstimate = {
  minutes: null,
  band: 'unknown',
  loading: true,
}

export const COMMUTE_UNKNOWN: CommuteEstimate = {
  minutes: null,
  band: 'unknown',
}
