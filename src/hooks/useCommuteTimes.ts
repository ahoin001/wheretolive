import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchCommuteTimes } from '../data/places/commuteApi'
import {
  COMMUTE_LOADING,
  COMMUTE_UNKNOWN,
  commuteAnchorLine,
  commuteEstimateFromMinutes,
  normalizeCommuteSettings,
  type CommuteEstimate,
} from '../domain/places/commute'
import type { CommuteSettings } from '../domain/types'
import { isSupabaseConfigured } from '../lib/supabase'

export type CommuteQuery = {
  id: string
  query: string
}

const SESSION_KEY = 'wtl-commute-cache-v2'
const DEBOUNCE_MS = 700

type CacheEntry = {
  minutes: number | null
  distanceMiles?: number | null
  error?: string
  at: number
}

let memoryCache = new Map<string, CacheEntry>()

function loadSessionCache(): void {
  if (typeof sessionStorage === 'undefined') return
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as Record<string, CacheEntry>
    memoryCache = new Map(Object.entries(parsed))
  } catch {
    memoryCache = new Map()
  }
}

function saveSessionCache(): void {
  if (typeof sessionStorage === 'undefined') return
  try {
    const obj = Object.fromEntries(memoryCache.entries())
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(obj))
  } catch {
    /* quota or private mode */
  }
}

loadSessionCache()

function cacheKey(anchorLine: string, query: string): string {
  return `${anchorLine}\u0000${query}`
}

function cacheGet(anchorLine: string, query: string): CacheEntry | null {
  return memoryCache.get(cacheKey(anchorLine, query)) ?? null
}

function cacheSet(anchorLine: string, query: string, entry: CacheEntry): void {
  memoryCache.set(cacheKey(anchorLine, query), entry)
  saveSessionCache()
}

/**
 * Resolve drive-time estimates for many place ids (and optional draft form).
 * Caches by anchor + normalized address string for the session.
 */
export function useCommuteTimes(
  queries: CommuteQuery[],
  commuteSettings: CommuteSettings,
): {
  byId: Record<string, CommuteEstimate>
  loading: boolean
} {
  const settings = useMemo(
    () => normalizeCommuteSettings(commuteSettings),
    [commuteSettings],
  )
  const anchorLine = useMemo(() => commuteAnchorLine(settings), [settings])

  const queryKey = useMemo(
    () =>
      queries
        .map((q) => `${q.id}\u0000${q.query}`)
        .sort()
        .join('\u0001'),
    [queries],
  )

  const [byId, setById] = useState<Record<string, CommuteEstimate>>({})
  const [loading, setLoading] = useState(false)
  const requestId = useRef(0)

  useEffect(() => {
    const parsed = queryKey
      ? queryKey.split('\u0001').map((row) => {
          const [id, query] = row.split('\u0000')
          return { id: id!, query: query! }
        })
      : []

    if (!parsed.length) {
      setById({})
      setLoading(false)
      return
    }

    if (!isSupabaseConfigured) {
      const unknown: Record<string, CommuteEstimate> = {}
      for (const { id } of parsed) {
        unknown[id] = {
          ...COMMUTE_UNKNOWN,
          error: 'Cloud not configured for commute lookup',
        }
      }
      setById(unknown)
      setLoading(false)
      return
    }

    const timer = window.setTimeout(() => {
      const req = ++requestId.current
      const next: Record<string, CommuteEstimate> = {}
      const missing: CommuteQuery[] = []

      for (const { id, query } of parsed) {
        const hit = cacheGet(anchorLine, query)
        if (hit) {
          next[id] = commuteEstimateFromMinutes(hit.minutes, settings, {
            error: hit.error,
          })
        } else {
          next[id] = COMMUTE_LOADING
          missing.push({ id, query })
        }
      }

      setById(next)

      if (!missing.length) {
        setLoading(false)
        return
      }

      setLoading(true)
      const addresses = [...new Set(missing.map((m) => m.query))]

      void fetchCommuteTimes(addresses, settings)
        .then((results) => {
          if (requestId.current !== req) return
          const merged: Record<string, CommuteEstimate> = { ...next }
          for (const { id, query } of parsed) {
            const cached = cacheGet(anchorLine, query)
            if (cached) {
              merged[id] = commuteEstimateFromMinutes(cached.minutes, settings, {
                error: cached.error,
              })
              continue
            }
            const row = results[query]
            if (row) {
              cacheSet(anchorLine, query, {
                minutes: row.minutes,
                distanceMiles: row.distanceMiles,
                error: row.error,
                at: Date.now(),
              })
              merged[id] = commuteEstimateFromMinutes(row.minutes, settings, {
                error: row.error,
              })
            } else if (!merged[id] || merged[id].loading) {
              merged[id] = {
                ...COMMUTE_UNKNOWN,
                error: 'Commute lookup failed',
              }
            }
          }
          setById(merged)
        })
        .catch((e) => {
          if (requestId.current !== req) return
          const merged: Record<string, CommuteEstimate> = { ...next }
          for (const { id } of missing) {
            merged[id] = {
              ...COMMUTE_UNKNOWN,
              error:
                e instanceof Error ? e.message : 'Commute lookup failed',
            }
          }
          setById(merged)
        })
        .finally(() => {
          if (requestId.current === req) setLoading(false)
        })
    }, DEBOUNCE_MS)

    return () => window.clearTimeout(timer)
  }, [queryKey, anchorLine, settings])

  return { byId, loading }
}
