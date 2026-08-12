import { requireSupabase } from '../../lib/supabase'
import {
  looksLikeListingUrl,
  normalizeListingUrl,
  type ListingImportDraft,
} from '../../domain/places/listingImport'
import {
  detectListingSource,
  extractListingFromHtml,
  isBlockedListingHtml,
} from '../../domain/places/listingPageExtract'

export type EnrichListingResult =
  | {
      ok: true
      draft: ListingImportDraft
      blocked: false
    }
  | {
      ok: false
      blocked: boolean
      error: string
    }

const ALLOWED =
  /(^|\.)(realtor\.com|zillow\.com|trulia\.com|redfin\.com)$/i

function assertAllowedListingUrl(url: string): void {
  let host = ''
  try {
    host = new URL(url).hostname
  } catch {
    throw new Error('Invalid listing URL')
  }
  if (!ALLOWED.test(host)) {
    throw new Error('Only Realtor, Zillow, or Redfin links can be fetched')
  }
}

/**
 * Fetch listing HTML via edge function, then extract fields locally.
 * Falls back is handled by the caller (slug parse).
 */
export async function enrichListingFromUrl(
  rawUrl: string,
): Promise<EnrichListingResult> {
  const url = normalizeListingUrl(rawUrl)
  if (!url || !looksLikeListingUrl(url)) {
    return { ok: false, blocked: false, error: 'Not a supported listing URL' }
  }

  try {
    assertAllowedListingUrl(url)
  } catch (e) {
    return {
      ok: false,
      blocked: false,
      error: e instanceof Error ? e.message : 'URL not allowed',
    }
  }

  const source = detectListingSource(url)
  if (source !== 'realtor' && source !== 'zillow') {
    return {
      ok: false,
      blocked: false,
      error: 'Live fetch is available for Realtor and Zillow links',
    }
  }

  try {
    const sb = requireSupabase()
    const { data, error } = await sb.functions.invoke('import-listing', {
      body: { url },
    })

    if (error) {
      return {
        ok: false,
        blocked: false,
        error: error.message || 'Could not reach listing import',
      }
    }

    const payload = data as {
      ok?: boolean
      html?: string
      blocked?: boolean
      error?: string
      url?: string
    }

    if (!payload?.ok || typeof payload.html !== 'string') {
      return {
        ok: false,
        blocked: Boolean(payload?.blocked),
        error: payload?.error || 'Listing page returned nothing useful',
      }
    }

    if (payload.blocked || isBlockedListingHtml(payload.html)) {
      return {
        ok: false,
        blocked: true,
        error:
          'That site blocked the live fetch (bot check). Address from the URL still works — add rent and photos by hand.',
      }
    }

    const draft = extractListingFromHtml(payload.html, payload.url || url)
    if (!draft) {
      return {
        ok: false,
        blocked: false,
        error: 'Could not read details from the listing page',
      }
    }

    return { ok: true, draft, blocked: false }
  } catch (e) {
    return {
      ok: false,
      blocked: false,
      error:
        e instanceof Error
          ? e.message
          : 'Live listing fetch failed',
    }
  }
}
