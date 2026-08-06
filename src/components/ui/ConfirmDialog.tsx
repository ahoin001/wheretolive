import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion } from '../../lib/motion'
import { cn } from '../../lib/utils'
import { Button } from './Button'

export type ConfirmDialogProps = {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  /** Destructive confirm styling (default) */
  tone?: 'danger' | 'primary'
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId()
  const descId = useId()
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const t = window.setTimeout(() => confirmRef.current?.focus(), 40)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.clearTimeout(t)
      window.removeEventListener('keydown', onKey)
    }
  }, [open, busy, onCancel])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-[120] flex items-end justify-center bg-ink/45 p-4 sm:items-center',
        motion.overlay,
      )}
      role="presentation"
      onClick={() => {
        if (!busy) onCancel()
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        className={cn(
          'w-full max-w-md rounded-[1.5rem] border border-line bg-panel p-5 shadow-[var(--shadow-lift)] md:p-6',
          motion.dialog,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="font-display text-2xl font-semibold text-ink">
          {title}
        </h2>
        {description ? (
          <p id={descId} className="mt-2 text-base leading-relaxed text-ink-soft">
            {description}
          </p>
        ) : null}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={onCancel}
            className="sm:min-w-[7rem]"
          >
            {cancelLabel}
          </Button>
          <Button
            ref={confirmRef}
            type="button"
            variant={tone === 'danger' ? 'danger' : 'primary'}
            disabled={busy}
            onClick={onConfirm}
            className="sm:min-w-[7rem]"
          >
            {busy ? 'Working…' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
