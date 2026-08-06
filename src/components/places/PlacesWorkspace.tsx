import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { CheckSquare, ExternalLink, Heart, Plus, Share2, Square, Trash2, Users, X } from 'lucide-react'
import type { AppController } from '../../hooks/useApp'
import type { AuthController } from '../../hooks/useAuth'
import type { CollaborationController } from '../../hooks/useCollaboration'
import type {
  PetsPolicy,
  PlaceListingKind,
  PlaceStatus,
  PlaceTier,
  SavedPlace,
} from '../../domain/types'
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
import { motion } from '../../lib/motion'
import { cn } from '../../lib/utils'
import { Button, ButtonLink } from '../ui/Button'
import { ChoiceGroup } from '../ui/ChoiceGroup'
import { CityCombobox } from '../ui/CityCombobox'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { CurrencyInput, Field, NumberInput, TextInput, TextTextarea } from '../ui/Field'
import { ImageLightbox, OpenableImage } from './ImageLightbox'
import { PlacePhotoEditor } from './PlacePhotoEditor'
import { PendingInvitesBanner, ShareSheet } from './ShareSheet'

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

type PlaceForm = Omit<SavedPlace, 'id' | 'createdAt' | 'updatedAt'>

const emptyForm = (): PlaceForm => ({
  title: '',
  url: '',
  listingKind: 'rent',
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

function sortByFavoriteThenRecent(a: SavedPlace, b: SavedPlace): number {
  if (a.favorite !== b.favorite) return a.favorite ? -1 : 1
  return (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0)
}

type ListSort =
  | 'featured'
  | 'monthly_asc'
  | 'monthly_desc'
  | 'list_asc'
  | 'list_desc'

function monthlyCost(place: SavedPlace): number | null {
  return place.monthlyEstimate != null && Number.isFinite(place.monthlyEstimate)
    ? place.monthlyEstimate
    : null
}

function listPrice(place: SavedPlace): number | null {
  return place.price != null && Number.isFinite(place.price) ? place.price : null
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
  petsOnly: boolean,
  cityKeys: string[],
): SavedPlace[] {
  let next = places.filter((p) => {
    if (petsOnly && !allowsPets(p)) return false
    if (!placeMatchesCities(p, cityKeys)) return false
    return true
  })

  const byMissingLast = (value: number | null, dir: 1 | -1) => {
    if (value == null) return Number.POSITIVE_INFINITY
    return dir === 1 ? value : -value
  }

  next = [...next].sort((a, b) => {
    if (sort === 'monthly_asc') {
      return byMissingLast(monthlyCost(a), 1) - byMissingLast(monthlyCost(b), 1)
    }
    if (sort === 'monthly_desc') {
      return byMissingLast(monthlyCost(a), -1) - byMissingLast(monthlyCost(b), -1)
    }
    if (sort === 'list_asc') {
      return byMissingLast(listPrice(a), 1) - byMissingLast(listPrice(b), 1)
    }
    if (sort === 'list_desc') {
      return byMissingLast(listPrice(a), -1) - byMissingLast(listPrice(b), -1)
    }
    if (a.favorite !== b.favorite) return a.favorite ? -1 : 1
    return (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0)
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
  const [listSort, setListSort] = useState<ListSort>('featured')
  const [petsOnly, setPetsOnly] = useState(false)
  const [cityKeys, setCityKeys] = useState<string[]>([])
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [shareOpen, setShareOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string
    title: string
  } | null>(null)
  const [lightbox, setLightbox] = useState<{
    images: string[]
    index: number
    title?: string
  } | null>(null)

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
    return sortPlaces(allPlaces, listSort, petsOnly, activeCityKeys)
  }, [allPlaces, listSort, petsOnly, activeCityKeys])

  const boardPlaces = useMemo(() => {
    let base = allPlaces
    if (petsOnly) base = base.filter(allowsPets)
    if (activeCityKeys.length) {
      base = base.filter((p) => placeMatchesCities(p, activeCityKeys))
    }
    return [...base].sort(sortByFavoriteThenRecent)
  }, [allPlaces, petsOnly, activeCityKeys])

  const cityFilterActive = activeCityKeys.length > 0
  const hasActiveFilters = petsOnly || cityFilterActive

  const clearAllFilters = () => {
    setListSort('featured')
    setPetsOnly(false)
    setCityKeys([])
  }

  const toggleCity = (key: string) => {
    setCityKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    )
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

  useEffect(() => {
    if (!formOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !lightbox) closeForm()
    }
    window.addEventListener('keydown', onKey)
    // Focus the panel for keyboard users
    window.setTimeout(() => {
      document.getElementById('place-form-title')?.focus()
    }, 40)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
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

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-[1.75rem] border border-line bg-panel px-5 py-4 shadow-[var(--shadow-soft)] md:px-7">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-[-0.02em] text-ink md:text-4xl">
            Places
          </h1>
          {collab.cloudActive && collab.activeList ? (
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-soft">
              <Users className="h-4 w-4" />
              <span>
                {collab.activeList.name}
                {collab.members.filter((m) => m.status === 'accepted').length > 1
                  ? ' · shared board'
                  : ''}
              </span>
              {collab.lists.length > 1 ? (
                <select
                  className="ml-1 rounded-xl border border-line bg-folio px-2 py-1 text-sm text-ink"
                  value={collab.activeListId ?? ''}
                  onChange={(e) => void collab.selectList(e.target.value)}
                >
                  {collab.lists.map((list) => (
                    <option key={list.id} value={list.id}>
                      {list.name}
                      {list.role === 'owner' ? '' : ' (shared)'}
                    </option>
                  ))}
                </select>
              ) : null}
            </p>
          ) : (
            <p className="mt-1 text-sm text-ink-soft">
              Save listings here. Sign in to share a board with a partner.
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={selectMode ? 'primary' : 'secondary'}
            onClick={() => {
              setSelectMode((v) => !v)
              if (selectMode) clearSelection()
            }}
          >
            {selectMode ? (
              <CheckSquare className="h-4 w-4" />
            ) : (
              <Square className="h-4 w-4" />
            )}
            Select
          </Button>
          <Button
            variant="secondary"
            onClick={() => setShareOpen(true)}
            title="Share list"
          >
            <Share2 className="h-4 w-4" />
            Share
          </Button>
          <Button variant="honey" onClick={openNewPlace}>
            <Plus className="h-4 w-4" />
            Add place
          </Button>
        </div>
      </header>

      <PendingInvitesBanner collab={collab} />

      {selectMode ? (
        <div className="flex flex-wrap items-center gap-2 rounded-[1.5rem] border border-line bg-folio/90 px-4 py-3">
          <p className="text-sm font-bold text-ink">
            {selectedIds.length} selected
          </p>
          <Button type="button" variant="secondary" onClick={selectAllVisible}>
            Select all shown
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setSelectedIds(allPlaces.map((p) => p.id))}
          >
            Select full list
          </Button>
          <Button type="button" variant="ghost" onClick={clearSelection}>
            Clear
          </Button>
          <Button
            type="button"
            variant="honey"
            className="ml-auto"
            onClick={() => setShareOpen(true)}
            disabled={selectedIds.length === 0 && allPlaces.length === 0}
          >
            <Share2 className="h-4 w-4" />
            Share selected
          </Button>
        </div>
      ) : null}

      <section className="rounded-[1.75rem] border border-line bg-panel p-4 shadow-[var(--shadow-soft)] md:p-6">
        <div className="flex flex-wrap items-center gap-2 border-b border-line pb-4">
          {(['list', 'tiers', 'compare'] as const).map((mode) => (
            <Button
              key={mode}
              variant={view === mode ? 'primary' : 'secondary'}
              onClick={() => setView(mode)}
            >
              {mode === 'list' ? 'List' : mode === 'tiers' ? 'Tier board' : 'Compare'}
            </Button>
          ))}
          {view === 'compare' && moveBudget != null ? (
            <span className="ml-auto text-sm text-ink-soft">
              Move budget: <strong className="text-ink">{formatMoney(moveBudget)}</strong>/mo
            </span>
          ) : null}
        </div>

        <div className="mt-5">
          {view === 'list' ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-line bg-folio/50 p-4 md:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <label className="flex w-full min-w-[14rem] flex-col gap-1.5 lg:max-w-xs">
                    <span className="text-sm font-bold text-ink">Sort</span>
                    <select
                      value={listSort}
                      onChange={(e) => setListSort(e.target.value as ListSort)}
                      className="min-h-11 rounded-2xl border border-line bg-panel px-4 text-base text-ink"
                    >
                      <option value="featured">Favorites & recent first</option>
                      <option value="monthly_asc">Rent · low to high</option>
                      <option value="monthly_desc">Rent · high to low</option>
                      <option value="list_asc">List price · low to high</option>
                      <option value="list_desc">List price · high to low</option>
                    </select>
                  </label>
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={petsOnly}
                      onClick={() => setPetsOnly((v) => !v)}
                      className={cn(
                        'inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-bold',
                        motion.chip,
                        petsOnly
                          ? 'border-sea bg-sea text-white'
                          : 'border-line bg-panel text-ink hover:border-sea',
                      )}
                    >
                      <span
                        className={cn(
                          'inline-flex h-5 w-9 items-center rounded-full px-0.5',
                          motion.color,
                          petsOnly ? 'bg-white/25' : 'bg-line',
                        )}
                      >
                        <span
                          className={cn(
                            'h-4 w-4 rounded-full bg-white',
                            motion.transform,
                            petsOnly ? 'translate-x-4' : 'translate-x-0',
                          )}
                        />
                      </span>
                      Pets allowed
                    </button>
                    <p className="text-sm text-ink-soft">
                      <span className="font-bold text-ink">{listPlaces.length}</span> of{' '}
                      {allPlaces.length} places
                      {hasActiveFilters ? ' match filters' : ''}
                    </p>
                  </div>
                </div>

                {availableCities.length > 0 ? (
                  <div className="mt-4">
                    <p className="text-sm font-bold text-ink">City</p>
                    <p className="mt-0.5 text-xs text-ink-soft">
                      From cities on your saved places. Tap one or more.
                    </p>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setCityKeys([])}
                        aria-pressed={!cityFilterActive}
                        className={cn(
                          'h-10 rounded-full border px-3.5 text-sm font-bold',
                          motion.chip,
                          !cityFilterActive
                            ? 'border-sea bg-sea text-white shadow-[var(--shadow-soft)]'
                            : 'border-line bg-panel text-ink hover:border-sea hover:bg-folio',
                        )}
                      >
                        All cities
                      </button>
                      {availableCities.map((city) => {
                        const on = activeCityKeys.includes(city.key)
                        return (
                          <button
                            key={city.key}
                            type="button"
                            onClick={() => toggleCity(city.key)}
                            aria-pressed={on}
                            className={cn(
                              'h-10 rounded-full border px-3.5 text-sm font-bold',
                              motion.chip,
                              on
                                ? 'border-sea bg-sea text-white shadow-[var(--shadow-soft)]'
                                : 'border-line bg-panel text-ink hover:border-sea hover:bg-folio',
                            )}
                          >
                            {city.label}
                            <span
                              className={cn(
                                'ml-1.5 tabular-nums',
                                on ? 'text-white/80' : 'text-ink-soft',
                              )}
                            >
                              {city.count}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ) : null}

                {(hasActiveFilters || listSort !== 'featured') && (
                  <div className="mt-3 flex justify-end">
                    <Button variant="ghost" onClick={clearAllFilters}>
                      Reset sort & filters
                    </Button>
                  </div>
                )}
              </div>

              {listPlaces.length === 0 ? (
                allPlaces.length === 0 ? (
                  <EmptyPlaces onAdd={openNewPlace} />
                ) : (
                  <div className="rounded-2xl border border-dashed border-line bg-folio/60 px-6 py-10 text-center">
                    <p className="font-display text-xl font-semibold text-ink">
                      No places match these filters
                    </p>
                    <p className="mt-2 text-ink-soft">
                      Pick more cities, turn off pets-only, or reset filters.
                    </p>
                    <Button
                      className="mt-4"
                      variant="secondary"
                      onClick={() => {
                        setPetsOnly(false)
                        setCityKeys([])
                      }}
                    >
                      Clear filters
                    </Button>
                  </div>
                )
              ) : (
                <div className="space-y-3">
                  {listPlaces.map((place) => (
                    <PlaceCard
                      key={place.id}
                      place={place}
                      moveBudget={moveBudget}
                      selected={compareIds.includes(place.id)}
                      selectMode={selectMode}
                      checked={selectedIds.includes(place.id)}
                      onToggleSelect={() => toggleSelect(place.id)}
                      onOpenImages={openLightbox}
                      onToggleCompare={() =>
                        setCompareIds((ids) =>
                          ids.includes(place.id)
                            ? ids.filter((id) => id !== place.id)
                            : [...ids, place.id].slice(0, 3),
                        )
                      }
                      onFavorite={() =>
                        persistPlace({
                          ...place,
                          favorite: !place.favorite,
                          updatedAt: new Date().toISOString(),
                        })
                      }
                      onEdit={() => startEdit(place)}
                      onDelete={() =>
                        setDeleteTarget({
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
            <div className="space-y-5">
              <div className="space-y-3 rounded-2xl border border-line bg-folio/50 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={petsOnly}
                    onClick={() => setPetsOnly((v) => !v)}
                    className={cn(
                      'inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-bold',
                      motion.chip,
                      petsOnly
                        ? 'border-sea bg-sea text-white'
                        : 'border-line bg-panel text-ink hover:border-sea',
                    )}
                  >
                    <span
                      className={cn(
                        'inline-flex h-5 w-9 items-center rounded-full px-0.5',
                        motion.color,
                        petsOnly ? 'bg-white/25' : 'bg-line',
                      )}
                    >
                      <span
                        className={cn(
                          'h-4 w-4 rounded-full bg-white',
                          motion.transform,
                          petsOnly ? 'translate-x-4' : 'translate-x-0',
                        )}
                      />
                    </span>
                    Pets allowed
                  </button>
                  <p className="text-sm text-ink-soft">
                    {petsOnly || cityFilterActive
                      ? `Showing ${boardPlaces.length} place${boardPlaces.length === 1 ? '' : 's'}`
                      : `${boardPlaces.length} places`}
                  </p>
                </div>

                {availableCities.length > 0 ? (
                  <div className="flex flex-wrap gap-2 border-t border-line pt-3">
                    <button
                      type="button"
                      onClick={() => setCityKeys([])}
                      aria-pressed={!cityFilterActive}
                      className={cn(
                        'h-9 rounded-full border px-3 text-sm font-bold',
                        motion.chip,
                        !cityFilterActive
                          ? 'border-sea bg-sea text-white'
                          : 'border-line bg-panel text-ink hover:border-sea',
                      )}
                    >
                      All cities
                    </button>
                    {availableCities.map((city) => {
                      const on = activeCityKeys.includes(city.key)
                      return (
                        <button
                          key={city.key}
                          type="button"
                          onClick={() => toggleCity(city.key)}
                          aria-pressed={on}
                          className={cn(
                            'h-9 rounded-full border px-3 text-sm font-bold',
                            motion.chip,
                            on
                              ? 'border-sea bg-sea text-white'
                              : 'border-line bg-panel text-ink hover:border-sea',
                          )}
                        >
                          {city.label}
                          <span
                            className={cn(
                              'ml-1.5 tabular-nums',
                              on ? 'text-white/80' : 'text-ink-soft',
                            )}
                          >
                            {city.count}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                ) : null}
              </div>
              {TIERS.map((tier) => {
                const placesInTier = boardPlaces.filter((p) => p.tier === tier)
                return (
                  <div
                    key={tier}
                    className="rounded-2xl border border-line bg-folio/70 p-4 md:p-5"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="font-display text-xl font-semibold text-ink">
                        {TIER_LABEL[tier]}
                      </h3>
                      <span className="text-sm font-bold text-ink-soft">
                        {placesInTier.length}{' '}
                        {placesInTier.length === 1 ? 'place' : 'places'}
                      </span>
                    </div>

                    {placesInTier.length === 0 ? (
                      <p className="mt-3 text-sm text-ink-soft">Nothing here yet.</p>
                    ) : (
                      <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
                        {placesInTier.map((place) => {
                          const images = placeImages(place)
                          return (
                            <div
                              key={place.id}
                              className={cn(
                                'w-52 shrink-0 overflow-hidden rounded-2xl border border-line bg-panel shadow-[var(--shadow-soft)] hover:border-sea',
                                motion.color,
                              )}
                            >
                              {images[0] ? (
                                <OpenableImage
                                  images={images}
                                  index={0}
                                  title={place.title || 'Untitled'}
                                  onOpen={openLightbox}
                                  className="h-28 w-full"
                                  imgClassName="h-28"
                                />
                              ) : (
                                <div className="flex h-28 items-center justify-center bg-folio text-sm text-ink-soft">
                                  No photo
                                </div>
                              )}
                              <button
                                type="button"
                                onClick={() => startEdit(place)}
                                className="w-full p-3 text-left"
                              >
                                <p className="line-clamp-2 font-bold text-ink">
                                  {place.title || 'Untitled'}
                                </p>
                                <p className="mt-1 text-sm text-ink-soft">
                                  {primaryCostLabel(place)}
                                </p>
                                <PetsBadge pets={place.pets ?? 'no'} className="mt-2" />
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : null}

          {view === 'compare' ? (
            compareIds.length === 0 ? (
              <p className="text-ink-soft">
                From List, tap <strong>Compare</strong> on up to 3 places.
              </p>
            ) : (
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
                    <div key={id} className="overflow-hidden rounded-2xl bg-folio">
                      {images[0] ? (
                        <OpenableImage
                          images={images}
                          index={0}
                          title={place.title || 'Untitled'}
                          onOpen={openLightbox}
                          className="h-36 w-full"
                          imgClassName="h-36"
                        />
                      ) : null}
                      <div className="p-4">
                        <p className="font-bold text-ink">{place.title || 'Untitled'}</p>
                        <p className="mt-1 text-sm text-ink-soft">{place.location}</p>
                        <PetsBadge
                          pets={place.pets ?? 'no'}
                          note={place.petsNote}
                          className="mt-2"
                        />
                        <p className="mt-3 text-lg font-bold">{primaryCostLabel(place)}</p>
                        {place.listingKind === 'rent' &&
                        place.monthlyEstimate != null &&
                        moveBudget != null ? (
                          <p
                            className={cn(
                              'mt-1 text-sm font-bold',
                              overBudget ? 'text-warn' : 'text-move',
                            )}
                          >
                            {overBudget ? 'Above move budget' : 'Within move budget'}
                          </p>
                        ) : null}
                        <TagRow labels={place.proTags} tone="pro" className="mt-3" />
                        <TagRow labels={place.concernTags} tone="con" className="mt-2" />
                        {place.url ? (
                          <ButtonLink
                            href={place.url}
                            target="_blank"
                            rel="noreferrer"
                            variant="primary"
                            className="mt-4 h-10 min-h-10 w-full rounded-xl px-3.5 text-sm"
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
            )
          ) : null}
        </div>
      </section>

      {formOpen
        ? createPortal(
            <div className="fixed inset-0 z-[80] flex justify-end">
              <button
                type="button"
                className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]"
                aria-label="Discard and close form"
                onClick={closeForm}
              />
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="place-form-title"
                className="relative flex h-full w-full max-w-3xl flex-col bg-panel shadow-[var(--shadow-lift)] sm:max-w-2xl lg:max-w-3xl"
              >
                <header className="sticky top-0 z-10 flex shrink-0 items-start justify-between gap-3 border-b border-line bg-panel/95 px-4 py-4 backdrop-blur md:px-6">
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
                  <Button variant="ghost" onClick={closeForm} aria-label="Close form">
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

                <footer className="sticky bottom-0 z-10 flex shrink-0 items-center justify-between gap-3 border-t border-line bg-panel/95 px-4 py-3 backdrop-blur md:px-6">
                  <Button variant="secondary" className="h-12 rounded-xl" onClick={closeForm}>
                    Cancel
                  </Button>
                  <Button
                    className="h-12 rounded-xl"
                    onClick={() => {
                      save()
                    }}
                  >
                    <Plus className="h-4 w-4" />
                    {editingId ? 'Save changes' : 'Save place'}
                  </Button>
                </footer>
              </div>
            </div>,
            document.body,
          )
        : null}

      {lightbox ? (
        <ImageLightbox
          images={lightbox.images}
          index={lightbox.index}
          title={lightbox.title}
          onClose={() => setLightbox(null)}
          onIndexChange={(index) =>
            setLightbox((prev) => (prev ? { ...prev, index } : prev))
          }
        />
      ) : null}

      {shareOpen ? (
        <ShareSheet
          collab={collab}
          selectedPlaceIds={
            selectMode && selectedIds.length > 0 ? selectedIds : []
          }
          signedIn={auth.signedIn}
          onClose={() => setShareOpen(false)}
          onNeedAuth={() => {
            setShareOpen(false)
            onOpenAccount()
          }}
        />
      ) : null}

      <ConfirmDialog
        open={deleteTarget != null}
        title="Remove this place?"
        description={
          deleteTarget
            ? `“${deleteTarget.title}” will be removed from your board. This can’t be undone.`
            : undefined
        }
        confirmLabel="Remove place"
        cancelLabel="Keep place"
        tone="danger"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            deletePlace(deleteTarget.id)
            setDeleteTarget(null)
          }
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
}: {
  pets: PetsPolicy
  note?: string
  className?: string
}) {
  const tone =
    pets === 'yes'
      ? 'bg-move/15 text-move'
      : pets === 'limited'
        ? 'bg-honey-soft text-honey'
        : pets === 'no'
          ? 'bg-warn/15 text-warn'
          : 'bg-line/60 text-ink-soft'

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
}: {
  labels: string[]
  tone: 'pro' | 'con'
  className?: string
}) {
  if (!labels?.length) return null
  return (
    <ul className={cn('flex flex-wrap gap-1.5', className)}>
      {labels.map((label) => (
        <li
          key={label}
          className={cn(
            'rounded-full px-2.5 py-1 text-xs font-bold',
            tone === 'pro' && 'bg-move/15 text-move',
            tone === 'con' && 'bg-warn/15 text-warn',
          )}
        >
          {label}
        </li>
      ))}
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
  selected,
  selectMode,
  checked,
  onToggleSelect,
  onOpenImages,
  onToggleCompare,
  onFavorite,
  onEdit,
  onDelete,
}: {
  place: SavedPlace
  moveBudget: number | null
  selected: boolean
  selectMode: boolean
  checked: boolean
  onToggleSelect: () => void
  onOpenImages: (images: string[], index: number, title?: string) => void
  onToggleCompare: () => void
  onFavorite: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const images = placeImages(place)
  const over =
    place.listingKind === 'rent' &&
    moveBudget != null &&
    place.monthlyEstimate != null &&
    place.monthlyEstimate > moveBudget

  return (
    <article
      className={cn(
        'overflow-hidden rounded-[1.5rem] border bg-folio/40 shadow-[var(--shadow-soft)] md:flex',
        checked ? 'border-sea ring-2 ring-sea/30' : 'border-line',
      )}
    >
      <div className="relative md:w-52 md:shrink-0">
        {selectMode ? (
          <button
            type="button"
            onClick={onToggleSelect}
            className="absolute left-2 top-2 z-10 rounded-xl bg-panel/95 p-2 shadow-[var(--shadow-soft)]"
            aria-pressed={checked}
            aria-label={checked ? 'Deselect place' : 'Select place'}
          >
            {checked ? (
              <CheckSquare className="h-5 w-5 text-sea-deep" />
            ) : (
              <Square className="h-5 w-5 text-ink-soft" />
            )}
          </button>
        ) : null}
        {images[0] ? (
          <OpenableImage
            images={images}
            index={0}
            title={place.title || 'Untitled place'}
            onOpen={onOpenImages}
            className="h-44 w-full md:h-full md:min-h-[11rem]"
            imgClassName="h-44 md:h-full md:min-h-[11rem]"
          />
        ) : (
          <div className="flex h-44 w-full items-center justify-center bg-folio text-sm text-ink-soft md:min-h-[11rem]">
            No photo
          </div>
        )}
        {images.length > 1 ? (
          <span className="pointer-events-none absolute bottom-2 left-2 rounded-full bg-ink/70 px-2 py-0.5 text-xs font-bold text-white">
            {images.length} photos
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4 md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-sea-deep">
              {place.listingKind === 'rent' ? 'Rental' : 'Buy'} · {TIER_LABEL[place.tier]}
              {place.status !== 'none' ? ` · ${STATUS_LABEL[place.status]}` : ''}
            </p>
            <h3 className="mt-1 font-display text-2xl font-semibold text-ink">
              {place.title || 'Untitled place'}
            </h3>
            <p className="mt-1 text-ink-soft">{place.location || 'Location not set'}</p>
            <PetsBadge pets={place.pets ?? 'no'} note={place.petsNote} className="mt-2" />
          </div>
          <div className="flex flex-wrap gap-2">
            {selectMode ? (
              <Button
                variant={checked ? 'primary' : 'secondary'}
                onClick={onToggleSelect}
              >
                {checked ? 'Selected' : 'Select'}
              </Button>
            ) : (
              <>
                <Button variant={place.favorite ? 'honey' : 'secondary'} onClick={onFavorite}>
                  <Heart className={cn('h-4 w-4', place.favorite && 'fill-current')} />
                </Button>
                <Button variant={selected ? 'primary' : 'secondary'} onClick={onToggleCompare}>
                  Compare
                </Button>
                <Button variant="secondary" onClick={onEdit}>
                  Edit
                </Button>
                <Button variant="ghost" onClick={onDelete}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span
            className={cn(
              'text-sm font-bold',
              place.listingKind === 'rent'
                ? over
                  ? 'text-warn'
                  : 'text-move'
                : 'text-ink',
            )}
          >
            {primaryCostLabel(place)}
          </span>
          {place.bedrooms != null || place.bathrooms != null ? (
            <span className="text-sm text-ink-soft">
              {[
                place.bedrooms != null ? `${place.bedrooms} bed` : null,
                place.bathrooms != null ? `${place.bathrooms} bath` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          ) : null}
          {place.url ? (
            <ButtonLink
              href={place.url}
              target="_blank"
              rel="noreferrer"
              variant="primary"
              className="ml-auto h-10 min-h-10 rounded-xl px-3.5 text-sm shadow-[var(--shadow-soft)] sm:ml-0"
            >
              <ExternalLink className="h-4 w-4 shrink-0" />
              Open listing
            </ButtonLink>
          ) : null}
        </div>

        <TagRow labels={place.proTags} tone="pro" />
        <TagRow labels={place.concernTags} tone="con" />
        {place.notes ? <p className="text-sm text-ink-soft">{place.notes}</p> : null}

        {images.length > 1 ? (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {images.map((url, index) => (
              <OpenableImage
                key={`${url}-${index}`}
                images={images}
                index={index}
                title={place.title || 'Untitled place'}
                onOpen={onOpenImages}
                className="h-14 w-20 shrink-0 rounded-lg"
                imgClassName="h-14 w-20"
              />
            ))}
          </div>
        ) : null}
      </div>
    </article>
  )
}
