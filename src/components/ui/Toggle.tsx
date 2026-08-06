import { cn } from '../../lib/utils'
import { cssMotion } from '../../lib/motion'
import { motion, useReducedMotion } from 'motion/react'
import { springSnappy } from '../../lib/motionPresets'

export function Toggle({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  hint?: string
}) {
  const reduce = useReducedMotion()

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'flex w-full items-start gap-4 rounded-2xl border border-line bg-panel p-4 text-left hover:border-sea',
        cssMotion.color,
      )}
    >
      <span
        className={cn(
          'mt-1 inline-flex h-7 w-12 shrink-0 items-center rounded-full px-1',
          cssMotion.color,
          checked ? 'bg-sea' : 'bg-line',
        )}
      >
        <motion.span
          className="h-5 w-5 rounded-full bg-white shadow-sm"
          initial={false}
          animate={{ x: checked ? 20 : 0 }}
          transition={reduce ? { duration: 0.01 } : springSnappy}
        />
      </span>
      <span>
        <span className="block text-base font-bold text-ink">{label}</span>
        {hint ? <span className="mt-1 block text-sm text-ink-soft">{hint}</span> : null}
      </span>
    </button>
  )
}
