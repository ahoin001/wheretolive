import { requireSupabase } from '../../lib/supabase'
import type { CommuteSettings } from '../../domain/types'
import { commuteAnchorLine } from '../../domain/places/commute'

export type CommuteRouteResult = {
  minutes: number | null
  distanceMiles?: number | null
  error?: string
}

type BatchResponse = {
  ok?: boolean
  results?: Record<string, CommuteRouteResult>
  error?: string
}

const BATCH_SIZE = 8

/**
 * Fetch drive times from the commute anchor to one or more addresses.
 * Results are keyed by the exact address string passed in.
 */
export async function fetchCommuteTimes(
  addresses: string[],
  anchor: CommuteSettings,
): Promise<Record<string, CommuteRouteResult>> {
  const unique = [...new Set(addresses.map((a) => a.trim()).filter(Boolean))]
  if (!unique.length) return {}

  const sb = requireSupabase()
  const merged: Record<string, CommuteRouteResult> = {}
  const anchorLine = commuteAnchorLine(anchor)

  for (let i = 0; i < unique.length; i += BATCH_SIZE) {
    const chunk = unique.slice(i, i + BATCH_SIZE)
    const { data, error } = await sb.functions.invoke('commute-time', {
      body: {
        addresses: chunk,
        anchor: {
          street: anchor.street,
          city: anchor.city,
          state: anchor.state,
          zip: anchor.zip,
        },
        anchorLine,
      },
    })

    if (error) {
      for (const addr of chunk) {
        merged[addr] = {
          minutes: null,
          error: error.message || 'Commute lookup failed',
        }
      }
      continue
    }

    const payload = data as BatchResponse
    if (!payload?.ok || !payload.results) {
      const msg = payload?.error || 'Commute lookup failed'
      for (const addr of chunk) {
        merged[addr] = { minutes: null, error: msg }
      }
      continue
    }

    for (const addr of chunk) {
      merged[addr] = payload.results[addr] ?? {
        minutes: null,
        error: 'No route returned',
      }
    }
  }

  return merged
}
