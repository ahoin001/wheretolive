import {
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { Check, ChevronRight, ExternalLink, GripVertical } from 'lucide-react'
import {
  useDroppable,
  type DraggableAttributes,
  type DraggableSyntheticListeners,
} from '@dnd-kit/core'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { PetsPolicy, PlaceTier, SavedPlace } from '../../../domain/types'
import { PLACE_SQFT_FILTER_OPTIONS } from '../../../domain/types'
import {
  citiesInPlaces,
  isTierReviewActive,
  TIER_BOARD_SORT_OPTIONS,
  type TierReviewState,
} from '../../../domain/places/tierReview'
import { placeCityLabel } from '../../../domain/places/address'
import { motion } from '../../../lib/motion'
import { cn } from '../../../lib/utils'
import { OpenableImage } from '../ImageLightbox'
import { MobileTierMoveTrigger } from '../TierMoveControls'
import {
  PETS_LABEL,
  TIER_META,
  placeImages,
  primaryCostLabel,
  tierDropId,
} from './tierMeta'

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

function CityBadge({
  place,
  className,
}: {
  place: SavedPlace
  className?: string
}) {
  const city = placeCityLabel(place)
  if (!city) return null

  return (
    <span
      className={cn(
        'pointer-events-none absolute bottom-1.5 right-1.5 z-10 max-w-[70%] truncate rounded-full bg-panel/95 px-2 py-1 text-[10px] font-bold leading-none text-ink shadow-sm',
        className,
      )}
      title={city}
    >
      {city}
    </span>
  )
}

/** Opens the listing in a new tab without triggering card edit / drag. */
function OpenListingControl({ url }: { url: string }) {
  const href = url.trim()
  if (!href) return null

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={(e: ReactMouseEvent) => e.stopPropagation()}
      onPointerDown={(e: ReactPointerEvent) => e.stopPropagation()}
      className={cn(
        'absolute right-2 top-2 z-10 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-ink/45 text-white backdrop-blur-[2px]',
        'opacity-90 hover:bg-ink/60 hover:opacity-100',
        motion.chip,
      )}
      aria-label="Open listing"
      title="Open listing"
    >
      <ExternalLink className="h-3.5 w-3.5" aria-hidden />
    </a>
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

function DragHandle({
  label,
  density,
  attributes,
  listeners,
}: {
  label: string
  density: 'mobile' | 'desktop'
  attributes: DraggableAttributes
  listeners?: DraggableSyntheticListeners
}) {
  return (
    <button
      type="button"
      className={cn(
        'absolute left-2 top-2 z-20 inline-flex items-center justify-center touch-none',
        'rounded-lg bg-ink/40 text-white/90 backdrop-blur-[2px]',
        'hover:bg-ink/55 hover:text-white active:cursor-grabbing',
        'cursor-grab',
        motion.chip,
        density === 'desktop'
          ? 'h-8 w-8 opacity-50 group-hover:opacity-100 group-focus-within:opacity-100'
          : 'h-9 w-9 opacity-90',
      )}
      aria-label={`Drag ${label}`}
      title="Drag to move"
      {...attributes}
      {...listeners}
    >
      <GripVertical className={density === 'desktop' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
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
      <BoardTile
        place={place}
        selected={selected}
        selectMode={selectMode}
        density={density}
        canMoveTier={canMoveTier}
        onActivate={onActivate}
        onOpenLightbox={onOpenLightbox}
        onRequestMoveTier={onRequestMoveTier}
        dragHandle={
          canDrag ? (
            <DragHandle
              label={place.title || 'place'}
              density={density}
              attributes={attributes}
              listeners={listeners}
            />
          ) : null
        }
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
      <MobileRowCard
        place={place}
        selected={selected}
        selectMode={selectMode}
        canMoveTier={canMoveTier}
        onToggleSelect={onToggleSelect}
        onEdit={onEdit}
        onOpenLightbox={onOpenLightbox}
        onRequestMoveTier={onRequestMoveTier}
        dragHandle={
          canDrag ? (
            <DragHandle
              label={place.title || 'place'}
              density="mobile"
              attributes={attributes}
              listeners={listeners}
            />
          ) : null
        }
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
  onRequestMoveTier,
  dragHandle = null,
}: {
  place: SavedPlace
  selected: boolean
  selectMode: boolean
  density: 'mobile' | 'desktop'
  dragging?: boolean
  canMoveTier?: boolean
  onActivate: () => void
  onOpenLightbox: (images: string[], index: number, title?: string) => void
  onRequestMoveTier?: () => void
  dragHandle?: ReactNode
}) {
  const images = placeImages(place)
  const title = place.title || 'Untitled'
  const listingUrl = place.url?.trim() || ''
  const showListing = Boolean(listingUrl) && !selectMode && !dragging
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
        <button
          type="button"
          onClick={onActivate}
          className={cn(
            'absolute left-2 top-2 z-20 flex h-7 w-7 items-center justify-center rounded-full border shadow-sm',
            motion.press,
            selected
              ? 'border-sea bg-sea text-white'
              : 'border-line bg-panel/95 text-transparent hover:border-sea hover:text-sea/40',
          )}
          aria-pressed={selected}
          aria-label={selected ? 'Deselect place' : 'Select place'}
        >
          <Check className="h-3.5 w-3.5" strokeWidth={3} />
        </button>
      ) : null}

      <div
        className={cn(
          'relative w-full bg-folio',
          density === 'mobile' ? 'aspect-[4/3]' : 'aspect-[16/11]',
        )}
      >
        {images[0] ? (
          selectMode ? (
            <button
              type="button"
              onClick={onActivate}
              className="absolute inset-0 h-full w-full"
              aria-label={
                selected ? `Deselect ${title}` : `Select ${title}`
              }
            >
              <img
                src={images[0]}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            </button>
          ) : (
            <OpenableImage
              images={images}
              index={0}
              title={title}
              onOpen={onOpenLightbox}
              showCue={density === 'desktop' && !dragging}
              className="absolute inset-0 h-full w-full"
              imgClassName="h-full w-full object-cover"
            />
          )
        ) : selectMode ? (
          <button
            type="button"
            onClick={onActivate}
            className="flex h-full w-full items-center justify-center px-2 text-center text-xs font-bold text-ink-soft"
            aria-label={selected ? `Deselect ${title}` : `Select ${title}`}
          >
            No photo
          </button>
        ) : (
          <div className="flex h-full items-center justify-center px-2 text-center text-xs font-bold text-ink-soft">
            No photo
          </div>
        )}
        {!dragging && !selectMode ? dragHandle : null}
        {showListing ? <OpenListingControl url={listingUrl} /> : null}
        {!dragging ? <CityBadge place={place} /> : null}
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
  dragHandle = null,
}: {
  place: SavedPlace
  selected: boolean
  selectMode: boolean
  canMoveTier: boolean
  onToggleSelect: () => void
  onEdit: () => void
  onOpenLightbox: (images: string[], index: number, title?: string) => void
  onRequestMoveTier: () => void
  dragHandle?: ReactNode
}) {
  const images = placeImages(place)
  const title = place.title || 'Untitled'
  const listingUrl = place.url?.trim() || ''
  const showListing = Boolean(listingUrl) && !selectMode

  return (
    <div
      className={cn(
        'group overflow-hidden rounded-2xl border bg-panel shadow-[var(--shadow-soft)]',
        motion.color,
        selectMode && selected
          ? 'border-sea ring-2 ring-sea/25'
          : 'border-line',
      )}
    >
      <div className="flex min-h-[7.25rem]">
        <div className="relative w-[42%] min-w-[7.5rem] max-w-[11rem] shrink-0 self-stretch bg-folio">
          {images[0] ? (
            selectMode ? (
              <button
                type="button"
                onClick={onToggleSelect}
                className="absolute inset-0 h-full w-full"
                aria-label={
                  selected ? `Deselect ${title}` : `Select ${title}`
                }
              >
                <img
                  src={images[0]}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
              </button>
            ) : (
              <OpenableImage
                images={images}
                index={0}
                title={title}
                onOpen={onOpenLightbox}
                showCue
                className="absolute inset-0 h-full w-full"
                imgClassName="h-full w-full object-cover"
              />
            )
          ) : selectMode ? (
            <button
              type="button"
              onClick={onToggleSelect}
              className="flex h-full min-h-[7.25rem] w-full items-center justify-center px-2 text-center text-xs text-ink-soft"
              aria-label={selected ? `Deselect ${title}` : `Select ${title}`}
            >
              No photo
            </button>
          ) : (
            <div className="flex h-full min-h-[7.25rem] items-center justify-center px-2 text-center text-xs text-ink-soft">
              No photo
            </div>
          )}
          {selectMode ? (
            <button
              type="button"
              onClick={onToggleSelect}
              className={cn(
                'absolute left-2 top-2 z-20 flex h-7 w-7 items-center justify-center rounded-full border shadow-sm',
                motion.press,
                selected
                  ? 'border-sea bg-sea text-white'
                  : 'border-line bg-panel/95 text-transparent hover:border-sea hover:text-sea/40',
              )}
              aria-pressed={selected}
              aria-label={selected ? 'Deselect place' : 'Select place'}
            >
              <Check className="h-3.5 w-3.5" strokeWidth={3} />
            </button>
          ) : null}
          {!selectMode ? dragHandle : null}
          {showListing ? <OpenListingControl url={listingUrl} /> : null}
          <CityBadge place={place} />
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
          {canMoveTier && !selectMode ? (
            <MobileTierMoveTrigger onOpen={onRequestMoveTier} />
          ) : null}
        </div>
      </div>
    </div>
  )
}

export {
  CompactPets,
  CityBadge,
  OpenListingControl,
  TierReviewBar,
  TierDropZone,
  MobileTierChip,
  DragHandle,
  SortableBoardTile,
  SortableMobileRow,
  BoardTile,
  MobileRowCard,
}
