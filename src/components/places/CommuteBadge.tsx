import { Car, Navigation } from 'lucide-react'
import {
  commuteBadgeTone,
  formatCommuteMinutes,
  type CommuteEstimate,
} from '../../domain/places/commute'
import type { CommuteSettings } from '../../domain/types'
import { commuteAnchorLine } from '../../domain/places/commute'
import { cn } from '../../lib/utils'

function formatDistance(miles: number | null | undefined): string | null {
  if (miles == null || !Number.isFinite(miles) || miles <= 0) return null
  return miles < 10
    ? `${miles.toFixed(1)} mi`
    : `${Math.round(miles)} mi`
}

function badgeTitle(
  estimate: CommuteEstimate,
  settings?: CommuteSettings,
): string {
  const anchor = settings ? commuteAnchorLine(settings) : 'your anchor'
  if (estimate.loading) return `Estimating drive time from ${anchor}`
  if (estimate.minutes == null) {
    return estimate.error
      ? `Commute unavailable: ${estimate.error}`
      : `Add city and state for drive time from ${anchor}`
  }
  const mins = Math.round(estimate.minutes)
  const dist = formatDistance(estimate.distanceMiles)
  return `${mins} min${dist ? ` · ${dist}` : ''} drive from ${anchor}`
}

/**
 * Aesthetic commute pill showing drive time + distance.
 *
 * - `compact` — smaller for cards / tight rows
 * - `showIcon` — prepends a car icon
 * - `inline` — designed to sit next to a title (slightly larger, bold)
 */
export function CommuteBadge({
  commute,
  settings,
  className,
  compact = false,
  showIcon = false,
}: {
  commute: CommuteEstimate | null | undefined
  settings?: CommuteSettings
  className?: string
  compact?: boolean
  showIcon?: boolean
}) {
  if (!commute) return null

  const title = badgeTitle(commute, settings)
  const isLoading = !!commute.loading
  const isUnknown = commute.band === 'unknown'
  const tone =
    isUnknown && isLoading ? 'bg-line/60 text-ink-soft' : commuteBadgeTone(commute.band)
  const dist = formatDistance(commute.distanceMiles)

  // Determine label
  let label: string
  if (isLoading) {
    label = 'Commute…'
  } else if (commute.minutes == null) {
    label = '—'
  } else {
    label = formatCommuteMinutes(commute.minutes)
  }

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full font-semibold leading-none transition-colors',
        compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs',
        tone,
        isLoading && 'animate-pulse',
        className,
      )}
      title={title}
    >
      {showIcon && (
        <Car className={cn('shrink-0 opacity-70', compact ? 'h-2.5 w-2.5' : 'h-3 w-3')} aria-hidden />
      )}
      <span>{label}</span>
      {dist && !isLoading && !isUnknown && (
        <>
          <span className="opacity-40">·</span>
          <span className="opacity-70">{dist}</span>
        </>
      )}
    </span>
  )
}

/**
 * Larger commute badge for near-title placement.
 * Shows a navigation icon, time, and distance in an elegant pill.
 */
export function CommuteTitleBadge({
  commute,
  settings,
  className,
}: {
  commute: CommuteEstimate | null | undefined
  settings?: CommuteSettings
  className?: string
}) {
  if (!commute) return null

  const title = badgeTitle(commute, settings)
  const isLoading = !!commute.loading
  const isUnknown = commute.band === 'unknown'
  const tone =
    isUnknown && isLoading ? 'bg-line/60 text-ink-soft' : commuteBadgeTone(commute.band)
  const dist = formatDistance(commute.distanceMiles)

  let label: string
  if (isLoading) {
    label = 'Calculating…'
  } else if (commute.minutes == null) {
    label = 'No commute data'
  } else {
    label = formatCommuteMinutes(commute.minutes)
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold leading-tight transition-colors',
        tone,
        isLoading && 'animate-pulse',
        className,
      )}
      title={title}
    >
      <Navigation className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
      <span>{label}</span>
      {dist && !isLoading && !isUnknown && (
        <>
          <span className="opacity-40">·</span>
          <span className="font-normal opacity-70">{dist}</span>
        </>
      )}
    </span>
  )
}
