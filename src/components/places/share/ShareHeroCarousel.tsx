import { useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, Images } from 'lucide-react'
import {
  animate,
  motion as m,
  useMotionValue,
} from 'motion/react'
import type { SharedPlaceSnapshot } from '../../../data/collaboration/share'
import { formatMoney } from '../../../domain/finance/calculations'
import { PLACE_HOME_TYPE_OPTIONS } from '../../../domain/types'
import { motion } from '../../../lib/motion'
import { cn } from '../../../lib/utils'

const PLACE_SWIPE_THRESHOLD = 56

const TIER_LABEL: Record<SharedPlaceSnapshot['tier'], string> = {
  dream: 'Dream',
  strong: 'Strong yes',
  maybe: 'Maybe',
  pass: 'Pass',
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

export interface ShareHeroCarouselProps {
  places: SharedPlaceSnapshot[]
  activeIndex: number
  /** Called when the active place changes (swipe, chevrons, or external). */
  onActiveIndexChange: (index: number, placeDir?: number) => void
  photoIndex: number
  onPhotoIndexChange?: (index: number) => void
  /** Tap on hero (not swipe) opens the lightbox. */
  onOpenLightbox: () => void
}

export function ShareHeroCarousel({
  places,
  activeIndex,
  onActiveIndexChange,
  photoIndex,
  onOpenLightbox,
}: ShareHeroCarouselProps) {
  const isCollection = places.length > 1
  const place = places[activeIndex] ?? null
  const images = place?.images ?? []
  const hero = images[photoIndex] ?? images[0] ?? null
  const canPrev = activeIndex > 0
  const canNext = activeIndex < places.length - 1
  const prevPlace = canPrev ? places[activeIndex - 1] : null
  const nextPlace = canNext ? places[activeIndex + 1] : null
  const typeLabel = place ? homeTypeLabel(place) : null

  const pointerStart = useRef<{ x: number; y: number; t: number } | null>(null)
  const swipedPlace = useRef(false)
  const axisLock = useRef<'x' | 'y' | null>(null)
  const heroWidthRef = useRef(320)
  const heroShellRef = useRef<HTMLDivElement>(null)
  const animatingPlace = useRef(false)
  const dragX = useMotionValue(0)

  const navigateByDelta = (delta: number) => {
    if (!delta || animatingPlace.current) return
    const next = Math.min(
      places.length - 1,
      Math.max(0, activeIndex + delta),
    )
    if (next === activeIndex) return
    onActiveIndexChange(next, delta)
  }

  useEffect(() => {
    animatingPlace.current = false
    if (Math.abs(dragX.get()) < 1) dragX.set(0)
  }, [activeIndex, dragX])

  const onHeroPointerDown = (e: React.PointerEvent) => {
    if (!isCollection || animatingPlace.current) return
    if (e.pointerType === 'mouse') return
    const w = heroShellRef.current?.offsetWidth ?? 320
    heroWidthRef.current = w
    pointerStart.current = { x: e.clientX, y: e.clientY, t: e.timeStamp }
    swipedPlace.current = false
    axisLock.current = null
    dragX.stop()
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  }

  const onHeroPointerMove = (e: React.PointerEvent) => {
    const start = pointerStart.current
    if (!start || !isCollection || animatingPlace.current) return
    const dx = e.clientX - start.x
    const dy = e.clientY - start.y

    if (!axisLock.current) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
      axisLock.current = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
    }
    if (axisLock.current === 'y') return

    e.preventDefault()
    let next = dx
    if (!canPrev && dx > 0) next = dx * 0.22
    if (!canNext && dx < 0) next = dx * 0.22
    dragX.set(next)
  }

  const finishHeroPointer = (e: React.PointerEvent) => {
    const start = pointerStart.current
    pointerStart.current = null
    const lock = axisLock.current
    axisLock.current = null

    if (!start || lock === 'y' || !isCollection) {
      void animate(dragX, 0, { type: 'spring', stiffness: 420, damping: 38 })
      return
    }

    const dx = e.clientX - start.x
    const dt = Math.max(16, e.timeStamp - start.t)
    const velocity = dx / dt
    const width = heroWidthRef.current
    const passed =
      Math.abs(dx) >= PLACE_SWIPE_THRESHOLD || Math.abs(velocity) > 0.55

    if (passed && dx < 0 && canNext) {
      swipedPlace.current = true
      const nextIndex = Math.min(places.length - 1, activeIndex + 1)
      dragX.set(width * 0.28)
      onActiveIndexChange(nextIndex, 1)
      void animate(dragX, 0, {
        type: 'spring',
        stiffness: 380,
        damping: 34,
        velocity: velocity * 0.4,
      })
      return
    }
    if (passed && dx > 0 && canPrev) {
      swipedPlace.current = true
      const nextIndex = Math.max(0, activeIndex - 1)
      dragX.set(-width * 0.28)
      onActiveIndexChange(nextIndex, -1)
      void animate(dragX, 0, {
        type: 'spring',
        stiffness: 380,
        damping: 34,
        velocity: velocity * 0.4,
      })
      return
    }

    void animate(dragX, 0, {
      type: 'spring',
      stiffness: 420,
      damping: 38,
      velocity,
    })
  }

  const openLightboxFromHero = () => {
    if (swipedPlace.current) {
      swipedPlace.current = false
      return
    }
    if (!images.length) return
    onOpenLightbox()
  }

  if (!place) return null

  return (
    <div className="relative mt-3 overflow-hidden rounded-[1.5rem] bg-ink shadow-[var(--shadow-lift)] md:mt-5 md:rounded-[1.75rem]">
      <div
        ref={heroShellRef}
        className={cn(
          'relative aspect-[4/5] w-full touch-pan-y sm:aspect-[16/11] md:aspect-[16/10]',
          isCollection && 'md:touch-auto',
        )}
        onPointerDown={onHeroPointerDown}
        onPointerMove={onHeroPointerMove}
        onPointerUp={finishHeroPointer}
        onPointerCancel={() => {
          pointerStart.current = null
          axisLock.current = null
          void animate(dragX, 0, {
            type: 'spring',
            stiffness: 420,
            damping: 38,
          })
        }}
      >
        <m.div
          className="absolute inset-0 will-change-transform"
          style={{ x: dragX }}
        >
          {hero ? (
            <button
              type="button"
              className="absolute inset-0 block h-full w-full cursor-zoom-in"
              onClick={openLightboxFromHero}
              aria-label={
                images.length > 1
                  ? `View ${images.length} photos`
                  : 'View photo'
              }
            >
              <img
                key={place.id + (hero ?? '')}
                src={hero}
                alt=""
                className="h-full w-full object-cover"
                draggable={false}
                referrerPolicy="no-referrer"
              />
              <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/55 via-ink/10 to-transparent" />
            </button>
          ) : (
            <div className="flex h-full items-center justify-center bg-folio text-sm font-bold text-ink-soft">
              No photo yet
            </div>
          )}
        </m.div>

        {isCollection ? (
          <>
            <button
              type="button"
              disabled={!canPrev}
              onClick={() => navigateByDelta(-1)}
              className={cn(
                'absolute left-3 top-1/2 z-20 hidden h-14 w-14 -translate-y-1/2 items-center justify-center rounded-2xl bg-panel/90 text-ink shadow-[var(--shadow-lift)] backdrop-blur-sm hover:bg-panel disabled:pointer-events-none disabled:opacity-35 md:inline-flex',
                motion.interactive,
              )}
              aria-label={
                prevPlace
                  ? `Previous place: ${prevPlace.title || 'Untitled'}`
                  : 'Previous place'
              }
              title={
                prevPlace
                  ? `Previous: ${prevPlace.title || 'Untitled'}`
                  : undefined
              }
            >
              <ChevronLeft className="h-7 w-7" />
            </button>
            <button
              type="button"
              disabled={!canNext}
              onClick={() => navigateByDelta(1)}
              className={cn(
                'absolute right-3 top-1/2 z-20 hidden h-14 w-14 -translate-y-1/2 items-center justify-center rounded-2xl bg-panel/90 text-ink shadow-[var(--shadow-lift)] backdrop-blur-sm hover:bg-panel disabled:pointer-events-none disabled:opacity-35 md:inline-flex',
                motion.interactive,
              )}
              aria-label={
                nextPlace
                  ? `Next place: ${nextPlace.title || 'Untitled'}`
                  : 'Next place'
              }
              title={
                nextPlace
                  ? `Next: ${nextPlace.title || 'Untitled'}`
                  : undefined
              }
            >
              <ChevronRight className="h-7 w-7" />
            </button>
          </>
        ) : null}

        {images.length > 1 ? (
          <span className="pointer-events-none absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-ink/70 px-2.5 py-1 text-[11px] font-bold text-white">
            <Images className="h-3.5 w-3.5" aria-hidden />
            {photoIndex + 1}/{images.length}
          </span>
        ) : null}

        {isCollection ? (
          <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex flex-col items-center gap-2 px-4 md:hidden">
            <div className="flex items-center gap-1.5">
              {places.map((_, i) => (
                <span
                  key={`dot-${i}`}
                  className={cn(
                    'h-1.5 rounded-full transition-[width,background-color] duration-200',
                    i === activeIndex ? 'w-5 bg-white' : 'w-1.5 bg-white/45',
                  )}
                />
              ))}
            </div>
            <p className="rounded-full bg-ink/55 px-2.5 py-1 text-[11px] font-bold text-white/95 backdrop-blur-[2px]">
              Swipe for next place
            </p>
          </div>
        ) : null}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 p-4 text-white sm:p-6 md:p-7">
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
  )
}
