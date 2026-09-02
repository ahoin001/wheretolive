import { Car } from 'lucide-react'
import {
  commuteBadgeLabel,
  commuteBadgeTitle,
  commuteBadgeTone,
  type CommuteEstimate,
} from '../../domain/places/commute'
import type { CommuteSettings } from '../../domain/types'
import { cn } from '../../lib/utils'

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

  const label = commuteBadgeLabel(commute)
  const title = commuteBadgeTitle(commute, settings)
  const tone = commute.band === 'unknown' && commute.loading
    ? 'bg-line/60 text-ink-soft'
    : commuteBadgeTone(commute.band)

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full font-bold leading-none',
        compact ? 'px-2 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]',
        tone,
        commute.loading && 'animate-pulse',
        className,
      )}
      title={title}
    >
      {showIcon ? <Car className="h-3 w-3 shrink-0 opacity-80" aria-hidden /> : null}
      <span>{label}</span>
    </span>
  )
}
