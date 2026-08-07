import type { PlaceLiker, SavedPlace } from '../../domain/types'
import {
  formatPlaceAddress,
  resolvePlaceAddress,
} from '../../domain/places/address'
import { requireSupabase, supabase } from '../../lib/supabase'
import type {
  CreatedShareLink,
  PublicShareRecord,
  ShareKind,
  SharedPlaceSnapshot,
} from './share'
import {
  normalizeSharedPlace,
  toSharedPlaceSnapshot,
} from './share'
import type {
  ListMember,
  PlaceListSummary,
  ProfileSearchResult,
} from './types'

function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[]
  return []
}

function normalizeLikedBy(raw: unknown): PlaceLiker[] {
  if (!Array.isArray(raw)) return []
  const rows: PlaceLiker[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    const userId = String(r.userId ?? r.user_id ?? '')
    if (!userId) continue
    const likedRaw = r.likedAt ?? r.liked_at
    let likedAt: string | null = null
    if (typeof likedRaw === 'string' && likedRaw) likedAt = likedRaw
    else if (likedRaw instanceof Date) likedAt = likedRaw.toISOString()
    rows.push({
      userId,
      displayName: String(r.displayName ?? r.display_name ?? 'Someone'),
      likedAt,
    })
  }
  // Newest heart first
  return rows.sort(
    (a, b) =>
      (Date.parse(b.likedAt ?? '') || 0) - (Date.parse(a.likedAt ?? '') || 0),
  )
}

function normalizePlace(raw: Record<string, unknown>): SavedPlace {
  const addr = resolvePlaceAddress({
    street: raw.street,
    city: raw.city,
    state: raw.state,
    zip: raw.zip,
    location: raw.location,
  })
  const likedBy = normalizeLikedBy(raw.likedBy)
  const likedByUserIds = Array.isArray(raw.likedByUserIds)
    ? raw.likedByUserIds.map(String)
    : likedBy.map((l) => l.userId)
  const likedByMe =
    typeof raw.likedByMe === 'boolean'
      ? raw.likedByMe
      : Boolean(raw.favorite)
  const likedAtRaw = raw.likedAt ?? raw.liked_at
  const likedAt =
    typeof likedAtRaw === 'string' && likedAtRaw
      ? likedAtRaw
      : likedByMe
        ? likedBy.find((l) => l.likedAt)?.likedAt ?? null
        : null

  return {
    id: String(raw.id ?? crypto.randomUUID()),
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
    updatedAt: String(raw.updatedAt ?? new Date().toISOString()),
    title: String(raw.title ?? ''),
    url: String(raw.url ?? ''),
    listingKind: raw.listingKind === 'buy' ? 'buy' : 'rent',
    homeType:
      raw.homeType === 'apartment' ||
      raw.homeType === 'condo' ||
      raw.homeType === 'single_family' ||
      raw.homeType === 'townhome'
        ? raw.homeType
        : null,
    price: raw.price == null || raw.price === '' ? null : Number(raw.price),
    monthlyEstimate:
      raw.monthlyEstimate == null || raw.monthlyEstimate === ''
        ? null
        : Number(raw.monthlyEstimate),
    street: addr.street,
    city: addr.city,
    state: addr.state,
    zip: addr.zip,
    location: formatPlaceAddress(addr),
    bedrooms:
      raw.bedrooms == null || raw.bedrooms === '' ? null : Number(raw.bedrooms),
    bathrooms:
      raw.bathrooms == null || raw.bathrooms === ''
        ? null
        : Number(raw.bathrooms),
    sqft:
      raw.sqft == null || raw.sqft === '' || Number(raw.sqft) <= 0
        ? null
        : Number(raw.sqft),
    notes: String(raw.notes ?? ''),
    pets:
      raw.pets === 'yes' || raw.pets === 'limited' || raw.pets === 'no'
        ? raw.pets
        : 'no',
    petsNote: String(raw.petsNote ?? ''),
    proTags: asArray<string>(raw.proTags),
    concernTags: asArray<string>(raw.concernTags),
    tier: (['dream', 'strong', 'maybe', 'pass'] as const).includes(
      raw.tier as 'dream',
    )
      ? (raw.tier as SavedPlace['tier'])
      : 'maybe',
    boardOrder:
      typeof raw.boardOrder === 'number' && Number.isFinite(raw.boardOrder)
        ? Math.max(0, Math.floor(raw.boardOrder))
        : typeof raw.board_order === 'number' && Number.isFinite(raw.board_order)
          ? Math.max(0, Math.floor(raw.board_order))
          : 0,
    status:
      raw.status === 'visited' || raw.status === 'offer' ? raw.status : 'none',
    favorite: likedByMe,
    likedByMe,
    likedAt: likedByMe ? likedAt : null,
    likedByUserIds,
    likedBy,
    images: asArray<string>(raw.images),
    tags: asArray<string>(raw.tags),
  }
}

export function placeToPayload(place: SavedPlace, listId?: string | null) {
  const addr = resolvePlaceAddress(place)
  const likedByMe = place.likedByMe ?? place.favorite
  return {
    id: place.id,
    createdAt: place.createdAt,
    updatedAt: place.updatedAt,
    title: place.title,
    url: place.url,
    listingKind: place.listingKind,
    homeType: place.homeType,
    price: place.price,
    monthlyEstimate: place.monthlyEstimate,
    location: formatPlaceAddress(addr) || place.location,
    bedrooms: place.bedrooms,
    bathrooms: place.bathrooms,
    sqft: place.sqft,
    notes: place.notes,
    pets: place.pets,
    petsNote: place.petsNote,
    proTags: place.proTags,
    concernTags: place.concernTags,
    tier: place.tier,
    boardOrder: place.boardOrder ?? 0,
    status: place.status,
    favorite: likedByMe,
    likedByMe,
    images: place.images,
    tags: place.tags,
    listId: listId ?? null,
  }
}

export async function bootstrapUser(): Promise<{ defaultListId: string }> {
  const client = requireSupabase()
  const { data, error } = await client.rpc('nc_bootstrap_user')
  if (error) throw error
  const row = data as { defaultListId?: string }
  if (!row?.defaultListId) throw new Error('Could not bootstrap place list.')
  return { defaultListId: row.defaultListId }
}

export async function getMyLists(): Promise<PlaceListSummary[]> {
  const client = requireSupabase()
  const { data, error } = await client.rpc('nc_get_my_lists')
  if (error) throw error
  return asArray<PlaceListSummary>(data).map((row) => ({
    ...row,
    memberCount:
      typeof row.memberCount === 'number' ? row.memberCount : undefined,
    placeCount: typeof row.placeCount === 'number' ? row.placeCount : undefined,
  }))
}

export async function createList(name: string): Promise<PlaceListSummary> {
  const client = requireSupabase()
  const { data, error } = await client.rpc('nc_create_list', {
    p_name: name.trim() || 'New list',
  })
  if (error) throw error
  return data as PlaceListSummary
}

export async function renameList(
  listId: string,
  name: string,
): Promise<{ id: string; name: string }> {
  const client = requireSupabase()
  const { data, error } = await client.rpc('nc_rename_list', {
    p_list_id: listId,
    p_name: name,
  })
  if (error) throw error
  return data as { id: string; name: string }
}

export async function deleteList(listId: string): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.rpc('nc_delete_list', {
    p_list_id: listId,
  })
  if (error) throw error
}

export async function copyPlaceToList(
  placeId: string,
  targetListId: string,
): Promise<SavedPlace> {
  const client = requireSupabase()
  const { data, error } = await client.rpc('nc_copy_place', {
    p_place_id: placeId,
    p_target_list_id: targetListId,
  })
  if (error) throw error
  return normalizePlace(data as Record<string, unknown>)
}

export async function copyPlacesToList(
  placeIds: string[],
  targetListId: string,
): Promise<{ copied: number; targetListId: string }> {
  const client = requireSupabase()
  const { data, error } = await client.rpc('nc_copy_places', {
    p_place_ids: placeIds,
    p_target_list_id: targetListId,
  })
  if (error) throw error
  const row = data as { copied?: number; targetListId?: string }
  return {
    copied: row.copied ?? 0,
    targetListId: row.targetListId ?? targetListId,
  }
}

export async function getListPlaces(listId: string): Promise<SavedPlace[]> {
  const client = requireSupabase()
  const { data, error } = await client.rpc('nc_get_list_places', {
    p_list_id: listId,
  })
  if (error) throw error
  return asArray<Record<string, unknown>>(data).map(normalizePlace)
}

export async function upsertCloudPlace(
  place: SavedPlace,
  listId: string,
): Promise<SavedPlace> {
  const client = requireSupabase()
  const { data, error } = await client.rpc('nc_upsert_place', {
    p_place: placeToPayload(place, listId),
  })
  if (error) throw error
  return normalizePlace(data as Record<string, unknown>)
}

export async function deleteCloudPlace(placeId: string): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.rpc('nc_delete_place', {
    p_place_id: placeId,
  })
  if (error) throw error
}

export async function getListMembers(listId: string): Promise<ListMember[]> {
  const client = requireSupabase()
  const { data, error } = await client.rpc('nc_get_list_members', {
    p_list_id: listId,
  })
  if (error) throw error
  return asArray<ListMember>(data)
}

export async function inviteToList(
  listId: string,
  userId: string,
): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.rpc('nc_invite_to_list', {
    p_list_id: listId,
    p_user_id: userId,
  })
  if (error) throw error
}

export async function sharePlaces(
  placeIds: string[],
  inviteUserId: string,
  listName = 'Shared places',
): Promise<{ listId: string }> {
  const client = requireSupabase()
  const { data, error } = await client.rpc('nc_share_places', {
    p_place_ids: placeIds,
    p_invite_user_id: inviteUserId,
    p_list_name: listName,
  })
  if (error) throw error
  const row = data as { listId?: string }
  if (!row?.listId) throw new Error('Share failed.')
  return { listId: row.listId }
}

export async function respondInvite(
  membershipId: string,
  accept: boolean,
): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.rpc('nc_respond_invite', {
    p_membership_id: membershipId,
    p_accept: accept,
  })
  if (error) throw error
}

export async function removeMember(membershipId: string): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.rpc('nc_remove_member', {
    p_membership_id: membershipId,
  })
  if (error) throw error
}

export async function setPlaceLike(
  placeId: string,
  liked: boolean,
): Promise<SavedPlace> {
  const client = requireSupabase()
  const { data, error } = await client.rpc('nc_set_place_like', {
    p_place_id: placeId,
    p_liked: liked,
  })
  if (error) throw error
  return normalizePlace(data as Record<string, unknown>)
}

export async function migrateLocalPlaces(
  places: SavedPlace[],
): Promise<{ listId: string; migrated: number }> {
  const client = requireSupabase()
  const payload = places.map((p) => placeToPayload(p))
  const { data, error } = await client.rpc('nc_migrate_local_places', {
    p_places: payload,
  })
  if (error) throw error
  const row = data as { listId?: string; migrated?: number }
  return {
    listId: row.listId ?? '',
    migrated: row.migrated ?? 0,
  }
}

export async function searchProfiles(
  query: string,
): Promise<ProfileSearchResult[]> {
  const client = requireSupabase()
  const { data, error } = await client.rpc('search_profiles_for_share', {
    p_query: query,
    p_limit: 8,
  })
  if (error) throw error
  return asArray<ProfileSearchResult>(data)
}

export async function fetchProfile(userId: string) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('profiles')
    .select('id, email, display_name, searchable')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return {
    id: data.id as string,
    email: (data.email as string | null) ?? null,
    displayName: (data.display_name as string | null) ?? '',
    searchable: data.searchable !== false,
  }
}

export async function updateProfile(fields: {
  displayName?: string
  searchable?: boolean
}) {
  const client = requireSupabase()
  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) throw new Error('Not signed in.')
  const patch: Record<string, unknown> = {}
  if (fields.displayName !== undefined) patch.display_name = fields.displayName
  if (fields.searchable !== undefined) patch.searchable = fields.searchable
  const { error } = await client.from('profiles').update(patch).eq('id', user.id)
  if (error) throw error
}

/** Copy-paste friendly details when guest-link creation fails. */
export type ShareLinkDebug = {
  at: string
  rpc: string
  projectUrl: string | null
  attempt: string
  httpStatus: number | null
  code: string | null
  message: string
  details: string | null
  hint: string | null
  session: {
    signedIn: boolean
    userId: string | null
    email: string | null
  }
  request: {
    kind: ShareKind
    placeCount: number
    title: string | null
    expiresDays: number | null
    placeIds: string[]
    payloadKeys: string[]
  }
  attempts: Array<{
    attempt: string
    code: string | null
    message: string
    details: string | null
    hint: string | null
    httpStatus: number | null
  }>
}

export class ShareLinkError extends Error {
  readonly debug: ShareLinkDebug
  readonly userMessage: string

  constructor(userMessage: string, debug: ShareLinkDebug) {
    super(userMessage)
    this.name = 'ShareLinkError'
    this.userMessage = userMessage
    this.debug = debug
  }

  toCopyText(): string {
    return JSON.stringify(this.debug, null, 2)
  }
}

function rpcErrorParts(error: unknown): {
  code: string | null
  message: string
  details: string | null
  hint: string | null
  httpStatus: number | null
} {
  const e = error as {
    code?: string
    message?: string
    details?: string
    hint?: string
    status?: number
  } | null
  return {
    code: typeof e?.code === 'string' ? e.code : null,
    message: typeof e?.message === 'string' ? e.message : String(error),
    details: typeof e?.details === 'string' ? e.details : null,
    hint: typeof e?.hint === 'string' ? e.hint : null,
    httpStatus: typeof e?.status === 'number' ? e.status : null,
  }
}

function isMissingRpcError(error: unknown): boolean {
  const { code, message, httpStatus } = rpcErrorParts(error)
  return (
    httpStatus === 404 ||
    code === 'PGRST202' ||
    code === 'PGRST204' ||
    /schema cache|could not find the function|not find the function|404/i.test(
      message,
    )
  )
}

/** Create a guest-readable snapshot link (authenticated). */
export async function createPlaceShareLink(input: {
  places: SavedPlace[]
  title?: string
  expiresDays?: number | null
}): Promise<CreatedShareLink> {
  const client = requireSupabase()
  const snapshots = input.places.map(toSharedPlaceSnapshot)
  if (snapshots.length === 0) {
    throw new Error('Pick at least one place to share.')
  }
  const kind: ShareKind = snapshots.length === 1 ? 'place' : 'collection'
  const title = input.title ?? null
  const expiresDays =
    typeof input.expiresDays === 'number' &&
    Number.isFinite(input.expiresDays) &&
    input.expiresDays > 0
      ? Math.floor(input.expiresDays)
      : null

  const payload: Record<string, unknown> = {
    kind,
    title,
    places: snapshots,
  }
  if (expiresDays != null) payload.expiresDays = expiresDays

  const projectUrl =
    typeof import.meta.env.VITE_SUPABASE_URL === 'string'
      ? import.meta.env.VITE_SUPABASE_URL
      : null

  const {
    data: { user },
  } = await client.auth.getUser()

  const attempts: ShareLinkDebug['attempts'] = []

  const baseDebug = (): Omit<ShareLinkDebug, 'attempt' | 'httpStatus' | 'code' | 'message' | 'details' | 'hint'> => ({
    at: new Date().toISOString(),
    rpc: 'nc_create_place_share',
    projectUrl,
    session: {
      signedIn: Boolean(user),
      userId: user?.id ?? null,
      email: user?.email ?? null,
    },
    request: {
      kind,
      placeCount: snapshots.length,
      title,
      expiresDays,
      placeIds: snapshots.map((p) => p.id),
      payloadKeys: Object.keys(payload),
    },
    attempts,
  })

  const throwShareError = (
    userMessage: string,
    attempt: string,
    error: unknown,
  ): never => {
    const parts = rpcErrorParts(error)
    attempts.push({ attempt, ...parts })
    throw new ShareLinkError(userMessage, {
      ...baseDebug(),
      attempt,
      ...parts,
    })
  }

  // 1) Preferred: single jsonb payload (unique overload after migration)
  const payloadCall = await client.rpc('nc_create_place_share', {
    p_payload: payload,
  })
  if (!payloadCall.error) {
    const row = (payloadCall.data ?? {}) as Record<string, unknown>
    const token = String(row.token ?? '')
    if (!token) {
      return throwShareError(
        'Share link was not created (empty token).',
        'payload_empty_token',
        { message: 'RPC returned no token', details: JSON.stringify(row) },
      )
    }
    return {
      id: String(row.id ?? ''),
      token,
      kind: row.kind === 'collection' ? 'collection' : 'place',
      path: String(row.path ?? `/s/${token}`),
    }
  }

  attempts.push({ attempt: 'p_payload', ...rpcErrorParts(payloadCall.error) })

  // 2) Fallback: legacy multi-arg signature (older DBs / stale caches)
  if (isMissingRpcError(payloadCall.error)) {
    const legacyArgs: Record<string, unknown> = {
      p_kind: kind,
      p_title: title,
      p_places: snapshots,
    }
    if (expiresDays != null) legacyArgs.p_expires_days = expiresDays

    const legacyCall = await client.rpc('nc_create_place_share', legacyArgs)
    if (!legacyCall.error) {
      const row = (legacyCall.data ?? {}) as Record<string, unknown>
      const token = String(row.token ?? '')
      if (!token) {
        return throwShareError(
          'Share link was not created (empty token).',
          'legacy_empty_token',
          { message: 'Legacy RPC returned no token', details: JSON.stringify(row) },
        )
      }
      return {
        id: String(row.id ?? ''),
        token,
        kind: row.kind === 'collection' ? 'collection' : 'place',
        path: String(row.path ?? `/s/${token}`),
      }
    }
    attempts.push({ attempt: 'legacy_args', ...rpcErrorParts(legacyCall.error) })

    if (!user) {
      return throwShareError(
        'Sign in to create a guest link.',
        'legacy_args',
        legacyCall.error,
      )
    }
    return throwShareError(
      'Could not reach the share-link API (RPC missing or schema cache stale). Copy the debug details below.',
      'legacy_args',
      legacyCall.error,
    )
  }

  const parts = rpcErrorParts(payloadCall.error)
  if (
    parts.code === '42501' ||
    /permission denied|not authenticated|JWT/i.test(parts.message)
  ) {
    return throwShareError(
      'Sign in to create a guest link.',
      'p_payload',
      payloadCall.error,
    )
  }

  return throwShareError(
    parts.message || 'Could not create a share link.',
    'p_payload',
    payloadCall.error,
  )
}

/**
 * Fetch a public share by token.
 * Uses the anon-capable client (works signed-out).
 */
export async function fetchPublicShare(
  token: string,
): Promise<PublicShareRecord | null> {
  const client = supabase
  if (!client) {
    throw new Error('Cloud sharing is not configured.')
  }
  const { data, error } = await client.rpc('nc_get_public_share', {
    p_token: token,
  })
  if (error) throw error
  if (!data || typeof data !== 'object') return null
  const row = data as Record<string, unknown>
  const payloadRaw = row.payload
  if (!payloadRaw || typeof payloadRaw !== 'object') return null
  const payloadObj = payloadRaw as Record<string, unknown>
  const placesRaw = Array.isArray(payloadObj.places) ? payloadObj.places : []
  const places: SharedPlaceSnapshot[] = []
  for (const item of placesRaw) {
    const snap = normalizeSharedPlace(item)
    if (snap) places.push(snap)
  }
  if (places.length === 0) return null
  return {
    token: String(row.token ?? token),
    kind: row.kind === 'collection' ? 'collection' : 'place',
    title:
      typeof row.title === 'string' && row.title
        ? row.title
        : typeof payloadObj.title === 'string'
          ? payloadObj.title
          : null,
    createdAt: String(row.createdAt ?? ''),
    expiresAt:
      typeof row.expiresAt === 'string' && row.expiresAt ? row.expiresAt : null,
    payload: {
      version: typeof payloadObj.version === 'number' ? payloadObj.version : 1,
      kind: places.length === 1 ? 'place' : 'collection',
      title:
        typeof payloadObj.title === 'string' && payloadObj.title
          ? payloadObj.title
          : null,
      places,
    },
  }
}

export async function revokePlaceShareLink(token: string): Promise<boolean> {
  const client = requireSupabase()
  const { data, error } = await client.rpc('nc_revoke_place_share', {
    p_token: token,
  })
  if (error) throw error
  return Boolean((data as { revoked?: boolean } | null)?.revoked)
}

/** Batch update tier + boardOrder for drag-reorder on the board. */
export async function reorderBoardPlaces(
  items: { id: string; tier: SavedPlace['tier']; boardOrder: number }[],
): Promise<number> {
  const client = requireSupabase()
  const { data, error } = await client.rpc('nc_reorder_board_places', {
    p_items: items,
  })
  if (error) throw error
  return Number((data as { updated?: number } | null)?.updated ?? 0)
}
