import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, CopyMinus } from 'lucide-react'
import type { SavedPlace } from '../../domain/types'
import {
  buildPlaceDiffRows,
  formatEditedAt,
  suggestedKeepId,
  type DuplicateGroup,
} from '../../domain/places/duplicates'
import { motion } from '../../lib/motion'
import { cn } from '../../lib/utils'
import { Button } from '../ui/Button'
import { SideDrawer } from '../ui/SideDrawer'
import { OpenableImage } from './ImageLightbox'

type DuplicatePlacesWizardProps = {
  open: boolean
  onClose: () => void
  groups: DuplicateGroup[]
  busy?: boolean
  onResolveGroup: (keepId: string, removeIds: string[]) => Promise<void> | void
  onOpenImages?: (images: string[], index: number, title?: string) => void
}

/**
 * One address group at a time: pick the correct place, see last edited +
 * highlighted field differences, then remove the rest.
 */
export function DuplicatePlacesWizard({
  open,
  onClose,
  groups,
  busy = false,
  onResolveGroup,
  onOpenImages,
}: DuplicatePlacesWizardProps) {
  const [index, setIndex] = useState(0)
  const [keepId, setKeepId] = useState<string | null>(null)
  const [diffsOnly, setDiffsOnly] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const group = groups[index] ?? null
  const total = groups.length

  useEffect(() => {
    if (!open) return
    setIndex(0)
    setDiffsOnly(true)
    setError(null)
  }, [open])

  useEffect(() => {
    if (!group) {
      setKeepId(null)
      return
    }
    setKeepId(suggestedKeepId(group.places))
    setError(null)
  }, [group])

  // Clamp index when groups shrink after a resolve
  useEffect(() => {
    if (index >= total && total > 0) setIndex(total - 1)
  }, [index, total])

  const rows = useMemo(
    () => (group ? buildPlaceDiffRows(group.places) : []),
    [group],
  )
  const visibleRows = diffsOnly ? rows.filter((r) => r.differs) : rows
  const diffCount = rows.filter((r) => r.differs).length

  const resolve = async () => {
    if (!group || !keepId || busy) return
    const removeIds = group.places
      .map((p) => p.id)
      .filter((id) => id !== keepId)
    if (!removeIds.length) return
    setError(null)
    try {
      await onResolveGroup(keepId, removeIds)
      if (total <= 1) onClose()
      else if (index >= total - 1) setIndex(Math.max(0, total - 2))
      // else stay on same index — next group slides into place
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove duplicates.')
    }
  }

  return (
    <SideDrawer
      open={open}
      onClose={onClose}
      aria-labelledby="dup-wizard-title"
      panelClassName="max-w-4xl sm:max-w-3xl lg:max-w-4xl"
      zIndexClassName="z-[95]"
    >
      <header className="sticky top-0 z-10 flex shrink-0 items-start justify-between gap-3 border-b border-line bg-panel/95 px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur md:px-6 md:pt-4">
        <div className="min-w-0">
          <p className="text-sm font-bold text-sea-deep">
            {total > 0 ? `Address ${Math.min(index + 1, total)} of ${total}` : 'Duplicates'}
          </p>
          <h2
            id="dup-wizard-title"
            className="font-display text-2xl font-semibold tracking-[-0.02em] text-ink"
          >
            Review duplicates
          </h2>
          {group ? (
            <p className="mt-1 line-clamp-2 text-sm text-ink-soft">{group.label}</p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="ghost"
          className="min-h-11 min-w-11 shrink-0"
          onClick={onClose}
          aria-label="Close"
        >
          Close
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 md:px-6">
        {!group ? (
          <div className="rounded-2xl border border-dashed border-line bg-folio/60 px-5 py-10 text-center">
            <p className="font-display text-xl font-semibold text-ink">
              No duplicate addresses left
            </p>
            <p className="mt-2 text-ink-soft">You’re all set.</p>
          </div>
        ) : (
          <div className="space-y-5">
            <p className="text-sm text-ink-soft">
              Pick the place that looks right. We’ll keep that one and remove the
              others at this address. Fields that differ are highlighted.
            </p>

            <div
              className={cn(
                'grid gap-3',
                group.places.length === 2
                  ? 'sm:grid-cols-2'
                  : 'sm:grid-cols-2 lg:grid-cols-3',
              )}
            >
              {group.places.map((place, i) => (
                <PlacePickCard
                  key={place.id}
                  place={place}
                  index={i}
                  selected={keepId === place.id}
                  suggested={suggestedKeepId(group.places) === place.id}
                  onSelect={() => setKeepId(place.id)}
                  onOpenImages={onOpenImages}
                />
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-bold text-ink">
                {diffCount === 0
                  ? 'Form details match'
                  : `${diffCount} difference${diffCount === 1 ? '' : 's'}`}
              </p>
              <button
                type="button"
                role="switch"
                aria-checked={diffsOnly}
                onClick={() => setDiffsOnly((v) => !v)}
                className={cn(
                  'inline-flex h-9 items-center rounded-full border px-3 text-xs font-bold',
                  motion.chip,
                  diffsOnly
                    ? 'border-sea bg-sea/10 text-sea-deep'
                    : 'border-line bg-panel text-ink-soft',
                )}
              >
                {diffsOnly ? 'Differences only' : 'Show all fields'}
              </button>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-line">
              <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-line bg-folio/80">
                    <th className="sticky left-0 z-[1] bg-folio/95 px-3 py-2.5 font-bold text-ink-soft">
                      Field
                    </th>
                    {group.places.map((place, i) => (
                      <th
                        key={place.id}
                        className={cn(
                          'px-3 py-2.5 font-bold',
                          keepId === place.id ? 'text-sea-deep' : 'text-ink',
                        )}
                      >
                        Place {String.fromCharCode(65 + i)}
                        {keepId === place.id ? ' · keep' : ''}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={group.places.length + 1}
                        className="px-3 py-6 text-center text-ink-soft"
                      >
                        No differences in the form fields.
                      </td>
                    </tr>
                  ) : (
                    visibleRows.map((row) => (
                      <tr
                        key={row.field}
                        className={cn(
                          'border-b border-line/80 last:border-0',
                          row.differs && 'bg-honey-soft/50',
                        )}
                      >
                        <th className="sticky left-0 z-[1] bg-panel px-3 py-2.5 align-top font-bold text-ink-soft">
                          <span
                            className={cn(
                              row.differs && 'bg-honey-soft/50',
                              'block',
                            )}
                          >
                            {row.label}
                          </span>
                        </th>
                        {row.cells.map((cell) => (
                          <td
                            key={cell.placeId}
                            className={cn(
                              'max-w-[14rem] px-3 py-2.5 align-top text-ink',
                              keepId === cell.placeId && 'font-semibold',
                            )}
                          >
                            <span className="line-clamp-4 break-words">
                              {cell.display}
                            </span>
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {error ? (
              <p className="text-sm font-bold text-warn" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        )}
      </div>

      <footer className="sticky bottom-0 z-10 flex shrink-0 flex-wrap items-center gap-2 border-t border-line bg-panel/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur md:px-6">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 min-w-11 px-2"
            disabled={index <= 0 || busy || total === 0}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            aria-label="Previous address"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 min-w-11 px-2"
            disabled={index >= total - 1 || busy || total === 0}
            onClick={() => setIndex((i) => Math.min(total - 1, i + 1))}
            aria-label="Next address"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            className="min-h-11"
            onClick={onClose}
            disabled={busy}
          >
            Later
          </Button>
          {group && keepId ? (
            <Button
              type="button"
              variant="honey"
              className="min-h-11"
              disabled={busy}
              onClick={() => void resolve()}
            >
              <CopyMinus className="h-4 w-4" />
              Keep selected · remove {group.places.length - 1}
            </Button>
          ) : null}
        </div>
      </footer>
    </SideDrawer>
  )
}

function PlacePickCard({
  place,
  index,
  selected,
  suggested,
  onSelect,
  onOpenImages,
}: {
  place: SavedPlace
  index: number
  selected: boolean
  suggested: boolean
  onSelect: () => void
  onOpenImages?: (images: string[], index: number, title?: string) => void
}) {
  const letter = String.fromCharCode(65 + index)
  const img = place.images?.[0]

  return (
    <article
      className={cn(
        'overflow-hidden rounded-2xl border text-left shadow-[var(--shadow-soft)]',
        motion.color,
        selected
          ? 'border-sea ring-2 ring-sea/25'
          : 'border-line hover:border-sea/60',
      )}
    >
      <div className="relative aspect-[16/9] bg-folio">
        {img && onOpenImages ? (
          <OpenableImage
            images={place.images}
            index={0}
            title={place.title || 'Untitled'}
            onOpen={onOpenImages}
            className="absolute inset-0 h-full w-full"
            imgClassName="h-full w-full object-cover"
          />
        ) : img ? (
          <img
            src={img}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <button
            type="button"
            onClick={onSelect}
            className="flex h-full w-full items-center justify-center text-xs font-bold text-ink-soft"
            aria-pressed={selected}
            aria-label={`Select place ${letter}`}
          >
            No photo
          </button>
        )}
        <span className="pointer-events-none absolute left-2 top-2 inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-ink/75 px-2 text-xs font-bold text-white">
          {letter}
        </span>
        {selected ? (
          <span className="pointer-events-none absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-sea text-white shadow-sm">
            <Check className="h-4 w-4" strokeWidth={3} />
          </span>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className="w-full space-y-1 px-3 py-2.5 text-left"
      >
        <p className="line-clamp-2 font-bold leading-snug text-ink">
          {place.title || 'Untitled place'}
        </p>
        <p className="text-xs text-ink-soft">
          Last edited{' '}
          <span className="font-bold text-ink">
            {formatEditedAt(place.updatedAt)}
          </span>
        </p>
        {suggested ? (
          <p className="text-[11px] font-bold text-sea-deep">
            Suggested · most recently edited
          </p>
        ) : null}
      </button>
    </article>
  )
}

export function DuplicateAddressesCallout({
  groupCount,
  placeCount,
  onReview,
}: {
  groupCount: number
  placeCount: number
  onReview: () => void
}) {
  if (groupCount <= 0) return null
  return (
    <div className="flex flex-col gap-3 rounded-[1.5rem] border border-honey/40 bg-honey-soft/80 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div className="min-w-0">
        <p className="font-display text-lg font-semibold tracking-[-0.02em] text-ink">
          Duplicate addresses found
        </p>
        <p className="mt-0.5 text-sm text-ink-soft">
          {placeCount} places share{' '}
          {groupCount === 1 ? 'the same address' : `${groupCount} addresses`}.
          Review side by side, keep the right one, and remove the rest.
        </p>
      </div>
      <Button
        type="button"
        variant="honey"
        className="h-11 min-h-11 shrink-0 rounded-xl px-4 text-sm"
        onClick={onReview}
      >
        <CopyMinus className="h-4 w-4" />
        Review duplicates
      </Button>
    </div>
  )
}
