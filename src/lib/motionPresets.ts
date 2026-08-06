import type { Transition, Variants } from 'motion/react'

/** Strong ease-out matching CSS --ease-snappy */
export const easeSnappy = [0.23, 1, 0.32, 1] as const
/** iOS-like sheet curve matching CSS --ease-sheet */
export const easeSheet = [0.32, 0.72, 0, 1] as const

export const springSnappy: Transition = {
  type: 'spring',
  duration: 0.42,
  bounce: 0.12,
}

export const springSoft: Transition = {
  type: 'spring',
  duration: 0.5,
  bounce: 0.18,
}

export const tweenUi: Transition = {
  duration: 0.2,
  ease: easeSnappy,
}

export const tweenPanel: Transition = {
  duration: 0.28,
  ease: easeSnappy,
}

/** Guide step / mode panel enter+exit */
export const pageVariants: Variants = {
  enter: {
    opacity: 0,
    y: 10,
  },
  center: {
    opacity: 1,
    y: 0,
    transition: tweenPanel,
  },
  exit: {
    opacity: 0,
    y: -6,
    transition: { duration: 0.16, ease: easeSnappy },
  },
}

export const overlayVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.24, ease: easeSheet },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.16, ease: easeSnappy },
  },
}

/** Modals / dialogs — never scale from 0 */
export const dialogVariants: Variants = {
  hidden: { opacity: 0, scale: 0.97, y: 8 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: springSnappy,
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    y: 4,
    transition: { duration: 0.16, ease: easeSnappy },
  },
}

export const lightboxImageVariants: Variants = {
  enter: { opacity: 0, scale: 0.98 },
  center: {
    opacity: 1,
    scale: 1,
    transition: tweenPanel,
  },
  exit: {
    opacity: 0,
    scale: 0.99,
    transition: { duration: 0.12, ease: easeSnappy },
  },
}
