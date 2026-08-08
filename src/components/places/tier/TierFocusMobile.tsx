import { AnimatePresence, motion as m } from 'motion/react'
import type { PlaceTier, SavedPlace } from '../../../domain/types'
import {
  isTierReviewActive,
  type TierReviewState,
} from '../../../domain/places/tierReview'
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'
import { tweenPanel, easeSnappy } from '../../../lib/motionPresets'
import { cn } from '../../../lib/utils'
import { motion } from '../../../lib/motion'
import { TIERS, TIER_META } from './tierMeta'
import {
  MobileTierChip,
  SortableBoardTile,
  SortableMobileRow,
  TierDropZone,
  TierReviewBar,
} from './TierTiles'

export function TierFocusMobile({
  mobileTier,
  items,
  byTier,
  reviews,
  selectedIds,
  selectMode,
  canDrag,
  reorderEnabled,
  activeIdPresent,
  onSelectTier,
  placesForTier,
  patchReview,
  resetReview,
  onToggleSelect,
  onEdit,
  onOpenLightbox,
  onRequestMoveTier,
}: {
  mobileTier: PlaceTier
  items: Record<PlaceTier, string[]>
  byTier: Record<PlaceTier, SavedPlace[]>
  reviews: Record<PlaceTier, TierReviewState>
  selectedIds: string[]
  selectMode: boolean
  canDrag: boolean
  reorderEnabled: boolean
  activeIdPresent: boolean
  onSelectTier: (tier: PlaceTier) => void
  placesForTier: (tier: PlaceTier) => SavedPlace[]
  patchReview: (tier: PlaceTier, patch: Partial<TierReviewState>) => void
  resetReview: (tier: PlaceTier) => void
  onToggleSelect: (id: string) => void
  onEdit: (place: SavedPlace) => void
  onOpenLightbox: (images: string[], index: number, title?: string) => void
  onRequestMoveTier: (placeId: string) => void
}) {
  const mobileBoardIds = items[mobileTier]
  const mobilePlaces = placesForTier(mobileTier)
  const mobileDisplayIds = mobilePlaces.map((p) => p.id)
  const mobileReview = reviews[mobileTier]
  const mobileReviewOn = isTierReviewActive(mobileReview)
  const meta = TIER_META[mobileTier]

  return (
    <div>
      <div
        className={cn(
          'sticky top-0 z-20 -mx-1 mb-3 overflow-hidden rounded-2xl border border-line/70 px-1.5 py-2 backdrop-blur-md',
          meta.wash,
          motion.color,
        )}
      >
        <div
          role="tablist"
          aria-label="Place tiers"
          className="grid grid-cols-4 gap-1.5"
        >
          {TIERS.map((tier) => {
            const count = items[tier].length
            const active = mobileTier === tier
            const chipMeta = TIER_META[tier]
            return (
              <MobileTierChip
                key={tier}
                tier={tier}
                active={active}
                count={count}
                meta={chipMeta}
                droppable={canDrag}
                onSelect={() => {
                  if (activeIdPresent) return
                  onSelectTier(tier)
                }}
              />
            )
          })}
        </div>
        {reorderEnabled && !selectMode ? (
          <p className="mt-1.5 text-center text-[11px] text-ink-soft">
            <span className="font-bold text-ink">Change tier</span> to move a
            place, or press and hold the grip to drag onto a tier chip.
          </p>
        ) : null}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <m.div
          key={mobileTier}
          role="tabpanel"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0, transition: tweenPanel }}
          exit={{
            opacity: 0,
            y: -4,
            transition: { duration: 0.14, ease: easeSnappy },
          }}
          className={cn(
            'relative overflow-hidden rounded-2xl border border-line/80 px-2.5 py-3',
            meta.wash,
          )}
        >
          <span
            className={cn(
              'absolute inset-y-3 left-0 w-1 rounded-r-full',
              meta.accentBar,
            )}
            aria-hidden
          />
          <div className="mb-2.5 flex items-baseline justify-between gap-2 pl-2">
            <h3 className={cn('font-display text-lg font-semibold', meta.ink)}>
              {meta.label}
            </h3>
            <span className="text-xs font-bold text-ink-soft">
              {mobileBoardIds.length === 0
                ? 'Empty'
                : mobileReviewOn
                  ? `${mobilePlaces.length} of ${mobileBoardIds.length}`
                  : `${mobilePlaces.length} ${
                      mobilePlaces.length === 1 ? 'place' : 'places'
                    }`}
            </span>
          </div>

          {mobileBoardIds.length > 0 ? (
            <TierReviewBar
              tier={mobileTier}
              placesInTier={byTier[mobileTier]}
              state={mobileReview}
              onChange={(patch) => patchReview(mobileTier, patch)}
              onReset={() => resetReview(mobileTier)}
              className="mb-2.5"
            />
          ) : null}

          <div
            className={cn(
              mobilePlaces.length === 0 &&
                'rounded-2xl border border-dashed border-line/80 bg-panel/55 px-4 py-10 text-center',
            )}
          >
            <SortableContext
              items={mobileDisplayIds}
              strategy={rectSortingStrategy}
              disabled={!canDrag}
            >
              {mobileBoardIds.length === 0 ? (
                <TierDropZone
                  tier={mobileTier}
                  empty
                  className="min-h-[4.5rem] py-6"
                >
                  <p className="text-sm font-bold text-ink-soft">
                    {TIER_META[mobileTier].emptyHint}
                  </p>
                </TierDropZone>
              ) : mobilePlaces.length === 0 ? (
                <p className="text-sm font-bold text-ink-soft">
                  No places match this tier’s temporary filters.
                </p>
              ) : (
                <ul
                  className={cn(
                    mobilePlaces.length <= 2
                      ? 'space-y-2.5'
                      : 'grid grid-cols-2 gap-2.5',
                  )}
                >
                  {mobilePlaces.map((place) => (
                    <li key={place.id} className="min-w-0">
                      {mobilePlaces.length <= 2 ? (
                        <SortableMobileRow
                          place={place}
                          selected={selectedIds.includes(place.id)}
                          selectMode={selectMode}
                          canDrag={canDrag}
                          canMoveTier={reorderEnabled && !selectMode}
                          onToggleSelect={() => onToggleSelect(place.id)}
                          onEdit={() => onEdit(place)}
                          onOpenLightbox={onOpenLightbox}
                          onRequestMoveTier={() =>
                            onRequestMoveTier(place.id)
                          }
                        />
                      ) : (
                        <SortableBoardTile
                          place={place}
                          selected={selectedIds.includes(place.id)}
                          selectMode={selectMode}
                          density="mobile"
                          canDrag={canDrag}
                          canMoveTier={reorderEnabled && !selectMode}
                          onActivate={() =>
                            selectMode
                              ? onToggleSelect(place.id)
                              : onEdit(place)
                          }
                          onOpenLightbox={onOpenLightbox}
                          onRequestMoveTier={() =>
                            onRequestMoveTier(place.id)
                          }
                        />
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </SortableContext>
          </div>
        </m.div>
      </AnimatePresence>
    </div>
  )
}
