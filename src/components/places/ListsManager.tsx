import { useState, type FormEvent } from 'react'
import {
  FolderPlus,
  Pencil,
  Trash2,
  Users,
  Lock,
  Check,
  X,
} from 'lucide-react'
import type { CollaborationController } from '../../hooks/useCollaboration'
import { listIsShared } from '../../data/collaboration/types'
import { Button } from '../ui/Button'
import { Field, TextInput } from '../ui/Field'
import { cn } from '../../lib/utils'
import { motion } from '../../lib/motion'

export function ListsManager({
  collab,
  open,
  onClose,
}: {
  collab: CollaborationController
  open: boolean
  onClose: () => void
}) {
  const [newName, setNewName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open || !collab.cloudActive) return null

  const create = async (e?: FormEvent) => {
    e?.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await collab.createPlaceList(newName.trim() || 'New list')
      setNewName('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create list.')
    } finally {
      setBusy(false)
    }
  }

  const saveRename = async (listId: string) => {
    if (!renameValue.trim()) return
    setBusy(true)
    setError(null)
    try {
      await collab.renamePlaceList(listId, renameValue.trim())
      setRenamingId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not rename.')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (listId: string, name: string) => {
    if (
      !confirm(
        `Delete “${name}” and all places on it? This cannot be undone.`,
      )
    ) {
      return
    }
    setBusy(true)
    setError(null)
    try {
      await collab.deletePlaceList(listId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete list.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-[1.5rem] border border-line bg-panel p-4 shadow-[var(--shadow-soft)] md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-xl font-semibold text-ink">Your lists</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Private boards for yourself, shared boards with partners or clients. Each
            list has its own places and people.
          </p>
        </div>
        <Button type="button" variant="ghost" onClick={onClose} aria-label="Close lists">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ul className="mt-4 space-y-2">
        {collab.lists.map((list) => {
          const shared = listIsShared(list)
          const active = list.id === collab.activeListId
          const isOwner = list.role === 'owner'
          return (
            <li
              key={list.id}
              className={cn(
                'flex flex-wrap items-center gap-2 rounded-2xl border px-3 py-2.5',
                active
                  ? 'border-sea bg-sea/10'
                  : 'border-line bg-folio/40 hover:border-sea/50',
              )}
            >
              {renamingId === list.id ? (
                <form
                  className="flex min-w-0 flex-1 flex-wrap items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    void saveRename(list.id)
                  }}
                >
                  <TextInput
                    className="min-w-0 flex-1"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    autoFocus
                  />
                  <Button
                    type="submit"
                    variant="primary"
                    className="h-10 min-h-10 px-3 text-sm"
                    disabled={busy || !renameValue.trim()}
                  >
                    <Check className="h-4 w-4" />
                    Save
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-10 min-h-10 px-3 text-sm"
                    onClick={() => setRenamingId(null)}
                  >
                    Cancel
                  </Button>
                </form>
              ) : (
                <>
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => void collab.selectList(list.id)}
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-ink">{list.name}</span>
                      {list.isDefault ? (
                        <span className="rounded-full bg-folio px-2 py-0.5 text-[11px] font-bold text-ink-soft">
                          Default
                        </span>
                      ) : null}
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold',
                          shared
                            ? 'bg-honey-soft text-honey'
                            : 'bg-folio text-ink-soft',
                        )}
                      >
                        {shared ? (
                          <Users className="h-3 w-3" />
                        ) : (
                          <Lock className="h-3 w-3" />
                        )}
                        {shared ? 'Shared' : 'Private'}
                      </span>
                      {list.role !== 'owner' ? (
                        <span className="text-[11px] font-bold text-ink-soft">
                          {list.role}
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block text-sm text-ink-soft">
                      {list.placeCount ?? '—'} places
                      {shared
                        ? ` · ${list.memberCount ?? '—'} people`
                        : ''}
                      {active ? ' · open' : ''}
                    </span>
                  </button>
                  <div className="flex shrink-0 flex-wrap gap-1">
                    {isOwner ? (
                      <Button
                        type="button"
                        variant="secondary"
                        className="h-9 min-h-9 px-2.5 text-sm"
                        onClick={() => {
                          setRenamingId(list.id)
                          setRenameValue(list.name)
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Rename
                      </Button>
                    ) : null}
                    {isOwner && !list.isDefault ? (
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-9 min-h-9 px-2"
                        title="Delete list"
                        disabled={busy}
                        onClick={() => void remove(list.id, list.name)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    ) : null}
                    {!active ? (
                      <Button
                        type="button"
                        variant="secondary"
                        className={cn('h-9 min-h-9 px-3 text-sm', motion.chip)}
                        onClick={() => void collab.selectList(list.id)}
                      >
                        Open
                      </Button>
                    ) : null}
                  </div>
                </>
              )}
            </li>
          )
        })}
      </ul>

      <form
        className="mt-4 flex flex-col gap-2 border-t border-line pt-4 sm:flex-row sm:items-end"
        onSubmit={(e) => void create(e)}
      >
        <Field label="New list name" className="min-w-0 flex-1">
          <TextInput
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Partner search, Client — Rivera…"
          />
        </Field>
        <Button type="submit" variant="honey" disabled={busy} className="shrink-0">
          <FolderPlus className="h-4 w-4" />
          Create list
        </Button>
      </form>

      {error ? (
        <p className="mt-3 rounded-xl bg-honey-soft px-3 py-2 text-sm text-ink">{error}</p>
      ) : null}
    </div>
  )
}

/** Compact target picker for copy-to-list actions */
export function CopyToListMenu({
  collab,
  placeIds,
  onDone,
  onCancel,
}: {
  collab: CollaborationController
  placeIds: string[]
  onDone: (message: string) => void
  onCancel: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const targets = collab.editableLists.filter(
    (l) => l.id !== collab.activeListId,
  )

  const copy = async (targetId: string, name: string) => {
    setBusy(true)
    setError(null)
    try {
      if (placeIds.length === 1) {
        await collab.copyPlace(placeIds[0]!, targetId)
        onDone(`Copied to “${name}”.`)
      } else {
        const r = await collab.copyPlaces(placeIds, targetId)
        onDone(
          r.copied
            ? `Copied ${r.copied} place${r.copied === 1 ? '' : 's'} to “${name}”.`
            : 'Nothing was copied.',
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Copy failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-panel p-3 shadow-[var(--shadow-soft)]">
      <p className="text-sm font-bold text-ink">
        Copy {placeIds.length === 1 ? 'place' : `${placeIds.length} places`} to…
      </p>
      {targets.length === 0 ? (
        <p className="mt-2 text-sm text-ink-soft">
          Create another list first (Lists panel), or open a board you can edit.
        </p>
      ) : (
        <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
          {targets.map((list) => (
            <li key={list.id}>
              <button
                type="button"
                disabled={busy}
                onClick={() => void copy(list.id, list.name)}
                className={cn(
                  'flex w-full items-center justify-between gap-2 rounded-xl border border-line px-3 py-2 text-left text-sm hover:border-sea hover:bg-folio',
                  motion.chip,
                )}
              >
                <span className="min-w-0 truncate font-bold text-ink">{list.name}</span>
                <span className="shrink-0 text-xs text-ink-soft">
                  {listIsShared(list) ? 'Shared' : 'Private'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {error ? (
        <p className="mt-2 text-sm text-warn">{error}</p>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        className="mt-2 h-9 min-h-9 w-full"
        onClick={onCancel}
      >
        Cancel
      </Button>
    </div>
  )
}
