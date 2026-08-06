import { useEffect, useState } from 'react'
import { Check, Search, Share2, UserMinus, X } from 'lucide-react'
import type { CollaborationController } from '../../hooks/useCollaboration'
import { searchProfiles } from '../../data/collaboration/api'
import type { ProfileSearchResult } from '../../data/collaboration/types'
import { Button } from '../ui/Button'
import { Field, TextInput } from '../ui/Field'

export function ShareSheet({
  collab,
  selectedPlaceIds,
  signedIn,
  onClose,
  onNeedAuth,
}: {
  collab: CollaborationController
  selectedPlaceIds: string[]
  signedIn: boolean
  onClose: () => void
  onNeedAuth: () => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ProfileSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!signedIn) return
    const q = query.trim()
    if (q.length < 2) {
      setResults([])
      return
    }
    const handle = window.setTimeout(() => {
      setSearching(true)
      void searchProfiles(q)
        .then(setResults)
        .catch((e) =>
          setError(e instanceof Error ? e.message : 'Search failed.'),
        )
        .finally(() => setSearching(false))
    }, 280)
    return () => window.clearTimeout(handle)
  }, [query, signedIn])

  useEffect(() => {
    if (signedIn && collab.activeListId) {
      void collab.loadMembers(collab.activeListId)
    }
    // loadMembers is stable enough; only re-fetch when list changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn, collab.activeListId])

  const shareCount =
    selectedPlaceIds.length > 0 ? selectedPlaceIds.length : collab.places.length

  const invite = async (userId: string) => {
    setError(null)
    setMessage(null)
    setBusyId(userId)
    try {
      await collab.inviteUser(userId, selectedPlaceIds)
      setMessage('Invite sent. They can accept from their Places board.')
      setQuery('')
      setResults([])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not invite.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-sheet-title"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[1.75rem] border border-line bg-panel p-5 shadow-[var(--shadow-lift)] md:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="share-sheet-title"
              className="font-display text-2xl font-semibold text-ink"
            >
              Share places
            </h2>
            <p className="mt-1 text-sm text-ink-soft">
              {selectedPlaceIds.length > 0
                ? `Invite someone to collaborate on ${shareCount} selected place${shareCount === 1 ? '' : 's'}.`
                : `Invite someone to the full list (${shareCount} place${shareCount === 1 ? '' : 's'}). Both of you can edit freely.`}
            </p>
          </div>
          <Button type="button" variant="ghost" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {!signedIn ? (
          <div className="mt-5 rounded-2xl border border-line bg-folio/70 p-4">
            <p className="text-sm text-ink-soft">
              Sign in to invite partners by email or display name.
            </p>
            <Button className="mt-3" type="button" onClick={onNeedAuth}>
              Sign in to share
            </Button>
          </div>
        ) : (
          <>
            {collab.activeList ? (
              <p className="mt-3 text-sm text-ink-soft">
                List:{' '}
                <span className="font-bold text-ink">{collab.activeList.name}</span>
                {collab.activeList.role === 'owner' ? ' · you are owner' : ' · editor'}
              </p>
            ) : null}

            <div className="mt-5">
              <Field
                label="Find someone"
                hint="Exact email, or the start of their display name"
              >
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
                  <TextInput
                    className="pl-10"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="name or email@example.com"
                    autoFocus
                  />
                </div>
              </Field>
              {searching ? (
                <p className="mt-2 text-sm text-ink-soft">Searching…</p>
              ) : null}
              {results.length > 0 ? (
                <ul className="mt-3 space-y-2">
                  {results.map((person) => (
                    <li
                      key={person.id}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-folio/50 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-bold text-ink">
                          {person.display_name || 'Unnamed'}
                        </p>
                        <p className="truncate text-sm text-ink-soft">
                          {person.email || 'No email listed'}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="honey"
                        disabled={busyId === person.id}
                        onClick={() => void invite(person.id)}
                      >
                        <Share2 className="h-4 w-4" />
                        {busyId === person.id ? '…' : 'Invite'}
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : query.trim().length >= 2 && !searching ? (
                <p className="mt-2 text-sm text-ink-soft">
                  No matches. They need an account and discoverability on in their profile.
                </p>
              ) : null}
            </div>

            <section className="mt-6">
              <h3 className="text-sm font-bold text-ink">People on this list</h3>
              <ul className="mt-2 space-y-2">
                {collab.members.length === 0 ? (
                  <li className="text-sm text-ink-soft">Only you so far.</li>
                ) : (
                  collab.members.map((m) => (
                    <li
                      key={m.id}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-line px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-bold text-ink">
                          {m.displayName || m.email || 'Member'}
                        </p>
                        <p className="text-sm text-ink-soft">
                          {m.role}
                          {m.status === 'pending' ? ' · pending invite' : ''}
                        </p>
                      </div>
                      {m.role !== 'owner' && collab.activeList?.role === 'owner' ? (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => void collab.kickOrLeave(m.id)}
                          title="Remove"
                        >
                          <UserMinus className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </li>
                  ))
                )}
              </ul>
            </section>
          </>
        )}

        {error ? (
          <p className="mt-4 rounded-xl bg-honey-soft px-3 py-2 text-sm text-ink">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="mt-4 rounded-xl bg-folio px-3 py-2 text-sm text-ink">{message}</p>
        ) : null}
      </div>
    </div>
  )
}

export function PendingInvitesBanner({
  collab,
}: {
  collab: CollaborationController
}) {
  if (!collab.pendingInvites.length) return null

  return (
    <div className="space-y-2 rounded-[1.5rem] border border-honey/40 bg-honey-soft/80 p-4">
      <p className="text-sm font-bold text-ink">Shared list invitations</p>
      {collab.pendingInvites.map((invite) => (
        <div
          key={invite.membershipId}
          className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line bg-panel px-3 py-2.5"
        >
          <div>
            <p className="font-bold text-ink">{invite.name}</p>
            <p className="text-sm text-ink-soft">You were invited as editor</p>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => void collab.declineInvite(invite.membershipId)}
            >
              <X className="h-4 w-4" />
              Decline
            </Button>
            <Button
              type="button"
              onClick={() => void collab.acceptInvite(invite.membershipId)}
            >
              <Check className="h-4 w-4" />
              Accept
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}
