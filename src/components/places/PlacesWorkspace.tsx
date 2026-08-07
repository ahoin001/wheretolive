import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import {
  Check,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Copy,
  ExternalLink,
  FolderOpen,
  Heart,
  MoreHorizontal,
  Pencil,
  Plus,
  Share2,
  SlidersHorizontal,
  Square,
  Trash2,
  X,
} from 'lucide-react'
import type { AppController } from '../../hooks/useApp'
import type { AuthController } from '../../hooks/useAuth'
import type { CollaborationController } from '../../hooks/useCollaboration'
import type {
  PetsPolicy,
  PlaceHomeType,
  PlaceListingKind,
  PlaceStatus,
  PlaceTier,
  SavedPlace,
} from '../../domain/types'
import { PLACE_HOME_TYPE_OPTIONS } from '../../domain/types'
import {
  cityKey,
  formatPlaceAddress,
  parseLocationString,
  placeCityLabel,
  sanitizeAddress,
  sanitizeState,
  sanitizeStreet,
  sanitizeZip,
} from '../../domain/places/address'
import { formatMoney } from '../../domain/finance/calculations'
import { AnimatePresence } from 'motion/react'
import { motion } from '../../lib/motion'
import { cn } from '../../lib/utils'
import { Button, ButtonLink } from '../ui/Button'
import { ChoiceGroup } from '../ui/ChoiceGroup'
import { CityCombobox } from '../ui/CityCombobox'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { BottomSheet } from '../ui/BottomSheet'
import { SideDrawer } from '../ui/SideDrawer'
import { CurrencyInput, Field, NumberInput, TextInput, TextTextarea } from '../ui/Field'
import { ImageLightbox, OpenableImage } from './ImageLightbox'
import { PlacePhotoEditor } from './PlacePhotoEditor'
import { ListsManager, CopyToListMenu } from './ListsManager'
import { PendingInvitesBanner, ShareSheet } from './ShareSheet'
import { listIsShared } from '../../data/collaboration/types'

const TIERS: PlaceTier[] = ['dream', 'strong', 'maybe', 'pass']
const TIER_LABEL: Record<PlaceTier, string> = {
  dream: 'Dream',
  strong: 'Strong yes',
  maybe: 'Maybe',
  pass: 'Pass',
}

const PRO_SUGGESTIONS = [
  'Yard',
  'Patio',
  'Modern',
  'Natural light',
  'Spacious',
  'Updated kitchen',
  'Quiet street',
  'Garage',
  'Pool',
  'Walkable',
  'Near family',
  'Single story',
  'Guest room',
  'Low maint.',
  'Storage',
  'Good schools nearby',
]

const CONCERN_SUGGESTIONS = [
  'Too small',
  'Stairs',
  'No parking',
  'Traffic noise',
  'Older systems',
  'High HOA',
  'Far from family',
  'Needs work',
  'Limited light',
  'No outdoor space',
  'Flood risk',
  'Busy complex',
  'HOA rules',
  'Too expensive',
]

const PETS_LABEL: Record<PetsPolicy, string> = {
  yes: 'Pets OK',
  limited: 'Pets limited',
  no: 'No pets',
}

const STATUS_LABEL: Record<PlaceStatus, string> = {
  none: 'Not marked',
  visited: 'Visited',
  offer: 'Offer',
}

function allowsPets(place: Pick<SavedPlace, 'pets'>): boolean {
  return place.pets === 'yes' || place.pets === 'limited'
}

/** List filter: show every place until the user narrows by pets. */
type PetsFilter = 'allowed' | 'none' | 'all'
const DEFAULT_PETS_FILTER: PetsFilter = 'all'

/** Home-type filter; options after Any are alphabetical via PLACE_HOME_TYPE_OPTIONS */
type HomeTypeFilter = 'all' | PlaceHomeType
const DEFAULT_HOME_TYPE_FILTER: HomeTypeFilter = 'all'

function matchesPetsFilter(
  place: Pick<SavedPlace, 'pets'>,
  filter: PetsFilter,
): boolean {
  if (filter === 'all') return true
  if (filter === 'allowed') return allowsPets(place)
  return !allowsPets(place)
}

function matchesHomeTypeFilter(
  place: Pick<SavedPlace, 'homeType'>,
  filter: HomeTypeFilter,
): boolean {
  if (filter === 'all') return true
  return place.homeType === filter
}

function PetsFilterControl({
  value,
  onChange,
  size = 'default',
}: {
  value: PetsFilter
  onChange: (value: PetsFilter) => void
  size?: 'default' | 'compact'
}) {
  const options: { value: PetsFilter; label: string }[] = [
    { value: 'allowed', label: 'Pets OK' },
    { value: 'none', label: 'No pets' },
    { value: 'all', label: 'All' },
  ]
  return (
    <div
      role="radiogroup"
      aria-label="Pets"
      className={cn(
        'inline-flex rounded-full border border-line bg-panel p-0.5',
        size === 'compact' && 'scale-[0.98]',
      )}
    >
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              size === 'compact'
                ? 'min-h-9 px-2.5 text-xs'
                : 'min-h-11 px-3.5 text-sm',
              'rounded-full font-bold',
              motion.chip,
              selected
                ? 'bg-sea text-white shadow-[var(--shadow-soft)]'
                : 'text-ink-soft hover:bg-folio hover:text-ink',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

/** Compact multi-select city filter (dropdown) — keeps filter bar one row. */
function CityFilterMenu({
  cities,
  selectedKeys,
  onChange,
  className,
}: {
  cities: { key: string; label: string; count: number }[]
  selectedKeys: string[]
  onChange: (keys: string[]) => void
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null)
  const known = useMemo(() => new Set(cities.map((c) => c.key)), [cities])
  const active = useMemo(
    () => selectedKeys.filter((k) => known.has(k)),
    [selectedKeys, known],
  )

  useEffect(() => {
    if (!open) return
    const place = () => {
      const el = buttonRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const menuH = 224
      const spaceBelow = window.innerHeight - r.bottom
      const openUp = spaceBelow < menuH && r.top > spaceBelow
      setMenuStyle({
        position: 'fixed',
        left: Math.min(r.left, window.innerWidth - 288),
        width: Math.max(r.width, 224),
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

  if (cities.length === 0) return null

  const summary =
    active.length === 0
      ? 'All cities'
      : active.length === 1
        ? (cities.find((c) => c.key === active[0])?.label ?? '1 city')
        : `${active.length} cities`

  const toggle = (key: string) => {
    if (active.includes(key)) {
      onChange(active.filter((k) => k !== key))
    } else {
      onChange([...active, key])
    }
  }

  return (
    <div ref={rootRef} className={cn('relative min-w-0', className)}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex h-10 w-full min-w-0 max-w-full items-center gap-1.5 rounded-xl border bg-panel px-2.5 text-left text-sm font-bold text-ink md:h-8 md:min-w-[9.5rem] md:max-w-[13rem] md:rounded-lg',
          motion.chip,
          active.length > 0
            ? 'border-sea bg-sea/5 text-sea-deep'
            : 'border-line hover:border-sea',
        )}
      >
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
          role="listbox"
          aria-multiselectable
          aria-label="Filter by city"
          style={menuStyle}
          className="overflow-y-auto rounded-xl border border-line bg-panel py-1 shadow-[var(--shadow-lift)]"
        >
          <button
            type="button"
            role="option"
            aria-selected={active.length === 0}
            onClick={() => {
              onChange([])
              setOpen(false)
            }}
            className={cn(
              'flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-bold hover:bg-folio',
              active.length === 0 ? 'text-sea-deep' : 'text-ink',
            )}
          >
            <span
              className={cn(
                'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                active.length === 0
                  ? 'border-sea bg-sea text-white'
                  : 'border-line bg-panel',
              )}
            >
              {active.length === 0 ? <Check className="h-3 w-3" /> : null}
            </span>
            All cities
          </button>
          {cities.map((city) => {
            const on = active.includes(city.key)
            return (
              <button
                key={city.key}
                type="button"
                role="option"
                aria-selected={on}
                onClick={() => toggle(city.key)}
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
                <span className="min-w-0 flex-1 truncate">{city.label}</span>
                <span className="tabular-nums text-xs text-ink-soft">
                  {city.count}
                </span>
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

type PlaceForm = Omit<SavedPlace, 'id' | 'createdAt' | 'updatedAt'>

const emptyForm = (): PlaceForm => ({
  title: '',
  url: '',
  listingKind: 'rent',
  homeType: null,
  price: null,
  monthlyEstimate: null,
  street: '',
  city: '',
  state: '',
  zip: '',
  location: '',
  bedrooms: null,
  bathrooms: null,
  notes: '',
  pets: 'no',
  petsNote: '',
  proTags: [],
  concernTags: [],
  tier: 'maybe',
  status: 'none',
  favorite: false,
  images: [],
  tags: [],
})

function formFromPlace(place: SavedPlace): PlaceForm {
  const { id: _i, createdAt: _c, updatedAt: _u, ...rest } = place
  const addr = sanitizeAddress({
    street: rest.street ?? '',
    city: rest.city ?? '',
    state: rest.state ?? '',
    zip: rest.zip ?? '',
  })
  const resolved =
    addr.city || addr.street || addr.state || addr.zip
      ? addr
      : parseLocationString(rest.location ?? '')

  return {
    ...emptyForm(),
    ...rest,
    ...resolved,
    location: formatPlaceAddress(resolved),
    listingKind: rest.listingKind ?? 'rent',
    homeType:
      rest.homeType === 'apartment' ||
      rest.homeType === 'condo' ||
      rest.homeType === 'single_family' ||
      rest.homeType === 'townhome'
        ? rest.homeType
        : null,
    pets: rest.pets === 'yes' || rest.pets === 'limited' ? rest.pets : 'no',
    petsNote: rest.petsNote ?? '',
    proTags: rest.proTags ?? [],
    concernTags: rest.concernTags ?? [],
    images: rest.images ?? [],
    status:
      rest.status === 'visited' || rest.status === 'offer' ? rest.status : 'none',
  }
}

function placeImages(place: SavedPlace): string[] {
  return Array.isArray(place.images) ? place.images.filter(Boolean) : []
}

function isLikedByMe(place: SavedPlace): boolean {
  return Boolean(place.likedByMe ?? place.favorite)
}

function isMutualLike(place: SavedPlace): boolean {
  const ids = place.likedByUserIds ?? place.likedBy?.map((l) => l.userId) ?? []
  return ids.length >= 2
}

function ms(iso: string | null | undefined): number {
  if (!iso) return 0
  const n = Date.parse(iso)
  return Number.isFinite(n) ? n : 0
}

/** Newest place first (default list order — ignores likes). */
function sortByRecentlyAdded(a: SavedPlace, b: SavedPlace): number {
  return ms(b.createdAt) - ms(a.createdAt) || ms(b.updatedAt) - ms(a.updatedAt)
}

/**
 * Most recent heart wins. Shared boards use the latest member like;
 * solo boards use the current user’s likedAt.
 */
function lastLikedMs(place: SavedPlace): number {
  if (place.likedBy?.length) {
    let best = 0
    for (const liker of place.likedBy) {
      best = Math.max(best, ms(liker.likedAt))
    }
    if (best > 0) return best
  }
  if (isLikedByMe(place)) {
    return ms(place.likedAt) || ms(place.updatedAt)
  }
  return 0
}

/** Stable multi-person like colors — hash user id so labels stay the same across places. */
const LIKER_SWATCHES = [
  {
    chip: 'border-honey/45 bg-honey-soft text-[#8a5524]',
    heart: 'text-honey fill-honey',
    badge: 'bg-honey text-white',
    onFill: 'border-honey bg-honey text-white hover:bg-honey/90',
  },
  {
    chip: 'border-sea/50 bg-sea/15 text-sea-deep',
    heart: 'text-sea-deep fill-sea',
    badge: 'bg-sea text-white',
    onFill: 'border-sea bg-sea text-white hover:bg-sea/90',
  },
  {
    chip: 'border-keep/45 bg-keep/15 text-keep',
    heart: 'text-keep fill-keep',
    badge: 'bg-keep text-white',
    onFill: 'border-keep bg-keep text-white hover:bg-keep/90',
  },
  {
    chip: 'border-move/50 bg-move/15 text-move',
    heart: 'text-move fill-move',
    badge: 'bg-move text-white',
    onFill: 'border-move bg-move text-white hover:bg-move/90',
  },
  {
    chip: 'border-warn/45 bg-[#f6ebd6] text-warn',
    heart: 'text-warn fill-warn',
    badge: 'bg-warn text-white',
    onFill: 'border-warn bg-warn text-white hover:bg-warn/90',
  },
  {
    chip: 'border-[#6b8e7a]/45 bg-[#e6f0ea] text-[#3f5e4e]',
    heart: 'text-[#4f7261] fill-[#4f7261]',
    badge: 'bg-[#4f7261] text-white',
    onFill: 'border-[#4f7261] bg-[#4f7261] text-white hover:bg-[#436355]',
  },
  {
    chip: 'border-[#b56b6b]/40 bg-[#f6e8e8] text-[#7a3d3d]',
    heart: 'text-[#b56b6b] fill-[#b56b6b]',
    badge: 'bg-[#b56b6b] text-white',
    onFill: 'border-[#b56b6b] bg-[#b56b6b] text-white hover:bg-[#a35c5c]',
  },
  {
    chip: 'border-[#5c7a99]/45 bg-[#e8eef5] text-[#3a5470]',
    heart: 'text-[#5c7a99] fill-[#5c7a99]',
    badge: 'bg-[#5c7a99] text-white',
    onFill: 'border-[#5c7a99] bg-[#5c7a99] text-white hover:bg-[#4f6b88]',
  },
] as const

type LikerSwatch = (typeof LIKER_SWATCHES)[number]

function hashUserId(userId: string): number {
  let h = 2166136261
  for (let i = 0; i < userId.length; i++) {
    h ^= userId.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function swatchForUser(userId: string): LikerSwatch {
  return LIKER_SWATCHES[hashUserId(userId) % LIKER_SWATCHES.length]!
}

/** Liked places first, ordered by most recently liked; then recently added. */
function sortByRecentlyLiked(a: SavedPlace, b: SavedPlace): number {
  const aLike = lastLikedMs(a)
  const bLike = lastLikedMs(b)
  if (aLike !== bLike) return bLike - aLike
  const aHas = aLike > 0 || isLikedByMe(a)
  const bHas = bLike > 0 || isLikedByMe(b)
  if (aHas !== bHas) return aHas ? -1 : 1
  return sortByRecentlyAdded(a, b)
}

/** Per-user likers for shared boards, most recent heart first. */
function likedByPeople(
  place: SavedPlace,
  currentUserId: string | undefined,
): { key: string; label: string; swatch: LikerSwatch }[] {
  const likers =
    place.likedBy && place.likedBy.length
      ? [...place.likedBy].sort((a, b) => ms(b.likedAt) - ms(a.likedAt))
      : (place.likedByUserIds ?? []).map((userId) => ({
          userId,
          displayName: 'Someone',
          likedAt: null as string | null,
        }))

  return likers.map((l) => {
    const isMe = Boolean(currentUserId && l.userId === currentUserId)
    return {
      key: l.userId,
      label: isMe ? 'You' : l.displayName || 'Someone',
      swatch: swatchForUser(l.userId),
    }
  })
}

type ListSort = 'recent' | 'liked' | 'monthly_asc' | 'monthly_desc'

function countActiveFilters(
  listSort: ListSort,
  petsFilter: PetsFilter,
  homeTypeFilter: HomeTypeFilter,
  mutualOnly: boolean,
  cityFilterActive: boolean,
): number {
  return (
    (listSort !== 'recent' ? 1 : 0) +
    (petsFilter !== 'all' ? 1 : 0) +
    (homeTypeFilter !== 'all' ? 1 : 0) +
    (mutualOnly ? 1 : 0) +
    (cityFilterActive ? 1 : 0)
  )
}

/** Monthly rent for pricing sorts (rental-first product). Buy list prices are not used. */
function monthlyCost(place: SavedPlace): number | null {
  if (place.listingKind === 'buy') return null
  return place.monthlyEstimate != null && Number.isFinite(place.monthlyEstimate)
    ? place.monthlyEstimate
    : null
}

function placeCityKey(place: Pick<SavedPlace, 'city' | 'location'>): string | null {
  const city = placeCityLabel(place)
  return city ? cityKey(city) : null
}

function citiesFromPlaces(
  places: SavedPlace[],
): { key: string; label: string; count: number }[] {
  const map = new Map<string, { label: string; count: number }>()
  for (const place of places) {
    const city = placeCityLabel(place)
    if (!city) continue
    const key = cityKey(city)
    const existing = map.get(key)
    if (existing) {
      existing.count += 1
    } else {
      map.set(key, { label: city, count: 1 })
    }
  }
  return [...map.entries()]
    .map(([key, value]) => ({ key, label: value.label, count: value.count }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
}

function placeMatchesCities(place: SavedPlace, selectedKeys: string[]): boolean {
  if (!selectedKeys.length) return true
  const key = placeCityKey(place)
  return key != null && selectedKeys.includes(key)
}

function sortPlaces(
  places: SavedPlace[],
  sort: ListSort,
  petsFilter: PetsFilter,
  homeTypeFilter: HomeTypeFilter,
  cityKeys: string[],
  mutualOnly: boolean,
): SavedPlace[] {
  let next = places.filter((p) => {
    if (!matchesPetsFilter(p, petsFilter)) return false
    if (!matchesHomeTypeFilter(p, homeTypeFilter)) return false
    if (!placeMatchesCities(p, cityKeys)) return false
    if (mutualOnly && !isMutualLike(p)) return false
    return true
  })

  const byMissingLast = (value: number | null, dir: 1 | -1) => {
    if (value == null) return Number.POSITIVE_INFINITY
    return dir === 1 ? value : -value
  }

  next = [...next].sort((a, b) => {
    if (sort === 'monthly_asc' || sort === 'monthly_desc') {
      const dir = sort === 'monthly_asc' ? 1 : -1
      const byRent =
        byMissingLast(monthlyCost(a), dir as 1 | -1) -
        byMissingLast(monthlyCost(b), dir as 1 | -1)
      if (byRent !== 0) return byRent
      if (a.listingKind !== b.listingKind) {
        return a.listingKind === 'rent' ? -1 : 1
      }
      // Liker timestamps matter when comparing hearts
      if (lastLikedMs(a) || lastLikedMs(b)) {
        return sortByRecentlyLiked(a, b)
      }
      return sortByRecentlyAdded(a, b)
    }
    if (sort === 'liked' || mutualOnly) {
      return sortByRecentlyLiked(a, b)
    }
    return sortByRecentlyAdded(a, b)
  })

  return next
}

export function PlacesWorkspace({
  app,
  auth,
  collab,
  onOpenAccount,
}: {
  app: AppController
  auth: AuthController
  collab: CollaborationController
  onOpenAccount: () => void
}) {
  const [form, setForm] = useState<PlaceForm>(emptyForm())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [view, setView] = useState<'list' | 'tiers' | 'compare'>('list')
  const [compareIds, setCompareIds] = useState<string[]>([])
  const [imageDraft, setImageDraft] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [listSort, setListSort] = useState<ListSort>('recent')
  const [petsFilter, setPetsFilter] = useState<PetsFilter>(DEFAULT_PETS_FILTER)
  const [homeTypeFilter, setHomeTypeFilter] = useState<HomeTypeFilter>(
    DEFAULT_HOME_TYPE_FILTER,
  )
  const [mutualOnly, setMutualOnly] = useState(false)
  const [cityKeys, setCityKeys] = useState<string[]>([])
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [shareOpen, setShareOpen] = useState(false)
  const [listsOpen, setListsOpen] = useState(false)
  const [listPickerOpen, setListPickerOpen] = useState(false)
  const [selectMoreOpen, setSelectMoreOpen] = useState(false)
  const [headerRenameOpen, setHeaderRenameOpen] = useState(false)
  const [headerRenameValue, setHeaderRenameValue] = useState('')
  const [headerRenameBusy, setHeaderRenameBusy] = useState(false)
  const [copyPlaceId, setCopyPlaceId] = useState<string | null>(null)
  const [bulkCopyOpen, setBulkCopyOpen] = useState(false)
  const [listToast, setListToast] = useState<string | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [bulkDeleteBusy, setBulkDeleteBusy] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<
    | { kind: 'single'; id: string; title: string }
    | { kind: 'bulk'; ids: string[] }
    | null
  >(null)
  const [lightbox, setLightbox] = useState<{
    images: string[]
    index: number
    title?: string
  } | null>(null)
  const [isMdUp, setIsMdUp] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(min-width: 768px)').matches
      : true,
  )

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const onChange = () => setIsMdUp(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const allPlaces = collab.cloudActive ? collab.places : app.places

  const persistPlace = (place: SavedPlace) => {
    if (collab.cloudActive) {
      void collab.upsertPlace(place).catch((e) => {
        alert(e instanceof Error ? e.message : 'Could not save place to cloud.')
        app.upsertPlace(place)
      })
    } else {
      app.upsertPlace(place)
    }
  }

  const deletePlace = (id: string) => {
    if (collab.cloudActive) {
      void collab.removePlace(id).catch((e) => {
        alert(e instanceof Error ? e.message : 'Could not delete from cloud.')
        app.removePlace(id)
      })
    } else {
      app.removePlace(id)
    }
  }

  const deleteSelectedPlaces = async (ids: string[]) => {
    const unique = [...new Set(ids)]
    if (!unique.length) return
    if (collab.cloudActive) {
      setBulkDeleteBusy(true)
      try {
        const result = await collab.removePlaces(unique)
        if (result.failed > 0) {
          setListToast(
            `Removed ${result.removed}; ${result.failed} could not be deleted.`,
          )
        } else {
          setListToast(
            `Removed ${result.removed} place${result.removed === 1 ? '' : 's'}.`,
          )
        }
      } catch (e) {
        setListToast(
          e instanceof Error ? e.message : 'Could not delete from cloud.',
        )
      } finally {
        setBulkDeleteBusy(false)
      }
    } else {
      app.removePlaces(unique)
      setListToast(
        `Removed ${unique.length} place${unique.length === 1 ? '' : 's'}.`,
      )
    }
    setSelectedIds((prev) => prev.filter((id) => !unique.includes(id)))
    setBulkCopyOpen(false)
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    )
  }

  const selectAllVisible = () => {
    setSelectedIds(listPlaces.map((p) => p.id))
  }

  const clearSelection = () => setSelectedIds([])

  const openLightbox = (images: string[], index = 0, title?: string) => {
    const clean = images.filter(Boolean)
    if (!clean.length) return
    setLightbox({
      images: clean,
      index: Math.min(Math.max(0, index), clean.length - 1),
      title,
    })
  }

  const moveBudget = app.finance?.moveMonthly ?? null

  const availableCities = useMemo(() => citiesFromPlaces(allPlaces), [allPlaces])

  const savedCityNames = useMemo(
    () => availableCities.map((c) => c.label),
    [availableCities],
  )

  // Drop city selections that no longer exist in saved places
  const activeCityKeys = useMemo(() => {
    if (!cityKeys.length) return [] as string[]
    const known = new Set(availableCities.map((c) => c.key))
    return cityKeys.filter((key) => known.has(key))
  }, [cityKeys, availableCities])

  const listPlaces = useMemo(() => {
    return sortPlaces(
      allPlaces,
      listSort,
      petsFilter,
      homeTypeFilter,
      activeCityKeys,
      mutualOnly,
    )
  }, [
    allPlaces,
    listSort,
    petsFilter,
    homeTypeFilter,
    activeCityKeys,
    mutualOnly,
  ])

  const boardPlaces = useMemo(() => {
    let base = allPlaces.filter(
      (p) =>
        matchesPetsFilter(p, petsFilter) &&
        matchesHomeTypeFilter(p, homeTypeFilter),
    )
    if (mutualOnly) base = base.filter(isMutualLike)
    if (activeCityKeys.length) {
      base = base.filter((p) => placeMatchesCities(p, activeCityKeys))
    }
    return [...base].sort(sortByRecentlyAdded)
  }, [allPlaces, petsFilter, homeTypeFilter, mutualOnly, activeCityKeys])

  const cityFilterActive = activeCityKeys.length > 0
  const petsFilterActive = petsFilter !== 'all'
  const homeTypeFilterActive = homeTypeFilter !== 'all'
  const hasActiveFilters =
    petsFilterActive || homeTypeFilterActive || mutualOnly || cityFilterActive
  const activeFilterCount = countActiveFilters(
    listSort,
    petsFilter,
    homeTypeFilter,
    mutualOnly,
    cityFilterActive,
  )

  const clearAllFilters = () => {
    setListSort('recent')
    setPetsFilter('all')
    setHomeTypeFilter('all')
    setMutualOnly(false)
    setCityKeys([])
  }

  const toggleLike = (place: SavedPlace) => {
    const nextLiked = !isLikedByMe(place)
    if (collab.cloudActive) {
      void collab.setLiked(place.id, nextLiked).catch((e) => {
        alert(e instanceof Error ? e.message : 'Could not update like.')
      })
      return
    }
    const now = new Date().toISOString()
    persistPlace({
      ...place,
      favorite: nextLiked,
      likedByMe: nextLiked,
      likedAt: nextLiked ? now : null,
      updatedAt: now,
    })
  }

  const save = () => {
    if (!form.title.trim() && !form.url.trim()) {
      alert('Add a title or listing link first.')
      return
    }
    const now = new Date().toISOString()
    const addr = sanitizeAddress({
      street: form.street,
      city: form.city,
      state: form.state,
      zip: form.zip,
    })
    const place: SavedPlace = {
      id: editingId ?? crypto.randomUUID(),
      createdAt: editingId
        ? allPlaces.find((p) => p.id === editingId)?.createdAt || now
        : now,
      updatedAt: now,
      ...form,
      ...addr,
      location: formatPlaceAddress(addr),
      price: form.listingKind === 'buy' ? form.price : null,
      // Price only: rent uses monthly; buy uses list price (no estimated monthly).
      monthlyEstimate: form.listingKind === 'rent' ? form.monthlyEstimate : null,
      pets: form.pets === 'yes' || form.pets === 'limited' ? form.pets : 'no',
      petsNote: form.pets === 'no' ? '' : form.petsNote,
      proTags: form.proTags,
      concernTags: form.concernTags,
      images: form.images.filter(Boolean),
    }
    persistPlace(place)
    setForm(emptyForm())
    setEditingId(null)
    setImageDraft('')
    setFormOpen(false)
  }

  const startEdit = (place: SavedPlace) => {
    setEditingId(place.id)
    setForm(formFromPlace(place))
    setFormOpen(true)
    setImageDraft('')
  }

  const closeForm = () => {
    setFormOpen(false)
    setEditingId(null)
    setForm(emptyForm())
    setImageDraft('')
  }

  const openNewPlace = () => {
    setEditingId(null)
    setForm(emptyForm())
    setFormOpen(true)
    setImageDraft('')
  }

  // Close form on Escape only when lightbox is not covering it
  useEffect(() => {
    if (!formOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !lightbox) closeForm()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [formOpen, lightbox])

  const addImageUrl = () => {
    const url = imageDraft.trim()
    if (!url) return
    setForm((f) =>
      f.images.includes(url) ? f : { ...f, images: [...f.images, url] },
    )
    setImageDraft('')
  }

  const isRent = form.listingKind === 'rent'

  const viewModes = [
    { id: 'list' as const, label: 'List' },
    { id: 'tiers' as const, label: 'Board' },
    { id: 'compare' as const, label: 'Compare' },
  ]

  const filtersBody = (
    <div className="contents">
      <label className="flex min-w-0 flex-col gap-1.5 md:min-w-[11rem]">
        <span className="text-xs font-bold uppercase tracking-wide text-ink-soft">
          Sort
        </span>
        <select
          value={listSort}
          onChange={(e) => setListSort(e.target.value as ListSort)}
          className="h-10 w-full rounded-xl border border-line bg-panel px-2.5 text-sm font-bold text-ink md:h-8 md:rounded-lg"
        >
          <option value="recent">Recently added</option>
          <option value="liked">Recently liked</option>
          <option value="monthly_asc">Rent · low–high</option>
          <option value="monthly_desc">Rent · high–low</option>
        </select>
      </label>

      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="text-xs font-bold uppercase tracking-wide text-ink-soft">
          Pets
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <PetsFilterControl
            value={petsFilter}
            onChange={setPetsFilter}
            size="compact"
          />
          {collab.isSharedList ? (
            <button
              type="button"
              role="switch"
              aria-checked={mutualOnly}
              onClick={() => setMutualOnly((v) => !v)}
              className={cn(
                'inline-flex h-8 items-center gap-1 rounded-full border px-2.5 text-xs font-bold',
                motion.chip,
                mutualOnly
                  ? 'border-honey bg-honey text-white'
                  : 'border-line bg-panel text-ink hover:border-sea',
              )}
            >
              <Heart className={cn('h-3.5 w-3.5', mutualOnly && 'fill-current')} />
              Mutual
            </button>
          ) : null}
        </div>
      </div>

      <label className="flex min-w-0 flex-col gap-1.5 md:min-w-[11rem]">
        <span className="text-xs font-bold uppercase tracking-wide text-ink-soft">
          Home type
        </span>
        <select
          value={homeTypeFilter}
          onChange={(e) =>
            setHomeTypeFilter(e.target.value as HomeTypeFilter)
          }
          className="h-10 w-full rounded-xl border border-line bg-panel px-2.5 text-sm font-bold text-ink md:h-8 md:rounded-lg"
        >
          <option value="all">Any</option>
          {PLACE_HOME_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      {availableCities.length > 0 ? (
        <div className="flex min-w-0 flex-col gap-1.5 md:min-w-[10rem]">
          <span className="text-xs font-bold uppercase tracking-wide text-ink-soft">
            City
          </span>
          <CityFilterMenu
            cities={availableCities}
            selectedKeys={activeCityKeys}
            onChange={setCityKeys}
          />
        </div>
      ) : null}
    </div>
  )

  return (
    <div className="space-y-3 pb-24 md:space-y-5 md:pb-0">
      {/* ── Page chrome: list identity + list-level actions ── */}
      <header className="rounded-[1.25rem] border border-line bg-panel px-3.5 py-3 shadow-[var(--shadow-soft)] md:rounded-[1.75rem] md:px-7 md:py-4">
        {/* Mobile: single identity row */}
        <div className="flex items-center gap-2 md:hidden">
          <div className="min-w-0 flex-1">
            {collab.cloudActive && collab.activeList ? (
              <button
                type="button"
                aria-expanded={listPickerOpen || listsOpen}
                aria-controls="lists-sheet"
                onClick={() => {
                  // Same control opens and closes: manage sheet first, else picker
                  if (listsOpen) {
                    setListsOpen(false)
                    return
                  }
                  if (listPickerOpen) {
                    setListPickerOpen(false)
                    return
                  }
                  setListPickerOpen(true)
                }}
                className={cn(
                  'flex w-full min-w-0 items-center gap-1 text-left',
                  motion.chip,
                  (listPickerOpen || listsOpen) && 'text-sea-deep',
                )}
              >
                <span className="truncate font-display text-[1.65rem] font-semibold leading-tight tracking-[-0.02em] text-ink">
                  {collab.activeList.name}
                </span>
                {listPickerOpen || listsOpen ? (
                  <ChevronUp className="h-5 w-5 shrink-0 text-sea-deep" />
                ) : (
                  <ChevronDown className="h-5 w-5 shrink-0 text-ink-soft" />
                )}
              </button>
            ) : (
              <h1 className="font-display text-[1.65rem] font-semibold tracking-[-0.02em] text-ink">
                Places
              </h1>
            )}
            <p className="mt-0.5 truncate text-xs text-ink-soft">
              {collab.cloudActive
                ? collab.isSharedList
                  ? 'Shared'
                  : 'Private'
                : 'Local'}
              {' · '}
              {allPlaces.length} place{allPlaces.length === 1 ? '' : 's'}
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            className="h-10 min-h-10 shrink-0 rounded-full px-3"
            onClick={() => setShareOpen(true)}
            title="Share list"
            aria-label="Share list"
          >
            <Share2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Desktop: existing expanded header */}
        <div className="hidden items-center justify-between gap-3 md:flex">
          <div className="min-w-0">
            <h1 className="font-display text-3xl font-semibold tracking-[-0.02em] text-ink md:text-4xl">
              Places
            </h1>
            {collab.cloudActive && collab.activeList ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {headerRenameOpen && collab.activeList.role === 'owner' ? (
                  <form
                    className="flex min-w-0 flex-wrap items-center gap-2"
                    onSubmit={(e) => {
                      e.preventDefault()
                      const name = headerRenameValue.trim()
                      if (!name || !collab.activeListId) return
                      setHeaderRenameBusy(true)
                      void collab
                        .renamePlaceList(collab.activeListId, name)
                        .then(() => {
                          setHeaderRenameOpen(false)
                          setListToast(`List renamed to “${name}”.`)
                        })
                        .catch((err) => {
                          setListToast(
                            err instanceof Error
                              ? err.message
                              : 'Could not rename list.',
                          )
                        })
                        .finally(() => setHeaderRenameBusy(false))
                    }}
                  >
                    <TextInput
                      className="h-10 min-h-10 w-[min(100%,16rem)]"
                      value={headerRenameValue}
                      onChange={(e) => setHeaderRenameValue(e.target.value)}
                      autoFocus
                      aria-label="List name"
                      disabled={headerRenameBusy}
                    />
                    <Button
                      type="submit"
                      variant="primary"
                      className="h-9 min-h-9 px-3 text-sm"
                      disabled={headerRenameBusy || !headerRenameValue.trim()}
                    >
                      Save
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-9 min-h-9 px-3 text-sm"
                      disabled={headerRenameBusy}
                      onClick={() => setHeaderRenameOpen(false)}
                    >
                      Cancel
                    </Button>
                  </form>
                ) : (
                  <>
                    <label className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-ink-soft">
                      <FolderOpen className="h-4 w-4 shrink-0" />
                      <span className="sr-only">Active list</span>
                      <select
                        className="max-w-[min(100%,18rem)] rounded-xl border border-line bg-folio px-2.5 py-1.5 text-sm font-bold text-ink"
                        value={collab.activeListId ?? ''}
                        onChange={(e) => void collab.selectList(e.target.value)}
                      >
                        {collab.lists.map((list) => (
                          <option key={list.id} value={list.id}>
                            {list.name}
                            {listIsShared(list) ? ' · shared' : ' · private'}
                            {list.role !== 'owner' ? ` · ${list.role}` : ''}
                          </option>
                        ))}
                      </select>
                    </label>
                    {collab.activeList.role === 'owner' ? (
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-9 min-h-9 px-2.5 text-sm"
                        title="Rename this list"
                        onClick={() => {
                          setHeaderRenameValue(collab.activeList?.name ?? '')
                          setHeaderRenameOpen(true)
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Rename
                      </Button>
                    ) : null}
                  </>
                )}
              </div>
            ) : (
              <p className="mt-1 text-sm text-ink-soft">
                Sign in to use multiple private or shared lists (great for clients or partners).
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {collab.cloudActive ? (
              <Button
                variant={listsOpen ? 'primary' : 'secondary'}
                onClick={() => setListsOpen((v) => !v)}
              >
                <FolderOpen className="h-4 w-4" />
                Lists
              </Button>
            ) : null}
            <Button
              variant="secondary"
              onClick={() => setShareOpen(true)}
              title="Share this list"
            >
              <Share2 className="h-4 w-4" />
              Share list
            </Button>
          </div>
        </div>
      </header>

      {listToast ? (
        <div className="rounded-2xl border border-line bg-folio/90 px-4 py-3 text-sm font-bold text-ink">
          {listToast}
          <button
            type="button"
            className="ml-3 text-ink-soft underline"
            onClick={() => setListToast(null)}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {/* Desktop: inline expand; mobile uses BottomSheet below */}
      {listsOpen && collab.cloudActive ? (
        <div className="hidden md:block">
          <ListsManager
            collab={collab}
            open={listsOpen}
            onClose={() => setListsOpen(false)}
            variant="panel"
          />
        </div>
      ) : null}

      <PendingInvitesBanner collab={collab} />

      {collab.guestImport ? (
        <div className="rounded-[1.5rem] border border-honey/40 bg-honey-soft/80 p-4 md:p-5">
          <p className="font-display text-xl font-semibold text-ink">
            Import guest places?
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            This device has {collab.guestImport.placeCount} place
            {collab.guestImport.placeCount === 1 ? '' : 's'} saved while signed out.
            Import them into your private account list, or leave them only as guest data on
            this device.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="honey"
              disabled={collab.busy}
              onClick={() => void collab.acceptGuestImport()}
            >
              Import into my list
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={collab.busy}
              onClick={() => collab.declineGuestImport()}
            >
              Keep separate
            </Button>
          </div>
        </div>
      ) : null}

      {/* Select: sticky bottom on mobile, inline bar on desktop */}
      {selectMode ? (
        <div
          className={cn(
            'z-40 flex items-center gap-1.5 border border-line bg-panel/95 px-2.5 py-2 shadow-[var(--shadow-lift)] backdrop-blur-md sm:flex-wrap sm:gap-2 sm:px-3 sm:py-2.5',
            'fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] rounded-2xl',
            'md:static md:inset-auto md:rounded-[1.5rem] md:bg-folio/90 md:px-4 md:py-3 md:shadow-[var(--shadow-soft)] md:backdrop-blur-none',
          )}
        >
          <p className="min-w-0 shrink-0 text-sm font-bold tabular-nums text-ink">
            {selectedIds.length}
            <span className="hidden sm:inline"> selected</span>
          </p>
          <Button
            type="button"
            variant="ghost"
            className="hidden min-h-11 px-2.5 text-sm sm:inline-flex md:min-h-9 md:h-9"
            onClick={selectAllVisible}
          >
            All shown
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="hidden min-h-11 px-2.5 text-sm md:inline-flex md:h-9 md:min-h-9"
            onClick={() => setSelectedIds(allPlaces.map((p) => p.id))}
          >
            Full list
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="hidden min-h-11 px-2.5 text-sm sm:inline-flex md:h-9 md:min-h-9"
            onClick={clearSelection}
          >
            Clear
          </Button>
          {selectedIds.length > 0 && collab.cloudActive ? (
            <div className="relative hidden sm:block">
              <Button
                type="button"
                variant="secondary"
                className="min-h-11 px-2.5 text-sm md:h-9 md:min-h-9"
                onClick={() => setBulkCopyOpen((v) => !v)}
              >
                <Copy className="h-4 w-4" />
                <span className="hidden sm:inline">Copy</span>
              </Button>
              {bulkCopyOpen ? (
                <div className="absolute bottom-full left-0 z-30 mb-2 w-72 md:bottom-auto md:top-full md:mb-0 md:mt-2">
                  <CopyToListMenu
                    collab={collab}
                    placeIds={selectedIds}
                    onDone={(msg) => {
                      setListToast(msg)
                      setBulkCopyOpen(false)
                    }}
                    onCancel={() => setBulkCopyOpen(false)}
                  />
                </div>
              ) : null}
            </div>
          ) : null}
          {selectedIds.length > 0 ? (
            <Button
              type="button"
              variant="danger"
              className="min-h-11 min-w-11 px-2.5 md:h-9 md:min-h-9"
              onClick={() =>
                setDeleteTarget({ kind: 'bulk', ids: [...selectedIds] })
              }
              aria-label="Delete selected"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          ) : null}
          <Button
            type="button"
            variant="honey"
            className="ml-auto min-h-11 min-w-11 px-3 md:h-9 md:min-h-9"
            onClick={() => setShareOpen(true)}
            disabled={selectedIds.length === 0 && allPlaces.length === 0}
            aria-label="Share"
          >
            <Share2 className="h-4 w-4" />
            <span className="hidden sm:inline">Share</span>
          </Button>
          <div className="relative sm:hidden">
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 min-w-11 px-2"
              aria-label="More select actions"
              aria-expanded={selectMoreOpen}
              onClick={() => setSelectMoreOpen((v) => !v)}
            >
              <MoreHorizontal className="h-5 w-5" />
            </Button>
            {selectMoreOpen ? (
              <div className="absolute bottom-full right-0 z-30 mb-2 min-w-[10rem] overflow-hidden rounded-xl border border-line bg-panel py-1 shadow-[var(--shadow-lift)]">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-bold text-ink hover:bg-folio"
                  onClick={() => {
                    selectAllVisible()
                    setSelectMoreOpen(false)
                  }}
                >
                  All shown
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-bold text-ink hover:bg-folio"
                  onClick={() => {
                    clearSelection()
                    setSelectMoreOpen(false)
                  }}
                >
                  Clear
                </button>
                {selectedIds.length > 0 && collab.cloudActive ? (
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-bold text-ink hover:bg-folio"
                    onClick={() => {
                      setBulkCopyOpen(true)
                      setSelectMoreOpen(false)
                    }}
                  >
                    <Copy className="h-4 w-4" />
                    Copy to list
                  </button>
                ) : null}
              </div>
            ) : null}
            {bulkCopyOpen && selectedIds.length > 0 && collab.cloudActive ? (
              <div className="absolute bottom-full right-0 z-30 mb-2 w-72 sm:hidden">
                <CopyToListMenu
                  collab={collab}
                  placeIds={selectedIds}
                  onDone={(msg) => {
                    setListToast(msg)
                    setBulkCopyOpen(false)
                  }}
                  onCancel={() => setBulkCopyOpen(false)}
                />
              </div>
            ) : null}
          </div>
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 min-w-11 px-2 md:hidden"
            onClick={() => {
              setSelectMode(false)
              clearSelection()
              setBulkCopyOpen(false)
              setSelectMoreOpen(false)
            }}
            aria-label="Done selecting"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : null}

      <section className="overflow-hidden rounded-[1.25rem] border border-line bg-panel shadow-[var(--shadow-soft)] md:rounded-[1.75rem]">
        {/* View + primary list tools */}
        <div className="flex flex-col gap-2.5 border-b border-line px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3 md:px-5 md:py-3">
          <div
            role="tablist"
            aria-label="Places view"
            className="inline-flex w-full rounded-full border border-line bg-folio p-0.5 sm:w-auto"
          >
            {viewModes.map((mode) => (
              <button
                key={mode.id}
                type="button"
                role="tab"
                aria-selected={view === mode.id}
                onClick={() => setView(mode.id)}
                className={cn(
                  'min-h-9 flex-1 rounded-full px-3 text-sm font-bold sm:flex-none sm:px-4',
                  motion.chip,
                  view === mode.id
                    ? 'bg-sea text-white shadow-[var(--shadow-soft)]'
                    : 'text-ink-soft hover:text-ink',
                )}
              >
                {mode.label}
              </button>
            ))}
          </div>

          {view === 'compare' && moveBudget != null ? (
            <span className="hidden text-sm text-ink-soft md:inline">
              Move budget:{' '}
              <strong className="text-ink">{formatMoney(moveBudget)}</strong>/mo
            </span>
          ) : null}

          <div className="flex items-center gap-1.5 sm:ml-auto">
            <Button
              type="button"
              variant={
                filtersOpen || activeFilterCount > 0 ? 'primary' : 'secondary'
              }
              className="h-9 min-h-9 flex-1 rounded-full px-3 text-sm sm:flex-none md:hidden"
              onClick={() => setFiltersOpen(true)}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filters
              {activeFilterCount > 0 ? (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white/20 px-1.5 text-[11px]">
                  {activeFilterCount}
                </span>
              ) : null}
            </Button>
            <Button
              type="button"
              variant={selectMode ? 'primary' : 'secondary'}
              className="h-9 min-h-9 rounded-full px-3 text-sm"
              onClick={() => {
                setSelectMode((v) => !v)
                if (selectMode) clearSelection()
                setBulkCopyOpen(false)
              }}
            >
              {selectMode ? (
                <CheckSquare className="h-3.5 w-3.5" />
              ) : (
                <Square className="h-3.5 w-3.5" />
              )}
              <span className="sm:inline">Select</span>
            </Button>
            <Button
              type="button"
              variant="honey"
              className="h-9 min-h-9 rounded-full px-3 text-sm"
              onClick={openNewPlace}
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Add place</span>
              <span className="sm:hidden">Add</span>
            </Button>
          </div>
        </div>

        <div className="p-3 md:p-5">
          {view === 'list' ? (
            <div className="space-y-3">
              {/* Desktop filters stay inline; mobile uses Filters sheet */}
              <div className="hidden overflow-visible rounded-xl border border-line bg-folio/50 px-3.5 py-2.5 md:block">
                <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
                  {filtersBody}
                  <p className="ml-auto pb-1 text-xs text-ink-soft">
                    <span className="font-bold text-ink">{listPlaces.length}</span>/
                    {allPlaces.length}
                    {hasActiveFilters ? ' match' : ''}
                  </p>
                </div>
                {(hasActiveFilters || listSort !== 'recent') && (
                  <div className="mt-2 flex justify-end border-t border-line/80 pt-2">
                    <Button
                      variant="ghost"
                      className="h-8 min-h-8 px-2 text-xs"
                      onClick={clearAllFilters}
                    >
                      Reset
                    </Button>
                  </div>
                )}
              </div>

              {/* Mobile: slim active-filter summary */}
              {activeFilterCount > 0 ? (
                <div className="flex items-center gap-2 md:hidden">
                  <p className="min-w-0 flex-1 truncate text-xs text-ink-soft">
                    <span className="font-bold text-ink">{listPlaces.length}</span>{' '}
                    of {allPlaces.length}
                    {hasActiveFilters ? ' match filters' : ''}
                  </p>
                  <button
                    type="button"
                    className="shrink-0 text-xs font-bold text-sea-deep"
                    onClick={clearAllFilters}
                  >
                    Clear
                  </button>
                </div>
              ) : (
                <p className="text-xs text-ink-soft md:hidden">
                  <span className="font-bold text-ink">{listPlaces.length}</span>{' '}
                  places
                </p>
              )}

              {listPlaces.length === 0 ? (
                allPlaces.length === 0 ? (
                  <EmptyPlaces onAdd={openNewPlace} />
                ) : (
                  <div className="rounded-2xl border border-dashed border-line bg-folio/60 px-6 py-10 text-center">
                    <p className="font-display text-xl font-semibold text-ink">
                      No places match these filters
                    </p>
                    <p className="mt-2 text-ink-soft">
                      Try All under Pets, pick more cities, or reset filters.
                    </p>
                    <Button
                      className="mt-4"
                      variant="secondary"
                      onClick={clearAllFilters}
                    >
                      Clear filters
                    </Button>
                  </div>
                )
              ) : (
                <div className="space-y-2.5">
                  {listPlaces.map((place) => (
                    <PlaceCard
                      key={place.id}
                      place={place}
                      moveBudget={moveBudget}
                      selectMode={selectMode}
                      checked={selectedIds.includes(place.id)}
                      onToggleSelect={() => toggleSelect(place.id)}
                      onOpenImages={openLightbox}
                      onFavorite={() => toggleLike(place)}
                      likedBy={
                        collab.isSharedList
                          ? likedByPeople(place, auth.user?.id)
                          : []
                      }
                      mySwatch={
                        auth.user?.id ? swatchForUser(auth.user.id) : undefined
                      }
                      onEdit={() => startEdit(place)}
                      onCopyToList={
                        collab.cloudActive
                          ? () =>
                              setCopyPlaceId((id) =>
                                id === place.id ? null : place.id,
                              )
                          : undefined
                      }
                      copyMenu={
                        copyPlaceId === place.id && collab.cloudActive ? (
                          <CopyToListMenu
                            collab={collab}
                            placeIds={[place.id]}
                            onDone={(msg) => {
                              setListToast(msg)
                              setCopyPlaceId(null)
                            }}
                            onCancel={() => setCopyPlaceId(null)}
                          />
                        ) : null
                      }
                      onDelete={() =>
                        setDeleteTarget({
                          kind: 'single',
                          id: place.id,
                          title: place.title || 'Untitled place',
                        })
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {view === 'tiers' ? (
            <div className="space-y-4">
              <div className="hidden overflow-visible rounded-xl border border-line bg-folio/50 px-3 py-2.5 md:block">
                <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
                  {filtersBody}
                  <p className="ml-auto pb-1 text-xs text-ink-soft">
                    {hasActiveFilters
                      ? `${boardPlaces.length} match`
                      : `${boardPlaces.length} places`}
                  </p>
                </div>
              </div>
              {activeFilterCount > 0 ? (
                <div className="flex items-center gap-2 md:hidden">
                  <p className="min-w-0 flex-1 truncate text-xs text-ink-soft">
                    <span className="font-bold text-ink">{boardPlaces.length}</span>{' '}
                    match filters
                  </p>
                  <button
                    type="button"
                    className="shrink-0 text-xs font-bold text-sea-deep"
                    onClick={clearAllFilters}
                  >
                    Clear
                  </button>
                </div>
              ) : null}
              {TIERS.map((tier) => {
                const placesInTier = boardPlaces.filter((p) => p.tier === tier)
                const empty = placesInTier.length === 0
                return (
                  <div
                    key={tier}
                    className={cn(
                      'rounded-2xl border border-line bg-folio/70',
                      empty ? 'px-3 py-2.5 md:p-5' : 'p-3 md:p-5',
                    )}
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3
                        className={cn(
                          'font-display font-semibold text-ink',
                          empty
                            ? 'text-base md:text-xl'
                            : 'text-lg md:text-xl',
                        )}
                      >
                        {TIER_LABEL[tier]}
                      </h3>
                      <span className="text-xs font-bold text-ink-soft md:text-sm">
                        {empty
                          ? 'Empty'
                          : `${placesInTier.length} ${
                              placesInTier.length === 1 ? 'place' : 'places'
                            }`}
                      </span>
                    </div>

                    {empty ? null : (
                      <>
                        {/* Mobile: photo-led rows — gallery on photo, edit on details */}
                        <ul className="mt-3 space-y-2.5 md:hidden">
                          {placesInTier.map((place) => {
                            const images = placeImages(place)
                            const selected = selectedIds.includes(place.id)
                            return (
                              <li
                                key={place.id}
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
                                        title={place.title || 'Untitled'}
                                        onOpen={openLightbox}
                                        showCue
                                        className="absolute inset-0 h-full w-full"
                                        imgClassName="h-full w-full"
                                      />
                                    ) : (
                                      <div className="flex h-full min-h-[7.25rem] items-center justify-center px-2 text-center text-xs text-ink-soft">
                                        No photo
                                      </div>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      selectMode
                                        ? toggleSelect(place.id)
                                        : startEdit(place)
                                    }
                                    className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 px-3 py-3 text-left"
                                  >
                                    <p className="line-clamp-2 text-[0.95rem] font-bold leading-snug text-ink">
                                      {place.title || 'Untitled'}
                                    </p>
                                    <p className="flex flex-wrap items-center gap-1.5 text-sm text-ink-soft">
                                      <span className="font-semibold text-ink">
                                        {primaryCostLabel(place)}
                                      </span>
                                      <PetsBadge
                                        pets={place.pets ?? 'no'}
                                        compact
                                      />
                                    </p>
                                    <span className="mt-0.5 inline-flex items-center gap-0.5 text-xs font-bold text-sea-deep">
                                      {selectMode
                                        ? selected
                                          ? 'Selected'
                                          : 'Tap to select'
                                        : 'Edit details'}
                                      <ChevronRight
                                        className="h-3.5 w-3.5"
                                        aria-hidden
                                      />
                                    </span>
                                  </button>
                                </div>
                              </li>
                            )
                          })}
                        </ul>

                        {/* Desktop: horizontal snap rails */}
                        <div className="mt-4 hidden gap-3 overflow-x-auto scroll-smooth pb-1 md:flex md:snap-x md:snap-mandatory">
                          {placesInTier.map((place) => {
                            const images = placeImages(place)
                            const selected = selectedIds.includes(place.id)
                            return (
                              <div
                                key={place.id}
                                className={cn(
                                  'w-[min(17rem,70vw)] shrink-0 snap-start overflow-hidden rounded-2xl border bg-panel shadow-[var(--shadow-soft)]',
                                  motion.color,
                                  selectMode && selected
                                    ? 'border-sea ring-2 ring-sea/25'
                                    : 'border-line hover:border-sea',
                                )}
                              >
                                {images[0] ? (
                                  <OpenableImage
                                    images={images}
                                    index={0}
                                    title={place.title || 'Untitled'}
                                    onOpen={openLightbox}
                                    showCue
                                    className="h-36 w-full"
                                    imgClassName="h-36"
                                  />
                                ) : (
                                  <div className="flex h-36 items-center justify-center bg-folio text-sm text-ink-soft">
                                    No photo
                                  </div>
                                )}
                                <button
                                  type="button"
                                  onClick={() =>
                                    selectMode
                                      ? toggleSelect(place.id)
                                      : startEdit(place)
                                  }
                                  className="w-full p-3.5 text-left"
                                >
                                  <p className="line-clamp-2 font-bold text-ink">
                                    {place.title || 'Untitled'}
                                  </p>
                                  <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-sm text-ink-soft">
                                    <span className="font-semibold text-ink">
                                      {primaryCostLabel(place)}
                                    </span>
                                    <PetsBadge
                                      pets={place.pets ?? 'no'}
                                      compact
                                    />
                                  </p>
                                  <span className="mt-2 inline-flex items-center gap-0.5 text-xs font-bold text-sea-deep">
                                    {selectMode
                                      ? selected
                                        ? 'Selected'
                                        : 'Tap to select'
                                      : 'Edit details'}
                                    <ChevronRight
                                      className="h-3.5 w-3.5"
                                      aria-hidden
                                    />
                                  </span>
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          ) : null}

          {view === 'compare' ? (
            <div className="space-y-5">
              {compareIds.length > 0 ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line bg-folio/60 px-4 py-2.5">
                    <p className="text-sm text-ink-soft">
                      Comparing{' '}
                      <span className="font-bold text-ink">{compareIds.length}</span> of 3
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-10 min-h-10 px-3 text-sm"
                      onClick={() => setCompareIds([])}
                    >
                      Clear
                    </Button>
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    {compareIds.map((id) => {
                      const place = allPlaces.find((p) => p.id === id)
                      if (!place) return null
                      const images = placeImages(place)
                      const overBudget =
                        place.listingKind === 'rent' &&
                        moveBudget != null &&
                        place.monthlyEstimate != null &&
                        place.monthlyEstimate > moveBudget
                      return (
                        <div
                          key={id}
                          className="overflow-hidden rounded-2xl border border-line bg-folio/50"
                        >
                          {images[0] ? (
                            <OpenableImage
                              images={images}
                              index={0}
                              title={place.title || 'Untitled'}
                              onOpen={openLightbox}
                              className="h-32 w-full"
                              imgClassName="h-32"
                            />
                          ) : null}
                          <div className="p-3.5">
                            <div className="flex items-start justify-between gap-2">
                              <p className="font-bold leading-snug text-ink">
                                {place.title || 'Untitled'}
                              </p>
                              <button
                                type="button"
                                className="shrink-0 text-sm font-bold text-ink-soft hover:text-ink"
                                onClick={() =>
                                  setCompareIds((ids) => ids.filter((x) => x !== id))
                                }
                              >
                                Remove
                              </button>
                            </div>
                            <p className="mt-1 line-clamp-1 text-sm text-ink-soft">
                              {place.location || place.city || 'Location not set'}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                              <span className="text-sm font-bold text-sea-deep">
                                {place.listingKind === 'rent' ? 'Rental' : 'Buy'}
                              </span>
                              <span className="text-ink-soft">·</span>
                              <span className="text-sm font-bold text-ink">
                                {TIER_LABEL[place.tier]}
                              </span>
                              <PetsBadge pets={place.pets ?? 'no'} compact />
                            </div>
                            <p className="mt-2 text-lg font-bold">{primaryCostLabel(place)}</p>
                            {place.listingKind === 'rent' &&
                            place.monthlyEstimate != null &&
                            moveBudget != null ? (
                              <p
                                className={cn(
                                  'mt-0.5 text-sm font-bold',
                                  overBudget ? 'text-warn' : 'text-move',
                                )}
                              >
                                {overBudget ? 'Above move budget' : 'Within move budget'}
                              </p>
                            ) : null}
                            <TagRow labels={place.proTags} tone="pro" className="mt-2" />
                            <TagRow labels={place.concernTags} tone="con" className="mt-1.5" />
                            {place.url ? (
                              <ButtonLink
                                href={place.url}
                                target="_blank"
                                rel="noreferrer"
                                variant="primary"
                                className="mt-3 h-10 min-h-10 w-full rounded-xl px-3.5 text-sm"
                              >
                                <ExternalLink className="h-4 w-4 shrink-0" />
                                Open listing
                              </ButtonLink>
                            ) : null}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              ) : null}

              <div>
                <p className="text-sm font-bold text-ink">
                  {compareIds.length >= 3
                    ? 'Comparison full (3)'
                    : compareIds.length > 0
                      ? 'Add more places'
                      : 'Choose up to 3 places to compare'}
                </p>
                <p className="mt-0.5 text-sm text-ink-soft">
                  Tap Add to include a place, or tap again to remove it. Up to 3.
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {[...allPlaces].sort(sortByRecentlyAdded).map((place) => {
                    const inCompare = compareIds.includes(place.id)
                    const full = compareIds.length >= 3 && !inCompare
                    return (
                      <button
                        key={place.id}
                        type="button"
                        disabled={full}
                        onClick={() =>
                          setCompareIds((ids) =>
                            ids.includes(place.id)
                              ? ids.filter((id) => id !== place.id)
                              : [...ids, place.id].slice(0, 3),
                          )
                        }
                        className={cn(
                          'flex items-center gap-3 rounded-2xl border px-3 py-2.5 text-left disabled:cursor-not-allowed disabled:opacity-45',
                          motion.chip,
                          inCompare
                            ? 'border-sea bg-sea/10 shadow-[var(--shadow-soft)]'
                            : 'border-line bg-folio/50 hover:border-sea hover:bg-folio',
                        )}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-bold text-ink">
                            {place.title || 'Untitled'}
                          </span>
                          <span className="block truncate text-sm text-ink-soft">
                            {primaryCostLabel(place)}
                            {place.city ? ` · ${place.city}` : ''}
                          </span>
                        </span>
                        <span
                          className={cn(
                            'shrink-0 rounded-full px-2.5 py-1 text-xs font-bold',
                            inCompare ? 'bg-sea text-white' : 'bg-panel text-ink-soft',
                          )}
                        >
                          {inCompare ? 'Added' : 'Add'}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <SideDrawer
        open={formOpen}
        onClose={closeForm}
        aria-labelledby="place-form-title"
        panelClassName="max-w-3xl sm:max-w-2xl lg:max-w-3xl"
        closeOnEscape={!lightbox}
      >
                <header className="sticky top-0 z-10 flex shrink-0 items-start justify-between gap-3 border-b border-line bg-panel/95 px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur md:px-6 md:pt-4">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-sea-deep">
                      {editingId ? 'Editing' : 'New place'}
                    </p>
                    <h2
                      id="place-form-title"
                      tabIndex={-1}
                      className="font-display text-2xl font-semibold text-ink outline-none md:text-3xl"
                    >
                      {editingId
                        ? form.title.trim() || 'Edit saved place'
                        : 'Add a place'}
                    </h2>
                    <p className="mt-1 text-sm text-ink-soft">
                      Fill in what you know — you can come back and update anytime.
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    onClick={closeForm}
                    aria-label="Close form"
                    className="min-h-11 min-w-11"
                  >
                    <X className="h-5 w-5" />
                    <span className="hidden sm:inline">Close</span>
                  </Button>
                </header>

                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 md:px-6">
                  <div className="mx-auto max-w-xl space-y-5 pb-8">
                    {/* Type */}
                    <FormSection>
                      <ChoiceGroup
                        legend="Listing type"
                        size="compact"
                        options={[
                          { value: 'rent', label: 'Rental' },
                          { value: 'buy', label: 'Home to buy' },
                        ] as { value: PlaceListingKind; label: string }[]}
                        value={form.listingKind}
                        onChange={(listingKind) =>
                          setForm((f) => ({
                            ...f,
                            listingKind,
                            price: listingKind === 'rent' ? null : f.price,
                            monthlyEstimate:
                              listingKind === 'buy' ? null : f.monthlyEstimate,
                          }))
                        }
                        columns={2}
                      />
                      <Field label="Home type" className="mt-4">
                        <select
                          value={form.homeType ?? ''}
                          onChange={(e) => {
                            const v = e.target.value
                            setForm((f) => ({
                              ...f,
                              homeType:
                                v === 'apartment' ||
                                v === 'condo' ||
                                v === 'single_family' ||
                                v === 'townhome'
                                  ? v
                                  : null,
                            }))
                          }}
                          className="h-12 w-full rounded-xl border border-line bg-panel px-3 text-base font-bold text-ink"
                        >
                          <option value="">Select…</option>
                          {PLACE_HOME_TYPE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </FormSection>

                    {/* Basics */}
                    <FormSection>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Field label="Listing URL" className="sm:col-span-2">
                          <TextInput
                            value={form.url}
                            onChange={(e) =>
                              setForm((f) => ({ ...f, url: e.target.value }))
                            }
                            placeholder="https://…"
                          />
                        </Field>
                        <Field label="Title" className="sm:col-span-2">
                          <TextInput
                            value={form.title}
                            onChange={(e) =>
                              setForm((f) => ({ ...f, title: e.target.value }))
                            }
                            placeholder={
                              isRent ? 'Bright 2-bed apartment' : 'Sunny townhome'
                            }
                          />
                        </Field>
                        <Field label="Street address" className="sm:col-span-2">
                          <TextInput
                            value={form.street}
                            autoComplete="street-address"
                            onChange={(e) =>
                              setForm((f) => ({ ...f, street: e.target.value }))
                            }
                            onBlur={() =>
                              setForm((f) => ({
                                ...f,
                                street: sanitizeStreet(f.street),
                              }))
                            }
                            onPaste={(e) => {
                              const text = e.clipboardData.getData('text')
                              if (!text.includes(',')) return
                              e.preventDefault()
                              const parsed = parseLocationString(text)
                              setForm((f) => ({
                                ...f,
                                street: parsed.street || f.street,
                                city: parsed.city || f.city,
                                state: parsed.state || f.state,
                                zip: parsed.zip || f.zip,
                              }))
                            }}
                            placeholder="123 Main St, Unit 4"
                          />
                          <span className="mt-1 text-xs text-ink-soft">
                            Paste a full listing address here to auto-fill city, state,
                            and ZIP.
                          </span>
                        </Field>
                        <Field label="City" className="sm:col-span-2">
                          <CityCombobox
                            value={form.city}
                            onChange={(city) => setForm((f) => ({ ...f, city }))}
                            extraSuggestions={savedCityNames}
                            placeholder="Pembroke Pines"
                          />
                        </Field>
                        <Field label="State">
                          <TextInput
                            value={form.state}
                            autoComplete="address-level1"
                            maxLength={2}
                            className="uppercase"
                            onChange={(e) =>
                              setForm((f) => ({
                                ...f,
                                state: e.target.value
                                  .toUpperCase()
                                  .replace(/[^A-Z]/g, '')
                                  .slice(0, 2),
                              }))
                            }
                            onBlur={() =>
                              setForm((f) => ({
                                ...f,
                                state: sanitizeState(f.state),
                              }))
                            }
                            placeholder="FL"
                          />
                        </Field>
                        <Field label="ZIP">
                          <TextInput
                            value={form.zip}
                            autoComplete="postal-code"
                            inputMode="numeric"
                            maxLength={10}
                            onChange={(e) =>
                              setForm((f) => ({
                                ...f,
                                zip: e.target.value.replace(/[^\d-]/g, '').slice(0, 10),
                              }))
                            }
                            onBlur={() =>
                              setForm((f) => ({
                                ...f,
                                zip: sanitizeZip(f.zip),
                              }))
                            }
                            placeholder="33026"
                          />
                        </Field>
                      </div>
                    </FormSection>

                    {/* Price — rent = monthly; buy = list. Sort/filter use these. */}
                    <FormSection>
                      {isRent ? (
                        <Field label="Monthly rent">
                          <CurrencyInput
                            value={form.monthlyEstimate ?? 0}
                            onChange={(monthlyEstimate) =>
                              setForm((f) => ({ ...f, monthlyEstimate }))
                            }
                          />
                        </Field>
                      ) : (
                        <Field label="List price">
                          <CurrencyInput
                            value={form.price ?? 0}
                            onChange={(price) => setForm((f) => ({ ...f, price }))}
                          />
                        </Field>
                      )}
                    </FormSection>

                    {/* Layout */}
                    <FormSection>
                      <div className="grid grid-cols-2 gap-4">
                        <Field label="Beds">
                          <NumberInput
                            value={form.bedrooms ?? 0}
                            onChange={(bedrooms) =>
                              setForm((f) => ({ ...f, bedrooms }))
                            }
                          />
                        </Field>
                        <Field label="Baths">
                          <NumberInput
                            value={form.bathrooms ?? 0}
                            onChange={(bathrooms) =>
                              setForm((f) => ({ ...f, bathrooms }))
                            }
                          />
                        </Field>
                      </div>
                    </FormSection>

                    {/* Organize */}
                    <FormSection>
                      <div className="space-y-4">
                        <ChoiceGroup
                          legend="Tier"
                          size="compact"
                          options={TIERS.map((tier) => ({
                            value: tier,
                            label: TIER_LABEL[tier],
                          }))}
                          value={form.tier}
                          onChange={(tier) => setForm((f) => ({ ...f, tier }))}
                          columns={4}
                        />
                        <ChoiceGroup
                          legend="Status"
                          size="compact"
                          options={[
                            { value: 'none', label: 'Not marked' },
                            { value: 'visited', label: 'Visited' },
                            { value: 'offer', label: 'Offer' },
                          ] as { value: PlaceStatus; label: string }[]}
                          value={form.status}
                          onChange={(status) => setForm((f) => ({ ...f, status }))}
                          columns={3}
                        />
                      </div>
                    </FormSection>

                    {/* Pets */}
                    <FormSection>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-bold leading-5 text-ink">
                              Pets allowed
                            </p>
                            <p className="text-xs text-ink-soft">
                              {form.pets === 'no'
                                ? 'Default is no. Turn on for pet-friendly places.'
                                : 'Add rules or deposit notes if you know them.'}
                            </p>
                          </div>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={form.pets !== 'no'}
                            aria-label="Pets allowed"
                            onClick={() =>
                              setForm((f) =>
                                f.pets === 'no'
                                  ? { ...f, pets: 'yes' }
                                  : { ...f, pets: 'no', petsNote: '' },
                              )
                            }
                            className={cn(
                              'inline-flex h-8 w-14 shrink-0 items-center rounded-full px-1',
                              motion.color,
                              form.pets !== 'no' ? 'bg-sea' : 'bg-line',
                            )}
                          >
                            <span
                              className={cn(
                                'h-6 w-6 rounded-full bg-white shadow-sm',
                                motion.transform,
                                form.pets !== 'no' ? 'translate-x-6' : 'translate-x-0',
                              )}
                            />
                          </button>
                        </div>

                        {form.pets !== 'no' ? (
                          <div className="space-y-4 border-t border-line pt-4">
                            <ChoiceGroup
                              legend={
                                isRent
                                  ? 'How flexible for pets?'
                                  : 'HOA / community pet rules'
                              }
                              size="compact"
                              options={[
                                { value: 'yes', label: 'Pets welcome' },
                                { value: 'limited', label: 'Limited / rules' },
                              ] as { value: PetsPolicy; label: string }[]}
                              value={form.pets === 'limited' ? 'limited' : 'yes'}
                              onChange={(pets) => setForm((f) => ({ ...f, pets }))}
                              columns={2}
                            />
                            <Field
                              label="Pet details"
                              hint={
                                isRent
                                  ? 'Deposit, pet rent, size limits…'
                                  : 'Breed rules, HOA limits…'
                              }
                            >
                              <TextInput
                                value={form.petsNote}
                                onChange={(e) =>
                                  setForm((f) => ({ ...f, petsNote: e.target.value }))
                                }
                                placeholder={
                                  isRent
                                    ? 'e.g. Dogs under 40 lb, $35/mo'
                                    : 'e.g. Max 2 pets'
                                }
                              />
                            </Field>
                          </div>
                        ) : null}
                      </div>
                    </FormSection>

                    {/* Photos */}
                    <FormSection>
                      <Field
                        label="Photos"
                        hint="Paste image URLs. Star a photo to make it the main thumbnail, or drag photos to reorder."
                      >
                        <div className="flex gap-2">
                          <TextInput
                            className="min-w-0 flex-1"
                            value={imageDraft}
                            onChange={(e) => setImageDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                addImageUrl()
                              }
                            }}
                            placeholder="https://…/photo.jpg"
                          />
                          <Button
                            type="button"
                            variant="secondary"
                            className="h-12 shrink-0 rounded-xl px-4"
                            onClick={addImageUrl}
                          >
                            Add
                          </Button>
                        </div>
                      </Field>
                      <PlacePhotoEditor
                        images={form.images}
                        title={form.title || 'Saved place'}
                        onOpen={openLightbox}
                        onChange={(images) => setForm((f) => ({ ...f, images }))}
                      />
                    </FormSection>

                    {/* Tags */}
                    <FormSection>
                      <div className="space-y-5">
                        <ChipPicker
                          legend="What I like"
                          suggestions={[
                            ...PRO_SUGGESTIONS,
                            'Pet friendly',
                            'Fenced yard for pets',
                          ]}
                          selected={form.proTags}
                          onChange={(proTags) => setForm((f) => ({ ...f, proTags }))}
                          tone="pro"
                          customPlaceholder="Add your own pro…"
                        />
                        <ChipPicker
                          legend="What concerns me"
                          suggestions={[
                            ...CONCERN_SUGGESTIONS,
                            'No pets allowed',
                            'Pet deposit high',
                          ]}
                          selected={form.concernTags}
                          onChange={(concernTags) =>
                            setForm((f) => ({ ...f, concernTags }))
                          }
                          tone="con"
                          customPlaceholder="Add your own concern…"
                        />
                      </div>
                    </FormSection>

                    <FormSection>
                      <Field label="Notes">
                        <TextTextarea
                          value={form.notes}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, notes: e.target.value }))
                          }
                          placeholder="Tour impressions, questions for the agent…"
                        />
                      </Field>
                    </FormSection>
                  </div>
                </div>

                <footer className="sticky bottom-0 z-10 flex shrink-0 items-center justify-between gap-3 border-t border-line bg-panel/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur md:px-6 md:pb-3">
                  <Button variant="secondary" className="h-12 min-h-12 rounded-xl" onClick={closeForm}>
                    Cancel
                  </Button>
                  <Button
                    className="h-12 min-h-12 rounded-xl"
                    onClick={() => {
                      save()
                    }}
                  >
                    <Plus className="h-4 w-4" />
                    {editingId ? 'Save changes' : 'Save place'}
                  </Button>
                </footer>
      </SideDrawer>

      <AnimatePresence>
        {lightbox ? (
          <ImageLightbox
            key="place-lightbox"
            images={lightbox.images}
            index={lightbox.index}
            title={lightbox.title}
            onClose={() => setLightbox(null)}
            onIndexChange={(index) =>
              setLightbox((prev) => (prev ? { ...prev, index } : prev))
            }
          />
        ) : null}
      </AnimatePresence>

      <ShareSheet
        open={shareOpen}
        collab={collab}
        selectedPlaceIds={
          selectMode && selectedIds.length > 0 ? selectedIds : []
        }
        onClose={() => setShareOpen(false)}
      />

      <BottomSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Sort & filters"
        titleId="filters-sheet-title"
        footer={
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              className="h-11 min-h-11 flex-1 rounded-xl text-sm"
              onClick={clearAllFilters}
            >
              Reset
            </Button>
            <Button
              type="button"
              variant="primary"
              className="h-11 min-h-11 flex-[1.4] rounded-xl text-sm"
              onClick={() => setFiltersOpen(false)}
            >
              Show {view === 'tiers' ? boardPlaces.length : listPlaces.length}{' '}
              place
              {(view === 'tiers' ? boardPlaces.length : listPlaces.length) === 1
                ? ''
                : 's'}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">{filtersBody}</div>
      </BottomSheet>

      <BottomSheet
        open={listPickerOpen && collab.cloudActive && !listsOpen}
        onClose={() => setListPickerOpen(false)}
        title="Switch list"
        titleId="list-picker-title"
        footer={
          <Button
            type="button"
            variant="secondary"
            className="h-11 min-h-11 w-full rounded-xl"
            onClick={() => {
              setListPickerOpen(false)
              setListsOpen(true)
            }}
          >
            <FolderOpen className="h-4 w-4" />
            Manage lists
          </Button>
        }
      >
        <ul className="space-y-1" role="listbox" aria-label="Place lists">
          {collab.lists.map((list) => {
            const active = list.id === collab.activeListId
            return (
              <li key={list.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left',
                    motion.chip,
                    active
                      ? 'bg-sea text-white'
                      : 'text-ink hover:bg-folio',
                  )}
                  onClick={() => {
                    void collab.selectList(list.id)
                    setListPickerOpen(false)
                  }}
                >
                  <span
                    className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
                      active
                        ? 'border-white bg-white text-sea'
                        : 'border-line',
                    )}
                  >
                    {active ? <Check className="h-3.5 w-3.5" /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{list.name}</span>
                    <span
                      className={cn(
                        'block text-xs',
                        active ? 'text-white/80' : 'text-ink-soft',
                      )}
                    >
                      {listIsShared(list) ? 'Shared' : 'Private'}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </BottomSheet>

      <BottomSheet
        open={listsOpen && collab.cloudActive && !isMdUp}
        onClose={() => setListsOpen(false)}
        title="Manage lists"
        titleId="lists-sheet"
        footer={
          <Button
            type="button"
            variant="primary"
            className="h-11 min-h-11 w-full rounded-xl"
            onClick={() => setListsOpen(false)}
          >
            Done
          </Button>
        }
      >
        <ListsManager
          collab={collab}
          open={listsOpen}
          onClose={() => setListsOpen(false)}
          variant="embedded"
        />
      </BottomSheet>

      <ConfirmDialog
        open={deleteTarget != null}
        title={
          deleteTarget?.kind === 'bulk'
            ? `Remove ${deleteTarget.ids.length} places?`
            : 'Remove this place?'
        }
        description={
          deleteTarget?.kind === 'bulk'
            ? `${deleteTarget.ids.length} selected place${
                deleteTarget.ids.length === 1 ? '' : 's'
              } will be removed from this list. This can’t be undone.`
            : deleteTarget?.kind === 'single'
              ? `“${deleteTarget.title}” will be removed from your board. This can’t be undone.`
              : undefined
        }
        confirmLabel={
          deleteTarget?.kind === 'bulk' ? 'Remove places' : 'Remove place'
        }
        cancelLabel="Keep"
        tone="danger"
        busy={bulkDeleteBusy}
        onCancel={() => {
          if (!bulkDeleteBusy) setDeleteTarget(null)
        }}
        onConfirm={() => {
          if (!deleteTarget || bulkDeleteBusy) return
          if (deleteTarget.kind === 'bulk') {
            void deleteSelectedPlaces(deleteTarget.ids).then(() => {
              setDeleteTarget(null)
            })
            return
          }
          deletePlace(deleteTarget.id)
          setDeleteTarget(null)
        }}
      />
    </div>
  )
}

function FormSection({ children }: { children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-panel p-4">
      {children}
    </section>
  )
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

function ChipPicker({
  legend,
  suggestions,
  selected,
  onChange,
  tone,
  customPlaceholder,
}: {
  legend: string
  suggestions: string[]
  selected: string[]
  onChange: (next: string[]) => void
  tone: 'pro' | 'con'
  customPlaceholder: string
}) {
  const [custom, setCustom] = useState('')
  const pool = useMemo(() => {
    const extras = selected.filter((s) => !suggestions.includes(s))
    return [...suggestions, ...extras]
  }, [suggestions, selected])

  const toggle = (label: string) => {
    if (selected.includes(label)) {
      onChange(selected.filter((s) => s !== label))
    } else {
      onChange([...selected, label])
    }
  }

  const addCustom = (e?: FormEvent) => {
    e?.preventDefault()
    const label = custom.trim()
    if (!label) return
    if (!selected.includes(label)) onChange([...selected, label])
    setCustom('')
  }

  return (
    <fieldset>
      <legend className="text-sm font-bold leading-5 text-ink">{legend}</legend>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {pool.map((label) => {
          const on = selected.includes(label)
          return (
            <button
              key={label}
              type="button"
              onClick={() => toggle(label)}
              aria-pressed={on}
              className={cn(
                'h-9 rounded-full border px-3 text-sm font-bold',
                motion.chip,
                on &&
                  tone === 'pro' &&
                  'border-move bg-move text-white shadow-[var(--shadow-soft)]',
                on &&
                  tone === 'con' &&
                  'border-warn bg-warn text-white shadow-[var(--shadow-soft)]',
                !on && 'border-line bg-panel text-ink hover:border-sea hover:bg-folio',
              )}
            >
              {label}
            </button>
          )
        })}
      </div>
      <form onSubmit={addCustom} className="mt-3 flex gap-2">
        <TextInput
          className="min-w-0 flex-1"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder={customPlaceholder}
        />
        <Button type="submit" variant="secondary" className="h-12 shrink-0 rounded-xl px-4">
          Add
        </Button>
      </form>
    </fieldset>
  )
}

function PlaceCard({
  place,
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
  onCopyToList,
  copyMenu,
}: {
  place: SavedPlace
  moveBudget: number | null
  selectMode: boolean
  checked: boolean
  /** Shared list: each person who liked, newest first */
  likedBy?: { key: string; label: string; swatch: LikerSwatch }[]
  /** Stable color for the signed-in user’s heart */
  mySwatch?: LikerSwatch
  onToggleSelect: () => void
  onOpenImages: (images: string[], index: number, title?: string) => void
  onFavorite: () => void
  onEdit: () => void
  onDelete: () => void
  onCopyToList?: () => void
  copyMenu?: ReactNode
}) {
  const [menuOpen, setMenuOpen] = useState(false)
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
        'overflow-hidden rounded-2xl border bg-panel shadow-[var(--shadow-soft)] sm:flex sm:rounded-[1.25rem]',
        motion.color,
        checked ? 'border-sea ring-2 ring-sea/25' : 'border-line sm:hover:border-sea/60',
      )}
    >
      {/* Media — full-bleed on mobile (Airbnb/Zillow style), rail on desktop */}
      <div className="relative sm:w-36 sm:shrink-0 md:w-40">
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
            className="aspect-[16/10] w-full sm:aspect-auto sm:h-full sm:min-h-[7.5rem]"
            imgClassName="h-full w-full object-cover sm:min-h-[7.5rem]"
          />
        ) : (
          <div className="flex aspect-[16/10] w-full items-center justify-center bg-folio text-xs font-bold text-ink-soft sm:aspect-auto sm:min-h-[7.5rem]">
            No photo
          </div>
        )}
        {images.length > 1 ? (
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
              'absolute right-2.5 top-2.5 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/40 bg-ink/35 text-white backdrop-blur-sm sm:hidden',
              motion.chip,
              liked && meTone.onFill,
            )}
          >
            <Heart className={cn('h-4 w-4', liked && 'fill-current')} />
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

      <div className="flex min-w-0 flex-1 flex-col justify-between gap-2 p-3.5 sm:gap-2 sm:px-4 sm:py-3">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] font-bold leading-none text-sea-deep sm:text-xs">
              <span>{place.listingKind === 'rent' ? 'Rental' : 'Buy'}</span>
              <span className="text-line" aria-hidden>
                ·
              </span>
              <span>{TIER_LABEL[place.tier]}</span>
              {place.status !== 'none' ? (
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
              <h3 className="font-display text-xl font-semibold leading-snug tracking-[-0.02em] text-ink sm:text-xl">
                <span className="line-clamp-2 sm:line-clamp-1">
                  {place.title || 'Untitled place'}
                </span>
              </h3>
            </button>

            <p className="mt-0.5 truncate text-sm text-ink-soft">{locationLine}</p>
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
                    liked && meTone.onFill,
                  )}
                  onClick={onFavorite}
                  aria-pressed={liked}
                  aria-label={liked ? 'Unlike place' : 'Like place'}
                >
                  <Heart
                    className={cn(
                      'h-3.5 w-3.5',
                      liked ? 'fill-current' : meTone.heart,
                    )}
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

        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <span
              className={cn(
                'text-lg font-bold tabular-nums sm:text-lg',
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
              <span className="text-sm text-ink-soft">{bedsBaths}</span>
            ) : null}
            {likedBy.length > 0 ? (
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

          {(place.proTags?.length || place.concernTags?.length) ? (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <TagRow labels={place.proTags} tone="pro" max={3} />
              <TagRow labels={place.concernTags} tone="con" max={2} />
            </div>
          ) : null}

          {place.notes ? (
            <p className="line-clamp-1 text-xs text-ink-soft sm:text-sm">{place.notes}</p>
          ) : null}

          {/* Mobile bottom actions — photo-led, tools one layer deeper */}
          {!selectMode ? (
            <div className="mt-0.5 flex items-center gap-1.5 border-t border-line/70 pt-2 sm:hidden">
              {place.url ? (
                <ButtonLink
                  href={place.url}
                  target="_blank"
                  rel="noreferrer"
                  variant="secondary"
                  className="min-h-11 flex-1 rounded-full px-3 text-sm"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Listing
                </ButtonLink>
              ) : null}
              <Button
                type="button"
                variant="secondary"
                className="min-h-11 flex-1 rounded-full px-3 text-sm"
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

          {images.length > 1 ? (
            <div
              className="-mx-0.5 hidden gap-1.5 overflow-x-auto pb-0.5 pt-0.5 sm:flex"
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

