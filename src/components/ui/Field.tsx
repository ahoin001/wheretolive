import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string
  hint?: string
  children: ReactNode
  className?: string
}) {
  return (
    <label className={cn('flex flex-col gap-1.5', className)}>
      <span className="text-sm font-bold leading-5 text-ink">{label}</span>
      {children}
      {hint ? (
        <span className="text-xs leading-4 text-ink-soft">{hint}</span>
      ) : null}
    </label>
  )
}

export function TextInput({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-12 w-full rounded-xl border border-line bg-panel px-3.5 text-base text-ink placeholder:text-ink-soft/70',
        className,
      )}
      {...props}
    />
  )
}

export function TextTextarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'min-h-28 w-full rounded-xl border border-line bg-panel px-3.5 py-3 text-base text-ink placeholder:text-ink-soft/70',
        className,
      )}
      {...props}
    />
  )
}

export function CurrencyInput({
  value,
  onChange,
  className,
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: number
  onChange: (value: number) => void
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-soft">
        $
      </span>
      <input
        inputMode="decimal"
        className={cn(
          'h-12 w-full rounded-xl border border-line bg-panel pl-8 pr-3.5 text-base text-ink',
          className,
        )}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        {...props}
      />
    </div>
  )
}

export function NumberInput({
  value,
  onChange,
  className,
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: number
  onChange: (value: number) => void
}) {
  return (
    <input
      type="number"
      className={cn(
        'h-12 w-full rounded-xl border border-line bg-panel px-3.5 text-base text-ink',
        className,
      )}
      value={Number.isFinite(value) ? value : 0}
      onChange={(e) => onChange(Number(e.target.value) || 0)}
      {...props}
    />
  )
}
