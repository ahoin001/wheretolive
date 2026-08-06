import { useEffect, useState, type FormEvent } from 'react'
import { ArrowLeft } from 'lucide-react'
import type { AuthController } from '../../hooks/useAuth'
import { cssMotion } from '../../lib/motion'
import { Button } from '../ui/Button'
import { Field, TextInput } from '../ui/Field'
import { Toggle } from '../ui/Toggle'
import { cn } from '../../lib/utils'

export function AccountPage({
  auth,
  onBack,
}: {
  auth: AuthController
  onBack: () => void
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

  useEffect(() => {
    if (!auth.signedIn) onBack()
  }, [auth.signedIn, onBack])

  if (!auth.signedIn) return null

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
    <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col px-4 py-6 md:px-6 md:py-10">
      <Button
        type="button"
        variant="ghost"
        onClick={onBack}
        className={cn('mb-8 min-h-11 w-fit px-3', cssMotion.interactive)}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to places
      </Button>

      <div className="flex flex-1 flex-col justify-center pb-16">
        <p className="font-display text-3xl font-semibold tracking-[-0.02em] text-ink md:text-4xl">
          Account
        </p>
        <p className="mt-2 text-base text-ink-soft">
          Name and email are used when someone invites you to a shared place list.
        </p>

        <div className="mt-8 rounded-[1.75rem] border border-line bg-panel p-6 shadow-[var(--shadow-lift)] md:p-8">
          <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
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

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="submit" disabled={auth.busy} className="sm:flex-1">
                {auth.busy ? 'Saving…' : 'Save profile'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={auth.busy}
                onClick={() => void auth.signOut()}
                className="sm:flex-1"
              >
                Sign out
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
