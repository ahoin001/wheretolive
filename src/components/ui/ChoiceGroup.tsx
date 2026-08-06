import { motion } from '../../lib/motion'
import { cn } from '../../lib/utils'

interface Option<T extends string> {
  value: T
  label: string
}

export function ChoiceGroup<T extends string>({
  legend,
  options,
  value,
  onChange,
  columns = 2,
  size = 'default',
  className,
}: {
  legend: string
  options: Option<T>[]
  value: T
  onChange: (value: T) => void
  columns?: 1 | 2 | 3 | 4
  size?: 'default' | 'compact'
  className?: string
}) {
  return (
    <fieldset className={cn('space-y-2', className)}>
      <legend className="text-sm font-bold leading-5 text-ink">{legend}</legend>
      <div
        className={cn(
          'grid gap-2',
          columns === 1 && 'grid-cols-1',
          columns === 2 && 'grid-cols-2',
          columns === 3 && 'grid-cols-1 sm:grid-cols-3',
          columns === 4 && 'grid-cols-2 sm:grid-cols-4',
        )}
      >
        {options.map((option) => {
          const selected = option.value === value
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={cn(
                'rounded-xl border text-center font-bold',
                motion.chip,
                size === 'compact' && 'h-11 px-2 text-sm',
                size === 'default' && 'h-12 px-3 text-sm sm:text-base',
                selected
                  ? 'border-sea bg-sea text-white shadow-[var(--shadow-soft)]'
                  : 'border-line bg-panel text-ink hover:border-sea hover:bg-folio',
              )}
              aria-pressed={selected}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
