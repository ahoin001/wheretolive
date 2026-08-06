import type { Transition, Variants } from 'motion/react'

/** Strong ease-out matching CSS --ease-snappy */
export const easeSnappy = [0.23, 1, 0.32, 1] as const
/** iOS-like sheet / drawer curve matching CSS --ease-sheet */
export const easeSheet = [0.32, 0.72, 0, 1] as const
/** Soft settle for on-screen morphs matching CSS --ease-settle */
export const easeSettle = [0.77, 0, 0.175, 1] as const

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

/**
 * Side drawers: critically damped-ish spring (tiny bounce only if thrown).
 * Matches Apple sheet response ~0.35 without toy bounce on programmatic open.
 */
export const springDrawer: Transition = {
  type: 'spring',
  duration: 0.42,
  bounce: 0.06,
}

/** Faster close so dismiss feels decisive */
export const tweenDrawerExit: Transition = {
  duration: 0.26,
  ease: easeSheet,
}

export const tweenUi: Transition = {
  duration: 0.2,
  ease: easeSnappy,
}

export const tweenPanel: Transition = {
  duration: 0.28,
  ease: easeSnappy,
}

export const tweenOverlay: Transition = {
  duration: 0.28,
  ease: easeSheet,
}

export const tweenOverlayExit: Transition = {
  duration: 0.2,
  ease: easeSnappy,
}

/** Guide step / mode panel enter+exit */
export const pageVariants: Variants = {
  enter: {
    opacity: 0,
    y: 8,
  },
  center: {
    opacity: 1,
    y: 0,
    transition: tweenPanel,
  },
  exit: {
    opacity: 0,
    y: -4,
    transition: { duration: 0.14, ease: easeSnappy },
  },
}

export const overlayVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: tweenOverlay,
  },
  exit: {
    opacity: 0,
    transition: tweenOverlayExit,
  },
}

/** Modals / dialogs — never scale from 0 */
export const dialogVariants: Variants = {
  hidden: { opacity: 0, scale: 0.97, y: 10 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: springSnappy,
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    y: 6,
    transition: { duration: 0.16, ease: easeSnappy },
  },
}

/**
 * Root shell for side drawer — holds children while exit plays.
 * Children use drawerScrimVariants / drawerPanelVariants.
 */
export const drawerRootVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      when: 'beforeChildren',
      staggerChildren: 0.02,
    },
  },
  exit: {
    transition: {
      when: 'afterChildren',
      staggerChildren: 0.02,
      staggerDirection: -1,
    },
  },
}

export const drawerScrimVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: tweenOverlay,
  },
  exit: {
    opacity: 0,
    transition: tweenOverlayExit,
  },
}

/** Right-edge sheet — transform only for smooth GPU compositing */
export const drawerPanelVariants: Variants = {
  hidden: { x: '100%' },
  visible: {
    x: 0,
    transition: springDrawer,
  },
  exit: {
    x: '100%',
    transition: tweenDrawerExit,
  },
}

/** Bottom sheet (mobile share / sheets) */
export const bottomSheetVariants: Variants = {
  hidden: { y: '110%', opacity: 0.96 },
  visible: {
    y: 0,
    opacity: 1,
    transition: springDrawer,
  },
  exit: {
    y: '110%',
    opacity: 1,
    transition: tweenDrawerExit,
  },
}

/** Centered modal panel on larger screens */
export const sheetCenterVariants: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: springSnappy,
  },
  exit: {
    opacity: 0,
    y: 10,
    scale: 0.985,
    transition: { duration: 0.18, ease: easeSnappy },
  },
}

export const lightboxImageVariants: Variants = {
  enter: { opacity: 0, scale: 0.985 },
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
