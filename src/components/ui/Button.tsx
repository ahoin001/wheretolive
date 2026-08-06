import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'honey'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  children: ReactNode
}

const styles: Record<Variant, string> = {
  primary:
    'bg-sea text-white hover:bg-sea-deep shadow-[var(--shadow-soft)]',
  secondary:
    'bg-panel text-ink border border-line hover:border-sea hover:bg-folio',
  ghost: 'bg-transparent text-ink-soft hover:bg-folio hover:text-ink',
  honey: 'bg-honey text-white hover:brightness-95 shadow-[var(--shadow-soft)]',
}

export function Button({
  variant = 'primary',
  className,
  children,
  ...props
}: Props) {
  return (
    <button
      className={cn(
        'inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 py-3 text-base font-bold transition disabled:cursor-not-allowed disabled:opacity-50',
        styles[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
