import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'
import { pageVariants, tweenPanel } from '../../lib/motionPresets'
import { cn } from '../../lib/utils'

/**
 * Interruptible enter/exit for guide steps, Places, and account panels.
 * Opacity-only when the user prefers reduced motion.
 * Crossfade (no mode="wait") so Continue isn't locked mid-animation.
 */
export function PageTransition({
  viewKey,
  children,
  className,
}: {
  viewKey: string
  children: ReactNode
  className?: string
}) {
  const reduce = useReducedMotion()

  return (
    <div className={cn('relative grid w-full', className)}>
      <AnimatePresence initial={false}>
        <motion.div
          key={viewKey}
          className="col-start-1 row-start-1 w-full"
          initial={reduce ? { opacity: 0 } : 'enter'}
          animate={
            reduce ? { opacity: 1, transition: { duration: 0.15 } } : 'center'
          }
          exit={
            reduce ? { opacity: 0, transition: { duration: 0.1 } } : 'exit'
          }
          variants={reduce ? undefined : pageVariants}
          transition={tweenPanel}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
