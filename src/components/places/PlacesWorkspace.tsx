import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import {
  Check,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  FolderOpen,
  Heart,
  Link2,
  MoreHorizontal,
  Pencil,
  Plus,
  Share2,
  SlidersHorizontal,
  Square,
  Trash2,
  ArrowUp,
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
import {
  PLACE_HOME_TYPE_OPTIONS,
  PLACE_SQFT_FILTER_OPTIONS,
} from '../../domain/types'
import {
  addressesMatch,
  findDuplicatePlace,
  formatPlaceAddress,
  parseLocationString,
  placeCityLabel,
  sanitizeAddress,
  sanitizeState,
  sanitizeStreet,
  sanitizeZip,
} from '../../domain/places/address'
import {
  DEFAULT_ADDED_FILTER,
  isAddedFilterActive,
  matchesAddedFilter,
  type AddedFilter,
} from '../../domain/places/addedDate'
import {
  DEFAULT_HOME_TYPE_FILTER,
  DEFAULT_PETS_FILTER,
  DEFAULT_SQFT_FILTER,
  citiesFromPlaces,
  countActiveFilters,
  idsInTierDisplayOrder,
  isLikedByMe,
  isMutualLike,
  matchesHomeTypeFilter,
  matchesPetsFilter,
  matchesSqftFilter,
  placeImages,
  placeMatchesCities,
  placesInIdOrder,
  sortByRecentlyAdded,
  sortPlaces,
  type HomeTypeFilter,
  type ListSort,
  type PetsFilter,
  type SqftFilter,
} from '../../domain/places/filtering'
import { likedByPeople, swatchForUser, LIKER_SWATCHES } from '../../domain/places/likes'
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
import {
  EmptyPlaces,
  PetsBadge,
  PlaceCard,
  TagRow,
  primaryCostLabel,
} from './PlaceCard'
import { ChipPicker, FormSection } from './PlaceEditor'
import { CityFilterMenu, PetsFilterControl } from './PlaceFilters'
import { SelectionDock, SelectionDockSpacer } from './SelectionDock'
import { PendingInvitesBanner, ShareSheet } from './ShareSheet'
import { PlaceShareSheet } from './PlaceShareSheet'
import { AddedFilterMenu } from './AddedFilterMenu'
import {
  DuplicateAddressesCallout,
  DuplicatePlacesWizard,
} from './DuplicatePlacesWizard'
import {
  listGroupModeForSort,
  PlacesList,
  type ListDensity,
} from './PlacesList'
import { TierBoard } from './TierBoard'
import { duplicatePlacesSummary } from '../../domain/places/duplicates'
import { listIsShared } from '../../data/collaboration/types'
import { isSupabaseConfigured } from '../../lib/supabase'

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
  sqft: null,
  notes: '',
  pets: 'no',
  petsNote: '',
  proTags: [],
  concernTags: [],
  tier: 'maybe',
  boardOrder: 0,
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
    sqft:
      rest.sqft != null && Number.isFinite(rest.sqft) && rest.sqft > 0
        ? rest.sqft
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
  const [sqftFilter, setSqftFilter] = useState<SqftFilter>(DEFAULT_SQFT_FILTER)
  const [addedFilter, setAddedFilter] = useState<AddedFilter>(DEFAULT_ADDED_FILTER)
  const [listDensity, setListDensity] = useState<ListDensity>('comfortable')
  const [dupWizardOpen, setDupWizardOpen] = useState(false)
  const [dupBusy, setDupBusy] = useState(false)
  const [mutualOnly, setMutualOnly] = useState(false)
  const [cityKeys, setCityKeys] = useState<string[]>([])
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [mobileTier, setMobileTier] = useState<PlaceTier>('dream')
  const [mobileTierMode, setMobileTierMode] = useState<'focus' | 'overview'>(
    'focus',
  )
  const [shareOpen, setShareOpen] = useState(false)
  const [linkSharePlaces, setLinkSharePlaces] = useState<SavedPlace[] | null>(
    null,
  )
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
  const toolsAnchorRef = useRef<HTMLDivElement>(null)
  const [scrolledPastTools, setScrolledPastTools] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const onChange = () => setIsMdUp(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    const node = toolsAnchorRef.current
    if (!node) return
    const io = new IntersectionObserver(
      ([entry]) => {
        setScrolledPastTools(!(entry?.isIntersecting ?? true))
      },
      { root: null, threshold: 0, rootMargin: '-12px 0px 0px 0px' },
    )
    io.observe(node)
    return () => io.disconnect()
  }, [])

  const allPlaces = collab.cloudActive ? collab.places : app.places

  const duplicateSummary = useMemo(
    () => duplicatePlacesSummary(allPlaces),
    [allPlaces],
  )

  const resolveDuplicateGroup = async (_keepId: string, removeIds: string[]) => {
    setDupBusy(true)
    try {
      await deleteSelectedPlaces(removeIds)
      setListToast(
        removeIds.length === 1
          ? 'Removed 1 duplicate place.'
          : `Removed ${removeIds.length} duplicate places.`,
      )
    } finally {
      setDupBusy(false)
    }
  }

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
    // Append on select so share / copy / guest links keep tap order.
    setSelectedIds((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    )
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

  const addressDuplicate = useMemo(() => {
    const addr = sanitizeAddress({
      street: form.street,
      city: form.city,
      state: form.state,
      zip: form.zip,
    })
    if (!addr.street.trim()) return null
    // Editing the same place with the same address is not a duplicate.
    if (editingId) {
      const original = allPlaces.find((p) => p.id === editingId)
      if (original && addressesMatch(original, addr)) return null
    }
    return findDuplicatePlace(allPlaces, addr, { excludeId: editingId })
  }, [
    form.street,
    form.city,
    form.state,
    form.zip,
    allPlaces,
    editingId,
  ])

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
      sqftFilter,
      activeCityKeys,
      mutualOnly,
      addedFilter,
    )
  }, [
    allPlaces,
    listSort,
    petsFilter,
    homeTypeFilter,
    sqftFilter,
    activeCityKeys,
    mutualOnly,
    addedFilter,
  ])

  const boardPlaces = useMemo(() => {
    let base = allPlaces.filter(
      (p) =>
        matchesPetsFilter(p, petsFilter) &&
        matchesHomeTypeFilter(p, homeTypeFilter) &&
        matchesSqftFilter(p, sqftFilter) &&
        matchesAddedFilter(p, addedFilter),
    )
    if (mutualOnly) base = base.filter(isMutualLike)
    if (activeCityKeys.length) {
      base = base.filter((p) => placeMatchesCities(p, activeCityKeys))
    }
    return base
  }, [
    allPlaces,
    petsFilter,
    homeTypeFilter,
    sqftFilter,
    mutualOnly,
    activeCityKeys,
    addedFilter,
  ])

  /** Places in the order the user selected them (for share / copy / guest links). */
  const selectedPlacesInOrder = useMemo(
    () => placesInIdOrder(allPlaces, selectedIds),
    [allPlaces, selectedIds],
  )

  const selectAllVisible = () => {
    if (view === 'tiers') {
      setSelectedIds(idsInTierDisplayOrder(boardPlaces))
      return
    }
    setSelectedIds(listPlaces.map((p) => p.id))
  }

  const openGuestLinkForSelection = () => {
    if (!selectedPlacesInOrder.length) return
    setLinkSharePlaces(selectedPlacesInOrder)
  }

  const cityFilterActive = activeCityKeys.length > 0
  const petsFilterActive = petsFilter !== 'all'
  const homeTypeFilterActive = homeTypeFilter !== 'all'
  const sqftFilterActive = sqftFilter !== 'all'
  const addedFilterActive = isAddedFilterActive(addedFilter)
  const hasActiveFilters =
    petsFilterActive ||
    homeTypeFilterActive ||
    sqftFilterActive ||
    mutualOnly ||
    cityFilterActive ||
    addedFilterActive
  const activeFilterCount = countActiveFilters(
    listSort,
    petsFilter,
    homeTypeFilter,
    sqftFilter,
    mutualOnly,
    cityFilterActive,
    addedFilterActive,
  )

  const clearAllFilters = () => {
    setListSort('recent')
    setPetsFilter('all')
    setHomeTypeFilter('all')
    setSqftFilter('all')
    setAddedFilter(DEFAULT_ADDED_FILTER)
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
    // Only warn when this would collide with a *different* place.
    // Editing the current place without changing address is always fine.
    const addressUnchanged =
      Boolean(editingId) &&
      (() => {
        const original = allPlaces.find((p) => p.id === editingId)
        return Boolean(original && addressesMatch(original, addr))
      })()
    if (!addressUnchanged) {
      const duplicate = findDuplicatePlace(allPlaces, addr, {
        excludeId: editingId,
      })
      if (duplicate) {
        const label = duplicate.title.trim() || duplicate.location || 'Untitled'
        const ok = confirm(
          `A place with this address is already on this list (“${label}”). Save anyway?`,
        )
        if (!ok) return
      }
    }
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
      sqft:
        form.sqft != null && Number.isFinite(form.sqft) && form.sqft > 0
          ? form.sqft
          : null,
      pets: form.pets === 'yes' || form.pets === 'limited' ? form.pets : 'no',
      petsNote: form.pets === 'no' ? '' : form.petsNote,
      proTags: form.proTags,
      concernTags: form.concernTags,
      images: form.images.filter(Boolean),
      boardOrder: editingId
        ? (allPlaces.find((p) => p.id === editingId)?.boardOrder ??
          form.boardOrder ??
          0)
        : Math.max(
            -1,
            ...allPlaces
              .filter((p) => p.tier === form.tier)
              .map((p) => p.boardOrder ?? 0),
          ) + 1,
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

  const placesBoardOpen = view === 'list' || view === 'tiers' || view === 'compare'
  /** Mobile always; desktop when the top tools / select strip have scrolled away. */
  const showFloatingSelectDock =
    selectMode && (!isMdUp || scrolledPastTools)
  /** Quick actions when browsing deep in the list (not already selecting). */
  const showFloatingQuickDock =
    !selectMode &&
    !formOpen &&
    placesBoardOpen &&
    scrolledPastTools &&
    allPlaces.length > 0
  const showFloatingDock = showFloatingSelectDock || showFloatingQuickDock

  const tierCounts = useMemo(() => {
    const counts = {
      dream: 0,
      strong: 0,
      maybe: 0,
      pass: 0,
    } as Record<PlaceTier, number>
    for (const p of boardPlaces) {
      counts[p.tier] = (counts[p.tier] ?? 0) + 1
    }
    return counts
  }, [boardPlaces])

  const showFloatingTierNav =
    view === 'tiers' && !isMdUp && scrolledPastTools && boardPlaces.length > 0

  const onFloatingTierSelect = (tier: PlaceTier) => {
    setMobileTier(tier)
    if (mobileTierMode === 'overview') {
      window.requestAnimationFrame(() => {
        document
          .getElementById(`tier-overview-${tier}`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    }
  }

  const viewModes = [
    { id: 'list' as const, label: 'List' },
    { id: 'tiers' as const, label: 'Tier List' },
    { id: 'compare' as const, label: 'Compare' },
  ]

  const filtersBody = (
    <div className="grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 xl:items-end xl:gap-x-3 xl:gap-y-2">
      <label className="flex min-w-0 flex-col gap-1.5">
        <span className="text-xs font-bold uppercase tracking-wide text-ink-soft">
          Sort
        </span>
        <select
          value={listSort}
          onChange={(e) => setListSort(e.target.value as ListSort)}
          className="h-10 w-full min-w-0 rounded-xl border border-line bg-panel px-2.5 text-sm font-bold text-ink md:h-8 md:rounded-lg"
        >
          <option value="recent">Recently added</option>
          <option value="liked">Recently liked</option>
          <option value="monthly_asc">Rent · low–high</option>
          <option value="monthly_desc">Rent · high–low</option>
        </select>
      </label>

      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="text-xs font-bold uppercase tracking-wide text-ink-soft">
          Added
        </span>
        <AddedFilterMenu
          places={allPlaces}
          value={addedFilter}
          onChange={setAddedFilter}
        />
      </div>

      <div className="flex min-w-0 flex-col gap-1.5 sm:col-span-2 lg:col-span-1 xl:col-span-1">
        <span className="text-xs font-bold uppercase tracking-wide text-ink-soft">
          Pets
        </span>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
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
                'inline-flex h-8 shrink-0 items-center gap-1 rounded-full border px-2.5 text-xs font-bold',
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

      <label className="flex min-w-0 flex-col gap-1.5">
        <span className="text-xs font-bold uppercase tracking-wide text-ink-soft">
          Home type
        </span>
        <select
          value={homeTypeFilter}
          onChange={(e) =>
            setHomeTypeFilter(e.target.value as HomeTypeFilter)
          }
          className="h-10 w-full min-w-0 rounded-xl border border-line bg-panel px-2.5 text-sm font-bold text-ink md:h-8 md:rounded-lg"
        >
          <option value="all">Any</option>
          {PLACE_HOME_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex min-w-0 flex-col gap-1.5">
        <span className="text-xs font-bold uppercase tracking-wide text-ink-soft">
          Sqft
        </span>
        <select
          value={sqftFilter}
          onChange={(e) => setSqftFilter(e.target.value as SqftFilter)}
          className="h-10 w-full min-w-0 rounded-xl border border-line bg-panel px-2.5 text-sm font-bold text-ink md:h-8 md:rounded-lg"
        >
          <option value="all">Any</option>
          {PLACE_SQFT_FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      {availableCities.length > 0 ? (
        <div className="flex min-w-0 flex-col gap-1.5">
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
    <div className="w-full min-w-0 max-w-full space-y-3 pb-24 md:space-y-5 md:pb-0">
      {/* â”€â”€ Page chrome: list identity + list-level actions â”€â”€ */}
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

      <DuplicateAddressesCallout
        groupCount={duplicateSummary.groupCount}
        placeCount={duplicateSummary.placeCount}
        onReview={() => setDupWizardOpen(true)}
      />

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

      {/* Select actions: desktop keeps an inline strip at the top when in view.
          Floating dock (below) covers mobile + scrolled-away desktop. */}
      {selectMode && isMdUp && !scrolledPastTools ? (
        <div
          className={cn(
            'z-30 flex min-w-0 max-w-full flex-wrap items-center gap-2 rounded-[1.5rem] border border-line bg-folio/90 px-4 py-3 shadow-[var(--shadow-soft)]',
          )}
        >
          <p className="shrink-0 text-sm font-bold tabular-nums text-ink">
            {selectedIds.length} selected
          </p>
          <Button
            type="button"
            variant="ghost"
            className="h-9 min-h-9 px-2.5 text-sm"
            onClick={selectAllVisible}
          >
            All shown
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-9 min-h-9 px-2.5 text-sm"
            onClick={() =>
              setSelectedIds(
                view === 'tiers'
                  ? idsInTierDisplayOrder(allPlaces)
                  : allPlaces.map((p) => p.id),
              )
            }
          >
            Full list
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-9 min-h-9 px-2.5 text-sm"
            onClick={clearSelection}
          >
            Clear
          </Button>
          {selectedIds.length > 0 && collab.cloudActive ? (
            <div className="relative">
              <Button
                type="button"
                variant="secondary"
                className="h-9 min-h-9 px-2.5 text-sm"
                onClick={() => setBulkCopyOpen((v) => !v)}
              >
                <Copy className="h-4 w-4" />
                Copy
              </Button>
              {bulkCopyOpen ? (
                <div className="absolute top-full left-0 z-30 mt-2 w-[min(18rem,calc(100vw-2rem))]">
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
              className="h-9 min-h-9 min-w-9 px-2.5"
              onClick={() =>
                setDeleteTarget({ kind: 'bulk', ids: [...selectedIds] })
              }
              aria-label="Delete selected"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          ) : null}
          {selectedIds.length > 0 && isSupabaseConfigured ? (
            <Button
              type="button"
              variant="secondary"
              className="h-9 min-h-9 px-2.5 text-sm"
              onClick={openGuestLinkForSelection}
              aria-label="Guest link"
              title="Create a guest link"
            >
              <Link2 className="h-4 w-4" />
              Guest link
            </Button>
          ) : null}
          <Button
            type="button"
            variant="honey"
            className="ml-auto h-9 min-h-9 min-w-9 px-3"
            onClick={() => setShareOpen(true)}
            disabled={selectedIds.length === 0 && allPlaces.length === 0}
            aria-label="Share with people"
          >
            <Share2 className="h-4 w-4" />
            Invite
          </Button>
        </div>
      ) : null}

      <section className="overflow-hidden rounded-[1.25rem] border border-line bg-panel shadow-[var(--shadow-soft)] md:rounded-[1.75rem]">
        {/* View + primary list tools */}
        <div
          ref={toolsAnchorRef}
          className="flex min-w-0 flex-col gap-2.5 border-b border-line px-3 py-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3 md:px-5 md:py-3"
        >
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

          <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:ml-auto">
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

        <div className="min-w-0 p-3 md:p-5">
          {view === 'list' ? (
            <div className="space-y-3">
              {/* Desktop filters stay inline; mobile uses Filters sheet */}
              <div className="hidden min-w-0 rounded-xl border border-line bg-folio/50 px-3.5 py-2.5 md:block">
                <div className="flex min-w-0 flex-col gap-2">
                  <div className="min-w-0">{filtersBody}</div>
                  <p className="shrink-0 text-xs text-ink-soft">
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
                <PlacesList
                  places={listPlaces}
                  groupBy={listGroupModeForSort(listSort)}
                  resetKey={[
                    listSort,
                    petsFilter,
                    homeTypeFilter,
                    sqftFilter,
                    addedFilter.type === 'range'
                      ? `r:${addedFilter.from}:${addedFilter.to}`
                      : addedFilter.type === 'month'
                        ? `m:${addedFilter.year}-${addedFilter.month}`
                        : addedFilter.type === 'last_days'
                          ? `d:${addedFilter.days}`
                          : addedFilter.type,
                    mutualOnly ? '1' : '0',
                    activeCityKeys.join(','),
                    String(listPlaces.length),
                  ].join('|')}
                  density={listDensity}
                  onDensityChange={setListDensity}
                  renderPlace={(place, density) => (
                    <PlaceCard
                      place={place}
                      density={density}
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
                      onShareLink={
                        isSupabaseConfigured
                          ? () => setLinkSharePlaces([place])
                          : undefined
                      }
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
                  )}
                />
              )}
            </div>
          ) : null}

          {view === 'tiers' ? (
            <div className="min-w-0 max-w-full space-y-4">
              <div className="hidden min-w-0 rounded-xl border border-line bg-folio/50 px-3 py-2.5 md:block">
                <div className="flex min-w-0 flex-col gap-2">
                  <div className="min-w-0">{filtersBody}</div>
                  <p className="shrink-0 text-xs text-ink-soft">
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
              {boardPlaces.length === 0 ? (
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
                <TierBoard
                  places={boardPlaces}
                  selectMode={selectMode}
                  selectedIds={selectedIds}
                  reorderEnabled={!hasActiveFilters}
                  mobileTier={mobileTier}
                  onMobileTierChange={setMobileTier}
                  mobileMode={mobileTierMode}
                  onMobileModeChange={setMobileTierMode}
                  onToggleSelect={toggleSelect}
                  onEdit={startEdit}
                  onOpenLightbox={openLightbox}
                  onReorder={(placements) => {
                    void collab.reorderBoard(placements).catch((e) => {
                      alert(
                        e instanceof Error
                          ? e.message
                          : 'Could not update the Tier List.',
                      )
                    })
                  }}
                />
              )}
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
                              <span className="text-ink-soft">Â·</span>
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
                      {addressDuplicate ? (
                        <p
                          className="mt-3 rounded-xl border border-honey/40 bg-honey-soft px-3 py-2 text-sm text-ink"
                          role="status"
                        >
                          Already in this list
                          {addressDuplicate.title.trim()
                            ? ` as “${addressDuplicate.title.trim()}”`
                            : ''}
                          . Saving will add another card with the same address.
                        </p>
                      ) : null}
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
                      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
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
                        <Field label="Sqft" className="col-span-2 sm:col-span-1">
                          <NumberInput
                            value={form.sqft ?? 0}
                            min={0}
                            step={50}
                            onChange={(sqft) =>
                              setForm((f) => ({
                                ...f,
                                sqft: sqft > 0 ? sqft : null,
                              }))
                            }
                            placeholder="e.g. 1800"
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

      <SelectionDock
        open={showFloatingDock}
        selectMode={selectMode}
        selectedCount={selectedIds.length}
        cloudActive={collab.cloudActive}
        supabaseConfigured={isSupabaseConfigured}
        isMdUp={isMdUp}
        activeFilterCount={activeFilterCount}
        filtersOpen={filtersOpen}
        bulkCopyOpen={bulkCopyOpen}
        selectMoreOpen={selectMoreOpen}
        selectedIds={selectedIds}
        collab={collab}
        tierNav={
          showFloatingTierNav
            ? {
                activeTier: mobileTier,
                mode: mobileTierMode,
                counts: tierCounts,
                onSelectTier: onFloatingTierSelect,
              }
            : null
        }
        onSelectAllVisible={selectAllVisible}
        onSelectFullList={() =>
          setSelectedIds(
            view === 'tiers'
              ? idsInTierDisplayOrder(allPlaces)
              : allPlaces.map((p) => p.id),
          )
        }
        onClearSelection={clearSelection}
        onDeleteSelected={() =>
          setDeleteTarget({ kind: 'bulk', ids: [...selectedIds] })
        }
        onGuestLink={openGuestLinkForSelection}
        onInvite={() => setShareOpen(true)}
        onDoneSelecting={() => {
          setSelectMode(false)
          clearSelection()
          setBulkCopyOpen(false)
          setSelectMoreOpen(false)
        }}
        onEnterSelectMode={() => {
          setSelectMode(true)
          setBulkCopyOpen(false)
        }}
        onAdd={openNewPlace}
        onOpenFilters={() => setFiltersOpen(true)}
        onBulkCopyOpenChange={setBulkCopyOpen}
        onSelectMoreOpenChange={setSelectMoreOpen}
        onCopyDone={(msg) => setListToast(msg)}
        onScrollTop={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        inviteDisabled={selectedIds.length === 0 && allPlaces.length === 0}
      />

      <SelectionDockSpacer open={showFloatingDock} tall={showFloatingTierNav} />

      <ShareSheet
        open={shareOpen}
        collab={collab}
        selectedPlaceIds={
          selectMode && selectedIds.length > 0 ? selectedIds : []
        }
        onClose={() => setShareOpen(false)}
      />

      <PlaceShareSheet
        open={linkSharePlaces != null && linkSharePlaces.length > 0}
        places={linkSharePlaces ?? []}
        onClose={() => setLinkSharePlaces(null)}
      />

      <DuplicatePlacesWizard
        open={dupWizardOpen}
        onClose={() => setDupWizardOpen(false)}
        groups={duplicateSummary.groups}
        busy={dupBusy || bulkDeleteBusy}
        onResolveGroup={resolveDuplicateGroup}
        onOpenImages={openLightbox}
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
        {filtersBody}
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
              } will be removed from this list. This can't be undone.`
            : deleteTarget?.kind === 'single'
              ? `“${deleteTarget.title}” will be removed from your Tier List. This can't be undone.`
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

