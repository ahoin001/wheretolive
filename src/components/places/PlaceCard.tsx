import { useState, type ReactNode } from 'react'
import {
  CheckSquare,
  Copy,
  ExternalLink,
  Heart,
  Link2,
  MoreHorizontal,
  Pencil,
  Plus,
  Square,
  Trash2,
} from 'lucide-react'
import type { PetsPolicy, PlaceStatus, PlaceTier, SavedPlace } from '../../domain/types'
import { formatMoney } from '../../domain/finance/calculations'
import { isLikedByMe, placeImages } from '../../domain/places/filtering'
import { LIKER_SWATCHES, type LikerSwatch } from '../../domain/places/likes'
import { motion } from '../../lib/motion'
import { cn } from '../../lib/utils'
import { Button, ButtonLink } from '../ui/Button'
import { OpenableImage } from './ImageLightbox'
import type { ListDensity } from './PlacesList'

const PETS_LABEL: Record<PetsPolicy, string> = {
  yes: 'Pets OK',
  limited: 'Pets limited',
  no: 'No pets',
}

const TIER_LABEL: Record<PlaceTier, string> = {
  dream: 'Dream',
  strong: 'Strong yes',
  maybe: 'Maybe',
  pass: 'Pass',
}

const STATUS_LABEL: Record<PlaceStatus, string> = {
  none: 'Not marked',
  visited: 'Visited',
  offer: 'Offer',
}

function PetsBadge({
  pets,
  note,
  className,
  compact = false,
}: {
  pets: PetsPolicy
  note?: string
  className?: string
  /** Inline chip without wrapping note — for dense list meta rows */
  compact?: boolean
}) {
  const tone =
    pets === 'yes'
      ? 'bg-move/15 text-move'
      : pets === 'limited'
        ? 'bg-honey-soft text-honey'
        : pets === 'no'
          ? 'bg-warn/15 text-warn'
          : 'bg-line/60 text-ink-soft'

  if (compact) {
    return (
      <span
        className={cn(
          'inline-flex shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold leading-none',
          tone,
          className,
        )}
        title={
          note && (pets === 'yes' || pets === 'limited')
            ? `${PETS_LABEL[pets] ?? PETS_LABEL.no}: ${note}`
            : PETS_LABEL[pets] ?? PETS_LABEL.no
        }
      >
        {PETS_LABEL[pets] ?? PETS_LABEL.no}
      </span>
    )
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <span className={cn('rounded-full px-2.5 py-1 text-xs font-bold', tone)}>
        {PETS_LABEL[pets] ?? PETS_LABEL.no}
      </span>
      {note && (pets === 'yes' || pets === 'limited') ? (
        <span className="text-xs text-ink-soft">{note}</span>
      ) : null}
    </div>
  )
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

function EmptyPlaces({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-folio/60 px-6 py-10 text-center">
      <p className="font-display text-2xl font-semibold text-ink">No places saved yet</p>
      <Button className="mt-4" variant="honey" onClick={onAdd}>
        <Plus className="h-4 w-4" />
        Add your first place
      </Button>
    </div>
  )
}

function TagRow({
  labels,
  tone,
  className,
  max = 6,
}: {
  labels: string[]
  tone: 'pro' | 'con'
  className?: string
  max?: number
}) {
  if (!labels?.length) return null
  const shown = labels.slice(0, max)
  const extra = labels.length - shown.length
  return (
    <ul className={cn('flex flex-wrap gap-1', className)}>
      {shown.map((label) => (
        <li
          key={label}
          className={cn(
            'rounded-full px-2 py-0.5 text-[11px] font-bold leading-tight',
            tone === 'pro' && 'bg-move/15 text-move',
            tone === 'con' && 'bg-warn/15 text-warn',
          )}
        >
          {label}
        </li>
      ))}
      {extra > 0 ? (
        <li className="rounded-full bg-line/50 px-2 py-0.5 text-[11px] font-bold text-ink-soft">
          +{extra}
        </li>
      ) : null}
    </ul>
  )
}

function PlaceCard({
  place,
  density = 'comfortable',
  moveBudget,
  selectMode,
  checked,
  likedBy = [],
  mySwatch,
  onToggleSelect,
  onOpenImages,
  onFavorite,
  onEdit,
  onDelete,
  onShareLink,
  onCopyToList,
  copyMenu,
}: {
  place: SavedPlace
  density?: ListDensity
  moveBudget: number | null
  selectMode: boolean
  checked: boolean
  /** Shared list: each person who liked, newest first */
  likedBy?: { key: string; label: string; swatch: LikerSwatch }[]
  /** Stable color for the signed-in user's heart */
  mySwatch?: LikerSwatch
  onToggleSelect: () => void
  onOpenImages: (images: string[], index: number, title?: string) => void
  onFavorite: () => void
  onEdit: () => void
  onDelete: () => void
  onShareLink?: () => void
  onCopyToList?: () => void
  copyMenu?: ReactNode
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const compact = density === 'compact'
  const images = placeImages(place)
  const liked = isLikedByMe(place)
  const meTone = mySwatch ?? LIKER_SWATCHES[0]!
  const over =
    place.listingKind === 'rent' &&
    moveBudget != null &&
    place.monthlyEstimate != null &&
    place.monthlyEstimate > moveBudget

  const bedsBaths = [
    place.bedrooms != null ? `${place.bedrooms} bd` : null,
    place.bathrooms != null ? `${place.bathrooms} ba` : null,
    place.sqft != null && place.sqft > 0
      ? `${Math.round(place.sqft).toLocaleString()} sqft`
      : null,
  ]
    .filter(Boolean)
    .join(' · ')

  const locationLine =
    place.city ||
    place.location ||
    (place.street ? place.street : '') ||
    'Location not set'

  const thumbLikers =
    likedBy.length > 0
      ? likedBy.slice(0, 4)
      : liked
        ? [{ key: 'me', label: 'You', swatch: meTone }]
        : []

  return (
    <article
      className={cn(
        'min-w-0 overflow-hidden border bg-panel shadow-[var(--shadow-soft)] sm:flex',
        motion.color,
        compact
          ? 'rounded-xl sm:rounded-xl'
          : 'rounded-2xl sm:rounded-[1.25rem]',
        checked ? 'border-sea ring-2 ring-sea/25' : 'border-line sm:hover:border-sea/60',
      )}
    >
      {/* Media — full-bleed on mobile (Airbnb/Zillow style), rail on desktop */}
      <div
        className={cn(
          'relative min-w-0 sm:shrink-0',
          compact ? 'sm:w-24 md:w-28' : 'sm:w-32 md:w-40',
        )}
      >
        {selectMode ? (
          <button
            type="button"
            onClick={onToggleSelect}
            className="absolute left-2.5 top-2.5 z-10 rounded-full bg-panel/95 p-2 shadow-[var(--shadow-soft)]"
            aria-pressed={checked}
            aria-label={checked ? 'Deselect place' : 'Select place'}
          >
            {checked ? (
              <CheckSquare className="h-4 w-4 text-sea-deep" />
            ) : (
              <Square className="h-4 w-4 text-ink-soft" />
            )}
          </button>
        ) : null}
        {images[0] ? (
          <OpenableImage
            images={images}
            index={0}
            title={place.title || 'Untitled place'}
            onOpen={onOpenImages}
            className={cn(
              'w-full sm:aspect-auto sm:h-full',
              compact
                ? 'aspect-[2.2/1] sm:min-h-[5.5rem]'
                : 'aspect-[16/10] sm:min-h-[7.5rem]',
            )}
            imgClassName={cn(
              'h-full w-full object-cover',
              compact ? 'sm:min-h-[5.5rem]' : 'sm:min-h-[7.5rem]',
            )}
          />
        ) : (
          <div
            className={cn(
              'flex w-full items-center justify-center bg-folio text-xs font-bold text-ink-soft sm:aspect-auto',
              compact
                ? 'aspect-[2.2/1] sm:min-h-[5.5rem]'
                : 'aspect-[16/10] sm:min-h-[7.5rem]',
            )}
          >
            No photo
          </div>
        )}
        {images.length > 1 && !compact ? (
          <span className="pointer-events-none absolute bottom-2 right-2 rounded-full bg-ink/70 px-2 py-0.5 text-[10px] font-bold text-white">
            {images.length} photos
          </span>
        ) : null}
        {!selectMode ? (
          <button
            type="button"
            onClick={onFavorite}
            aria-pressed={liked}
            aria-label={liked ? 'Unlike place' : 'Like place'}
            className={cn(
              'absolute right-2.5 top-2.5 z-10 flex h-9 w-9 items-center justify-center rounded-full backdrop-blur-sm sm:hidden',
              motion.chip,
              liked
                ? cn(meTone.badge, 'border border-transparent shadow-sm')
                : 'border border-white/40 bg-ink/35 text-white',
            )}
          >
            <Heart
              className={cn(
                'h-4 w-4',
                liked ? 'fill-white text-white' : 'fill-none text-white',
              )}
              strokeWidth={liked ? 2 : 2.25}
            />
          </button>
        ) : null}
        {thumbLikers.length > 0 && !selectMode ? (
          <span
            className="pointer-events-none absolute right-1.5 top-1.5 hidden items-center -space-x-1.5 sm:flex"
            title={
              likedBy.length
                ? `Liked by ${likedBy.map((p) => p.label).join(', ')}`
                : 'Liked'
            }
          >
            {thumbLikers.map((person) => (
              <span
                key={person.key}
                className={cn(
                  'inline-flex h-6 w-6 items-center justify-center rounded-full shadow-sm ring-2 ring-white/90',
                  person.swatch.badge,
                )}
              >
                <Heart className="h-3 w-3 fill-current" />
              </span>
            ))}
          </span>
        ) : null}
      </div>

      <div
        className={cn(
          'flex min-w-0 flex-1 flex-col justify-between',
          compact ? 'gap-1 p-2.5 sm:px-3 sm:py-2' : 'gap-2 p-3.5 sm:px-4 sm:py-3',
        )}
      >
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div
              className={cn(
                'flex flex-wrap items-center gap-x-1.5 gap-y-1 font-bold leading-none text-sea-deep',
                compact ? 'text-[10px]' : 'text-[11px] sm:text-xs',
              )}
            >
              <span>{place.listingKind === 'rent' ? 'Rental' : 'Buy'}</span>
              <span className="text-line" aria-hidden>
                ·
              </span>
              <span>{TIER_LABEL[place.tier]}</span>
              {!compact && place.status !== 'none' ? (
                <>
                  <span className="text-line" aria-hidden>
                    ·
                  </span>
                  <span>{STATUS_LABEL[place.status]}</span>
                </>
              ) : null}
              <PetsBadge pets={place.pets ?? 'no'} note={place.petsNote} compact />
            </div>

            <button
              type="button"
              onClick={onEdit}
              className="mt-1 block w-full text-left"
            >
              <h3
                className={cn(
                  'font-display font-semibold leading-snug tracking-[-0.02em] text-ink',
                  compact ? 'text-base' : 'text-xl',
                )}
              >
                <span className="line-clamp-2 sm:line-clamp-1">
                  {place.title || 'Untitled place'}
                </span>
              </h3>
            </button>

            <p
              className={cn(
                'mt-0.5 truncate text-ink-soft',
                compact ? 'text-xs' : 'text-sm',
              )}
            >
              {locationLine}
            </p>
          </div>

          {/* Desktop action cluster */}
          <div className="hidden shrink-0 flex-wrap items-center justify-end gap-1.5 sm:flex">
            {selectMode ? (
              <Button
                type="button"
                variant={checked ? 'primary' : 'secondary'}
                className="h-9 min-h-9 rounded-xl px-3 text-sm"
                onClick={onToggleSelect}
              >
                {checked ? 'Selected' : 'Select'}
              </Button>
            ) : (
              <>
                {place.url ? (
                  <ButtonLink
                    href={place.url}
                    target="_blank"
                    rel="noreferrer"
                    variant="primary"
                    className="h-9 min-h-9 rounded-xl px-3 text-sm"
                    title="Open listing"
                  >
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                    Open listing
                  </ButtonLink>
                ) : null}
                <Button
                  type="button"
                  variant="secondary"
                  className={cn(
                    'h-9 min-h-9 rounded-xl px-2.5',
                    liked
                      ? cn(meTone.chip, 'hover:brightness-[0.98]')
                      : 'text-ink-soft',
                  )}
                  onClick={onFavorite}
                  aria-pressed={liked}
                  aria-label={liked ? 'Unlike place' : 'Like place'}
                  title={liked ? 'Unlike' : 'Like'}
                >
                  <Heart
                    className={cn(
                      'h-4 w-4',
                      liked
                        ? cn('fill-current', meTone.heart)
                        : 'fill-none text-ink-soft',
                    )}
                    strokeWidth={liked ? 2 : 2.25}
                  />
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="h-9 min-h-9 rounded-xl px-3 text-sm"
                  onClick={onEdit}
                >
                  Edit
                </Button>
                {onShareLink ? (
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-9 min-h-9 rounded-xl px-2.5"
                    onClick={onShareLink}
                    title="Guest link"
                    aria-label="Create guest link"
                  >
                    <Link2 className="h-3.5 w-3.5" />
                  </Button>
                ) : null}
                {onCopyToList ? (
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-9 min-h-9 rounded-xl px-2.5"
                    onClick={onCopyToList}
                    title="Copy to another list"
                    aria-label="Copy to another list"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  className="h-9 min-h-9 rounded-xl px-2"
                  onClick={onDelete}
                  aria-label="Remove place"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </div>
        </div>

        {copyMenu ? <div className="relative z-20">{copyMenu}</div> : null}

        <div className={cn('flex flex-col', compact ? 'gap-1' : 'gap-1.5')}>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <span
              className={cn(
                'font-bold tabular-nums',
                compact ? 'text-base' : 'text-lg',
                place.listingKind === 'rent'
                  ? over
                    ? 'text-warn'
                    : 'text-move'
                  : 'text-ink',
              )}
            >
              {primaryCostLabel(place)}
            </span>
            {bedsBaths ? (
              <span className={cn('text-ink-soft', compact ? 'text-xs' : 'text-sm')}>
                {bedsBaths}
              </span>
            ) : null}
            {!compact && likedBy.length > 0 ? (
              <span
                className="inline-flex max-w-full flex-wrap items-center gap-1 text-[11px] font-bold"
                title={`Liked by ${likedBy.map((p) => p.label).join(', ')}`}
              >
                <span className="text-ink-soft">Liked by</span>
                {likedBy.map((person) => (
                  <span
                    key={person.key}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full border px-2 py-0.5',
                      person.swatch.chip,
                    )}
                  >
                    <Heart className={cn('h-3 w-3 shrink-0', person.swatch.heart)} />
                    {person.label}
                  </span>
                ))}
              </span>
            ) : null}
          </div>

          {!compact && (place.proTags?.length || place.concernTags?.length) ? (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <TagRow labels={place.proTags} tone="pro" max={3} />
              <TagRow labels={place.concernTags} tone="con" max={2} />
            </div>
          ) : null}

          {!compact && place.notes ? (
            <p className="line-clamp-1 text-xs text-ink-soft sm:text-sm">{place.notes}</p>
          ) : null}

          {/* Mobile bottom actions — photo-led, tools one layer deeper */}
          {!selectMode ? (
            <div
              className={cn(
                'flex items-center gap-1.5 border-t border-line/70 sm:hidden',
                compact ? 'mt-0.5 pt-1.5' : 'mt-0.5 pt-2',
              )}
            >
              {place.url ? (
                <ButtonLink
                  href={place.url}
                  target="_blank"
                  rel="noreferrer"
                  variant="secondary"
                  className={cn(
                    'flex-1 rounded-full px-3 text-sm',
                    compact ? 'min-h-10' : 'min-h-11',
                  )}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Listing
                </ButtonLink>
              ) : null}
              <Button
                type="button"
                variant="secondary"
                className={cn(
                  'flex-1 rounded-full px-3 text-sm',
                  compact ? 'min-h-10' : 'min-h-11',
                )}
                onClick={onEdit}
              >
                Edit
              </Button>
              <div className="relative">
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-11 min-w-11 rounded-full px-2.5"
                  onClick={() => setMenuOpen((v) => !v)}
                  aria-expanded={menuOpen}
                  aria-label="More actions"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
                {menuOpen ? (
                  <>
                    <button
                      type="button"
                      className="fixed inset-0 z-20 cursor-default"
                      aria-label="Close menu"
                      onClick={() => setMenuOpen(false)}
                    />
                    <div className="absolute bottom-full right-0 z-30 mb-1.5 min-w-[10rem] overflow-hidden rounded-xl border border-line bg-panel py-1 shadow-[var(--shadow-lift)]">
                      {onShareLink ? (
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-bold text-ink hover:bg-folio"
                          onClick={() => {
                            setMenuOpen(false)
                            onShareLink()
                          }}
                        >
                          <Link2 className="h-3.5 w-3.5" />
                          Guest link
                        </button>
                      ) : null}
                      {onCopyToList ? (
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-bold text-ink hover:bg-folio"
                          onClick={() => {
                            setMenuOpen(false)
                            onCopyToList()
                          }}
                        >
                          <Copy className="h-3.5 w-3.5" />
                          Copy to list
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-bold text-warn hover:bg-folio"
                        onClick={() => {
                          setMenuOpen(false)
                          onDelete()
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Remove
                      </button>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="mt-0.5 border-t border-line/70 pt-2 sm:hidden">
              <Button
                type="button"
                variant={checked ? 'primary' : 'secondary'}
                className="h-9 min-h-9 w-full rounded-full text-sm"
                onClick={onToggleSelect}
              >
                {checked ? 'Selected' : 'Select'}
              </Button>
            </div>
          )}

          {images.length > 1 && !compact ? (
            <div
              className="hidden min-w-0 max-w-full gap-1.5 overflow-x-auto pb-0.5 pt-0.5 sm:flex"
              aria-label={`${images.length} photos`}
            >
              {images.map((url, index) => (
                <OpenableImage
                  key={`${url}-${index}`}
                  images={images}
                  index={index}
                  title={place.title || 'Untitled place'}
                  onOpen={onOpenImages}
                  className={cn(
                    'h-12 w-[4.25rem] shrink-0 overflow-hidden rounded-lg border sm:h-14 sm:w-20',
                    index === 0 ? 'border-sea/50' : 'border-line',
                  )}
                  imgClassName="h-12 w-[4.25rem] object-cover sm:h-14 sm:w-20"
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  )
}


export { PlaceCard, EmptyPlaces, TagRow, PetsBadge, primaryCostLabel }
