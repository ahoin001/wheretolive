import { useEffect, useCallback, useRef } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { cssMotion } from '../../lib/motion'
import {
  lightboxImageVariants,
  overlayVariants,
  springSnappy,
} from '../../lib/motionPresets'
import { cn } from '../../lib/utils'

const SWIPE_THRESHOLD = 40

export interface ImageLightboxProps {
  images: string[]
  index: number
  title?: string
  onClose: () => void
  onIndexChange: (index: number) => void
}

export function ImageLightbox({
  images,
  index,
  title,
  onClose,
  onIndexChange,
}: ImageLightboxProps) {
  const total = images.length
  const safeIndex = total > 0 ? ((index % total) + total) % total : 0
  const current = total > 0 ? images[safeIndex] : ''
  const reduce = useReducedMotion()
  const pointerStart = useRef<{ x: number; y: number } | null>(null)
  const swiping = useRef(false)

  const go = useCallback(
    (delta: number) => {
      if (total <= 0) return
      onIndexChange(((safeIndex + delta) % total + total) % total)
    },
    [onIndexChange, safeIndex, total],
  )

  useEffect(() => {
    if (total <= 0) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') go(-1)
      if (e.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [go, onClose, total])

  if (total === 0 || !current) return null

  const onPointerDown = (e: React.PointerEvent) => {
    pointerStart.current = { x: e.clientX, y: e.clientY }
    swiping.current = false
  }

  const onPointerUp = (e: React.PointerEvent) => {
    const start = pointerStart.current
    pointerStart.current = null
    if (!start || total <= 1) return
    const dx = e.clientX - start.x
    const dy = e.clientY - start.y
    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy)) return
    swiping.current = true
    if (dx < 0) go(1)
    else go(-1)
  }

  const onStageClick = (e: React.MouseEvent) => {
    if (swiping.current) {
      swiping.current = false
      return
    }
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <motion.div
      className={cn(
        'fixed inset-0 z-[100] flex flex-col bg-ink/95',
        'pt-[max(0.5rem,env(safe-area-inset-top))]',
        'pb-[max(0.5rem,env(safe-area-inset-bottom))]',
        'md:bg-ink/90 md:p-5',
      )}
      role="dialog"
      aria-modal="true"
      aria-label={title ? `Photos of ${title}` : 'Photo gallery'}
      variants={overlayVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      onClick={onClose}
    >
      <div
        className="mx-auto flex w-full max-w-6xl shrink-0 items-center justify-between gap-3 px-3 text-white md:px-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-w-0">
          {title ? (
            <p className="truncate font-display text-base font-semibold md:text-xl">
              {title}
            </p>
          ) : (
            <p className="font-display text-base font-semibold md:text-xl">Photos</p>
          )}
          <p className="text-xs text-white/70 md:text-sm">
            {safeIndex + 1} of {total}
            <span className="hidden sm:inline"> · Esc to close · arrows to browse</span>
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className={cn(
            'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white md:h-12 md:w-12 md:rounded-2xl',
            cssMotion.interactive,
          )}
          aria-label="Close gallery"
        >
          <X className="h-6 w-6" />
        </button>
      </div>

      <div
        className="relative mx-auto mt-2 flex min-h-0 w-full max-w-6xl flex-1 items-center justify-center md:mt-3"
        onClick={onStageClick}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          pointerStart.current = null
        }}
      >
        {total > 1 ? (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                go(-1)
              }}
              className={cn(
                'absolute left-2 z-10 hidden h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-white shadow-lg backdrop-blur-sm hover:bg-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white md:inline-flex',
                cssMotion.interactive,
              )}
              aria-label="Previous photo"
            >
              <ChevronLeft className="h-7 w-7" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                go(1)
              }}
              className={cn(
                'absolute right-2 z-10 hidden h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-white shadow-lg backdrop-blur-sm hover:bg-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white md:inline-flex',
                cssMotion.interactive,
              )}
              aria-label="Next photo"
            >
              <ChevronRight className="h-7 w-7" />
            </button>
          </>
        ) : null}

        <AnimatePresence mode="wait" initial={false}>
          <motion.img
            key={current}
            src={current}
            alt={title ? `${title} photo ${safeIndex + 1}` : `Photo ${safeIndex + 1}`}
            className={cn(
              'max-h-full max-w-full object-contain shadow-2xl',
              'touch-pan-y select-none rounded-none md:rounded-xl',
              'md:max-h-[min(78vh,900px)]',
            )}
            draggable={false}
            variants={reduce ? undefined : lightboxImageVariants}
            initial={reduce ? { opacity: 0 } : 'enter'}
            animate={reduce ? { opacity: 1 } : 'center'}
            exit={reduce ? { opacity: 0 } : 'exit'}
            transition={reduce ? { duration: 0.12 } : springSnappy}
            referrerPolicy="no-referrer"
            onClick={(e) => e.stopPropagation()}
          />
        </AnimatePresence>
      </div>

      {total > 1 ? (
        <div
          className="mx-auto mt-2 flex w-full max-w-6xl gap-2 overflow-x-auto px-3 pb-1 md:mt-3 md:px-0"
          onClick={(e) => e.stopPropagation()}
        >
          {images.map((url, i) => (
            <button
              key={`${url}-${i}`}
              type="button"
              onClick={() => onIndexChange(i)}
              aria-label={`Show photo ${i + 1}`}
              aria-current={i === safeIndex}
              className={cn(
                'h-12 w-16 shrink-0 overflow-hidden rounded-lg border-2 sm:h-14 sm:w-20 md:h-16 md:w-24',
                cssMotion.chip,
                i === safeIndex
                  ? 'border-honey ring-2 ring-honey/40'
                  : 'border-transparent opacity-70 hover:opacity-100',
              )}
            >
              <img
                src={url}
                alt=""
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
            </button>
          ))}
        </div>
      ) : null}
    </motion.div>
  )
}

/** Clickable photo surface that opens a lightbox at a given index. */
export function OpenableImage({
  images,
  index = 0,
  title,
  onOpen,
  className,
  imgClassName,
  alt = '',
}: {
  images: string[]
  index?: number
  title?: string
  onOpen: (images: string[], index: number, title?: string) => void
  className?: string
  imgClassName?: string
  alt?: string
}) {
  const url = images[index]
  if (!url) return null

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onOpen(images, index, title)
      }}
      className={cn(
        'group relative block overflow-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sea',
        className,
      )}
      aria-label={
        images.length > 1
          ? `View photo ${index + 1} of ${images.length}${title ? ` — ${title}` : ''}`
          : `View photo${title ? ` — ${title}` : ''}`
      }
    >
      <img
        src={url}
        alt={alt}
        className={cn('h-full w-full object-cover motion-hover-zoom', imgClassName)}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={(e) => {
          const el = e.currentTarget
          el.style.display = 'none'
          const parent = el.parentElement
          if (parent && !parent.querySelector('[data-img-fallback]')) {
            const fallback = document.createElement('span')
            fallback.dataset.imgFallback = '1'
            fallback.className =
              'flex h-full min-h-[5rem] w-full items-center justify-center bg-folio px-2 text-center text-sm text-ink-soft'
            fallback.textContent = 'Photo unavailable'
            parent.appendChild(fallback)
          }
        }}
      />
      <span className="pointer-events-none absolute inset-0 bg-ink/0 motion-hover-veil group-hover:bg-ink/20 group-focus-visible:bg-ink/15" />
      <span className="pointer-events-none absolute bottom-2 right-2 rounded-full bg-ink/70 px-2 py-0.5 text-xs font-bold text-white opacity-0 motion-hover-veil group-hover:opacity-100 group-focus-visible:opacity-100">
        Expand
      </span>
    </button>
  )
}
