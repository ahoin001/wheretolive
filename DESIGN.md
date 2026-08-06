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

### Tokens (`src/index.css` `@theme`)

| Token | Value | Use |
| --- | --- | --- |
| `--ease-snappy` | `cubic-bezier(0.23, 1, 0.32, 1)` | UI enter / feedback |
| `--ease-settle` | `cubic-bezier(0.77, 0, 0.175, 1)` | On-screen morphs |
| `--ease-sheet` | `cubic-bezier(0.32, 0.72, 0, 1)` | Overlays / scrims |
| `--duration-press` | `130ms` | Active scale |
| `--duration-fast` | `160ms` | Buttons, chips |
| `--duration-ui` | `200ms` | Color / toggles |
| `--duration-panel` | `280ms` | Step enter, lightbox |

### Classes (`src/lib/motion.ts`)

- `motion.interactive` — pressable controls (`scale(0.97)` on `:active`)
- `motion.chip` — filter chips / step nav tabs
- `motion.color` / `motion.transform` — property-scoped transitions (never `transition: all`)
- `motion.stepEnter` — guide step / mode panel enter (opacity + 8px rise)
- `motion.overlay` / `motion.dialog` — lightbox open (dialog starts at `scale(0.97)`, not 0)

### Rules

- Prefer CSS transitions over keyframes for repeated toggles.
- Gate hover zoom/veil behind `@media (hover: hover) and (pointer: fine)`.
- `prefers-reduced-motion`: keep short opacity/color feedback; drop displacement and press-scale.
- Sticky step footer and finance stats remain the primary continuous feedback.

## Voice

Plain English, non-judgmental, no forced winner colors, always show “because” reasons beside fit summaries.
