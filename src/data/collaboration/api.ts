import type { PlaceLiker, SavedPlace } from '../../domain/types'
import {
  formatPlaceAddress,
  resolvePlaceAddress,
} from '../../domain/places/address'
import { requireSupabase } from '../../lib/supabase'
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
    price: place.price,
    monthlyEstimate: place.monthlyEstimate,
    location: formatPlaceAddress(addr) || place.location,
    bedrooms: place.bedrooms,
    bathrooms: place.bathrooms,
    notes: place.notes,
    pets: place.pets,
    petsNote: place.petsNote,
    proTags: place.proTags,
    concernTags: place.concernTags,
    tier: place.tier,
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
