import type { SavedPlace } from '../../domain/types'
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

function normalizePlace(raw: Record<string, unknown>): SavedPlace {
  const addr = resolvePlaceAddress({
    street: raw.street,
    city: raw.city,
    state: raw.state,
    zip: raw.zip,
    location: raw.location,
  })
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
    favorite: Boolean(raw.favorite),
    images: asArray<string>(raw.images),
    tags: asArray<string>(raw.tags),
  }
}

export function placeToPayload(place: SavedPlace, listId?: string | null) {
  const addr = resolvePlaceAddress(place)
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
    favorite: place.favorite,
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
  return asArray<PlaceListSummary>(data)
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
