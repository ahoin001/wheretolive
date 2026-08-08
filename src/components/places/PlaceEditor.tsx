import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { motion } from '../../lib/motion'
import { cn } from '../../lib/utils'
import { Button } from '../ui/Button'
import { TextInput } from '../ui/Field'

function FormSection({ children }: { children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-panel p-4">
      {children}
    </section>
  )
}

function ChipPicker({
  legend,
  suggestions,
  selected,
  onChange,
  tone,
  customPlaceholder,
}: {
  legend: string
  suggestions: string[]
  selected: string[]
  onChange: (next: string[]) => void
  tone: 'pro' | 'con'
  customPlaceholder: string
}) {
  const [custom, setCustom] = useState('')
  const pool = useMemo(() => {
    const extras = selected.filter((s) => !suggestions.includes(s))
    return [...suggestions, ...extras]
  }, [suggestions, selected])

  const toggle = (label: string) => {
    if (selected.includes(label)) {
      onChange(selected.filter((s) => s !== label))
    } else {
      onChange([...selected, label])
    }
  }

  const addCustom = (e?: FormEvent) => {
    e?.preventDefault()
    const label = custom.trim()
    if (!label) return
    if (!selected.includes(label)) onChange([...selected, label])
    setCustom('')
  }

  return (
    <fieldset>
      <legend className="text-sm font-bold leading-5 text-ink">{legend}</legend>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {pool.map((label) => {
          const on = selected.includes(label)
          return (
            <button
              key={label}
              type="button"
              onClick={() => toggle(label)}
              aria-pressed={on}
              className={cn(
                'h-9 rounded-full border px-3 text-sm font-bold',
                motion.chip,
                on &&
                  tone === 'pro' &&
                  'border-move bg-move text-white shadow-[var(--shadow-soft)]',
                on &&
                  tone === 'con' &&
                  'border-warn bg-warn text-white shadow-[var(--shadow-soft)]',
                !on && 'border-line bg-panel text-ink hover:border-sea hover:bg-folio',
              )}
            >
              {label}
            </button>
          )
        })}
      </div>
      <form onSubmit={addCustom} className="mt-3 flex gap-2">
        <TextInput
          className="min-w-0 flex-1"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder={customPlaceholder}
        />
        <Button type="submit" variant="secondary" className="h-12 shrink-0 rounded-xl px-4">
          Add
        </Button>
      </form>
    </fieldset>
  )
}


export { FormSection, ChipPicker }
