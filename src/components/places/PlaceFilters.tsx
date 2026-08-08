import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import type { PetsFilter } from '../../domain/places/filtering'
import { motion } from '../../lib/motion'
import { cn } from '../../lib/utils'

function PetsFilterControl({
  value,
  onChange,
  size = 'default',
}: {
  value: PetsFilter
  onChange: (value: PetsFilter) => void
  size?: 'default' | 'compact'
}) {
  const options: { value: PetsFilter; label: string }[] = [
    { value: 'allowed', label: 'Pets OK' },
    { value: 'none', label: 'No pets' },
    { value: 'all', label: 'All' },
  ]
  return (
    <div
      role="radiogroup"
      aria-label="Pets"
      className={cn(
        'inline-flex max-w-full flex-wrap rounded-full border border-line bg-panel p-0.5',
        size === 'compact' && 'scale-[0.98]',
      )}
    >
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              size === 'compact'
                ? 'min-h-9 px-2.5 text-xs'
                : 'min-h-11 px-3.5 text-sm',
              'rounded-full font-bold',
              motion.chip,
              selected
                ? 'bg-sea text-white shadow-[var(--shadow-soft)]'
                : 'text-ink-soft hover:bg-folio hover:text-ink',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

/** Compact multi-select city filter (dropdown) — keeps filter bar one row. */
function CityFilterMenu({
  cities,
  selectedKeys,
  onChange,
  className,
}: {
  cities: { key: string; label: string; count: number }[]
  selectedKeys: string[]
  onChange: (keys: string[]) => void
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null)
  const known = useMemo(() => new Set(cities.map((c) => c.key)), [cities])
  const active = useMemo(
    () => selectedKeys.filter((k) => known.has(k)),
    [selectedKeys, known],
  )

  useEffect(() => {
    if (!open) return
    const place = () => {
      const el = buttonRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const menuH = 224
      const spaceBelow = window.innerHeight - r.bottom
      const openUp = spaceBelow < menuH && r.top > spaceBelow
      setMenuStyle({
        position: 'fixed',
        left: Math.min(r.left, window.innerWidth - 288),
        width: Math.max(r.width, 224),
        maxHeight: menuH,
        zIndex: 90,
        ...(openUp
          ? { bottom: window.innerHeight - r.top + 6, top: 'auto' }
          : { top: r.bottom + 6, bottom: 'auto' }),
      })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (cities.length === 0) return null

  const summary =
    active.length === 0
      ? 'All cities'
      : active.length === 1
        ? (cities.find((c) => c.key === active[0])?.label ?? '1 city')
        : `${active.length} cities`

  const toggle = (key: string) => {
    if (active.includes(key)) {
      onChange(active.filter((k) => k !== key))
    } else {
      onChange([...active, key])
    }
  }

  return (
    <div ref={rootRef} className={cn('relative min-w-0', className)}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex h-10 w-full min-w-0 max-w-full items-center gap-1.5 rounded-xl border bg-panel px-2.5 text-left text-sm font-bold text-ink md:h-8 md:max-w-[13rem] md:rounded-lg',
          motion.chip,
          active.length > 0
            ? 'border-sea bg-sea/5 text-sea-deep'
            : 'border-line hover:border-sea',
        )}
      >
        <span className="min-w-0 flex-1 truncate">{summary}</span>
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 shrink-0 text-ink-soft',
            motion.transform,
            open && 'rotate-180',
          )}
        />
      </button>

      {open && menuStyle ? (
        <div
          role="listbox"
          aria-multiselectable
          aria-label="Filter by city"
          style={menuStyle}
          className="overflow-y-auto rounded-xl border border-line bg-panel py-1 shadow-[var(--shadow-lift)]"
        >
          <button
            type="button"
            role="option"
            aria-selected={active.length === 0}
            onClick={() => {
              onChange([])
              setOpen(false)
            }}
            className={cn(
              'flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-bold hover:bg-folio',
              active.length === 0 ? 'text-sea-deep' : 'text-ink',
            )}
          >
            <span
              className={cn(
                'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                active.length === 0
                  ? 'border-sea bg-sea text-white'
                  : 'border-line bg-panel',
              )}
            >
              {active.length === 0 ? <Check className="h-3 w-3" /> : null}
            </span>
            All cities
          </button>
          {cities.map((city) => {
            const on = active.includes(city.key)
            return (
              <button
                key={city.key}
                type="button"
                role="option"
                aria-selected={on}
                onClick={() => toggle(city.key)}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-bold hover:bg-folio',
                  on ? 'text-sea-deep' : 'text-ink',
                )}
              >
                <span
                  className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                    on
                      ? 'border-sea bg-sea text-white'
                      : 'border-line bg-panel',
                  )}
                >
                  {on ? <Check className="h-3 w-3" /> : null}
                </span>
                <span className="min-w-0 flex-1 truncate">{city.label}</span>
                <span className="tabular-nums text-xs text-ink-soft">
                  {city.count}
                </span>
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}


export { PetsFilterControl, CityFilterMenu }
