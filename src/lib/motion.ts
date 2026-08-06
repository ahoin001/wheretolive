/**
 * CSS motion class tokens. Prefer these over bare Tailwind `transition`
 * so easing, duration, and reduced-motion stay consistent app-wide.
 *
 * Definitions live in `src/index.css`. For interruptible enter/exit, use
 * `motion/react` + `lib/motionPresets.ts` instead.
 */
export const cssMotion = {
  /** Color / border / shadow state changes (chips, tabs, hovers) */
  color: 'motion-color',
  /** Transform + opacity (toggles, small movements) */
  transform: 'motion-transform',
  /** Pressable controls: color + active scale(0.97) */
  interactive: 'motion-interactive',
  /** Compact chips / pills used many times a session */
  chip: 'motion-chip',
  /** Overlay scrim (modals, lightbox) — prefer motion/react overlays when open/close */
  overlay: 'motion-overlay',
  /** Centered dialog content on open */
  dialog: 'motion-dialog',
  /** Guide step / mode panel enter — prefer PageTransition for route changes */
  stepEnter: 'motion-step-enter',
} as const

/** @deprecated use cssMotion — kept for gradual renames */
export const motion = cssMotion
