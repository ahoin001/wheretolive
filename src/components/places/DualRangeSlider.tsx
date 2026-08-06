import { useCallback, useId, useMemo, useRef } from 'react'
import { cn } from '../../lib/utils'
import { formatMoney } from '../../domain/finance/calculations'

export function niceStep(min: number, max: number): number {
  const span = Math.max(max - min, 1)
  if (span <= 500) return 25
  if (span <= 2000) return 50
  if (span <= 10000) return 100
  if (span <= 100000) return 1000
  if (span <= 1000000) return 5000
  return 10000
}

export function padBounds(values: number[]): { min: number; max: number; step: number } {
  if (!values.length) {
    return { min: 0, max: 5000, step: 100 }
  }
  let lo = Math.min(...values)
  let hi = Math.max(...values)
  if (lo === hi) {
    const pad = Math.max(lo * 0.15, lo >= 50000 ? 25000 : lo >= 1000 ? 250 : 100)
    lo = Math.max(0, Math.floor(lo - pad))
    hi = Math.ceil(hi + pad)
  } else {
    const pad = (hi - lo) * 0.05
    lo = Math.max(0, Math.floor(lo - pad))
    hi = Math.ceil(hi + pad)
  }
  const step = niceStep(lo, hi)
  lo = Math.floor(lo / step) * step
  hi = Math.ceil(hi / step) * step
  if (lo >= hi) hi = lo + step
  return { min: lo, max: hi, step }
}

export function DualRangeSlider({
  label,
  min,
  max,
  step,
  valueMin,
  valueMax,
  onChange,
  formatValue = (n) => formatMoney(n),
  disabled,
  className,
}: {
  label: string
  min: number
  max: number
  step: number
  valueMin: number
  valueMax: number
  onChange: (next: { min: number; max: number }) => void
  formatValue?: (n: number) => string
  disabled?: boolean
  className?: string
}) {
  const id = useId()
  const trackRef = useRef<HTMLDivElement>(null)
  const span = Math.max(max - min, step)
  const lo = Math.min(Math.max(valueMin, min), max)
  const hi = Math.min(Math.max(valueMax, min), max)
  const leftPct = ((Math.min(lo, hi) - min) / span) * 100
  const rightPct = ((Math.max(lo, hi) - min) / span) * 100

  const clamp = useCallback(
    (n: number) => {
      const snapped = Math.round(n / step) * step
      return Math.min(max, Math.max(min, snapped))
    },
    [min, max, step],
  )

  const ticks = useMemo(() => {
    return [
      { label: formatValue(min), at: 0 },
      { label: formatValue(max), at: 100 },
    ]
  }, [min, max, formatValue])

  if (disabled || min >= max) {
    return (
      <div className={cn('rounded-2xl border border-line bg-panel px-4 py-3', className)}>
        <p className="text-sm font-bold text-ink">{label}</p>
        <p className="mt-2 text-sm text-ink-soft">
          Add places with prices to enable this range.
        </p>
      </div>
    )
  }

  return (
    <div className={cn('rounded-2xl border border-line bg-panel px-4 py-3', className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-bold text-ink" id={`${id}-label`}>
          {label}
        </p>
        <p className="text-sm font-bold text-sea-deep" aria-live="polite">
          {formatValue(Math.min(lo, hi))} – {formatValue(Math.max(lo, hi))}
        </p>
      </div>

      <div className="relative mt-6 mb-2 h-8" ref={trackRef}>
        <div className="absolute left-0 right-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-line" />
        <div
          className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-sea"
          style={{ left: `${leftPct}%`, right: `${100 - rightPct}%` }}
        />

        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={Math.min(lo, hi)}
          aria-labelledby={`${id}-label`}
          aria-label={`${label} minimum`}
          className="dual-range-thumb absolute inset-0 z-[3] m-0 h-8 w-full appearance-none bg-transparent"
          onChange={(e) => {
            const next = clamp(Number(e.target.value))
            const top = Math.max(lo, hi)
            onChange({ min: Math.min(next, top), max: Math.max(next, top) })
          }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={Math.max(lo, hi)}
          aria-labelledby={`${id}-label`}
          aria-label={`${label} maximum`}
          className="dual-range-thumb absolute inset-0 z-[4] m-0 h-8 w-full appearance-none bg-transparent"
          onChange={(e) => {
            const next = clamp(Number(e.target.value))
            const bottom = Math.min(lo, hi)
            onChange({ min: Math.min(bottom, next), max: Math.max(bottom, next) })
          }}
        />
      </div>

      <div className="flex justify-between text-xs text-ink-soft">
        {ticks.map((t) => (
          <span key={t.at}>{t.label}</span>
        ))}
      </div>
    </div>
  )
}
