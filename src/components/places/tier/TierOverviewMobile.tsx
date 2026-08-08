import { useEffect, useRef } from 'react'
import type { PlaceTier, SavedPlace } from '../../../domain/types'
import { cn } from '../../../lib/utils'
import { motion } from '../../../lib/motion'
import { placeImages, primaryCostLabel, TIERS, TIER_META } from './tierMeta'
import { CompactPets } from './TierTiles'

export function TierOverviewMobile({
  placesByTier,
  selectedIds,
  selectMode,
  activeTier,
  onActiveTierChange,
  onToggleSelect,
  onEdit,
}: {
  placesByTier: Record<PlaceTier, SavedPlace[]>
  selectedIds: string[]
  selectMode: boolean
  activeTier: PlaceTier
  onActiveTierChange: (tier: PlaceTier) => void
  onToggleSelect: (id: string) => void
  onEdit: (place: SavedPlace) => void
}) {
  const sectionRefs = useRef<Partial<Record<PlaceTier, HTMLElement | null>>>({})
  const activeTierRef = useRef(activeTier)
  activeTierRef.current = activeTier
  const activeMeta = TIER_META[activeTier]

  // Sticky cue follows whichever tier section is nearest the top of the viewport.
  useEffect(() => {
    const nodes = TIERS.map((tier) => sectionRefs.current[tier]).filter(
      (n): n is HTMLElement => Boolean(n),
    )
    if (!nodes.length) return

    const ratios = new Map<PlaceTier, number>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const tier = (entry.target as HTMLElement).dataset.tier as
            | PlaceTier
            | undefined
          if (!tier) continue
          ratios.set(tier, entry.isIntersecting ? entry.intersectionRatio : 0)
        }
        let best: PlaceTier | null = null
        let bestRatio = 0
        for (const tier of TIERS) {
          const r = ratios.get(tier) ?? 0
          if (r > bestRatio) {
            bestRatio = r
            best = tier
          }
        }
        if (bestRatio < 0.12) {
          let nearest: PlaceTier | null = null
          let nearestDist = Number.POSITIVE_INFINITY
          for (const tier of TIERS) {
            const el = sectionRefs.current[tier]
            if (!el) continue
            const top = el.getBoundingClientRect().top
            const dist = Math.abs(top - 96)
            if (top <= 140 && dist < nearestDist) {
              nearestDist = dist
              nearest = tier
            }
          }
          if (nearest) best = nearest
        }
        if (best && best !== activeTierRef.current) {
          onActiveTierChange(best)
        }
      },
      {
        root: null,
        rootMargin: '-72px 0px -45% 0px',
        threshold: [0, 0.15, 0.35, 0.55, 0.75],
      },
    )

    for (const node of nodes) observer.observe(node)
    return () => observer.disconnect()
  }, [onActiveTierChange, placesByTier])

  return (
    <div className="space-y-3">
      <div
        className={cn(
          'sticky top-0 z-20 -mx-1 mb-1 overflow-hidden rounded-2xl border border-line/80 px-3 py-2.5 shadow-[var(--shadow-soft)] backdrop-blur-md',
          activeMeta.wash,
          motion.color,
        )}
        role="status"
        aria-live="polite"
      >
        <div className="flex items-center gap-2.5">
          <span
            className={cn('h-8 w-1.5 shrink-0 rounded-full', activeMeta.accentBar)}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <p className={cn('font-display text-lg font-semibold leading-none', activeMeta.ink)}>
              {activeMeta.label}
            </p>
            <p className="mt-1 text-[11px] font-bold text-ink-soft">
              Scrolling overview · tap a row to open
            </p>
          </div>
          <span className={cn('text-xs font-bold tabular-nums', activeMeta.ink)}>
            {placesByTier[activeTier].length}
          </span>
        </div>
      </div>

      {TIERS.map((tier) => {
        const places = placesByTier[tier]
        const meta = TIER_META[tier]
        const isActive = activeTier === tier
        return (
          <section
            key={tier}
            id={`tier-overview-${tier}`}
            data-tier={tier}
            ref={(el) => {
              sectionRefs.current[tier] = el
            }}
            className={cn(
              'scroll-mt-28 overflow-hidden rounded-2xl border px-3 py-3',
              meta.wash,
              isActive ? 'border-line shadow-[var(--shadow-soft)]' : 'border-line/70',
            )}
            aria-label={`${meta.label}: ${places.length} places`}
          >
            <div className="mb-2.5 flex items-center gap-2">
              <span
                className={cn('h-5 w-1 shrink-0 rounded-full', meta.accentBar)}
                aria-hidden
              />
              <h3 className={cn('font-display text-base font-semibold', meta.ink)}>
                {meta.label}
              </h3>
              <span className="ml-auto text-xs font-bold tabular-nums text-ink-soft">
                {places.length === 0
                  ? 'Empty'
                  : `${places.length} ${places.length === 1 ? 'place' : 'places'}`}
              </span>
            </div>

            {places.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line/80 bg-panel/60 px-3 py-4 text-center text-sm text-ink-soft">
                {meta.emptyHint}
              </p>
            ) : (
              <ul className="space-y-1.5">
                {places.map((place) => {
                  const selected = selectedIds.includes(place.id)
                  const thumb = placeImages(place)[0]
                  const title = place.title || 'Untitled'
                  return (
                    <li key={place.id}>
                      <button
                        type="button"
                        onClick={() =>
                          selectMode
                            ? onToggleSelect(place.id)
                            : onEdit(place)
                        }
                        className={cn(
                          'flex w-full min-w-0 items-center gap-2.5 rounded-xl border bg-panel/95 px-2 py-2 text-left',
                          motion.press,
                          selectMode && selected
                            ? 'border-sea ring-2 ring-sea/25'
                            : 'border-line/80 hover:border-sea/50',
                        )}
                      >
                        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-folio">
                          {thumb ? (
                            <img
                              src={thumb}
                              alt=""
                              className="h-full w-full object-cover"
                              loading="lazy"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-[9px] font-bold text-ink-soft">
                              —
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-ink">
                            {title}
                          </p>
                          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-soft">
                            <span className="font-semibold text-ink">
                              {primaryCostLabel(place)}
                            </span>
                            <CompactPets pets={place.pets ?? 'no'} />
                          </p>
                        </div>
                        {selectMode ? (
                          <span
                            className={cn(
                              'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold',
                              selected
                                ? 'border-sea bg-sea text-white'
                                : 'border-line bg-panel text-transparent',
                            )}
                            aria-hidden
                          >
                            ✓
                          </span>
                        ) : null}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        )
      })}
    </div>
  )
}
