import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { CalendarDays, Check, ChevronDown } from 'lucide-react'
import {
  bucketSelected,
  buildAddedBuckets,
  DEFAULT_ADDED_FILTER,
  formatAddedFilterSummary,
  isAddedFilterActive,
  type AddedFilter,
} from '../../domain/places/addedDate'
import { motion } from '../../lib/motion'
import { cn } from '../../lib/utils'
import { Button } from '../ui/Button'

type PlaceStamp = { createdAt: string }

/**
 * Single “Added” filter: live buckets from place dates + optional custom range.
 * Matches CityFilterMenu placement (fixed panel under the trigger).
 */
export function AddedFilterMenu({
  places,
  value,
  onChange,
  className,
}: {
  places: PlaceStamp[]
  value: AddedFilter
  onChange: (next: AddedFilter) => void
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null)
  const [draftFrom, setDraftFrom] = useState('')
  const [draftTo, setDraftTo] = useState('')

  const buckets = buildAddedBuckets(places)
  const active = isAddedFilterActive(value)
  const summary = formatAddedFilterSummary(value)

  useEffect(() => {
    if (!open) return
    if (value.type === 'range') {
      setDraftFrom(value.from)
      setDraftTo(value.to)
    } else {
      setDraftFrom('')
      setDraftTo('')
    }
  }, [open, value])

  useEffect(() => {
    if (!open) return
    const place = () => {
      const el = buttonRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const menuH = Math.min(420, window.innerHeight - 24)
      const spaceBelow = window.innerHeight - r.bottom
      const openUp = spaceBelow < Math.min(menuH, 280) && r.top > spaceBelow
      setMenuStyle({
        position: 'fixed',
        left: Math.min(r.left, window.innerWidth - 304),
        width: Math.max(r.width, 280),
        maxHeight: menuH,
        zIndex: 90,
        ...(openUp
          ? { bottom: window.innerHeight - r.top + 6, top: 'auto' }
          : { top: r.bottom + 6, bottom: 'auto' }),
      })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const applyRange = () => {
    const from = draftFrom.trim()
    const to = draftTo.trim()
    if (!from && !to) {
      onChange(DEFAULT_ADDED_FILTER)
      setOpen(false)
      return
    }
    onChange({
      type: 'range',
      from: from || to,
      to: to || from,
    })
    setOpen(false)
  }

  const rangeActive = value.type === 'range'

  return (
    <div ref={rootRef} className={cn('relative min-w-0', className)}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex h-10 w-full min-w-0 max-w-full items-center gap-1.5 rounded-xl border bg-panel px-2.5 text-left text-sm font-bold text-ink md:h-8 md:max-w-[14rem] md:rounded-lg',
          motion.chip,
          active
            ? 'border-sea bg-sea/5 text-sea-deep'
            : 'border-line hover:border-sea',
        )}
      >
        <CalendarDays className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
        <span className="min-w-0 flex-1 truncate">{summary}</span>
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 shrink-0 text-ink-soft',
            motion.transform,
            open && 'rotate-180',
          )}
        />
      </button>

      {open && menuStyle ? (
        <div
          role="dialog"
          aria-label="Filter by date added"
          style={menuStyle}
          className="flex flex-col overflow-hidden rounded-xl border border-line bg-panel shadow-[var(--shadow-lift)]"
        >
          <div className="min-h-0 flex-1 overflow-y-auto py-1">
            <button
              type="button"
              onClick={() => {
                onChange(DEFAULT_ADDED_FILTER)
                setOpen(false)
              }}
              className={cn(
                'flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-bold hover:bg-folio',
                !active ? 'text-sea-deep' : 'text-ink',
              )}
            >
              <span
                className={cn(
                  'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                  !active
                    ? 'border-sea bg-sea text-white'
                    : 'border-line bg-panel',
                )}
              >
                {!active ? <Check className="h-3 w-3" /> : null}
              </span>
              Any time
            </button>

            {buckets.length > 0 ? (
              <>
                <p className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wide text-ink-soft">
                  When places were added
                </p>
                {buckets.map((bucket) => {
                  const on = bucketSelected(value, bucket)
                  return (
                    <button
                      key={bucket.id}
                      type="button"
                      onClick={() => {
                        onChange(on ? DEFAULT_ADDED_FILTER : bucket.filter)
                        setOpen(false)
                      }}
                      className={cn(
                        'flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-bold hover:bg-folio',
                        on ? 'text-sea-deep' : 'text-ink',
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                          on
                            ? 'border-sea bg-sea text-white'
                            : 'border-line bg-panel',
                        )}
                      >
                        {on ? <Check className="h-3 w-3" /> : null}
                      </span>
                      <span className="min-w-0 flex-1 truncate">
                        {bucket.label}
                      </span>
                      <span className="tabular-nums text-xs text-ink-soft">
                        {bucket.count}
                      </span>
                    </button>
                  )
                })}
              </>
            ) : (
              <p className="px-3 py-2 text-sm text-ink-soft">
                No saved places yet — dates show up here as you add them.
              </p>
            )}

            <div className="mt-1 border-t border-line px-3 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-ink-soft">
                Custom range
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="min-w-0">
                  <span className="mb-1 block text-xs font-bold text-ink-soft">
                    From
                  </span>
                  <input
                    type="date"
                    value={draftFrom}
                    onChange={(e) => setDraftFrom(e.target.value)}
                    className="h-10 w-full min-w-0 rounded-lg border border-line bg-folio px-2 text-sm font-bold text-ink"
                  />
                </label>
                <label className="min-w-0">
                  <span className="mb-1 block text-xs font-bold text-ink-soft">
                    To
                  </span>
                  <input
                    type="date"
                    value={draftTo}
                    onChange={(e) => setDraftTo(e.target.value)}
                    className="h-10 w-full min-w-0 rounded-lg border border-line bg-folio px-2 text-sm font-bold text-ink"
                  />
                </label>
              </div>
              <div className="mt-2.5 flex items-center gap-2">
                <Button
                  type="button"
                  variant={rangeActive ? 'primary' : 'secondary'}
                  className="h-9 min-h-9 flex-1 rounded-xl px-3 text-sm"
                  onClick={applyRange}
                  disabled={!draftFrom.trim() && !draftTo.trim()}
                >
                  Apply range
                </Button>
                {rangeActive ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-9 min-h-9 px-2.5 text-sm"
                    onClick={() => {
                      onChange(DEFAULT_ADDED_FILTER)
                      setDraftFrom('')
                      setDraftTo('')
                    }}
                  >
                    Clear
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
