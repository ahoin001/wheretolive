import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { tweenUi } from '../../lib/motionPresets'
import { cn } from '../../lib/utils'

/**
 * Bottom floating action panel for list scrolling.
 * Appears when primary tools scroll out of view (or always in select mode on mobile).
 */
export function FloatingListDock({
  open,
  children,
  className,
  layout = 'row',
  'aria-label': ariaLabel = 'List actions',
}: {
  open: boolean
  children: ReactNode
  className?: string
  /** `stack` = column (tier chips above actions). `row` = classic wrap toolbar. */
  layout?: 'row' | 'stack'
  'aria-label'?: string
}) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="floating-list-dock"
          role="toolbar"
          aria-label={ariaLabel}
          initial={{ opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98 }}
          transition={tweenUi}
          className={cn(
            'pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3',
            className,
          )}
        >
          <div
            className={cn(
              'pointer-events-auto w-full max-w-xl min-w-0 rounded-2xl border border-line bg-panel/95 px-2.5 py-2 shadow-[var(--shadow-lift)] backdrop-blur-md sm:px-3 sm:py-2.5',
              layout === 'stack'
                ? 'flex flex-col gap-2'
                : 'flex flex-wrap items-center gap-1.5 sm:gap-2',
            )}
          >
            {children}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
