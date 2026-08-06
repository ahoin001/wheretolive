import { useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  filterCitySuggestions,
  mergeCitySuggestions,
  sanitizeCity,
} from '../../domain/places/address'
import { cn } from '../../lib/utils'

export function CityCombobox({
  value,
  onChange,
  extraSuggestions = [],
  placeholder = 'Start typing a city…',
  id,
  className,
}: {
  value: string
  onChange: (city: string) => void
  extraSuggestions?: string[]
  placeholder?: string
  id?: string
  className?: string
}) {
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const [draft, setDraft] = useState(value)

  useEffect(() => {
    setDraft(value)
  }, [value])

  const options = useMemo(
    () => mergeCitySuggestions(extraSuggestions),
    [extraSuggestions],
  )

  const matches = useMemo(
    () => filterCitySuggestions(draft, options, 10),
    [draft, options],
  )

  useEffect(() => {
    setHighlight(0)
  }, [draft, open])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const commit = (raw: string) => {
    const next = sanitizeCity(raw)
    setDraft(next)
    onChange(next)
    setOpen(false)
  }

  const showList = open && matches.length > 0

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <input
        id={id}
        type="text"
        autoComplete="address-level2"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        value={draft}
        placeholder={placeholder}
        className="h-12 w-full rounded-xl border border-line bg-panel px-3.5 text-base text-ink placeholder:text-ink-soft/70"
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setDraft(e.target.value)
          setOpen(true)
        }}
        onBlur={() => {
          // Defer so option mousedown can run first
          window.setTimeout(() => {
            if (!rootRef.current?.contains(document.activeElement)) {
              commit(draft)
            }
          }, 120)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && showList) {
            e.preventDefault()
            setHighlight((h) => Math.min(h + 1, matches.length - 1))
          } else if (e.key === 'ArrowUp' && showList) {
            e.preventDefault()
            setHighlight((h) => Math.max(h - 1, 0))
          } else if (e.key === 'Enter') {
            if (showList && matches[highlight]) {
              e.preventDefault()
              commit(matches[highlight]!)
            } else {
              commit(draft)
            }
          } else if (e.key === 'Escape') {
            setOpen(false)
          }
        }}
      />
      {showList ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-line bg-panel py-1 shadow-[var(--shadow-soft)]"
        >
          {matches.map((city, i) => (
            <li key={city} role="option" aria-selected={i === highlight}>
              <button
                type="button"
                className={cn(
                  'flex w-full px-3.5 py-2.5 text-left text-base text-ink',
                  i === highlight ? 'bg-folio' : 'hover:bg-folio/80',
                )}
                onMouseEnter={() => setHighlight(i)}
                onMouseDown={(e) => {
                  e.preventDefault()
                  commit(city)
                }}
              >
                {city}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
