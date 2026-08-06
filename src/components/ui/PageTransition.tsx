import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'
import { pageVariants, tweenPanel } from '../../lib/motionPresets'

/**
 * Interruptible enter/exit for guide steps, Places, and account panels.
 * Opacity-only when the user prefers reduced motion.
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
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={viewKey}
        className={className}
        initial={reduce ? { opacity: 0 } : 'enter'}
        animate={reduce ? { opacity: 1, transition: { duration: 0.15 } } : 'center'}
        exit={reduce ? { opacity: 0, transition: { duration: 0.1 } } : 'exit'}
        variants={reduce ? undefined : pageVariants}
        transition={tweenPanel}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
