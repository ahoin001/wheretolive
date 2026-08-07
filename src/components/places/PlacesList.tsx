import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ArrowUp, LayoutList, Rows3 } from 'lucide-react'
import type { SavedPlace } from '../../domain/types'
import {
  groupPlacesByAdded,
  groupPlacesByTier,
  LIST_PAGE_SIZE,
  type PlaceListSection,
} from '../../domain/places/listGrouping'
import { motion } from '../../lib/motion'
import { cn } from '../../lib/utils'
import { Button } from '../ui/Button'

export type ListDensity = 'comfortable' | 'compact'
export type ListGroupMode = 'added' | 'tier'

type PlacesListProps = {
  places: SavedPlace[]
  groupBy: ListGroupMode
  /** Reset progressive reveal when this key changes (filters/sort). */
  resetKey: string
  density: ListDensity
  onDensityChange: (density: ListDensity) => void
  renderPlace: (place: SavedPlace, density: ListDensity) => ReactNode
}

function sliceGroupedSections<T>(
  sections: PlaceListSection<T>[],
  limit: number,
): { sections: PlaceListSection<T>[]; shown: number } {
  if (limit <= 0) return { sections: [], shown: 0 }
  let remaining = limit
  const out: PlaceListSection<T>[] = []
  for (const section of sections) {
    if (remaining <= 0) break
    const items = section.items.slice(0, remaining)
    if (items.length === 0) continue
    out.push({ ...section, items })
    remaining -= items.length
  }
  return { sections: out, shown: limit - remaining }
}

export function PlacesList({
  places,
  groupBy,
  resetKey,
  density,
  onDensityChange,
  renderPlace,
}: PlacesListProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [visibleCount, setVisibleCount] = useState(LIST_PAGE_SIZE)
  const [showTop, setShowTop] = useState(false)

  useEffect(() => {
    setVisibleCount(LIST_PAGE_SIZE)
  }, [resetKey])

  useEffect(() => {
    const onScroll = () => {
      setShowTop(window.scrollY > 480)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const allSections = useMemo(() => {
    if (groupBy === 'added') return groupPlacesByAdded(places)
    return groupPlacesByTier(places)
  }, [places, groupBy])

  const { sections, shown } = useMemo(
    () => sliceGroupedSections(allSections, visibleCount),
    [allSections, visibleCount],
  )

  const total = places.length
  const remaining = Math.max(0, total - shown)
  const nextChunk = Math.min(LIST_PAGE_SIZE, remaining)

  if (total === 0) return null

  return (
    <div ref={rootRef} className="min-w-0 space-y-3">
      <div className="sticky top-2 z-20 flex min-w-0 flex-wrap items-center gap-2 rounded-2xl border border-line bg-panel/95 px-3 py-2 shadow-[var(--shadow-soft)] backdrop-blur-md">
        <p className="min-w-0 flex-1 text-sm text-ink-soft">
          {shown < total ? (
            <>
              Showing{' '}
              <span className="font-bold tabular-nums text-ink">{shown}</span> of{' '}
              <span className="font-bold tabular-nums text-ink">{total}</span>
            </>
          ) : (
            <>
              <span className="font-bold tabular-nums text-ink">{total}</span>{' '}
              {total === 1 ? 'place' : 'places'}
            </>
          )}
        </p>
        <div
          role="group"
          aria-label="List density"
          className="inline-flex rounded-full border border-line bg-folio p-0.5"
        >
          <button
            type="button"
            aria-pressed={density === 'comfortable'}
            title="Comfortable cards"
            onClick={() => onDensityChange('comfortable')}
            className={cn(
              'inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-xs font-bold',
              motion.chip,
              density === 'comfortable'
                ? 'bg-sea text-white shadow-[var(--shadow-soft)]'
                : 'text-ink-soft hover:text-ink',
            )}
          >
            <Rows3 className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden sm:inline">Comfortable</span>
          </button>
          <button
            type="button"
            aria-pressed={density === 'compact'}
            title="Compact rows"
            onClick={() => onDensityChange('compact')}
            className={cn(
              'inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-xs font-bold',
              motion.chip,
              density === 'compact'
                ? 'bg-sea text-white shadow-[var(--shadow-soft)]'
                : 'text-ink-soft hover:text-ink',
            )}
          >
            <LayoutList className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden sm:inline">Compact</span>
          </button>
        </div>
      </div>

      <div className="space-y-5">
        {sections.map((section) => (
          <section key={section.key} className="min-w-0" aria-labelledby={`list-sec-${section.key}`}>
            <div className="sticky top-[3.25rem] z-10 -mx-0.5 mb-2 bg-mist/90 px-0.5 py-1.5 backdrop-blur-md">
              <div className="flex items-baseline justify-between gap-2">
                <h3
                  id={`list-sec-${section.key}`}
                  className="font-display text-base font-semibold tracking-[-0.02em] text-ink md:text-lg"
                >
                  {section.label}
                </h3>
                <span className="text-xs font-bold tabular-nums text-ink-soft">
                  {(() => {
                    const full =
                      allSections.find((s) => s.key === section.key)?.items
                        .length ?? section.items.length
                    return full > section.items.length
                      ? `${section.items.length} of ${full}`
                      : String(full)
                  })()}
                </span>
              </div>
            </div>
            <ul
              className={cn(
                density === 'compact' ? 'space-y-1.5' : 'space-y-2.5',
              )}
            >
              {section.items.map((place) => (
                <li key={place.id}>{renderPlace(place, density)}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {remaining > 0 ? (
        <div className="flex flex-col items-stretch gap-2 rounded-2xl border border-dashed border-line bg-folio/60 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-ink-soft">
            <span className="font-bold text-ink">{remaining}</span> more{' '}
            {remaining === 1 ? 'place' : 'places'} below
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="primary"
              className="h-11 min-h-11 flex-1 rounded-xl px-4 text-sm sm:flex-none"
              onClick={() => setVisibleCount((n) => n + LIST_PAGE_SIZE)}
            >
              Show {nextChunk} more
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="h-11 min-h-11 flex-1 rounded-xl px-4 text-sm sm:flex-none"
              onClick={() => setVisibleCount(total)}
            >
              Show all
            </Button>
          </div>
        </div>
      ) : null}

      {showTop ? (
        <button
          type="button"
          onClick={() => {
            const top =
              rootRef.current?.getBoundingClientRect().top ?? 0
            const y = window.scrollY + top - 12
            window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' })
          }}
          className={cn(
            'fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-30 inline-flex h-12 w-12 items-center justify-center rounded-full border border-line bg-panel text-ink shadow-[var(--shadow-lift)] md:bottom-6 md:right-6',
            motion.interactive,
          )}
          aria-label="Back to top of list"
          title="Back to top"
        >
          <ArrowUp className="h-5 w-5" />
        </button>
      ) : null}
    </div>
  )
}

/** Infer grouping from list sort — recently added uses date sections. */
export function listGroupModeForSort(
  sort: 'recent' | 'liked' | 'monthly_asc' | 'monthly_desc',
): ListGroupMode {
  return sort === 'recent' ? 'added' : 'tier'
}
