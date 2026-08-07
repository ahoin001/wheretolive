/**
 * THESIS: A shared home opens as a looking-glass window — the place leads; chrome recedes.
 * OWN-WORLD: Folio mist, sea/honey accents, Petrona + Atkinson; photo as architectural aperture.
 * STORY: Guest understands the home at a glance, browses photos, opens the listing for more.
 * FIRST VIEWPORT: Full-bleed photo window; title + price on the sill; sticky “View listing” CTA.
 * FORM: Looking-glass window (surface seed 24c19eb3 · candidate 6).
 * FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
 */
import { useEffect, useMemo, useState } from 'react'
import { ExternalLink, Images } from 'lucide-react'
import { AnimatePresence, motion as m } from 'motion/react'
import { fetchPublicShare } from '../../data/collaboration/api'
import type {
  PublicShareRecord,
  SharedPlaceSnapshot,
} from '../../data/collaboration/share'
import { formatMoney } from '../../domain/finance/calculations'
import {
  formatPlaceAddress,
  resolvePlaceAddress,
} from '../../domain/places/address'
import { PLACE_HOME_TYPE_OPTIONS } from '../../domain/types'
import { motion } from '../../lib/motion'
import { tweenPanel, easeSnappy } from '../../lib/motionPresets'
import { isSupabaseConfigured } from '../../lib/supabase'
import { cn } from '../../lib/utils'
import { ButtonLink } from '../ui/Button'
import { ImageLightbox } from './ImageLightbox'

const TIER_LABEL: Record<SharedPlaceSnapshot['tier'], string> = {
  dream: 'Dream',
  strong: 'Strong yes',
  maybe: 'Maybe',
  pass: 'Pass',
}

const PETS_LABEL: Record<SharedPlaceSnapshot['pets'], string> = {
  yes: 'Pets OK',
  limited: 'Pets limited',
  no: 'No pets',
}

function costLabel(place: SharedPlaceSnapshot): string {
  if (place.listingKind === 'rent') {
    return place.monthlyEstimate != null
      ? `${formatMoney(place.monthlyEstimate)}/mo`
      : 'Rent not set'
  }
  if (place.price != null) return formatMoney(place.price)
  return 'Price not set'
}

function homeTypeLabel(place: SharedPlaceSnapshot): string | null {
  if (!place.homeType) return null
  return (
    PLACE_HOME_TYPE_OPTIONS.find((o) => o.value === place.homeType)?.label ??
    null
  )
}

function placeAddress(place: SharedPlaceSnapshot): string {
  const resolved = resolvePlaceAddress(place)
  return (
    formatPlaceAddress(resolved) ||
    place.location ||
    place.city ||
    'Location not set'
  )
}

function bedsLine(place: SharedPlaceSnapshot): string {
  return [
    place.bedrooms != null ? `${place.bedrooms} bd` : null,
    place.bathrooms != null ? `${place.bathrooms} ba` : null,
    place.sqft != null && place.sqft > 0
      ? `${Math.round(place.sqft).toLocaleString()} sqft`
      : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

export function PublicSharePage({ token }: { token: string }) {
  const [record, setRecord] = useState<PublicShareRecord | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeIndex, setActiveIndex] = useState(0)
  const [photoIndex, setPhotoIndex] = useState(0)
  const [lightbox, setLightbox] = useState<{
    images: string[]
    index: number
    title?: string
  } | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!isSupabaseConfigured) {
        setError('Sharing is not available right now.')
        setLoading(false)
        return
      }
      setLoading(true)
      setError(null)
      try {
        const next = await fetchPublicShare(token)
        if (cancelled) return
        if (!next) {
          setRecord(null)
          setError('This share link is missing, expired, or was revoked.')
        } else {
          setRecord(next)
          setActiveIndex(0)
          setPhotoIndex(0)
        }
      } catch (e) {
        if (cancelled) return
        setError(
          e instanceof Error ? e.message : 'Could not open this share link.',
        )
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [token])

  const places = record?.payload.places ?? []
  const place = places[activeIndex] ?? null
  const images = place?.images ?? []
  const hero = images[photoIndex] ?? images[0] ?? null

  useEffect(() => {
    setPhotoIndex(0)
  }, [activeIndex])

  const collectionTitle = useMemo(() => {
    if (!record) return ''
    if (record.title) return record.title
    if (places.length === 1) return places[0]?.title || 'A place to consider'
    return `${places.length} places to consider`
  }, [record, places])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-mist px-6 text-ink-soft">
        Opening shared places…
      </div>
    )
  }

  if (error || !place) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-mist px-6 text-center">
        <p className="font-display text-3xl font-semibold tracking-[-0.02em] text-ink">
          Link unavailable
        </p>
        <p className="max-w-md text-ink-soft">
          {error ?? 'Nothing to show on this link.'}
        </p>
        <ButtonLink href="/" variant="secondary">
          Go to Room for the Next Chapter
        </ButtonLink>
      </div>
    )
  }

  const listingUrl = place.url.trim()
  const facts = bedsLine(place)
  const typeLabel = homeTypeLabel(place)

  return (
    <div className="min-h-screen bg-mist pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
      <header className="mx-auto flex max-w-5xl items-baseline justify-between gap-3 px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))] md:px-6">
        <div className="min-w-0">
          <p className="font-display text-xl font-semibold tracking-[-0.02em] text-ink md:text-2xl">
            Room for the Next Chapter
          </p>
          <p className="mt-0.5 truncate text-sm text-ink-soft">{collectionTitle}</p>
        </div>
        {places.length > 1 ? (
          <p className="shrink-0 text-xs font-bold tabular-nums text-ink-soft">
            {activeIndex + 1} / {places.length}
          </p>
        ) : null}
      </header>

      {places.length > 1 ? (
        <div className="sticky top-0 z-20 border-b border-line/70 bg-mist/90 backdrop-blur-md">
          <div
            role="tablist"
            aria-label="Shared places"
            className="mx-auto flex max-w-5xl gap-2 overflow-x-auto px-4 py-2.5 md:px-6"
          >
            {places.map((p, i) => {
              const active = i === activeIndex
              const thumb = p.images[0]
              return (
                <button
                  key={p.id + i}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveIndex(i)}
                  className={cn(
                    'flex shrink-0 items-center gap-2 rounded-xl border px-2 py-1.5',
                    motion.chip,
                    active
                      ? 'border-sea bg-sea text-white shadow-[var(--shadow-soft)]'
                      : 'border-line bg-panel text-ink',
                  )}
                >
                  <span className="h-9 w-9 overflow-hidden rounded-lg bg-folio">
                    {thumb ? (
                      <img
                        src={thumb}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span className="flex h-full items-center justify-center text-[10px] font-bold text-ink-soft">
                        —
                      </span>
                    )}
                  </span>
                  <span className="max-w-[7.5rem] truncate text-left text-xs font-bold">
                    {p.title || 'Untitled'}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      ) : null}

      <main className="mx-auto max-w-5xl px-4 md:px-6">
        <AnimatePresence mode="wait" initial={false}>
          <m.div
            key={place.id + activeIndex}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0, transition: tweenPanel }}
            exit={{
              opacity: 0,
              y: -6,
              transition: { duration: 0.14, ease: easeSnappy },
            }}
          >
            {/* Looking-glass window */}
            <div className="relative mt-3 overflow-hidden rounded-[1.5rem] bg-ink shadow-[var(--shadow-lift)] md:mt-5 md:rounded-[1.75rem]">
              <div className="relative aspect-[4/5] w-full sm:aspect-[16/11] md:aspect-[16/10]">
                {hero ? (
                  <button
                    type="button"
                    className="absolute inset-0 block h-full w-full"
                    onClick={() =>
                      setLightbox({
                        images,
                        index: photoIndex,
                        title: place.title,
                      })
                    }
                    aria-label={
                      images.length > 1
                        ? `View ${images.length} photos`
                        : 'View photo'
                    }
                  >
                    <img
                      src={hero}
                      alt=""
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/55 via-ink/10 to-transparent" />
                  </button>
                ) : (
                  <div className="flex h-full items-center justify-center bg-folio text-sm font-bold text-ink-soft">
                    No photo yet
                  </div>
                )}

                {images.length > 1 ? (
                  <span className="pointer-events-none absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-ink/70 px-2.5 py-1 text-[11px] font-bold text-white">
                    <Images className="h-3.5 w-3.5" aria-hidden />
                    {photoIndex + 1}/{images.length}
                  </span>
                ) : null}

                {/* Sill — facts over the window edge */}
                <div className="absolute inset-x-0 bottom-0 p-4 text-white sm:p-6 md:p-7">
                  <p className="text-sm font-bold text-white/80">
                    {place.listingKind === 'rent' ? 'Rental' : 'For sale'}
                    {typeLabel ? ` · ${typeLabel}` : ''}
                    {` · ${TIER_LABEL[place.tier]}`}
                  </p>
                  <h1 className="mt-1 font-display text-[1.85rem] font-semibold leading-[1.15] tracking-[-0.03em] text-balance sm:text-4xl md:text-5xl">
                    {place.title || 'Untitled place'}
                  </h1>
                  <p className="mt-2 text-2xl font-bold tabular-nums sm:text-3xl">
                    {costLabel(place)}
                  </p>
                </div>
              </div>
            </div>

            {images.length > 1 ? (
              <ul className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {images.map((src, i) => (
                  <li key={src + i} className="shrink-0">
                    <button
                      type="button"
                      onClick={() => setPhotoIndex(i)}
                      className={cn(
                        'h-16 w-20 overflow-hidden rounded-xl border-2',
                        motion.color,
                        i === photoIndex
                          ? 'border-sea'
                          : 'border-transparent opacity-80 hover:opacity-100',
                      )}
                      aria-label={`Photo ${i + 1}`}
                      aria-pressed={i === photoIndex}
                    >
                      <img
                        src={src}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            <section className="mt-6 space-y-5 pb-8 md:mt-8">
              <div>
                <p className="text-base text-ink-soft">{placeAddress(place)}</p>
                {facts ? (
                  <p className="mt-1 text-base font-bold text-ink">{facts}</p>
                ) : null}
                <p className="mt-2 inline-flex flex-wrap items-center gap-2 text-sm">
                  <span
                    className={cn(
                      'rounded-full px-2.5 py-1 text-xs font-bold',
                      place.pets === 'yes'
                        ? 'bg-move/15 text-move'
                        : place.pets === 'limited'
                          ? 'bg-honey-soft text-honey'
                          : 'bg-warn/15 text-warn',
                    )}
                  >
                    {PETS_LABEL[place.pets]}
                  </span>
                  {place.petsNote &&
                  (place.pets === 'yes' || place.pets === 'limited') ? (
                    <span className="text-ink-soft">{place.petsNote}</span>
                  ) : null}
                </p>
              </div>

              {place.proTags.length > 0 || place.concernTags.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {place.proTags.map((tag) => (
                    <span
                      key={`pro-${tag}`}
                      className="rounded-full bg-move/15 px-2.5 py-1 text-xs font-bold text-move"
                    >
                      {tag}
                    </span>
                  ))}
                  {place.concernTags.map((tag) => (
                    <span
                      key={`con-${tag}`}
                      className="rounded-full bg-honey-soft px-2.5 py-1 text-xs font-bold text-honey"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}

              {!listingUrl ? (
                <p className="rounded-2xl border border-dashed border-line bg-folio/60 px-4 py-3 text-sm text-ink-soft">
                  No listing link was shared for this place.
                </p>
              ) : null}
            </section>
          </m.div>
        </AnimatePresence>
      </main>

      {/* Sticky listing CTA */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-panel/95 px-4 py-3 shadow-[var(--shadow-lift)] backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="hidden text-sm text-ink-soft sm:block">
            See the full listing for floor plans, agent details, and more.
          </p>
          {listingUrl ? (
            <ButtonLink
              href={listingUrl}
              target="_blank"
              rel="noreferrer"
              variant="honey"
              className="w-full min-h-12 sm:w-auto sm:min-w-[14rem]"
            >
              <ExternalLink className="h-4 w-4" />
              View listing
            </ButtonLink>
          ) : (
            <ButtonLink
              href="/"
              variant="secondary"
              className="w-full min-h-12 sm:w-auto"
            >
              Open the planner
            </ButtonLink>
          )}
        </div>
      </div>

      {lightbox ? (
        <ImageLightbox
          images={lightbox.images}
          index={lightbox.index}
          title={lightbox.title}
          onClose={() => setLightbox(null)}
          onIndexChange={(index) => {
            setLightbox((prev) => (prev ? { ...prev, index } : prev))
            setPhotoIndex(index)
          }}
        />
      ) : null}
    </div>
  )
}
