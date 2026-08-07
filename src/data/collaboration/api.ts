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
  const payload: Record<string, unknown> = {
    kind,
    title: input.title ?? null,
    places: snapshots,
  }
  if (
    typeof input.expiresDays === 'number' &&
    Number.isFinite(input.expiresDays) &&
    input.expiresDays > 0
  ) {
    payload.expiresDays = Math.floor(input.expiresDays)
  }

  // Prefer single jsonb payload; legacy multi-arg kept server-side for stale clients.
  const { data, error } = await client.rpc('nc_create_place_share', {
    p_payload: payload,
  })
  if (error) {
    const code = (error as { code?: string }).code
    if (code === 'PGRST202' || /schema cache|not find the function/i.test(error.message)) {
      throw new Error(
        'Share link service is updating. Wait a few seconds and try again.',
      )
    }
    if (code === '42501' || /permission denied|not authenticated|JWT/i.test(error.message)) {
      throw new Error('Sign in to create a guest link.')
    }
    throw error
  }
  const row = (data ?? {}) as Record<string, unknown>
  const token = String(row.token ?? '')
  if (!token) throw new Error('Share link was not created.')
  return {
    id: String(row.id ?? ''),
    token,
    kind: row.kind === 'collection' ? 'collection' : 'place',
    path: String(row.path ?? `/s/${token}`),
  }
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
