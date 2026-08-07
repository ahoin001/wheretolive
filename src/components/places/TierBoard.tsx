import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Check, ChevronRight, GripVertical } from 'lucide-react'
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
  type UniqueIdentifier,
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
import {
  compareBoardOrder,
  groupPlacesByTier,
  isPlaceTier,
  movePlaceOnBoard,
  type BoardPlacement,
} from '../../domain/places/boardOrder'
import { formatMoney } from '../../domain/finance/calculations'
import { motion } from '../../lib/motion'
import { tweenPanel, easeSnappy } from '../../lib/motionPresets'
import { cn } from '../../lib/utils'
import { OpenableImage } from './ImageLightbox'

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

function tierDropId(tier: PlaceTier): string {
  return `tier:${tier}`
}

function findContainer(
  items: Record<PlaceTier, string[]>,
  id: UniqueIdentifier,
): PlaceTier | null {
  const sid = String(id)
  if (sid.startsWith('tier:') && isPlaceTier(sid.slice(5))) {
    return sid.slice(5) as PlaceTier
  }
  for (const tier of TIERS) {
    if (items[tier].includes(sid)) return tier
  }
  return null
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
  const canDrag = reorderEnabled && !selectMode

  const byTier = useMemo(() => groupPlacesByTier(places), [places])

  const [items, setItems] = useState<Record<PlaceTier, string[]>>(() => ({
    dream: byTier.dream.map((p) => p.id),
    strong: byTier.strong.map((p) => p.id),
    maybe: byTier.maybe.map((p) => p.id),
    pass: byTier.pass.map((p) => p.id),
  }))

  useEffect(() => {
    setItems({
      dream: byTier.dream.map((p) => p.id),
      strong: byTier.strong.map((p) => p.id),
      maybe: byTier.maybe.map((p) => p.id),
      pass: byTier.pass.map((p) => p.id),
    })
  }, [byTier])

  const placeById = useMemo(() => {
    const map = new Map<string, SavedPlace>()
    for (const p of places) map.set(p.id, p)
    return map
  }, [places])

  const firstPopulated = useMemo(
    () => TIERS.find((tier) => byTier[tier].length > 0) ?? 'dream',
    [byTier],
  )

  const [mobileTier, setMobileTier] = useState<PlaceTier>(firstPopulated)
  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => {
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

  const commitFromItems = (next: Record<PlaceTier, string[]>) => {
    const placements: BoardPlacement[] = []
    for (const tier of TIERS) {
      next[tier].forEach((id, boardOrder) => {
        placements.push({ id, tier, boardOrder })
      })
    }
    // Only emit placements that actually changed
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
    const { active, over } = event
    if (!over) return
    const activeContainer = findContainer(items, active.id)
    const overContainer = findContainer(items, over.id)
    if (!activeContainer || !overContainer || activeContainer === overContainer) {
      return
    }

    setMobileTier(overContainer)

    setItems((prev) => {
      const activeItems = [...prev[activeContainer]]
      const overItems = [...prev[overContainer]]
      const activeIndex = activeItems.indexOf(String(active.id))
      if (activeIndex < 0) return prev
      activeItems.splice(activeIndex, 1)

      let newIndex: number
      if (String(over.id).startsWith('tier:')) {
        newIndex = overItems.length
      } else {
        const overIndex = overItems.indexOf(String(over.id))
        newIndex = overIndex >= 0 ? overIndex : overItems.length
      }
      overItems.splice(newIndex, 0, String(active.id))

      return {
        ...prev,
        [activeContainer]: activeItems,
        [overContainer]: overItems,
      }
    })
  }

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)
    if (!over) {
      // Reset from props if cancelled mid-flight oddly
      setItems({
        dream: byTier.dream.map((p) => p.id),
        strong: byTier.strong.map((p) => p.id),
        maybe: byTier.maybe.map((p) => p.id),
        pass: byTier.pass.map((p) => p.id),
      })
      return
    }

    const activeContainer = findContainer(items, active.id)
    const overContainer = findContainer(items, over.id)
    if (!activeContainer || !overContainer) return

    if (activeContainer === overContainer) {
      const list = items[activeContainer]
      const oldIndex = list.indexOf(String(active.id))
      const newIndex = String(over.id).startsWith('tier:')
        ? list.length - 1
        : list.indexOf(String(over.id))
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) {
        commitFromItems(items)
        return
      }
      const nextList = arrayMove(list, oldIndex, newIndex)
      const next = { ...items, [activeContainer]: nextList }
      setItems(next)
      commitFromItems(next)
      return
    }

    // Cross-container already reflected in items via onDragOver
    commitFromItems(items)
  }

  const onDragCancel = () => {
    setActiveId(null)
    setItems({
      dream: byTier.dream.map((p) => p.id),
      strong: byTier.strong.map((p) => p.id),
      maybe: byTier.maybe.map((p) => p.id),
      pass: byTier.pass.map((p) => p.id),
    })
  }

  /** Mobile: quick move when dropping onto a tier chip while dragging. */
  const moveActiveToMobileTier = (tier: PlaceTier) => {
    if (!activeId || !canDrag) {
      setMobileTier(tier)
      return
    }
    const placements = movePlaceOnBoard(places, activeId, tierDropId(tier))
    if (placements) onReorder(placements)
    setMobileTier(tier)
    setActiveId(null)
  }

  const mobileIds = items[mobileTier]
  const mobilePlaces = mobileIds
    .map((id) => placeById.get(id))
    .filter((p): p is SavedPlace => Boolean(p))

  return (
    <div className="space-y-3">
      {!reorderEnabled && !selectMode ? (
        <p className="text-xs text-ink-soft md:text-sm">
          Clear filters to drag places between tiers or reorder left to right.
        </p>
      ) : canDrag ? (
        <p className="hidden text-xs text-ink-soft md:block">
          Drag places left to right within a tier, or up and down across tiers.
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
        {/* ——— Mobile: focused tier + droppable chips ——— */}
        <div className="md:hidden">
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
                    onSelect={() => moveActiveToMobileTier(tier)}
                  />
                )
              })}
            </div>
            {canDrag ? (
              <p className="mt-1.5 text-center text-[11px] text-ink-soft">
                Press and hold a place, then drag — drop on a tier chip to move
                it.
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
                  {mobilePlaces.length === 0
                    ? 'Empty'
                    : `${mobilePlaces.length} ${
                        mobilePlaces.length === 1 ? 'place' : 'places'
                      }`}
                </span>
              </div>

              <div
                className={cn(
                  mobilePlaces.length === 0 &&
                    'rounded-2xl border border-dashed border-line bg-folio/50 px-4 py-10 text-center',
                )}
              >
                {mobilePlaces.length === 0 ? (
                  <p className="text-sm font-bold text-ink-soft">
                    {TIER_META[mobileTier].emptyHint}
                  </p>
                ) : (
                  <SortableContext
                    items={mobileIds}
                    strategy={rectSortingStrategy}
                    disabled={!canDrag}
                  >
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
                              onToggleSelect={() => onToggleSelect(place.id)}
                              onEdit={() => onEdit(place)}
                              onOpenLightbox={onOpenLightbox}
                            />
                          ) : (
                            <SortableBoardTile
                              place={place}
                              selected={selectedIds.includes(place.id)}
                              selectMode={selectMode}
                              density="mobile"
                              canDrag={canDrag}
                              onActivate={() =>
                                selectMode
                                  ? onToggleSelect(place.id)
                                  : onEdit(place)
                              }
                              onOpenLightbox={onOpenLightbox}
                            />
                          )}
                        </li>
                      ))}
                    </ul>
                  </SortableContext>
                )}
              </div>
            </m.div>
          </AnimatePresence>
        </div>

        {/* ——— Desktop: classic wrapping board ——— */}
        <div className="hidden min-w-0 overflow-hidden rounded-2xl border border-line bg-panel shadow-[var(--shadow-soft)] md:block">
          {TIERS.map((tier, index) => {
            const ids = items[tier]
            const placesInTier = ids
              .map((id) => placeById.get(id))
              .filter((p): p is SavedPlace => Boolean(p))
              .sort(compareBoardOrder)
            const empty = placesInTier.length === 0
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
                    {empty ? '—' : placesInTier.length}
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
                  {empty ? (
                    <p className="text-sm text-ink-soft">{meta.emptyHint}</p>
                  ) : (
                    <SortableContext
                      items={ids}
                      strategy={rectSortingStrategy}
                      disabled={!canDrag}
                    >
                      <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,10.5rem),1fr))] gap-2.5">
                        {placesInTier.map((place) => (
                          <li key={place.id} className="min-w-0">
                            <SortableBoardTile
                              place={place}
                              selected={selectedIds.includes(place.id)}
                              selectMode={selectMode}
                              density="desktop"
                              canDrag={canDrag}
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
                    </SortableContext>
                  )}
                </TierDropZone>
              </section>
            )
          })}
        </div>

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
  onActivate,
  onOpenLightbox,
}: {
  place: SavedPlace
  selected: boolean
  selectMode: boolean
  density: 'mobile' | 'desktop'
  canDrag: boolean
  onActivate: () => void
  onOpenLightbox: (images: string[], index: number, title?: string) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: place.id, disabled: !canDrag })

  const style = {
    transform: CSS.Transform.toString(transform),
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
        onActivate={onActivate}
        onOpenLightbox={onOpenLightbox}
      />
    </div>
  )
}

function SortableMobileRow({
  place,
  selected,
  selectMode,
  canDrag,
  onToggleSelect,
  onEdit,
  onOpenLightbox,
}: {
  place: SavedPlace
  selected: boolean
  selectMode: boolean
  canDrag: boolean
  onToggleSelect: () => void
  onEdit: () => void
  onOpenLightbox: (images: string[], index: number, title?: string) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: place.id, disabled: !canDrag })

  const style = {
    transform: CSS.Transform.toString(transform),
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
        onToggleSelect={onToggleSelect}
        onEdit={onEdit}
        onOpenLightbox={onOpenLightbox}
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
  onActivate,
  onOpenLightbox,
}: {
  place: SavedPlace
  selected: boolean
  selectMode: boolean
  density: 'mobile' | 'desktop'
  dragging?: boolean
  onActivate: () => void
  onOpenLightbox: (images: string[], index: number, title?: string) => void
}) {
  const images = placeImages(place)
  const title = place.title || 'Untitled'

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
      </div>

      <button
        type="button"
        onClick={onActivate}
        className={cn(
          'w-full text-left',
          motion.press,
          density === 'mobile' ? 'px-2.5 py-2' : 'px-3 py-2.5',
        )}
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
    </article>
  )
}

function MobileRowCard({
  place,
  selected,
  selectMode,
  onToggleSelect,
  onEdit,
  onOpenLightbox,
}: {
  place: SavedPlace
  selected: boolean
  selectMode: boolean
  onToggleSelect: () => void
  onEdit: () => void
  onOpenLightbox: (images: string[], index: number, title?: string) => void
}) {
  const images = placeImages(place)
  const title = place.title || 'Untitled'

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
        </div>
        <button
          type="button"
          onClick={() => (selectMode ? onToggleSelect() : onEdit())}
          className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 px-3 py-3 text-left"
        >
          <p className="line-clamp-2 text-[0.95rem] font-bold leading-snug text-ink">
            {title}
          </p>
          <p className="flex flex-wrap items-center gap-1.5 text-sm text-ink-soft">
            <span className="font-semibold text-ink">
              {primaryCostLabel(place)}
            </span>
            <CompactPets pets={place.pets ?? 'no'} />
          </p>
          <span className="mt-0.5 inline-flex items-center gap-0.5 text-xs font-bold text-sea-deep">
            {selectMode
              ? selected
                ? 'Selected'
                : 'Tap to select'
              : 'Edit details'}
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </span>
        </button>
      </div>
    </div>
  )
}
