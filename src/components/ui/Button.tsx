import {
  forwardRef,
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react'
import { motion } from '../../lib/motion'
import { cn } from '../../lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'honey' | 'danger'

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
  danger:
    'bg-warn text-white hover:brightness-95 shadow-[var(--shadow-soft)]',
}

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'primary', className, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 py-3 text-base font-bold disabled:cursor-not-allowed disabled:opacity-50',
        motion.interactive,
        styles[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
})

/** Link styled like a filled control so secondary actions stay scannable. */
export function ButtonLink({
  variant = 'secondary',
  className,
  children,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: Variant
  children: ReactNode
}) {
  return (
    <a
      className={cn(
        'inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 py-3 text-base font-bold',
        motion.interactive,
        styles[variant],
        className,
      )}
      {...props}
    >
      {children}
    </a>
  )
}
