import { useEffect, useState } from 'react'
import { MapPin } from 'lucide-react'
import type { CommuteSettings } from '../../domain/types'
import {
  commuteAnchorLine,
  DEFAULT_COMMUTE_SETTINGS,
  normalizeCommuteSettings,
} from '../../domain/places/commute'
import {
  parseLocationString,
  sanitizeAddress,
  sanitizeState,
  sanitizeStreet,
  sanitizeZip,
} from '../../domain/places/address'
import { motion } from '../../lib/motion'
import { cn } from '../../lib/utils'
import { Button } from '../ui/Button'
import { BottomSheet } from '../ui/BottomSheet'
import { Field, NumberInput, TextInput } from '../ui/Field'
import { CityCombobox } from '../ui/CityCombobox'

export function CommuteSettingsSheet({
  open,
  onClose,
  settings,
  onSave,
  className,
}: {
  open: boolean
  onClose: () => void
  settings: CommuteSettings
  onSave: (next: CommuteSettings) => void
  className?: string
}) {
  const [draft, setDraft] = useState(() => normalizeCommuteSettings(settings))

  useEffect(() => {
    if (open) setDraft(normalizeCommuteSettings(settings))
  }, [open, settings])

  const save = () => {
    onSave(normalizeCommuteSettings(draft))
    onClose()
  }

  const reset = () => {
    setDraft({ ...DEFAULT_COMMUTE_SETTINGS })
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Commute anchor">
      <div className={cn('space-y-4 pb-2', className)}>
        <p className="text-sm text-ink-soft">
          Drive times are measured from this address. Ideal and budget minutes
          control badge colors and the “Within commute” filter.
        </p>

        <Field label="Street">
          <TextInput
            value={draft.street}
            onChange={(e) =>
              setDraft((d) => ({ ...d, street: e.target.value }))
            }
            onBlur={() =>
              setDraft((d) => ({ ...d, street: sanitizeStreet(d.street) }))
            }
            placeholder="16401 Miramar Pkwy"
          />
        </Field>
        <Field label="City">
          <CityCombobox
            value={draft.city}
            onChange={(city) => setDraft((d) => ({ ...d, city }))}
            placeholder="Miramar"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="State">
            <TextInput
              value={draft.state}
              maxLength={2}
              className="uppercase"
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  state: e.target.value
                    .toUpperCase()
                    .replace(/[^A-Z]/g, '')
                    .slice(0, 2),
                }))
              }
              onBlur={() =>
                setDraft((d) => ({ ...d, state: sanitizeState(d.state) }))
              }
              placeholder="FL"
            />
          </Field>
          <Field label="ZIP">
            <TextInput
              value={draft.zip}
              inputMode="numeric"
              maxLength={10}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  zip: e.target.value.replace(/[^\d-]/g, '').slice(0, 10),
                }))
              }
              onBlur={() =>
                setDraft((d) => ({ ...d, zip: sanitizeZip(d.zip) }))
              }
              placeholder="33027"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Ideal max (min)" hint="Green badge">
            <NumberInput
              value={draft.idealMaxMin}
              min={5}
              max={120}
              onChange={(idealMaxMin) =>
                setDraft((d) => ({
                  ...d,
                  idealMaxMin: idealMaxMin ?? d.idealMaxMin,
                }))
              }
            />
          </Field>
          <Field label="Budget max (min)" hint="Honey badge">
            <NumberInput
              value={draft.budgetMaxMin}
              min={draft.idealMaxMin}
              max={180}
              onChange={(budgetMaxMin) =>
                setDraft((d) => ({
                  ...d,
                  budgetMaxMin: budgetMaxMin ?? d.budgetMaxMin,
                }))
              }
            />
          </Field>
        </div>

        <p className="rounded-xl border border-line/80 bg-folio/70 px-3 py-2 text-xs text-ink-soft">
          Preview:{' '}
          <span className="font-bold text-ink">
            {commuteAnchorLine(draft) || 'Add anchor address'}
          </span>
        </p>

        <div className="flex flex-wrap gap-2 pt-1">
          <Button type="button" variant="honey" className="flex-1" onClick={save}>
            Save commute settings
          </Button>
          <Button type="button" variant="secondary" onClick={reset}>
            Reset
          </Button>
        </div>
      </div>
    </BottomSheet>
  )
}

export function CommuteSettingsButton({
  settings,
  onOpen,
  className,
}: {
  settings: CommuteSettings
  onOpen: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'inline-flex h-8 min-w-0 max-w-full items-center gap-1.5 rounded-full border border-line bg-panel px-2.5 text-xs font-bold text-ink hover:border-sea',
        motion.chip,
        className,
      )}
      title={`Commute anchor: ${commuteAnchorLine(settings)}`}
    >
      <MapPin className="h-3.5 w-3.5 shrink-0 text-sea-deep" aria-hidden />
      <span className="truncate">Anchor</span>
    </button>
  )
}

/** Paste a full address into commute anchor fields. */
export function applyPastedCommuteAnchor(
  text: string,
  current: CommuteSettings,
): CommuteSettings {
  if (!text.includes(',')) return current
  const parsed = parseLocationString(text)
  const addr = sanitizeAddress({
    street: parsed.street || current.street,
    city: parsed.city || current.city,
    state: parsed.state || current.state,
    zip: parsed.zip || current.zip,
  })
  return normalizeCommuteSettings({ ...current, ...addr })
}
