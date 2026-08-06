import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from 'motion/react'
import {
  drawerPanelVariants,
  drawerScrimVariants,
} from '../../lib/motionPresets'
import { cn } from '../../lib/utils'

type SideDrawerProps = {
  open: boolean
  onClose: () => void
  children: ReactNode
  'aria-labelledby'?: string
  'aria-label'?: string
  panelClassName?: string
  /** Stacking context — panel sits above scrim via sibling order + same z base */
  zIndexClassName?: string
  /** When false, parent owns Escape (e.g. nested lightbox) */
  closeOnEscape?: boolean
}

/**
 * Premium right-edge sheet: spring open, decisive slide-close, soft scrim.
 * AnimatePresence keeps both layers alive until their exits finish so close
 * never hard-cuts.
 */
export function SideDrawer({
  open,
  onClose,
  children,
  'aria-labelledby': ariaLabelledBy,
  'aria-label': ariaLabel,
  panelClassName,
  zIndexClassName = 'z-[80]',
  closeOnEscape = true,
}: SideDrawerProps) {
  const reduce = useReducedMotion()
  const panelRef = useRef<HTMLDivElement>(null)
  const [scrollLocked, setScrollLocked] = useState(false)

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

  useEffect(() => {
    if (!open) return
    const t = window.setTimeout(() => {
      const titled = ariaLabelledBy
        ? document.getElementById(ariaLabelledBy)
        : null
      if (titled instanceof HTMLElement) {
        titled.focus()
        return
      }
      panelRef.current
        ?.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        )
        ?.focus()
    }, 100)
    return () => window.clearTimeout(t)
  }, [open, ariaLabelledBy])

  if (typeof document === 'undefined') return null

  // Scrim below panel: 80 vs 81
  const scrimZ = zIndexClassName
  const panelZ = zIndexClassName === 'z-[80]' ? 'z-[81]' : zIndexClassName

  return createPortal(
    <AnimatePresence
      onExitComplete={() => {
        setScrollLocked(false)
      }}
    >
      {open ? (
        <motion.button
          key="side-drawer-scrim"
          type="button"
          aria-label="Close"
          className={cn(
            'fixed inset-0 cursor-default bg-ink/40 backdrop-blur-[3px]',
            scrimZ,
          )}
          initial={reduce ? { opacity: 0 } : 'hidden'}
          animate={reduce ? { opacity: 1 } : 'visible'}
          exit={reduce ? { opacity: 0, transition: { duration: 0.12 } } : 'exit'}
          variants={reduce ? undefined : drawerScrimVariants}
          transition={reduce ? { duration: 0.14 } : undefined}
          onClick={onClose}
        />
      ) : null}

      {open ? (
        <motion.div
          key="side-drawer-panel"
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={ariaLabelledBy}
          aria-label={ariaLabel}
          className={cn(
            'fixed inset-y-0 right-0 flex h-full w-full flex-col bg-panel',
            'shadow-[-16px_0_48px_rgba(28,43,42,0.14)]',
            'will-change-transform',
            panelZ,
            panelClassName ?? 'max-w-3xl sm:max-w-2xl lg:max-w-3xl',
          )}
          initial={reduce ? { opacity: 0 } : 'hidden'}
          animate={reduce ? { opacity: 1 } : 'visible'}
          exit={reduce ? { opacity: 0, transition: { duration: 0.12 } } : 'exit'}
          variants={reduce ? undefined : drawerPanelVariants}
          transition={reduce ? { duration: 0.16, ease: [0.23, 1, 0.32, 1] } : undefined}
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
