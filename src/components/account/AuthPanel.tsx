import { useState, type FormEvent } from 'react'
import type { AuthController } from '../../hooks/useAuth'
import { Button } from '../ui/Button'
import { Field, TextInput } from '../ui/Field'

export function AuthPanel({
  auth,
  onClose,
}: {
  auth: AuthController
  onClose?: () => void
}) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setMessage(null)
    try {
      if (mode === 'signin') {
        await auth.signIn(email, password)
        setMessage('Signed in.')
        onClose?.()
      } else {
        await auth.signUp(email, password, displayName)
        setMessage(
          'Account created. If email confirmation is required, check your inbox before signing in.',
        )
      }
    } catch {
      /* error on auth controller */
    }
  }

  if (!auth.configured) {
    return (
      <div className="rounded-[1.5rem] border border-line bg-panel p-5">
        <h2 className="font-display text-2xl font-semibold text-ink">Cloud account</h2>
        <p className="mt-2 text-sm text-ink-soft">
          Add <code className="text-ink">VITE_SUPABASE_URL</code> and{' '}
          <code className="text-ink">VITE_SUPABASE_ANON_KEY</code> to enable sign-in and
          shared place lists.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-[1.5rem] border border-line bg-panel p-5 shadow-[var(--shadow-soft)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-2xl font-semibold text-ink">
          {mode === 'signin' ? 'Sign in' : 'Create account'}
        </h2>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={mode === 'signin' ? 'primary' : 'secondary'}
            onClick={() => setMode('signin')}
          >
            Sign in
          </Button>
          <Button
            type="button"
            variant={mode === 'signup' ? 'primary' : 'secondary'}
            onClick={() => setMode('signup')}
          >
            Sign up
          </Button>
        </div>
      </div>
      <p className="mt-2 text-sm text-ink-soft">
        Shared place boards need an account so partners can edit the same list.
      </p>

      <form className="mt-5 space-y-3" onSubmit={(e) => void onSubmit(e)}>
        {mode === 'signup' ? (
          <Field label="Display name" hint="Shown when others search for you">
            <TextInput
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoComplete="name"
              required
            />
          </Field>
        ) : null}
        <Field label="Email">
          <TextInput
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </Field>
        <Field label="Password" hint="At least 6 characters">
          <TextInput
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            minLength={6}
            required
          />
        </Field>
        {auth.error ? (
          <p className="rounded-xl bg-honey-soft px-3 py-2 text-sm text-ink">{auth.error}</p>
        ) : null}
        {message ? (
          <p className="rounded-xl bg-folio px-3 py-2 text-sm text-ink">{message}</p>
        ) : null}
        <Button type="submit" disabled={auth.busy} className="w-full">
          {auth.busy
            ? 'Working…'
            : mode === 'signin'
              ? 'Sign in'
              : 'Create account'}
        </Button>
      </form>
    </div>
  )
}
