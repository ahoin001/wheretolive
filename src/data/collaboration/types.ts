export type ListMemberRole = 'owner' | 'editor' | 'viewer'
export type ListMemberStatus = 'pending' | 'accepted' | 'declined'

export interface PlaceListSummary {
  id: string
  name: string
  createdBy: string
  isDefault: boolean
  createdAt: string
  updatedAt: string
  role: ListMemberRole
  status: ListMemberStatus
  membershipId: string
  /** Accepted members (1 = private to you alone) */
  memberCount?: number
  placeCount?: number
}

/** True when someone else is already on the board, or you joined someone else's. */
export function listIsShared(list: PlaceListSummary): boolean {
  if (typeof list.memberCount === 'number') return list.memberCount > 1
  return list.role !== 'owner'
}

export interface ListMember {
  id: string
  listId: string
  userId: string
  role: ListMemberRole
  status: ListMemberStatus
  invitedBy: string | null
  displayName: string | null
  email: string | null
  createdAt: string
}

export interface ProfileSearchResult {
  id: string
  display_name: string | null
  email: string | null
}

export interface UserProfile {
  id: string
  email: string | null
  displayName: string
  searchable: boolean
}
