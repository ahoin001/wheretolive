import { useEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent, type ReactNode } from 'react'
import { Check, ChevronRight, ExternalLink, GripVertical } from 'lucide-react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { AnimatePresence, motion as m } from 'motion/react'
import type { PetsPolicy, PlaceTier, SavedPlace } from '../../domain/types'
import { PLACE_SQFT_FILTER_OPTIONS } from '../../domain/types'
import {
  findBoardContainer,
  groupPlacesByTier,
  itemsByTierFromPlaces,
  movePlaceToTier,
  relocateBoardItem,
  type BoardPlacement,
} from '../../domain/places/boardOrder'
import {
  applyTierReview,
  citiesInPlaces,
  DEFAULT_TIER_REVIEW,
  isTierReviewActive,
  TIER_BOARD_SORT_OPTIONS,
  type TierReviewState,
} from '../../domain/places/tierReview'
import { formatMoney } from '../../domain/finance/calculations'
import { motion } from '../../lib/motion'
import { tweenPanel, easeSnappy } from '../../lib/motionPresets'
import { cn } from '../../lib/utils'
import { OpenableImage } from './ImageLightbox'
import {
  DesktopTierMover,
  MobileTierMoveTrigger,
  TierMoveSheet,
} from './TierMoveControls'

function emptyReviews(): Record<PlaceTier, TierReviewState> {
  return {
    dream: { ...DEFAULT_TIER_REVIEW },
    strong: { ...DEFAULT_TIER_REVIEW },
    maybe: { ...DEFAULT_TIER_REVIEW },
    pass: { ...DEFAULT_TIER_REVIEW },
  }
}

const TIERS: PlaceTier[] = ['dream', 'strong', 'maybe', 'pass']

const TIER_META: Record<
  PlaceTier,
  {
    label: string
    short: string
    rail: string
    chip: string
    chipActive: string
    emptyHint: string
  }
> = {
  dream: {
    label: 'Dream',
    short: 'Dream',
    rail: 'bg-honey-soft text-[#8a5524]',
    chip: 'border-honey/35 text-[#8a5524]',
    chipActive: 'border-honey bg-honey text-white shadow-[var(--shadow-soft)]',
    emptyHint: 'Drop places here',
  },
  strong: {
    label: 'Strong yes',
    short: 'Strong',
    rail: 'bg-sea/15 text-sea-deep',
    chip: 'border-sea/40 text-sea-deep',
    chipActive: 'border-sea-deep bg-sea-deep text-white shadow-[var(--shadow-soft)]',
    emptyHint: 'Drop places here',
  },
  maybe: {
    label: 'Maybe',
    short: 'Maybe',
    rail: 'bg-keep/15 text-keep',
    chip: 'border-keep/35 text-keep',
    chipActive: 'border-keep bg-keep text-white shadow-[var(--shadow-soft)]',
    emptyHint: 'Drop places here',
  },
  pass: {
    label: 'Pass',
    short: 'Pass',
    rail: 'bg-line/70 text-ink-soft',
    chip: 'border-line text-ink-soft',
    chipActive: 'border-ink bg-ink text-white shadow-[var(--shadow-soft)]',
    emptyHint: 'Drop places here',
  },
}

const PETS_LABEL: Record<PetsPolicy, string> = {
  yes: 'Pets OK',
  limited: 'Pets limited',
  no: 'No pets',
}

function placeImages(place: SavedPlace): string[] {
  return Array.isArray(place.images) ? place.images.filter(Boolean) : []
}

function primaryCostLabel(place: SavedPlace): string {
  if (place.listingKind === 'rent') {
    return place.monthlyEstimate != null
      ? `${formatMoney(place.monthlyEstimate)}/mo`
      : 'Rent not set'
  }
  if (place.price != null) return formatMoney(place.price)
  return 'Price not set'
}

function CompactPets({ pets }: { pets: PetsPolicy }) {
  const tone =
    pets === 'yes'
      ? 'bg-move/15 text-move'
      : pets === 'limited'
        ? 'bg-honey-soft text-honey'
        : 'bg-warn/15 text-warn'

  return (
    <span
      className={cn(
        'inline-flex shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none',
        tone,
      )}
    >
      {PETS_LABEL[pets]}
    </span>
  )
}

/** Opens the listing in a new tab without triggering card edit / drag. */
function OpenListingControl({
  url,
  variant,
}: {
  url: string
  variant: 'photo' | 'row'
}) {
  const href = url.trim()
  if (!href) return null

  const shared = {
    href,
    target: '_blank' as const,
    rel: 'noreferrer',
    onClick: (e: MouseEvent) => e.stopPropagation(),
    onPointerDown: (e: PointerEvent) => e.stopPropagation(),
  }

  if (variant === 'photo') {
    return (
      <a
        {...shared}
        className={cn(
          'absolute right-2 top-2 z-10 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-line/80 bg-panel/95 text-ink shadow-sm',
          motion.chip,
        )}
        aria-label="Open listing"
        title="Open listing"
      >
        <ExternalLink className="h-4 w-4" aria-hidden />
      </a>
    )
  }

  return (
    <a
      {...shared}
      className={cn(
        'mt-2 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-sea/30 bg-sea/10 text-xs font-bold text-sea-deep',
        motion.chip,
      )}
    >
      <ExternalLink className="h-3.5 w-3.5" aria-hidden />
      Open listing
    </a>
  )
}

function tierDropId(tier: PlaceTier): string {
  return `tier:${tier}`
}

type TierBoardProps = {
  places: SavedPlace[]
  selectMode: boolean
  selectedIds: string[]
  /** When false (filters on), dragging is disabled so hidden places stay stable. */
  reorderEnabled?: boolean
  onToggleSelect: (id: string) => void
  onEdit: (place: SavedPlace) => void
  onOpenLightbox: (images: string[], index: number, title?: string) => void
  onReorder: (placements: BoardPlacement[]) => void
}

export function TierBoard({
  places,
  selectMode,
  selectedIds,
  reorderEnabled = true,
  onToggleSelect,
  onEdit,
  onOpenLightbox,
  onReorder,
}: TierBoardProps) {
  const byTier = useMemo(() => groupPlacesByTier(places), [places])

  const [items, setItems] = useState<Record<PlaceTier, string[]>>(() =>
    itemsByTierFromPlaces(places),
  )
  /** Always mirrors latest items — drag handlers must not read stale closures. */
  const itemsRef = useRef(items)
  itemsRef.current = items

  /** Per-tier temporary review — never written to boardOrder. */
  const [reviews, setReviews] =
    useState<Record<PlaceTier, TierReviewState>>(emptyReviews)

  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(min-width: 768px)').matches
      : true,
  )
  const isDesktopRef = useRef(isDesktop)
  isDesktopRef.current = isDesktop

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const onChange = () => setIsDesktop(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const [activeId, setActiveId] = useState<string | null>(null)
  const activeIdRef = useRef<string | null>(null)
  activeIdRef.current = activeId

  // Breakpoint flips remount the board layout — abort any in-flight drag cleanly.
  useEffect(() => {
    if (!activeIdRef.current) return
    setActiveId(null)
    const next = itemsByTierFromPlaces(places)
    itemsRef.current = next
    setItems(next)
    // places intentionally omitted: only react to layout mode changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDesktop])

  // Sync from props only when not mid-drag (avoids wiping live preview / double IDs).
  useEffect(() => {
    if (activeIdRef.current) return
    const next = itemsByTierFromPlaces(places)
    setItems(next)
    itemsRef.current = next
  }, [places])

  // Drop city filters that no longer exist in a tier’s places
  useEffect(() => {
    setReviews((prev) => {
      let changed = false
      const next = { ...prev }
      for (const tier of TIERS) {
        const key = prev[tier].cityKey
        if (!key) continue
        const cities = citiesInPlaces(byTier[tier])
        if (!cities.some((c) => c.key === key)) {
          next[tier] = { ...prev[tier], cityKey: '' }
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [byTier])

  const placeById = useMemo(() => {
    const map = new Map<string, SavedPlace>()
    for (const p of places) map.set(p.id, p)
    return map
  }, [places])

  const reviewActiveAnywhere = TIERS.some((tier) =>
    isTierReviewActive(reviews[tier]),
  )
  const canDrag = reorderEnabled && !selectMode && !reviewActiveAnywhere

  const placesForTier = (tier: PlaceTier): SavedPlace[] => {
    const ordered = items[tier]
      .map((id) => placeById.get(id))
      .filter((p): p is SavedPlace => Boolean(p))
    return applyTierReview(ordered, reviews[tier])
  }

  const patchReview = (tier: PlaceTier, patch: Partial<TierReviewState>) => {
    setReviews((prev) => ({
      ...prev,
      [tier]: { ...prev[tier], ...patch },
    }))
  }

  const resetReview = (tier: PlaceTier) => {
    setReviews((prev) => ({
      ...prev,
      [tier]: { ...DEFAULT_TIER_REVIEW },
    }))
  }

  const resetAllReviews = () => setReviews(emptyReviews())

  const firstPopulated = useMemo(
    () => TIERS.find((tier) => byTier[tier].length > 0) ?? 'dream',
    [byTier],
  )

  const [mobileTier, setMobileTier] = useState<PlaceTier>(firstPopulated)
  const [movingPlaceId, setMovingPlaceId] = useState<string | null>(null)

  useEffect(() => {
    if (activeIdRef.current) return
    if (byTier[mobileTier].length === 0 && places.length > 0) {
      setMobileTier(firstPopulated)
    }
  }, [byTier, firstPopulated, mobileTier, places.length])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 220, tolerance: 8 },
    }),
  )

  const activePlace = activeId ? placeById.get(activeId) ?? null : null
  const movingPlace = movingPlaceId
    ? placeById.get(movingPlaceId) ?? null
    : null

  const resetItemsFromPlaces = () => {
    const next = itemsByTierFromPlaces(places)
    itemsRef.current = next
    setItems(next)
  }

  const commitMoveToTier = (placeId: string, tier: PlaceTier) => {
    const placements = movePlaceToTier(places, placeId, tier)
    if (placements) onReorder(placements)
    setMovingPlaceId(null)
    if (placements) setMobileTier(tier)
  }

  const commitFromItems = (next: Record<PlaceTier, string[]>) => {
    const placements: BoardPlacement[] = []
    for (const tier of TIERS) {
      next[tier].forEach((id, boardOrder) => {
        placements.push({ id, tier, boardOrder })
      })
    }
    const changed = placements.filter((p) => {
      const cur = placeById.get(p.id)
      if (!cur) return false
      return cur.tier !== p.tier || (cur.boardOrder ?? 0) !== p.boardOrder
    })
    if (changed.length) onReorder(changed)
  }

  const onDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id))
  }

  const onDragOver = (event: DragOverEvent) => {
    // Mobile shows one tier at a time. Live-relocating would unmount the
    // drag source before drop — keep preview local and commit on drag end.
    if (!isDesktopRef.current) return

    const { active, over } = event
    if (!over) return

    const activeIdStr = String(active.id)
    const overIdStr = String(over.id)

    // Functional update + ref so rapid cross-tier events never use stale lists.
    setItems((prev) => {
      const relocated = relocateBoardItem(prev, activeIdStr, overIdStr)
      if (!relocated) return prev
      itemsRef.current = relocated
      return relocated
    })
  }

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    const current = itemsRef.current
    setActiveId(null)

    if (!over) {
      resetItemsFromPlaces()
      return
    }

    const activeIdStr = String(active.id)
    const overIdStr = String(over.id)
    const activeContainer = findBoardContainer(current, activeIdStr)
    const overContainer = findBoardContainer(current, overIdStr)

    if (!activeContainer || !overContainer) {
      resetItemsFromPlaces()
      return
    }

    let next = current

    if (activeContainer === overContainer) {
      const list = current[activeContainer]
      const oldIndex = list.indexOf(activeIdStr)
      const newIndex = overIdStr.startsWith('tier:')
        ? list.length - 1
        : list.indexOf(overIdStr)
      if (oldIndex >= 0 && newIndex >= 0 && oldIndex !== newIndex) {
        next = {
          ...current,
          [activeContainer]: arrayMove(list, oldIndex, newIndex),
        }
        itemsRef.current = next
        setItems(next)
      }
    } else {
      // Cross-tier preview may have missed the final over target — apply once more.
      const relocated = relocateBoardItem(current, activeIdStr, overIdStr)
      if (relocated) {
        next = relocated
        itemsRef.current = next
        setItems(next)
      }
    }

    const destTier = findBoardContainer(next, activeIdStr)
    if (destTier) setMobileTier(destTier)

    commitFromItems(next)
  }

  const onDragCancel = () => {
    setActiveId(null)
    resetItemsFromPlaces()
  }

  const mobileBoardIds = items[mobileTier]
  const mobilePlaces = placesForTier(mobileTier)
  const mobileDisplayIds = mobilePlaces.map((p) => p.id)
  const mobileReview = reviews[mobileTier]
  const mobileReviewOn = isTierReviewActive(mobileReview)

  return (
    <div className="min-w-0 space-y-3">
      {reviewActiveAnywhere ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-honey/35 bg-honey-soft/70 px-3 py-2">
          <p className="text-xs text-ink-soft md:text-sm">
            Temporary review is on — your dragged order stays saved. Reset to
            drag again.
          </p>
          <button
            type="button"
            className="shrink-0 text-xs font-bold text-sea-deep"
            onClick={resetAllReviews}
          >
            Reset all
          </button>
        </div>
      ) : !reorderEnabled && !selectMode ? (
        <p className="text-xs text-ink-soft md:text-sm">
          Clear list filters to rearrange the Tier List.
        </p>
      ) : canDrag ? (
        <p className="hidden text-xs text-ink-soft md:block">
          Promote or demote with the buttons on each place, click a tier chip to
          jump, or drag to rearrange left to right.
        </p>
      ) : null}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={canDrag ? onDragStart : undefined}
        onDragOver={canDrag ? onDragOver : undefined}
        onDragEnd={canDrag ? onDragEnd : undefined}
        onDragCancel={canDrag ? onDragCancel : undefined}
      >
        {/*
          Mount only one layout. CSS-hiding both registered the same sortable
          and droppable IDs twice — measuring the hidden node put the overlay
          at the top of the viewport and broke later drags.
        */}
        {!isDesktop ? (
          <div>
            <div className="sticky top-0 z-20 -mx-1 mb-3 bg-mist/90 px-1 py-2 backdrop-blur-md">
              <div
                role="tablist"
                aria-label="Place tiers"
                className="grid grid-cols-4 gap-1.5"
              >
                {TIERS.map((tier) => {
                  const count = items[tier].length
                  const active = mobileTier === tier
                  const meta = TIER_META[tier]
                  return (
                    <MobileTierChip
                      key={tier}
                      tier={tier}
                      active={active}
                      count={count}
                      meta={meta}
                      droppable={canDrag}
                      onSelect={() => {
                        // Never commit while dragging — droppable + onDragEnd own that.
                        if (activeIdRef.current) return
                        setMobileTier(tier)
                      }}
                    />
                  )
                })}
              </div>
              {reorderEnabled && !selectMode ? (
                <p className="mt-1.5 text-center text-[11px] text-ink-soft">
                  Tap <span className="font-bold text-ink">Change tier</span> on a
                  place — or press and hold to drag onto a tier chip.
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
              >
                <div className="mb-2.5 flex items-baseline justify-between gap-2 px-0.5">
                  <h3 className="font-display text-lg font-semibold text-ink">
                    {TIER_META[mobileTier].label}
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
                      'rounded-2xl border border-dashed border-line bg-folio/50 px-4 py-10 text-center',
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
                                  setMovingPlaceId(place.id)
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
                                  setMovingPlaceId(place.id)
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
        ) : (
          <div className="min-w-0 overflow-hidden rounded-2xl border border-line bg-panel shadow-[var(--shadow-soft)]">
            {TIERS.map((tier, index) => {
              const ids = items[tier]
              const boardPlacesInTier = ids
                .map((id) => placeById.get(id))
                .filter((p): p is SavedPlace => Boolean(p))
              const placesInTier = applyTierReview(
                boardPlacesInTier,
                reviews[tier],
              )
              const displayIds = placesInTier.map((p) => p.id)
              const reviewOn = isTierReviewActive(reviews[tier])
              const empty = boardPlacesInTier.length === 0
              const filteredEmpty = !empty && placesInTier.length === 0
              const meta = TIER_META[tier]
              return (
                <section
                  key={tier}
                  className={cn(
                    'grid min-w-0 grid-cols-[5.5rem_minmax(0,1fr)] lg:grid-cols-[7rem_minmax(0,1fr)]',
                    index > 0 && 'border-t border-line',
                  )}
                  aria-label={`${meta.label}: ${placesInTier.length} places`}
                >
                  <div
                    className={cn(
                      'flex min-w-0 flex-col items-center justify-center gap-1 px-1.5 py-4 text-center lg:px-2',
                      meta.rail,
                      empty && 'py-3 opacity-70',
                    )}
                  >
                    <p className="font-display text-sm font-semibold leading-tight tracking-[-0.02em] lg:text-lg">
                      {meta.short}
                    </p>
                    <p className="text-[11px] font-bold tabular-nums opacity-80">
                      {empty
                        ? '—'
                        : reviewOn
                          ? `${placesInTier.length}/${boardPlacesInTier.length}`
                          : placesInTier.length}
                    </p>
                  </div>

                  <TierDropZone
                    tier={tier}
                    empty={empty}
                    className={cn(
                      'min-w-0 overflow-hidden bg-mist/40',
                      empty ? 'min-h-[4.5rem] px-4 py-3' : 'p-3 lg:p-3.5',
                    )}
                  >
                    <SortableContext
                      items={displayIds}
                      strategy={rectSortingStrategy}
                      disabled={!canDrag}
                    >
                      {empty ? (
                        <p className="text-sm text-ink-soft">{meta.emptyHint}</p>
                      ) : (
                        <div className="space-y-2.5">
                          <TierReviewBar
                            tier={tier}
                            placesInTier={byTier[tier]}
                            state={reviews[tier]}
                            onChange={(patch) => patchReview(tier, patch)}
                            onReset={() => resetReview(tier)}
                          />
                          {filteredEmpty ? (
                            <p className="text-sm text-ink-soft">
                              No places match this temporary review.
                            </p>
                          ) : (
                            <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,10.5rem),1fr))] gap-2.5">
                              {placesInTier.map((place) => (
                                <li key={place.id} className="min-w-0">
                                  <SortableBoardTile
                                    place={place}
                                    selected={selectedIds.includes(place.id)}
                                    selectMode={selectMode}
                                    density="desktop"
                                    canDrag={canDrag}
                                    canMoveTier={
                                      reorderEnabled && !selectMode
                                    }
                                    onActivate={() =>
                                      selectMode
                                        ? onToggleSelect(place.id)
                                        : onEdit(place)
                                    }
                                    onOpenLightbox={onOpenLightbox}
                                    onMoveTier={(nextTier) =>
                                      commitMoveToTier(place.id, nextTier)
                                    }
                                  />
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </SortableContext>
                  </TierDropZone>
                </section>
              )
            })}
          </div>
        )}

        <DragOverlay dropAnimation={null}>
          {activePlace ? (
            <div className="w-[11rem] rotate-1 scale-[1.03] opacity-95 shadow-[var(--shadow-lift)]">
              <BoardTile
                place={activePlace}
                selected={false}
                selectMode={false}
                density="desktop"
                dragging
                onActivate={() => undefined}
                onOpenLightbox={() => undefined}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <TierMoveSheet
        open={Boolean(movingPlace)}
        place={movingPlace}
        onClose={() => setMovingPlaceId(null)}
        onPick={(tier) => {
          if (movingPlace) commitMoveToTier(movingPlace.id, tier)
        }}
      />
    </div>
  )
}

function TierReviewBar({
  tier,
  placesInTier,
  state,
  onChange,
  onReset,
  className,
}: {
  tier: PlaceTier
  placesInTier: SavedPlace[]
  state: TierReviewState
  onChange: (patch: Partial<TierReviewState>) => void
  onReset: () => void
  className?: string
}) {
  const cities = citiesInPlaces(placesInTier)
  const active = isTierReviewActive(state)
  const selectClass =
    'h-8 min-w-0 max-w-full rounded-lg border border-line bg-panel px-2 text-xs font-bold text-ink'

  return (
    <div
      className={cn(
        'flex min-w-0 flex-wrap items-end gap-2 rounded-xl border border-line/80 bg-panel/80 px-2 py-2',
        active && 'border-honey/40 bg-honey-soft/40',
        className,
      )}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <label className="flex min-w-[7.5rem] flex-1 flex-col gap-0.5 sm:max-w-[11rem]">
        <span className="text-[10px] font-bold uppercase tracking-wide text-ink-soft">
          Sort
        </span>
        <select
          aria-label={`${TIER_META[tier].label} sort`}
          className={selectClass}
          value={state.sort}
          onChange={(e) =>
            onChange({ sort: e.target.value as TierReviewState['sort'] })
          }
        >
          {TIER_BOARD_SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex min-w-[6.5rem] flex-1 flex-col gap-0.5 sm:max-w-[10rem]">
        <span className="text-[10px] font-bold uppercase tracking-wide text-ink-soft">
          City
        </span>
        <select
          aria-label={`${TIER_META[tier].label} city filter`}
          className={selectClass}
          value={state.cityKey}
          onChange={(e) => onChange({ cityKey: e.target.value })}
          disabled={cities.length === 0}
        >
          <option value="">All cities</option>
          {cities.map((city) => (
            <option key={city.key} value={city.key}>
              {city.label} ({city.count})
            </option>
          ))}
        </select>
      </label>

      <label className="flex min-w-[6.5rem] flex-1 flex-col gap-0.5 sm:max-w-[10rem]">
        <span className="text-[10px] font-bold uppercase tracking-wide text-ink-soft">
          Sqft
        </span>
        <select
          aria-label={`${TIER_META[tier].label} sqft filter`}
          className={selectClass}
          value={state.sqftFilter}
          onChange={(e) => onChange({ sqftFilter: e.target.value })}
        >
          <option value="all">Any</option>
          {PLACE_SQFT_FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      {active ? (
        <button
          type="button"
          className="mb-0.5 h-8 shrink-0 rounded-lg px-2 text-xs font-bold text-sea-deep hover:bg-folio"
          onClick={onReset}
        >
          Your order
        </button>
      ) : null}
    </div>
  )
}

function TierDropZone({
  tier,
  empty,
  className,
  children,
}: {
  tier: PlaceTier
  empty: boolean
  className?: string
  children: ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: tierDropId(tier) })
  return (
    <div
      ref={setNodeRef}
      className={cn(
        className,
        isOver && empty && 'ring-2 ring-inset ring-sea/40',
        isOver && !empty && 'bg-sea/5',
      )}
    >
      {children}
    </div>
  )
}

function MobileTierChip({
  tier,
  active,
  count,
  meta,
  droppable,
  onSelect,
}: {
  tier: PlaceTier
  active: boolean
  count: number
  meta: (typeof TIER_META)[PlaceTier]
  droppable: boolean
  onSelect: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: tierDropId(tier),
    disabled: !droppable,
  })
  return (
    <button
      ref={setNodeRef}
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onSelect}
      className={cn(
        'flex flex-col items-center justify-center gap-0.5 rounded-xl border px-1 py-2',
        motion.chip,
        active ? meta.chipActive : cn('bg-panel', meta.chip),
        isOver && 'ring-2 ring-sea ring-offset-1',
      )}
    >
      <span className="text-[11px] font-bold leading-none">{meta.short}</span>
      <span
        className={cn(
          'text-[10px] font-bold tabular-nums leading-none',
          active ? 'text-white/85' : 'text-ink-soft',
        )}
      >
        {count}
      </span>
    </button>
  )
}

function SortableBoardTile({
  place,
  selected,
  selectMode,
  density,
  canDrag,
  canMoveTier,
  onActivate,
  onOpenLightbox,
  onMoveTier,
  onRequestMoveTier,
}: {
  place: SavedPlace
  selected: boolean
  selectMode: boolean
  density: 'mobile' | 'desktop'
  canDrag: boolean
  canMoveTier: boolean
  onActivate: () => void
  onOpenLightbox: (images: string[], index: number, title?: string) => void
  onMoveTier?: (tier: PlaceTier) => void
  onRequestMoveTier?: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: place.id,
    disabled: !canDrag,
    animateLayoutChanges: () => false,
  })

  const style = {
    transform: isDragging ? undefined : CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn('relative', isDragging && 'opacity-40')}
    >
      {canDrag ? (
        <button
          type="button"
          className="absolute left-1 top-1 z-20 flex h-8 w-8 items-center justify-center rounded-lg bg-panel/90 text-ink-soft shadow-sm touch-none"
          aria-label={`Drag ${place.title || 'place'}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      ) : null}
      <BoardTile
        place={place}
        selected={selected}
        selectMode={selectMode}
        density={density}
        canMoveTier={canMoveTier}
        onActivate={onActivate}
        onOpenLightbox={onOpenLightbox}
        onMoveTier={onMoveTier}
        onRequestMoveTier={onRequestMoveTier}
      />
    </div>
  )
}

function SortableMobileRow({
  place,
  selected,
  selectMode,
  canDrag,
  canMoveTier,
  onToggleSelect,
  onEdit,
  onOpenLightbox,
  onRequestMoveTier,
}: {
  place: SavedPlace
  selected: boolean
  selectMode: boolean
  canDrag: boolean
  canMoveTier: boolean
  onToggleSelect: () => void
  onEdit: () => void
  onOpenLightbox: (images: string[], index: number, title?: string) => void
  onRequestMoveTier: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: place.id,
    disabled: !canDrag,
    animateLayoutChanges: () => false,
  })

  const style = {
    transform: isDragging ? undefined : CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn('relative', isDragging && 'opacity-40')}
    >
      {canDrag ? (
        <button
          type="button"
          className="absolute left-2 top-2 z-20 flex h-9 w-9 items-center justify-center rounded-lg bg-panel/95 text-ink-soft shadow-sm touch-none"
          aria-label={`Drag ${place.title || 'place'}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      ) : null}
      <MobileRowCard
        place={place}
        selected={selected}
        selectMode={selectMode}
        canMoveTier={canMoveTier}
        onToggleSelect={onToggleSelect}
        onEdit={onEdit}
        onOpenLightbox={onOpenLightbox}
        onRequestMoveTier={onRequestMoveTier}
      />
    </div>
  )
}

function BoardTile({
  place,
  selected,
  selectMode,
  density,
  dragging = false,
  canMoveTier = false,
  onActivate,
  onOpenLightbox,
  onMoveTier,
  onRequestMoveTier,
}: {
  place: SavedPlace
  selected: boolean
  selectMode: boolean
  density: 'mobile' | 'desktop'
  dragging?: boolean
  canMoveTier?: boolean
  onActivate: () => void
  onOpenLightbox: (images: string[], index: number, title?: string) => void
  onMoveTier?: (tier: PlaceTier) => void
  onRequestMoveTier?: () => void
}) {
  const images = placeImages(place)
  const title = place.title || 'Untitled'
  const listingUrl = place.url?.trim() || ''
  const showListing = Boolean(listingUrl) && !selectMode && !dragging
  const showDesktopMover =
    density === 'desktop' &&
    canMoveTier &&
    !selectMode &&
    !dragging &&
    onMoveTier
  const showMobileMover =
    density === 'mobile' &&
    canMoveTier &&
    !selectMode &&
    !dragging &&
    onRequestMoveTier

  return (
    <article
      className={cn(
        'group relative min-w-0 overflow-hidden rounded-xl border bg-panel',
        motion.color,
        selected
          ? 'border-sea ring-2 ring-sea/25'
          : 'border-line hover:border-sea/70',
        density === 'desktop' &&
          !selectMode &&
          !dragging &&
          'hover:shadow-[var(--shadow-soft)]',
      )}
    >
      {selectMode ? (
        <span
          className={cn(
            'pointer-events-none absolute left-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full border shadow-sm',
            selected
              ? 'border-sea bg-sea text-white'
              : 'border-line bg-panel/95 text-transparent',
          )}
          aria-hidden
        >
          <Check className="h-3.5 w-3.5" strokeWidth={3} />
        </span>
      ) : null}

      <div
        className={cn(
          'relative w-full bg-folio',
          density === 'mobile' ? 'aspect-[4/3]' : 'aspect-[16/11]',
        )}
      >
        {images[0] ? (
          <OpenableImage
            images={images}
            index={0}
            title={title}
            onOpen={onOpenLightbox}
            showCue={density === 'desktop' && !dragging}
            className="absolute inset-0 h-full w-full"
            imgClassName="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center px-2 text-center text-xs font-bold text-ink-soft">
            No photo
          </div>
        )}
        {showListing ? (
          <OpenListingControl url={listingUrl} variant="photo" />
        ) : null}
      </div>

      <div
        className={cn(
          density === 'mobile' ? 'px-2.5 py-2' : 'px-3 py-2.5',
        )}
      >
        <button
          type="button"
          onClick={onActivate}
          className={cn('w-full text-left', motion.press)}
        >
          <p
            className={cn(
              'font-bold leading-snug text-ink',
              density === 'mobile'
                ? 'line-clamp-2 text-[0.8rem]'
                : 'line-clamp-2 text-sm',
            )}
          >
            {title}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-ink-soft">
            <span className="font-semibold text-ink">
              {primaryCostLabel(place)}
            </span>
            <CompactPets pets={place.pets ?? 'no'} />
          </p>
          {density === 'desktop' ? (
            <span className="mt-1.5 inline-flex items-center gap-0.5 text-[11px] font-bold text-sea-deep">
              {selectMode
                ? selected
                  ? 'Selected'
                  : 'Select'
                : 'Edit details'}
              <ChevronRight className="h-3 w-3" aria-hidden />
            </span>
          ) : null}
        </button>

        {showDesktopMover ? (
          <DesktopTierMover
            current={place.tier}
            onMove={onMoveTier}
            disabled={!canMoveTier}
          />
        ) : null}
        {showMobileMover ? (
          <MobileTierMoveTrigger
            onOpen={onRequestMoveTier}
            disabled={!canMoveTier}
          />
        ) : null}
      </div>
    </article>
  )
}

function MobileRowCard({
  place,
  selected,
  selectMode,
  canMoveTier,
  onToggleSelect,
  onEdit,
  onOpenLightbox,
  onRequestMoveTier,
}: {
  place: SavedPlace
  selected: boolean
  selectMode: boolean
  canMoveTier: boolean
  onToggleSelect: () => void
  onEdit: () => void
  onOpenLightbox: (images: string[], index: number, title?: string) => void
  onRequestMoveTier: () => void
}) {
  const images = placeImages(place)
  const title = place.title || 'Untitled'
  const listingUrl = place.url?.trim() || ''
  const showListing = Boolean(listingUrl) && !selectMode

  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border bg-panel shadow-[var(--shadow-soft)]',
        motion.color,
        selectMode && selected
          ? 'border-sea ring-2 ring-sea/25'
          : 'border-line',
      )}
    >
      <div className="flex min-h-[7.25rem]">
        <div className="relative w-[42%] min-w-[7.5rem] max-w-[11rem] shrink-0 self-stretch bg-folio">
          {images[0] ? (
            <OpenableImage
              images={images}
              index={0}
              title={title}
              onOpen={onOpenLightbox}
              showCue
              className="absolute inset-0 h-full w-full"
              imgClassName="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full min-h-[7.25rem] items-center justify-center px-2 text-center text-xs text-ink-soft">
              No photo
            </div>
          )}
          {showListing ? (
            <OpenListingControl url={listingUrl} variant="photo" />
          ) : null}
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center px-3 py-3">
          <button
            type="button"
            onClick={() => (selectMode ? onToggleSelect() : onEdit())}
            className="w-full text-left"
          >
            <p className="line-clamp-2 text-[0.95rem] font-bold leading-snug text-ink">
              {title}
            </p>
            <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-sm text-ink-soft">
              <span className="font-semibold text-ink">
                {primaryCostLabel(place)}
              </span>
              <CompactPets pets={place.pets ?? 'no'} />
            </p>
            <span className="mt-1.5 inline-flex items-center gap-0.5 text-xs font-bold text-sea-deep">
              {selectMode
                ? selected
                  ? 'Selected'
                  : 'Tap to select'
                : 'Edit details'}
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </span>
          </button>
          {showListing ? (
            <OpenListingControl url={listingUrl} variant="row" />
          ) : null}
          {canMoveTier && !selectMode ? (
            <MobileTierMoveTrigger onOpen={onRequestMoveTier} />
          ) : null}
        </div>
      </div>
    </div>
  )
}
