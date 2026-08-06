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
