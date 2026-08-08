import { useEffect, useMemo, useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  closestCorners,
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
} from '@dnd-kit/sortable'
import type { PlaceTier, SavedPlace } from '../../domain/types'
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
  type TierReviewState,
} from '../../domain/places/tierReview'
import { cn } from '../../lib/utils'
import { TierMoveSheet } from './TierMoveControls'
import { emptyReviews, TIERS, TIER_META } from './tier/tierMeta'
import { BoardTile, SortableBoardTile, TierDropZone, TierReviewBar } from './tier/TierTiles'
import { TierFocusMobile } from './tier/TierFocusMobile'
import { TierOverviewMobile } from './tier/TierOverviewMobile'

export type MobileTierMode = 'focus' | 'overview'

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
  mobileTier?: PlaceTier
  onMobileTierChange?: (tier: PlaceTier) => void
  mobileMode?: MobileTierMode
  onMobileModeChange?: (mode: MobileTierMode) => void
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
  mobileTier: mobileTierControlled,
  onMobileTierChange,
  mobileMode: mobileModeControlled,
  onMobileModeChange,
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

  const [mobileTierUncontrolled, setMobileTierUncontrolled] =
    useState<PlaceTier>(firstPopulated)
  const mobileTier = mobileTierControlled ?? mobileTierUncontrolled
  const setMobileTier = (tier: PlaceTier) => {
    onMobileTierChange?.(tier)
    if (mobileTierControlled === undefined) setMobileTierUncontrolled(tier)
  }

  const [mobileModeUncontrolled, setMobileModeUncontrolled] =
    useState<MobileTierMode>('focus')
  const mobileMode = mobileModeControlled ?? mobileModeUncontrolled
  const setMobileMode = (mode: MobileTierMode) => {
    onMobileModeChange?.(mode)
    if (mobileModeControlled === undefined) setMobileModeUncontrolled(mode)
  }

  const [movingPlaceId, setMovingPlaceId] = useState<string | null>(null)

  useEffect(() => {
    if (activeIdRef.current) return
    if (byTier[mobileTier].length === 0 && places.length > 0) {
      setMobileTier(firstPopulated)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only auto-jump when empty
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

  const overviewPlacesByTier = useMemo(() => {
    const map = {} as Record<PlaceTier, SavedPlace[]>
    for (const tier of TIERS) {
      map[tier] = items[tier]
        .map((id) => placeById.get(id))
        .filter((p): p is SavedPlace => Boolean(p))
    }
    return map
  }, [items, placeById])

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
          Drag a place to reorder it, or drop it into another tier.
        </p>
      ) : null}

      {!isDesktop ? (
        <div
          role="tablist"
          aria-label="Tier board mode"
          className="grid grid-cols-2 gap-1 rounded-xl border border-line bg-folio/70 p-1"
        >
          {(
            [
              { id: 'focus' as const, label: 'Focus' },
              { id: 'overview' as const, label: 'Overview' },
            ] as const
          ).map((tab) => {
            const active = mobileMode === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setMobileMode(tab.id)}
                className={cn(
                  'min-h-10 rounded-lg text-sm font-bold',
                  active
                    ? 'bg-panel text-ink shadow-[var(--shadow-soft)]'
                    : 'text-ink-soft hover:text-ink',
                )}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      ) : null}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={canDrag ? onDragStart : undefined}
        onDragOver={canDrag ? onDragOver : undefined}
        onDragEnd={canDrag ? onDragEnd : undefined}
        onDragCancel={canDrag ? onDragCancel : undefined}
      >
        {!isDesktop ? (
          mobileMode === 'overview' ? (
            <TierOverviewMobile
              placesByTier={overviewPlacesByTier}
              selectedIds={selectedIds}
              selectMode={selectMode}
              activeTier={mobileTier}
              onActiveTierChange={setMobileTier}
              onToggleSelect={onToggleSelect}
              onEdit={onEdit}
            />
          ) : (
            <TierFocusMobile
              mobileTier={mobileTier}
              items={items}
              byTier={byTier}
              reviews={reviews}
              selectedIds={selectedIds}
              selectMode={selectMode}
              canDrag={canDrag}
              reorderEnabled={reorderEnabled}
              activeIdPresent={Boolean(activeId)}
              onSelectTier={setMobileTier}
              placesForTier={placesForTier}
              patchReview={patchReview}
              resetReview={resetReview}
              onToggleSelect={onToggleSelect}
              onEdit={onEdit}
              onOpenLightbox={onOpenLightbox}
              onRequestMoveTier={setMovingPlaceId}
            />
          )
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
                                    canMoveTier={false}
                                    onActivate={() =>
                                      selectMode
                                        ? onToggleSelect(place.id)
                                        : onEdit(place)
                                    }
                                    onOpenLightbox={onOpenLightbox}
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
            <div className="w-[11rem] rotate-1 scale-[1.03] cursor-grabbing opacity-95 shadow-[var(--shadow-lift)]">
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

// Re-export for dock / callers that need tier metadata
export { TIERS, TIER_META } from './tier/tierMeta'
