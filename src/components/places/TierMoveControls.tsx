import { ArrowDown, ArrowUp, Check, Layers } from 'lucide-react'
import type { PlaceTier, SavedPlace } from '../../domain/types'
import { motion } from '../../lib/motion'
import { cn } from '../../lib/utils'
import { BottomSheet } from '../ui/BottomSheet'
import { Button } from '../ui/Button'

export const TIER_MOVE_OPTIONS: {
  id: PlaceTier
  label: string
  short: string
  hint: string
  rail: string
  chip: string
  chipActive: string
}[] = [
  {
    id: 'dream',
    label: 'Dream',
    short: 'Dream',
    hint: 'Top of the list — a real contender',
    rail: 'bg-honey-soft text-[#8a5524]',
    chip: 'border-honey/40 text-[#8a5524]',
    chipActive: 'border-honey bg-honey text-white',
  },
  {
    id: 'strong',
    label: 'Strong yes',
    short: 'Strong',
    hint: 'Worth a closer look',
    rail: 'bg-sea/15 text-sea-deep',
    chip: 'border-sea/40 text-sea-deep',
    chipActive: 'border-sea-deep bg-sea-deep text-white',
  },
  {
    id: 'maybe',
    label: 'Maybe',
    short: 'Maybe',
    hint: 'Keep for later comparison',
    rail: 'bg-keep/15 text-keep',
    chip: 'border-keep/35 text-keep',
    chipActive: 'border-keep bg-keep text-white',
  },
  {
    id: 'pass',
    label: 'Pass',
    short: 'Pass',
    hint: 'Not the right fit right now',
    rail: 'bg-line/70 text-ink-soft',
    chip: 'border-line text-ink-soft',
    chipActive: 'border-ink bg-ink text-white',
  },
]

const TIER_INDEX: Record<PlaceTier, number> = {
  dream: 0,
  strong: 1,
  maybe: 2,
  pass: 3,
}

function neighborTier(current: PlaceTier): {
  up: PlaceTier | null
  down: PlaceTier | null
} {
  const i = TIER_INDEX[current]
  return {
    up: i > 0 ? TIER_MOVE_OPTIONS[i - 1]!.id : null,
    down: i < TIER_MOVE_OPTIONS.length - 1 ? TIER_MOVE_OPTIONS[i + 1]!.id : null,
  }
}

/**
 * Desktop: promote / demote one step + clickable tier rail.
 * Pointer-first, visible without opening a menu.
 */
export function DesktopTierMover({
  current,
  onMove,
  disabled,
}: {
  current: PlaceTier
  onMove: (tier: PlaceTier) => void
  disabled?: boolean
}) {
  const { up, down } = neighborTier(current)

  return (
    <div
      className="mt-2 space-y-1.5 border-t border-line/70 pt-2"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={disabled || !up}
          onClick={() => up && onMove(up)}
          className={cn(
            'inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-lg border border-line bg-folio/80 text-[11px] font-bold text-ink',
            motion.chip,
            (!up || disabled) && 'opacity-40',
          )}
          title={up ? `Promote to ${TIER_MOVE_OPTIONS[TIER_INDEX[up]]!.short}` : undefined}
          aria-label={up ? `Promote to ${TIER_MOVE_OPTIONS[TIER_INDEX[up]]!.label}` : 'Already top tier'}
        >
          <ArrowUp className="h-3.5 w-3.5" aria-hidden />
          Promote
        </button>
        <button
          type="button"
          disabled={disabled || !down}
          onClick={() => down && onMove(down)}
          className={cn(
            'inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-lg border border-line bg-folio/80 text-[11px] font-bold text-ink',
            motion.chip,
            (!down || disabled) && 'opacity-40',
          )}
          title={
            down
              ? `Demote to ${TIER_MOVE_OPTIONS[TIER_INDEX[down]]!.short}`
              : undefined
          }
          aria-label={
            down
              ? `Demote to ${TIER_MOVE_OPTIONS[TIER_INDEX[down]]!.label}`
              : 'Already bottom tier'
          }
        >
          <ArrowDown className="h-3.5 w-3.5" aria-hidden />
          Demote
        </button>
      </div>
      <div
        role="group"
        aria-label="Move to tier"
        className="grid grid-cols-4 gap-1"
      >
        {TIER_MOVE_OPTIONS.map((opt) => {
          const active = opt.id === current
          return (
            <button
              key={opt.id}
              type="button"
              disabled={disabled || active}
              onClick={() => onMove(opt.id)}
              className={cn(
                'rounded-lg border px-0.5 py-1.5 text-center text-[10px] font-bold leading-tight',
                motion.chip,
                active ? opt.chipActive : cn('bg-panel', opt.chip),
                disabled && 'opacity-50',
              )}
              aria-pressed={active}
              aria-label={
                active ? `Current tier: ${opt.label}` : `Move to ${opt.label}`
              }
            >
              {opt.short}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Mobile: thumb-reach control that opens the tier sheet. */
export function MobileTierMoveTrigger({
  onOpen,
  disabled,
}: {
  onOpen: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation()
        onOpen()
      }}
      className={cn(
        'mt-2 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-line bg-folio text-xs font-bold text-ink',
        motion.chip,
        disabled && 'opacity-50',
      )}
    >
      <Layers className="h-3.5 w-3.5 text-sea-deep" aria-hidden />
      Change tier
    </button>
  )
}

export function TierMoveSheet({
  open,
  place,
  onClose,
  onPick,
}: {
  open: boolean
  place: SavedPlace | null
  onClose: () => void
  onPick: (tier: PlaceTier) => void
}) {
  const title = place?.title?.trim() || 'Untitled place'
  const current = place?.tier ?? 'maybe'

  return (
    <BottomSheet
      open={open && Boolean(place)}
      onClose={onClose}
      title="Change tier"
      titleId="tier-move-sheet-title"
    >
      <div className="space-y-3 px-1 pb-2">
        <p className="text-sm text-ink-soft">
          Where should{' '}
          <span className="font-bold text-ink">{title}</span> sit on your Tier
          List?
        </p>
        <ul className="space-y-2">
          {TIER_MOVE_OPTIONS.map((opt) => {
            const active = opt.id === current
            return (
              <li key={opt.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (!active) onPick(opt.id)
                    else onClose()
                  }}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left',
                    motion.chip,
                    active
                      ? 'border-sea bg-sea/10 ring-2 ring-sea/20'
                      : 'border-line bg-panel hover:border-sea/50',
                  )}
                  aria-pressed={active}
                >
                  <span
                    className={cn(
                      'flex h-12 w-14 shrink-0 items-center justify-center rounded-xl text-sm font-bold',
                      opt.rail,
                    )}
                  >
                    {opt.short}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-lg font-semibold tracking-[-0.02em] text-ink">
                      {opt.label}
                    </span>
                    <span className="mt-0.5 block text-sm text-ink-soft">
                      {opt.hint}
                    </span>
                  </span>
                  {active ? (
                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sea text-white">
                      <Check className="h-4 w-4" strokeWidth={3} aria-hidden />
                    </span>
                  ) : null}
                </button>
              </li>
            )
          })}
        </ul>
        <Button
          type="button"
          variant="ghost"
          className="w-full min-h-11"
          onClick={onClose}
        >
          Cancel
        </Button>
      </div>
    </BottomSheet>
  )
}
