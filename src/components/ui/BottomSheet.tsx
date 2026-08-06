import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from 'motion/react'
import {
  bottomSheetVariants,
  overlayVariants,
  sheetCenterVariants,
} from '../../lib/motionPresets'
import { cn } from '../../lib/utils'

function useWideScreen(breakpoint = 640) {
  const [wide, setWide] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia(`(min-width: ${breakpoint}px)`).matches
      : true,
  )
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${breakpoint}px)`)
    const onChange = () => setWide(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [breakpoint])
  return wide
}

/**
 * Mobile-first sheet: rises from the bottom under `sm`, centers on wider screens.
 * Matches ShareSheet physics (spring + handle).
 */
export function BottomSheet({
  open,
  onClose,
  title,
  titleId,
  children,
  footer,
  className,
  zIndexClassName = 'z-[90]',
  closeOnEscape = true,
}: {
  open: boolean
  onClose: () => void
  title?: string
  titleId?: string
  children: ReactNode
  footer?: ReactNode
  className?: string
  zIndexClassName?: string
  closeOnEscape?: boolean
}) {
  const reduce = useReducedMotion()
  const wide = useWideScreen()
  const [scrollLocked, setScrollLocked] = useState(false)
  const resolvedTitleId = titleId ?? 'bottom-sheet-title'

  useEffect(() => {
    if (open) setScrollLocked(true)
  }, [open])

  useEffect(() => {
    if (!scrollLocked) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [scrollLocked])

  useEffect(() => {
    if (!open || !closeOnEscape) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, closeOnEscape])

  if (typeof document === 'undefined') return null

  const panelVariants = wide ? sheetCenterVariants : bottomSheetVariants

  return createPortal(
    <AnimatePresence onExitComplete={() => setScrollLocked(false)}>
      {open ? (
        <motion.div
          key="bottom-sheet"
          className={cn(
            'fixed inset-0 flex items-end justify-center p-0 sm:items-center sm:p-4',
            zIndexClassName,
          )}
          role="presentation"
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          <motion.button
            type="button"
            aria-label="Close"
            className="absolute inset-0 cursor-default bg-ink/40 backdrop-blur-[3px]"
            variants={overlayVariants}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? resolvedTitleId : undefined}
            className={cn(
              'relative z-10 flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden border border-line bg-panel shadow-[var(--shadow-lift)]',
              'rounded-t-[1.75rem] sm:rounded-[1.75rem]',
              className,
            )}
            variants={reduce ? undefined : panelVariants}
            initial={reduce ? { opacity: 0 } : 'hidden'}
            animate={reduce ? { opacity: 1 } : 'visible'}
            exit={reduce ? { opacity: 0 } : 'exit'}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-line sm:hidden"
              aria-hidden
            />
            {title ? (
              <div className="shrink-0 px-5 pb-2 pt-3 md:px-6">
                <h2
                  id={resolvedTitleId}
                  className="font-display text-xl font-semibold text-ink md:text-2xl"
                >
                  {title}
                </h2>
              </div>
            ) : null}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-3 md:px-6">
              {children}
            </div>
            {footer ? (
              <div
                className={cn(
                  'shrink-0 border-t border-line px-5 pt-3 md:px-6',
                  'pb-[max(0.75rem,env(safe-area-inset-bottom))]',
                )}
              >
                {footer}
              </div>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
