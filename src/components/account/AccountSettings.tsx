import { useEffect, useState, type FormEvent } from 'react'
import type { AuthController } from '../../hooks/useAuth'
import { Button } from '../ui/Button'
import { Field, TextInput } from '../ui/Field'
import { Toggle } from '../ui/Toggle'

export function AccountSettings({
  auth,
  onClose,
}: {
  auth: AuthController
  onClose?: () => void
}) {
  const [displayName, setDisplayName] = useState(auth.profile?.displayName ?? '')
  const [email, setEmail] = useState(auth.user?.email ?? auth.profile?.email ?? '')
  const [password, setPassword] = useState('')
  const [searchable, setSearchable] = useState(auth.profile?.searchable ?? true)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    setDisplayName(auth.profile?.displayName ?? '')
    setEmail(auth.user?.email ?? auth.profile?.email ?? '')
    setSearchable(auth.profile?.searchable ?? true)
  }, [auth.profile, auth.user])

  if (!auth.signedIn) {
    return null
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setMessage(null)
    try {
      await auth.updateProfile({
        displayName: displayName.trim(),
        email: email.trim(),
        searchable,
        password: password || undefined,
      })
      setPassword('')
      setMessage('Profile saved.')
    } catch {
      /* surfaced on auth.error */
    }
  }

  return (
    <div className="rounded-[1.5rem] border border-line bg-panel p-5 shadow-[var(--shadow-soft)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold text-ink">Account</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Name and email are used when someone invites you to a shared place list.
          </p>
        </div>
        {onClose ? (
          <Button type="button" variant="ghost" onClick={onClose}>
            Close
          </Button>
        ) : null}
      </div>

      <form className="mt-5 space-y-3" onSubmit={(e) => void onSubmit(e)}>
        <Field label="Display name">
          <TextInput
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            autoComplete="name"
            required
          />
        </Field>
        <Field label="Email">
          <TextInput
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </Field>
        <Field label="New password" hint="Leave blank to keep your current password">
          <TextInput
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={6}
          />
        </Field>
        <div className="rounded-2xl border border-line bg-folio/60 px-4 py-3">
          <Toggle
            checked={searchable}
            onChange={setSearchable}
            label="Allow others to find me"
            hint="People can search your exact email or display name when sharing a list."
          />
        </div>

        {auth.error ? (
          <p className="rounded-xl bg-honey-soft px-3 py-2 text-sm text-ink">{auth.error}</p>
        ) : null}
        {message ? (
          <p className="rounded-xl bg-folio px-3 py-2 text-sm text-ink">{message}</p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={auth.busy}>
            {auth.busy ? 'Saving…' : 'Save profile'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={auth.busy}
            onClick={() => void auth.signOut()}
          >
            Sign out
          </Button>
        </div>
      </form>
    </div>
  )
}
