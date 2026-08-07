import { useCallback, useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import type { SavedPlace } from '../domain/types'
import { localAppRepo } from '../data/repositories'
import {
  bootstrapUser,
  copyPlaceToList,
  copyPlacesToList,
  createList,
  deleteCloudPlace,
  deleteList,
  getListMembers,
  getListPlaces,
  getMyLists,
  inviteToList,
  migrateLocalPlaces,
  removeMember,
  renameList,
  reorderBoardPlaces,
  respondInvite,
  setPlaceLike,
  sharePlaces,
  upsertCloudPlace,
} from '../data/collaboration/api'
import type { ListMember, PlaceListSummary } from '../data/collaboration/types'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

/** One-time decision flag: guest import offered+answered for this user on this browser */
const GUEST_IMPORT_FLAG = 'next-chapter.guest-import-decided.v1'

function collabErrorMessage(e: unknown): string {
  if (e instanceof Error && e.message) return e.message
  if (e && typeof e === 'object') {
    const r = e as { message?: unknown; details?: unknown; hint?: unknown }
    const parts = [r.message, r.details, r.hint]
      .map((x) => (typeof x === 'string' ? x.trim() : ''))
      .filter(Boolean)
    if (parts.length) return parts.join(' — ')
  }
  return 'Cloud sync failed.'
}

export function useCollaboration({
  user,
  localPlaces,
  replaceLocalPlaces,
}: {
  user: User | null
  localPlaces: SavedPlace[]
  /** Mirror of active list into the signed-in user's identity-scoped local cache */
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
  const [guestImport, setGuestImport] = useState<{
    placeCount: number
  } | null>(null)

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

  const isSharedList = useMemo(() => {
    if (!activeList) return false
    if (typeof activeList.memberCount === 'number') {
      return activeList.memberCount > 1
    }
    return members.filter((m) => m.status === 'accepted').length > 1
  }, [activeList, members])

  /** Lists the user can copy into (accepted + editor/owner). */
  const editableLists = useMemo(
    () =>
      acceptedLists.filter(
        (l) => l.role === 'owner' || l.role === 'editor',
      ),
    [acceptedLists],
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

  const maybeOfferGuestImport = useCallback(async (userId: string) => {
    const flagKey = `${GUEST_IMPORT_FLAG}:${userId}`
    if (localStorage.getItem(flagKey)) {
      setGuestImport(null)
      return
    }
    try {
      const guestPlaces = await localAppRepo.peekGuestPlaces()
      if (guestPlaces.length > 0) {
        setGuestImport({ placeCount: guestPlaces.length })
      } else {
        setGuestImport(null)
        localStorage.setItem(flagKey, new Date().toISOString())
      }
    } catch {
      setGuestImport(null)
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
        // Mirror only into this user's scoped cache (never into guest)
        replaceLocalPlaces(cloudPlaces)
      } else {
        setPlaces([])
        replaceLocalPlaces([])
      }
      setCloudActive(true)
    } catch (e) {
      setError(collabErrorMessage(e))
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

  // Login → bootstrap + load this account only (no silent cross-account migrate)
  useEffect(() => {
    if (!user || !isSupabaseConfigured) {
      setCloudActive(false)
      setLists([])
      setPlaces([])
      setMembers([])
      setActiveListId(null)
      setGuestImport(null)
      setReady(true)
      // Do NOT touch local places — guest workspace is separate and restored by useApp
      return
    }

    let cancelled = false
    ;(async () => {
      setReady(false)
      try {
        await bootstrapUser()
        if (cancelled) return
        // Clear active list so we pick this user's default (not previous session)
        setActiveListId(null)
        const nextLists = await getMyLists()
        if (cancelled) return
        setLists(nextLists)
        const accepted = nextLists.filter((l) => l.status === 'accepted')
        const defaultList =
          accepted.find((l) => l.isDefault) ?? accepted[0] ?? null
        const listId = defaultList?.id ?? null
        setActiveListId(listId)
        if (listId) {
          const cloudPlaces = await getListPlaces(listId)
          if (cancelled) return
          setPlaces(cloudPlaces)
          replaceLocalPlaces(cloudPlaces)
          await loadMembers(listId)
        } else {
          setPlaces([])
          replaceLocalPlaces([])
        }
        setCloudActive(true)
        if (!cancelled) await maybeOfferGuestImport(user.id)
      } catch (e) {
        if (!cancelled) {
          setError(collabErrorMessage(e))
          setCloudActive(false)
        }
      } finally {
        if (!cancelled) setReady(true)
      }
    })()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  // Realtime places + membership + reactions
  useEffect(() => {
    if (!user || !supabase || !activeListId || !cloudActive) return
    const client = supabase

    const reload = () => {
      void loadPlaces(activeListId).then((next) => replaceLocalPlaces(next))
    }

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
        reload,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'app_next_chapter_v1',
          table: 'place_reactions',
        },
        reload,
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

  const removePlaces = useCallback(
    async (ids: string[]) => {
      if (!cloudActive || ids.length === 0) return { removed: 0, failed: 0 }
      const unique = [...new Set(ids)]
      const results = await Promise.allSettled(
        unique.map((id) => deleteCloudPlace(id)),
      )
      const removedIds = unique.filter(
        (_, i) => results[i]?.status === 'fulfilled',
      )
      if (removedIds.length) {
        const drop = new Set(removedIds)
        setPlaces((prev) => {
          const next = prev.filter((p) => !drop.has(p.id))
          replaceLocalPlaces(next)
          return next
        })
      }
      return {
        removed: removedIds.length,
        failed: unique.length - removedIds.length,
      }
    },
    [cloudActive, replaceLocalPlaces],
  )

  const setLiked = useCallback(
    async (placeId: string, liked: boolean) => {
      if (!cloudActive) {
        // Guest / local: toggle favorite on the place in local state via caller
        return
      }
      const saved = await setPlaceLike(placeId, liked)
      setPlaces((prev) => {
        const next = prev.map((p) => (p.id === saved.id ? saved : p))
        replaceLocalPlaces(next)
        return next
      })
      return saved
    },
    [cloudActive, replaceLocalPlaces],
  )

  const reorderBoard = useCallback(
    async (
      items: { id: string; tier: SavedPlace['tier']; boardOrder: number }[],
    ) => {
      if (!items.length) return
      const now = new Date().toISOString()
      const applyLocal = (prev: SavedPlace[]) => {
        const map = new Map(items.map((i) => [i.id, i]))
        return prev.map((p) => {
          const u = map.get(p.id)
          return u
            ? {
                ...p,
                tier: u.tier,
                boardOrder: u.boardOrder,
                updatedAt: now,
              }
            : p
        })
      }

      if (!cloudActive) {
        replaceLocalPlaces(applyLocal(localPlaces))
        return
      }

      // Optimistic UI, then confirm with cloud
      setPlaces((prev) => {
        const next = applyLocal(prev)
        replaceLocalPlaces(next)
        return next
      })
      await reorderBoardPlaces(items)
    },
    [cloudActive, localPlaces, replaceLocalPlaces],
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

  const createPlaceList = useCallback(
    async (name: string) => {
      const created = await createList(name)
      const next = await refreshLists()
      const id = created.id
      setActiveListId(id)
      const cloudPlaces = await loadPlaces(id)
      await loadMembers(id)
      replaceLocalPlaces(cloudPlaces)
      return next.find((l) => l.id === id) ?? created
    },
    [refreshLists, loadPlaces, loadMembers, replaceLocalPlaces],
  )

  const renamePlaceList = useCallback(
    async (listId: string, name: string) => {
      await renameList(listId, name)
      await refreshLists()
    },
    [refreshLists],
  )

  const deletePlaceList = useCallback(
    async (listId: string) => {
      await deleteList(listId)
      const next = await refreshLists()
      const accepted = next.filter((l) => l.status === 'accepted')
      if (activeListId === listId) {
        const fallback =
          accepted.find((l) => l.isDefault) ?? accepted[0] ?? null
        if (fallback) {
          await selectList(fallback.id)
        } else {
          setActiveListId(null)
          setPlaces([])
          replaceLocalPlaces([])
        }
      }
    },
    [activeListId, refreshLists, selectList, replaceLocalPlaces],
  )

  const copyPlace = useCallback(
    async (placeId: string, targetListId: string) => {
      const saved = await copyPlaceToList(placeId, targetListId)
      await refreshLists()
      if (targetListId === activeListId) {
        setPlaces((prev) => {
          const next = [saved, ...prev.filter((p) => p.id !== saved.id)]
          replaceLocalPlaces(next)
          return next
        })
      }
      return saved
    },
    [activeListId, refreshLists, replaceLocalPlaces],
  )

  const copyPlaces = useCallback(
    async (placeIds: string[], targetListId: string) => {
      const result = await copyPlacesToList(placeIds, targetListId)
      await refreshLists()
      if (targetListId === activeListId && result.copied > 0) {
        const next = await loadPlaces(targetListId)
        replaceLocalPlaces(next)
      }
      return result
    },
    [activeListId, refreshLists, loadPlaces, replaceLocalPlaces],
  )

  const acceptGuestImport = useCallback(async () => {
    if (!user) return
    setBusy(true)
    setError(null)
    try {
      const guestPlaces = await localAppRepo.peekGuestPlaces()
      if (guestPlaces.length) {
        await migrateLocalPlaces(guestPlaces)
      }
      localStorage.setItem(
        `${GUEST_IMPORT_FLAG}:${user.id}`,
        new Date().toISOString(),
      )
      setGuestImport(null)

      const nextLists = await getMyLists()
      setLists(nextLists)
      const accepted = nextLists.filter((l) => l.status === 'accepted')
      const defaultList =
        accepted.find((l) => l.isDefault) ?? accepted[0] ?? null
      const listId = defaultList?.id ?? null
      setActiveListId(listId)
      if (listId) {
        const cloudPlaces = await getListPlaces(listId)
        setPlaces(cloudPlaces)
        replaceLocalPlaces(cloudPlaces)
        await loadMembers(listId)
      }
      setCloudActive(true)
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Could not import guest places.',
      )
    } finally {
      setBusy(false)
    }
  }, [user, replaceLocalPlaces, loadMembers])

  const declineGuestImport = useCallback(() => {
    if (!user) return
    localStorage.setItem(
      `${GUEST_IMPORT_FLAG}:${user.id}`,
      new Date().toISOString(),
    )
    setGuestImport(null)
  }, [user])

  return {
    ready,
    busy,
    error,
    cloudActive: cloudActive && Boolean(user),
    lists: acceptedLists,
    editableLists,
    pendingInvites,
    activeListId,
    activeList,
    places: cloudActive ? places : localPlaces,
    members,
    isSharedList,
    guestImport,
    acceptGuestImport,
    declineGuestImport,
    selectList,
    createPlaceList,
    renamePlaceList,
    deletePlaceList,
    copyPlace,
    copyPlaces,
    upsertPlace,
    removePlace,
    removePlaces,
    setLiked,
    reorderBoard,
    inviteUser,
    acceptInvite,
    declineInvite,
    kickOrLeave,
    refreshAll,
    loadMembers,
  }
}

export type CollaborationController = ReturnType<typeof useCollaboration>
