import { cn } from '../../lib/utils'

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
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-start gap-4 rounded-2xl border border-line bg-panel p-4 text-left hover:border-sea"
    >
      <span
        className={cn(
          'mt-1 inline-flex h-7 w-12 shrink-0 items-center rounded-full px-1 transition',
          checked ? 'bg-sea' : 'bg-line',
        )}
      >
        <span
          className={cn(
            'h-5 w-5 rounded-full bg-white transition',
            checked ? 'translate-x-5' : 'translate-x-0',
          )}
        />
      </span>
      <span>
        <span className="block text-base font-bold text-ink">{label}</span>
        {hint ? <span className="mt-1 block text-sm text-ink-soft">{hint}</span> : null}
      </span>
    </button>
  )
}
