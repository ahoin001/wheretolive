import { useState } from 'react'
import { Check, Link2, Loader2, Sparkles } from 'lucide-react'
import { enrichListingFromUrl } from '../../data/collaboration/listingImportApi'
import {
  applyListingImport,
  listingImportSourceLabel,
  looksLikeListingUrl,
  mergeListingDrafts,
  parseListingUrl,
  type ListingImportableFields,
} from '../../domain/places/listingImport'
import { isSupabaseConfigured } from '../../lib/supabase'
import { motion } from '../../lib/motion'
import { cn } from '../../lib/utils'
import { Button } from '../ui/Button'
import { TextInput } from '../ui/Field'

/**
 * Paste a Realtor / Zillow / Redfin link to seed the place form.
 * Tries live page fetch (rent, beds, photos) when Supabase is configured;
 * always falls back to URL slug parsing for address.
 */
export function ListingUrlAssist({
  form,
  onApply,
  className,
}: {
  form: ListingImportableFields
  onApply: (next: ListingImportableFields, message: string) => void
  className?: string
}) {
  const [draftUrl, setDraftUrl] = useState(form.url || '')
  const [status, setStatus] = useState<
    'idle' | 'busy' | 'ok' | 'partial' | 'fail'
  >('idle')
  const [message, setMessage] = useState<string | null>(null)

  const runImport = async (raw: string) => {
    const trimmed = raw.trim()
    if (!trimmed) {
      setStatus('idle')
      setMessage(null)
      return
    }

    const slug = parseListingUrl(trimmed)
    if (!slug) {
      setStatus('fail')
      setMessage('That doesn’t look like a listing link. Paste a full URL.')
      return
    }

    setDraftUrl(slug.url)
    setStatus('busy')
    setMessage('Reading listing…')

    let draft = slug
    let pageNote: string | null = null

    const canFetch =
      isSupabaseConfigured &&
      (slug.source === 'realtor' || slug.source === 'zillow')

    if (canFetch) {
      const enriched = await enrichListingFromUrl(slug.url)
      if (enriched.ok) {
        draft = mergeListingDrafts(slug, enriched.draft)
      } else if (enriched.blocked) {
        pageNote = enriched.error
      } else {
        pageNote =
          enriched.error ||
          'Live details unavailable — used the address from the link.'
      }
    }

    const { next, applied } = applyListingImport(form, draft)

    if (applied.length === 0 && draft.url === form.url) {
      setStatus('partial')
      setMessage(
        pageNote ||
          'Link already applied — fields below are filled. Tweak anything that looks off.',
      )
      return
    }

    const source = listingImportSourceLabel(draft.source)
    const detail =
      applied.length > 0
        ? `Filled ${applied.join(', ')} from ${source}.`
        : `Saved ${source} link.`
    const followUp = draft.fromPage
      ? ' Review below and tweak anything that looks off.'
      : pageNote
        ? ` ${pageNote}`
        : ' Review below — add anything the link didn’t include.'

    setStatus(applied.length > 0 ? 'ok' : 'partial')
    setMessage(detail + followUp)
    onApply(next, detail)
  }

  return (
    <section
      className={cn(
        'rounded-2xl border border-sea/25 bg-sea/[0.06] p-4',
        className,
      )}
    >
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sea/15 text-sea-deep">
          <Sparkles className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-ink">Paste listing link</p>
          <p className="mt-0.5 text-xs text-ink-soft">
            Realtor or Zillow — we pull rent, beds, pets, and photos when the
            page allows, plus the address from the URL.
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Link2
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft"
            aria-hidden
          />
          <TextInput
            value={draftUrl}
            onChange={(e) => {
              setDraftUrl(e.target.value)
              if (status !== 'idle') {
                setStatus('idle')
                setMessage(null)
              }
            }}
            onPaste={(e) => {
              const text = e.clipboardData.getData('text')
              if (
                !looksLikeListingUrl(text) &&
                !/^https?:\/\//i.test(text.trim())
              ) {
                return
              }
              window.setTimeout(() => {
                void runImport(text)
              }, 0)
            }}
            onBlur={() => {
              if (
                draftUrl.trim() &&
                draftUrl.trim() !== form.url.trim() &&
                looksLikeListingUrl(draftUrl) &&
                status !== 'busy'
              ) {
                void runImport(draftUrl)
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void runImport(draftUrl)
              }
            }}
            placeholder="https://www.realtor.com/rentals/details/…"
            className="pl-10"
            inputMode="url"
            autoComplete="url"
            disabled={status === 'busy'}
          />
        </div>
        <Button
          type="button"
          variant="secondary"
          className="h-12 shrink-0 rounded-xl px-4 sm:h-[3rem]"
          onClick={() => void runImport(draftUrl)}
          disabled={!draftUrl.trim() || status === 'busy'}
        >
          {status === 'busy' ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Reading…
            </>
          ) : (
            'Fill from link'
          )}
        </Button>
      </div>

      {message ? (
        <p
          className={cn(
            'mt-2.5 flex items-start gap-2 text-xs font-bold leading-snug',
            motion.color,
            status === 'ok' && 'text-sea-deep',
            (status === 'partial' || status === 'busy') && 'text-ink-soft',
            status === 'fail' && 'text-warn',
          )}
          role="status"
        >
          {status === 'ok' ? (
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          ) : null}
          <span>{message}</span>
        </p>
      ) : null}
    </section>
  )
}
