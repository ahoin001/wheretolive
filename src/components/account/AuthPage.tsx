import { useEffect, useState, type FormEvent } from 'react'
import type { AuthController } from '../../hooks/useAuth'
import { Button } from '../ui/Button'
import { Field, TextInput } from '../ui/Field'

export function AuthPage({
  auth,
  onSignedIn,
}: {
  auth: AuthController
  onSignedIn: () => void
}) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (auth.signedIn) onSignedIn()
  }, [auth.signedIn, onSignedIn])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setMessage(null)
    try {
      if (mode === 'signin') {
        await auth.signIn(email, password)
        onSignedIn()
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

  return (
    <div className="mx-auto flex min-h-screen w-full min-w-0 max-w-lg flex-col justify-center px-4 py-10 md:px-6">
      <p className="font-display text-3xl font-semibold tracking-[-0.02em] text-ink md:text-4xl">
        Room for the Next Chapter
      </p>
      <p className="mt-2 text-base text-ink-soft">
        {mode === 'signin'
          ? 'Sign in to open your places list.'
          : 'Create an account to save and share places.'}
      </p>

      {!auth.configured ? (
        <div className="mt-8 rounded-[1.5rem] border border-line bg-panel p-6 shadow-[var(--shadow-soft)]">
          <h1 className="font-display text-2xl font-semibold text-ink">Cloud not configured</h1>
          <p className="mt-3 text-base leading-relaxed text-ink-soft">
            Add <code className="text-ink">VITE_SUPABASE_URL</code> and{' '}
            <code className="text-ink">VITE_SUPABASE_ANON_KEY</code> so people can sign in.
          </p>
        </div>
      ) : (
        <div className="mt-8 rounded-[1.75rem] border border-line bg-panel p-6 shadow-[var(--shadow-lift)] md:p-8">
          <h1 className="font-display text-2xl font-semibold text-ink md:text-3xl">
            {mode === 'signin' ? 'Sign in' : 'Create account'}
          </h1>
          <div
            className="mt-4 grid grid-cols-2 gap-1 rounded-2xl bg-folio p-1"
            role="tablist"
            aria-label="Sign in or create account"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'signin'}
              className={
                mode === 'signin'
                  ? 'min-h-11 rounded-xl bg-panel text-sm font-bold text-ink shadow-[var(--shadow-soft)]'
                  : 'min-h-11 rounded-xl text-sm font-bold text-ink-soft'
              }
              onClick={() => {
                setMode('signin')
                setMessage(null)
              }}
            >
              Sign in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'signup'}
              className={
                mode === 'signup'
                  ? 'min-h-11 rounded-xl bg-panel text-sm font-bold text-ink shadow-[var(--shadow-soft)]'
                  : 'min-h-11 rounded-xl text-sm font-bold text-ink-soft'
              }
              onClick={() => {
                setMode('signup')
                setMessage(null)
              }}
            >
              Sign up
            </button>
          </div>

          <form className="mt-6 space-y-4" onSubmit={(e) => void onSubmit(e)}>
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
      )}
    </div>
  )
}
