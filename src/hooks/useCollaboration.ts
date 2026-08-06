import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import type { SavedPlace } from '../domain/types'
import {
  bootstrapUser,
  deleteCloudPlace,
  getListMembers,
  getListPlaces,
  getMyLists,
  inviteToList,
  migrateLocalPlaces,
  removeMember,
  respondInvite,
  sharePlaces,
  upsertCloudPlace,
} from '../data/collaboration/api'
import type { ListMember, PlaceListSummary } from '../data/collaboration/types'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

const MIGRATE_FLAG = 'next-chapter.migrated-places.v1'

export function useCollaboration({
  user,
  localPlaces,
  replaceLocalPlaces,
}: {
  user: User | null
  localPlaces: SavedPlace[]
  /** When cloud is active we still mirror places into local cache for offline backup */
  replaceLocalPlaces: (places: SavedPlace[]) => void
}) {
  const [lists, setLists] = useState<PlaceListSummary[]>([])
  const [activeListId, setActiveListId] = useState<string | null>(null)
  const [places, setPlaces] = useState<SavedPlace[]>([])
  const [members, setMembers] = useState<ListMember[]>([])
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cloudActive, setCloudActive] = useState(false)
  const migrateOnce = useRef(false)

  const acceptedLists = useMemo(
    () => lists.filter((l) => l.status === 'accepted'),
    [lists],
  )
  const pendingInvites = useMemo(
    () => lists.filter((l) => l.status === 'pending'),
    [lists],
  )

  const activeList = useMemo(
    () => acceptedLists.find((l) => l.id === activeListId) ?? null,
    [acceptedLists, activeListId],
  )

  const refreshLists = useCallback(async () => {
    const next = await getMyLists()
    setLists(next)
    return next
  }, [])

  const loadPlaces = useCallback(async (listId: string) => {
    const next = await getListPlaces(listId)
    setPlaces(next)
    return next
  }, [])

  const loadMembers = useCallback(async (listId: string) => {
    try {
      const next = await getListMembers(listId)
      setMembers(next)
      return next
    } catch {
      setMembers([])
      return []
    }
  }, [])

  const refreshAll = useCallback(async () => {
    if (!user || !isSupabaseConfigured) return
    setBusy(true)
    setError(null)
    try {
      await bootstrapUser()
      const nextLists = await refreshLists()
      const accepted = nextLists.filter((l) => l.status === 'accepted')
      let listId = activeListId
      if (!listId || !accepted.some((l) => l.id === listId)) {
        const defaultList =
          accepted.find((l) => l.isDefault) ?? accepted[0] ?? null
        listId = defaultList?.id ?? null
        setActiveListId(listId)
      }
      if (listId) {
        const cloudPlaces = await loadPlaces(listId)
        await loadMembers(listId)
        replaceLocalPlaces(cloudPlaces)
      }
      setCloudActive(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load shared lists.')
      setCloudActive(false)
    } finally {
      setBusy(false)
      setReady(true)
    }
  }, [
    user,
    activeListId,
    refreshLists,
    loadPlaces,
    loadMembers,
    replaceLocalPlaces,
  ])

  // Login → bootstrap, migrate local once, load
  useEffect(() => {
    if (!user || !isSupabaseConfigured) {
      setCloudActive(false)
      setLists([])
      setPlaces([])
      setMembers([])
      setActiveListId(null)
      setReady(true)
      migrateOnce.current = false
      return
    }

    let cancelled = false
    ;(async () => {
      setReady(false)
      try {
        await bootstrapUser()
        const flagKey = `${MIGRATE_FLAG}:${user.id}`
        if (!migrateOnce.current && !localStorage.getItem(flagKey) && localPlaces.length) {
          await migrateLocalPlaces(localPlaces)
          localStorage.setItem(flagKey, new Date().toISOString())
        }
        migrateOnce.current = true
        if (cancelled) return
        await refreshAll()
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Cloud sync failed.')
          setReady(true)
        }
      }
    })()

    return () => {
      cancelled = true
    }
    // only re-run on user change; localPlaces snapshot at login is intentional
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  // Realtime places + membership changes
  useEffect(() => {
    if (!user || !supabase || !activeListId || !cloudActive) return
    const client = supabase

    const channel = client
      .channel(`nc-list-${activeListId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'app_next_chapter_v1',
          table: 'places',
          filter: `list_id=eq.${activeListId}`,
        },
        () => {
          void loadPlaces(activeListId).then((next) => replaceLocalPlaces(next))
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'app_next_chapter_v1',
          table: 'place_list_members',
          filter: `list_id=eq.${activeListId}`,
        },
        () => {
          void loadMembers(activeListId)
          void refreshLists()
        },
      )
      .subscribe()

    return () => {
      void client.removeChannel(channel)
    }
  }, [
    user,
    activeListId,
    cloudActive,
    loadPlaces,
    loadMembers,
    refreshLists,
    replaceLocalPlaces,
  ])

  // Listen for pending invites on any list for this user
  useEffect(() => {
    if (!user || !supabase || !cloudActive) return
    const client = supabase
    const channel = client
      .channel(`nc-invites-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'app_next_chapter_v1',
          table: 'place_list_members',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void refreshLists()
        },
      )
      .subscribe()
    return () => {
      void client.removeChannel(channel)
    }
  }, [user, cloudActive, refreshLists])

  const selectList = useCallback(
    async (listId: string) => {
      setActiveListId(listId)
      setBusy(true)
      try {
        const next = await loadPlaces(listId)
        await loadMembers(listId)
        replaceLocalPlaces(next)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not open list.')
      } finally {
        setBusy(false)
      }
    },
    [loadPlaces, loadMembers, replaceLocalPlaces],
  )

  const upsertPlace = useCallback(
    async (place: SavedPlace) => {
      if (!cloudActive || !activeListId) {
        return place
      }
      const saved = await upsertCloudPlace(place, activeListId)
      setPlaces((prev) => {
        const exists = prev.some((p) => p.id === saved.id)
        const next = exists
          ? prev.map((p) => (p.id === saved.id ? saved : p))
          : [saved, ...prev]
        replaceLocalPlaces(next)
        return next
      })
      return saved
    },
    [cloudActive, activeListId, replaceLocalPlaces],
  )

  const removePlace = useCallback(
    async (id: string) => {
      if (!cloudActive) return
      await deleteCloudPlace(id)
      setPlaces((prev) => {
        const next = prev.filter((p) => p.id !== id)
        replaceLocalPlaces(next)
        return next
      })
    },
    [cloudActive, replaceLocalPlaces],
  )

  const inviteUser = useCallback(
    async (userId: string, placeIds: string[]) => {
      if (!activeListId) throw new Error('No active list.')
      const sharingWholeBoard =
        placeIds.length === 0 || placeIds.length >= places.length

      if (sharingWholeBoard) {
        await inviteToList(activeListId, userId)
        await loadMembers(activeListId)
        await refreshLists()
        return { listId: activeListId }
      }

      const result = await sharePlaces(placeIds, userId)
      await refreshLists()
      if (result.listId !== activeListId) {
        await selectList(result.listId)
      } else {
        await loadMembers(activeListId)
      }
      return result
    },
    [
      activeListId,
      places.length,
      refreshLists,
      selectList,
      loadMembers,
    ],
  )

  const acceptInvite = useCallback(
    async (membershipId: string) => {
      await respondInvite(membershipId, true)
      await refreshAll()
    },
    [refreshAll],
  )

  const declineInvite = useCallback(
    async (membershipId: string) => {
      await respondInvite(membershipId, false)
      await refreshLists()
    },
    [refreshLists],
  )

  const kickOrLeave = useCallback(
    async (membershipId: string) => {
      await removeMember(membershipId)
      await refreshLists()
      if (activeListId) await loadMembers(activeListId)
    },
    [refreshLists, loadMembers, activeListId],
  )

  return {
    ready,
    busy,
    error,
    cloudActive: cloudActive && Boolean(user),
    lists: acceptedLists,
    pendingInvites,
    activeListId,
    activeList,
    places: cloudActive ? places : localPlaces,
    members,
    selectList,
    upsertPlace,
    removePlace,
    inviteUser,
    acceptInvite,
    declineInvite,
    kickOrLeave,
    refreshAll,
    loadMembers,
  }
}

export type CollaborationController = ReturnType<typeof useCollaboration>
