import { useEffect, useState } from 'react'
import { Check, Copy, Link2, Share2 } from 'lucide-react'
import {
  createPlaceShareLink,
  ShareLinkError,
  type ShareLinkDebug,
} from '../../data/collaboration/api'
import { absoluteShareUrl } from '../../data/collaboration/share'
import type { SavedPlace } from '../../domain/types'
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

  const isCollection = places.length > 1
  const title =
    places.length === 1
      ? places[0]?.title || 'Untitled place'
      : `${places.length} places`

  const placeKey = places.map((p) => p.id).join(',')

  useEffect(() => {
    if (!open) {
      setBusy(false)
      setError(null)
      setDebug(null)
      setDebugCopied(false)
      setUrl(null)
      setCopied(false)
    }
  }, [open])

  useEffect(() => {
    if (!open || places.length === 0) return
    let cancelled = false
    const snapshot = [...places]
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
    // placeKey captures identity; places read via snapshot above
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

        <div className="rounded-2xl border border-line bg-folio/70 px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">
            Sharing
          </p>
          <p className="mt-1 font-display text-lg font-semibold text-ink">
            {title}
          </p>
          {isCollection ? (
            <ol className="mt-2 list-decimal space-y-1 pl-4 text-sm text-ink-soft">
              {places.slice(0, 8).map((p) => (
                <li key={p.id} className="truncate pl-1">
                  {p.title || 'Untitled'}
                </li>
              ))}
              {places.length > 8 ? (
                <li className="list-none pl-1 text-ink-soft">
                  +{places.length - 8} more
                </li>
              ) : null}
            </ol>
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
                Link
              </span>
              <input
                readOnly
                value={url}
                className="mt-1.5 h-12 w-full rounded-xl border border-line bg-panel px-3 text-sm text-ink"
                onFocus={(e) => e.currentTarget.select()}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="honey"
                className="min-h-11 flex-1"
                onClick={async () => {
                  const ok = await copyText(url)
                  if (ok) setCopied(true)
                }}
              >
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {copied ? 'Copied' : 'Copy link'}
              </Button>
              {typeof navigator !== 'undefined' &&
              typeof navigator.share === 'function' ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-11"
                  onClick={() => {
                    void navigator.share({
                      title: title,
                      text: 'Take a look at this place',
                      url,
                    })
                  }}
                >
                  <Share2 className="h-4 w-4" />
                  Share…
                </Button>
              ) : null}
            </div>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className={cn(
                'inline-flex items-center gap-1.5 text-sm font-bold text-sea-deep',
                motion.color,
              )}
            >
              <Link2 className="h-3.5 w-3.5" />
              Preview guest view
            </a>
          </div>
        ) : null}

        <Button
          type="button"
          variant="ghost"
          className="w-full min-h-11"
          onClick={onClose}
        >
          Done
        </Button>
      </div>
    </BottomSheet>
  )
}
