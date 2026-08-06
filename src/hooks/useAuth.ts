import { useCallback, useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import {
  fetchProfile,
  updateProfile as updateProfileApi,
} from '../data/collaboration/api'
import type { UserProfile } from '../data/collaboration/types'

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [ready, setReady] = useState(!isSupabaseConfigured)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refreshProfile = useCallback(async (uid: string) => {
    try {
      const p = await fetchProfile(uid)
      setProfile(p)
    } catch {
      setProfile(null)
    }
  }, [])

  useEffect(() => {
    if (!supabase) {
      setReady(true)
      return
    }

    let cancelled = false
    ;(async () => {
      const { data } = await supabase.auth.getSession()
      if (cancelled) return
      setSession(data.session)
      setUser(data.session?.user ?? null)
      if (data.session?.user) {
        await refreshProfile(data.session.user.id)
      }
      setReady(true)
    })()

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      setUser(next?.user ?? null)
      if (next?.user) {
        void refreshProfile(next.user.id)
      } else {
        setProfile(null)
      }
    })

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [refreshProfile])

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Cloud is not configured.')
    setBusy(true)
    setError(null)
    try {
      const { error: err } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (err) throw err
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Sign-in failed.'
      setError(message)
      throw e
    } finally {
      setBusy(false)
    }
  }, [])

  const signUp = useCallback(
    async (email: string, password: string, displayName: string) => {
      if (!supabase) throw new Error('Cloud is not configured.')
      setBusy(true)
      setError(null)
      try {
        const { data, error: err } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { display_name: displayName.trim() },
          },
        })
        if (err) throw err
        if (data.user) {
          // Best-effort profile fields (trigger may already insert the row)
          await supabase
            .from('profiles')
            .upsert({
              id: data.user.id,
              email: email.trim(),
              display_name: displayName.trim() || null,
              searchable: true,
            })
            .select()
          await refreshProfile(data.user.id)
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Sign-up failed.'
        setError(message)
        throw e
      } finally {
        setBusy(false)
      }
    },
    [refreshProfile],
  )

  const signOut = useCallback(async () => {
    if (!supabase) return
    setBusy(true)
    try {
      await supabase.auth.signOut()
      setProfile(null)
    } finally {
      setBusy(false)
    }
  }, [])

  const updateProfile = useCallback(
    async (fields: {
      displayName?: string
      searchable?: boolean
      email?: string
      password?: string
    }) => {
      if (!supabase || !user) throw new Error('Not signed in.')
      setBusy(true)
      setError(null)
      try {
        if (fields.displayName !== undefined || fields.searchable !== undefined) {
          await updateProfileApi({
            displayName: fields.displayName,
            searchable: fields.searchable,
          })
        }
        const authPatch: { email?: string; password?: string; data?: object } =
          {}
        if (fields.email && fields.email !== user.email) {
          authPatch.email = fields.email.trim()
        }
        if (fields.password) {
          authPatch.password = fields.password
        }
        if (fields.displayName !== undefined) {
          authPatch.data = { display_name: fields.displayName }
        }
        if (Object.keys(authPatch).length) {
          const { error: err } = await supabase.auth.updateUser(authPatch)
          if (err) throw err
        }
        if (fields.email) {
          await supabase
            .from('profiles')
            .update({ email: fields.email.trim() })
            .eq('id', user.id)
        }
        await refreshProfile(user.id)
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Could not update profile.'
        setError(message)
        throw e
      } finally {
        setBusy(false)
      }
    },
    [refreshProfile, user],
  )

  return {
    configured: isSupabaseConfigured,
    ready,
    busy,
    error,
    session,
    user,
    profile,
    signedIn: Boolean(user),
    signIn,
    signUp,
    signOut,
    updateProfile,
    refreshProfile,
  }
}

export type AuthController = ReturnType<typeof useAuth>
