import { useEffect, useMemo, useState } from 'react'
import { Check, Copy, Link2, Share2 } from 'lucide-react'
import {
  createPlaceShareLink,
  ShareLinkError,
  type ShareLinkDebug,
} from '../../data/collaboration/api'
import { absoluteShareUrl } from '../../data/collaboration/share'
import type { SavedPlace } from '../../domain/types'
import {
  availablePlacesIn,
  isPlaceTaken,
  takenPlacesIn,
} from '../../domain/places/status'
import { isSupabaseConfigured } from '../../lib/supabase'
import { motion } from '../../lib/motion'
import { cn } from '../../lib/utils'
import { BottomSheet } from '../ui/BottomSheet'
import { Button } from '../ui/Button'

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const el = document.createElement('textarea')
      el.value = text
      el.setAttribute('readonly', '')
      el.style.position = 'fixed'
      el.style.left = '-9999px'
      document.body.appendChild(el)
      el.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(el)
      return ok
    } catch {
      return false
    }
  }
}

export function PlaceShareSheet({
  open,
  places,
  onClose,
}: {
  open: boolean
  places: SavedPlace[]
  onClose: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [debug, setDebug] = useState<ShareLinkDebug | null>(null)
  const [debugCopied, setDebugCopied] = useState(false)
  const [url, setUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  /** When taken places are in the selection, exclude them from the guest link by default. */
  const [includeTaken, setIncludeTaken] = useState(false)

  const taken = useMemo(() => takenPlacesIn(places), [places])
  const available = useMemo(() => availablePlacesIn(places), [places])
  const hasTaken = taken.length > 0
  const sharePlaces = useMemo(() => {
    if (!hasTaken || includeTaken) return places
    return available
  }, [available, hasTaken, includeTaken, places])

  const isCollection = sharePlaces.length > 1
  const title =
    sharePlaces.length === 1
      ? sharePlaces[0]?.title || 'Untitled place'
      : `${sharePlaces.length} places`
  const placeKey = `${sharePlaces.map((p) => p.id).join(',')}|${includeTaken ? '1' : '0'}`

  useEffect(() => {
    if (!open) {
      setBusy(false)
      setError(null)
      setDebug(null)
      setDebugCopied(false)
      setUrl(null)
      setCopied(false)
      setIncludeTaken(false)
    }
  }, [open])

  useEffect(() => {
    if (!open || places.length === 0) return
    if (sharePlaces.length === 0) {
      setBusy(false)
      setUrl(null)
      setError(
        'Every selected place is marked Taken. Include taken places, or clear Taken first.',
      )
      return
    }

    let cancelled = false
    const snapshot = [...sharePlaces]
    const collection = snapshot.length > 1
    async function create() {
      if (!isSupabaseConfigured) {
        setError('Cloud sharing needs Supabase configured.')
        setDebug(null)
        return
      }
      setBusy(true)
      setError(null)
      setDebug(null)
      setDebugCopied(false)
      setUrl(null)
      try {
        const created = await createPlaceShareLink({
          places: snapshot,
          title: collection
            ? `${snapshot.length} places from Room for the Next Chapter`
            : snapshot[0]?.title || 'Shared place',
        })
        if (cancelled) return
        const full = absoluteShareUrl(created.token)
        setUrl(full)
        const ok = await copyText(full)
        if (!cancelled && ok) setCopied(true)
      } catch (e) {
        if (cancelled) return
        if (e instanceof ShareLinkError) {
          setError(e.userMessage)
          setDebug(e.debug)
          console.error('[place-share]', e.userMessage, e.debug)
        } else {
          setError(
            e instanceof Error
              ? e.message
              : 'Could not create a share link. Try again.',
          )
          setDebug(null)
          console.error('[place-share]', e)
        }
      } finally {
        if (!cancelled) setBusy(false)
      }
    }
    void create()
    return () => {
      cancelled = true
    }
    // placeKey captures share payload; places read via snapshot above
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, placeKey])

  useEffect(() => {
    if (!copied) return
    const t = window.setTimeout(() => setCopied(false), 2200)
    return () => window.clearTimeout(t)
  }, [copied])

  useEffect(() => {
    if (!debugCopied) return
    const t = window.setTimeout(() => setDebugCopied(false), 2200)
    return () => window.clearTimeout(t)
  }, [debugCopied])

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={isCollection ? 'Share these places' : 'Share this place'}
      titleId="place-share-title"
    >
      <div className="space-y-4 px-1 pb-2">
        <p className="text-sm text-ink-soft">
          Guests get a private link to view photos and details — no sign-in
          needed. Personal notes and likes stay off the share.
        </p>

        {hasTaken ? (
          <div className="rounded-2xl border border-warn/35 bg-honey-soft/70 px-4 py-3">
            <p className="text-sm font-bold text-ink">
              {taken.length === 1
                ? '1 place is marked Taken'
                : `${taken.length} places are marked Taken`}
            </p>
            <p className="mt-1 text-sm text-ink-soft">
              {includeTaken
                ? 'Taken places will be on this guest link.'
                : available.length > 0
                  ? `Guest link will leave them out (${available.length} available).`
                  : 'Nothing left to share unless you include taken places.'}
            </p>
            <button
              type="button"
              role="switch"
              aria-checked={includeTaken}
              onClick={() => setIncludeTaken((v) => !v)}
              className={cn(
                'mt-3 inline-flex h-9 items-center gap-2 rounded-full border px-3 text-xs font-bold',
                motion.chip,
                includeTaken
                  ? 'border-warn bg-warn text-white'
                  : 'border-line bg-panel text-ink',
              )}
            >
              Include taken
            </button>
          </div>
        ) : null}

        <div className="rounded-2xl border border-line bg-folio/70 px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">
            Sharing
          </p>
          <p className="mt-1 font-display text-lg font-semibold text-ink">
            {sharePlaces.length === 0 ? 'No places to share' : title}
          </p>
          {sharePlaces.length > 1 ? (
            <ol className="mt-2 list-decimal space-y-1 pl-4 text-sm text-ink-soft">
              {sharePlaces.slice(0, 8).map((p) => (
                <li key={p.id} className="truncate pl-1">
                  {p.title || 'Untitled'}
                  {isPlaceTaken(p) ? ' · Taken' : ''}
                </li>
              ))}
              {sharePlaces.length > 8 ? (
                <li className="list-none pl-1 text-ink-soft">
                  +{sharePlaces.length - 8} more
                </li>
              ) : null}
            </ol>
          ) : sharePlaces.length === 1 && isPlaceTaken(sharePlaces[0]!) ? (
            <p className="mt-1 text-sm font-bold text-warn">Marked Taken</p>
          ) : null}
        </div>

        {busy ? (
          <p className="text-sm font-bold text-ink-soft">Creating link…</p>
        ) : null}

        {error ? (
          <div className="space-y-2 rounded-xl border border-warn/30 bg-honey-soft/60 px-3 py-2.5">
            <p className="text-sm font-bold text-ink">{error}</p>
            {debug ? (
              <>
                <p className="text-xs text-ink-soft">
                  {debug.code ? `${debug.code} · ` : ''}
                  {debug.httpStatus != null ? `HTTP ${debug.httpStatus} · ` : ''}
                  {debug.attempt}
                  {debug.projectUrl ? ` · ${debug.projectUrl}` : ''}
                </p>
                <pre className="max-h-40 overflow-auto rounded-lg border border-line/70 bg-panel/80 p-2 text-[11px] leading-snug text-ink">
                  {JSON.stringify(debug, null, 2)}
                </pre>
                <Button
                  type="button"
                  variant="secondary"
                  className="h-10 min-h-10 w-full rounded-xl text-sm"
                  onClick={async () => {
                    const ok = await copyText(JSON.stringify(debug, null, 2))
                    if (ok) setDebugCopied(true)
                  }}
                >
                  {debugCopied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  {debugCopied ? 'Debug copied' : 'Copy debug details'}
                </Button>
              </>
            ) : null}
          </div>
        ) : null}

        {url ? (
          <div className="space-y-3">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-ink-soft">
                Guest link
              </span>
              <input
                readOnly
                value={url}
                className="mt-1.5 h-12 w-full rounded-xl border border-line bg-panel px-3 text-sm text-ink"
                onFocus={(e) => e.currentTarget.select()}
              />
            </label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="honey"
                className="min-h-11 flex-1 rounded-xl"
                onClick={async () => {
                  const ok = await copyText(url)
                  if (ok) setCopied(true)
                }}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copied' : 'Copy link'}
              </Button>
              {typeof navigator !== 'undefined' &&
              typeof navigator.share === 'function' ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-11 rounded-xl px-4"
                  onClick={() => {
                    void navigator.share({
                      title: title,
                      url,
                    })
                  }}
                  aria-label="Share link"
                >
                  <Share2 className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          </div>
        ) : !busy && !error ? (
          <p className="flex items-center gap-2 text-sm text-ink-soft">
            <Link2 className="h-4 w-4" />
            Preparing guest link…
          </p>
        ) : null}
      </div>
    </BottomSheet>
  )
}
