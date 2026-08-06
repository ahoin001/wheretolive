# Design system — Room for the Next Chapter

## World

Household planning folio for a kitchen-table conversation: mist surfaces, sea-glass actions, honey accents, generous spacing, large controls.

## Type

- Display: Petrona
- UI / body: Atkinson Hyperlegible

## Color

- Mist background `#f2f6f5`
- Folio panels `#e8efed`
- Ink `#1c2b2a`
- Sea `#5b8a84`
- Honey `#c47b3a`
- Keep path `#4a6d8c`
- Move path `#6b7f4a`

## Motion

Calm kitchen-table UI — feedback over flair. No marketing bounce.

### Stack

1. **CSS tokens** (`src/index.css` + `src/lib/motion.ts` as `cssMotion`) for pressable controls, chips, hover.
2. **Motion library** (`motion/react`) for interruptible enter/exit: step pages, dialogs, lightbox, toggle spring.
3. **Presets** in `src/lib/motionPresets.ts` (snappy spring, panel tween, dialog never from scale 0).
4. Root `<MotionConfig reducedMotion="user" />` in `main.tsx`.

### Tokens (`@theme`)

| Token | Value | Use |
| --- | --- | --- |
| `--ease-snappy` | `cubic-bezier(0.23, 1, 0.32, 1)` | UI enter / feedback |
| `--ease-sheet` | `cubic-bezier(0.32, 0.72, 0, 1)` | Overlays |
| `--duration-press` | `130ms` | Active scale |
| `--duration-fast` | `160ms` | Buttons, chips |
| `--duration-panel` | `280ms` | Step / panel changes |

### Rules

- Prefer CSS for high-frequency hover/press; Motion for occasional open/close and springs.
- Gate hover zoom behind fine-pointer media query.
- Reduced motion: opacity-only page/dialog; drop displacement.

## Voice

Plain English, non-judgmental, no forced winner colors, always show “because” reasons beside fit summaries.
