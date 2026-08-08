import type { PlaceTier, SavedPlace } from '../../../domain/types'
import { cn } from '../../../lib/utils'
import { motion } from '../../../lib/motion'
import { placeImages, primaryCostLabel, TIERS, TIER_META } from './tierMeta'
import { CompactPets } from './TierTiles'

export function TierOverviewMobile({
  placesByTier,
  selectedIds,
  selectMode,
  onToggleSelect,
  onEdit,
}: {
  placesByTier: Record<PlaceTier, SavedPlace[]>
  selectedIds: string[]
  selectMode: boolean
  onToggleSelect: (id: string) => void
  onEdit: (place: SavedPlace) => void
}) {
  return (
    <div className="space-y-5">
      {TIERS.map((tier) => {
        const places = placesByTier[tier]
        const meta = TIER_META[tier]
        return (
          <section
            key={tier}
            id={`tier-overview-${tier}`}
            className="scroll-mt-24"
            aria-label={`${meta.label}: ${places.length} places`}
          >
            <div className="mb-2 flex items-baseline justify-between gap-2 px-0.5">
              <h3 className="font-display text-base font-semibold text-ink">
                {meta.label}
              </h3>
              <span className="text-xs font-bold tabular-nums text-ink-soft">
                {places.length === 0
                  ? 'Empty'
                  : `${places.length} ${places.length === 1 ? 'place' : 'places'}`}
              </span>
            </div>

            {places.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line bg-folio/50 px-3 py-4 text-center text-sm text-ink-soft">
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
                          'flex w-full min-w-0 items-center gap-2.5 rounded-xl border bg-panel px-2 py-2 text-left',
                          motion.press,
                          selectMode && selected
                            ? 'border-sea ring-2 ring-sea/25'
                            : 'border-line hover:border-sea/50',
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
