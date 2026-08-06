import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { ErrorBoundary } from './components/ErrorBoundary'
import { AppShell } from './components/layout/AppShell'
import { AccountPage } from './components/account/AccountPage'
import { AuthPage } from './components/account/AuthPage'
import { PageTransition } from './components/ui/PageTransition'
import { MoveStep } from './components/wizard/MoveStep'
import { PictureStep } from './components/wizard/PictureStep'
import { StayStep } from './components/wizard/StayStep'
import { WelcomeStep } from './components/wizard/WelcomeStep'
import { useApp } from './hooks/useApp'
import { useAuth } from './hooks/useAuth'
import { useCollaboration } from './hooks/useCollaboration'
import { canAccessGuide } from './lib/access'

const PlacesWorkspace = lazy(async () => {
  const mod = await import('./components/places/PlacesWorkspace')
  return { default: mod.PlacesWorkspace }
})

export default function App() {
  const auth = useAuth()
  const app = useApp(auth.user?.id ?? null, auth.ready)
  const collab = useCollaboration({
    user: auth.user,
    localPlaces: app.places,
    replaceLocalPlaces: app.replacePlaces,
  })
  const [accountOpen, setAccountOpen] = useState(false)

  const guideAllowed = canAccessGuide(auth.user?.email)
  const openAccount = useCallback(() => setAccountOpen(true), [])
  const closeAccount = useCallback(() => setAccountOpen(false), [])

  // Places is home when signed in; never leave non-allowlisted users stuck in Guide.
  useEffect(() => {
    if (!app.ready || !auth.signedIn) return
    if (!guideAllowed && app.ui.mode === 'guide') {
      app.setMode('places')
    }
  }, [app.ready, app.ui.mode, guideAllowed, app.setMode, auth.signedIn])

  useEffect(() => {
    if (!auth.signedIn) setAccountOpen(false)
  }, [auth.signedIn])

  const viewKey = useMemo(() => {
    if (!auth.signedIn) return 'auth'
    if (accountOpen) return 'account'
    if (!guideAllowed || app.ui.mode === 'places') return 'places'
    if (!app.scenario || app.ui.activeStep === 'welcome') return 'welcome'
    return app.ui.activeStep
  }, [
    auth.signedIn,
    accountOpen,
    guideAllowed,
    app.ui.mode,
    app.ui.activeStep,
    app.scenario,
  ])

  if (!auth.ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-ink-soft">
        Loading…
      </div>
    )
  }

  // Auth gate — no guest app surface
  if (!auth.signedIn) {
    return (
      <ErrorBoundary>
        <PageTransition viewKey="auth">
          <AuthPage auth={auth} onSignedIn={() => setAccountOpen(false)} />
        </PageTransition>
      </ErrorBoundary>
    )
  }

  if (!app.ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-ink-soft">
        Loading your places…
      </div>
    )
  }

  if (accountOpen) {
    return (
      <ErrorBoundary>
        <PageTransition viewKey={viewKey}>
          <AccountPage auth={auth} onBack={closeAccount} />
        </PageTransition>
      </ErrorBoundary>
    )
  }

  const onPlaces = !guideAllowed || app.ui.mode === 'places'

  let body: React.ReactNode
  if (onPlaces) {
    body = (
      <Suspense
        fallback={
          <div className="rounded-[1.75rem] border border-line bg-panel p-8 text-ink-soft">
            Opening Places…
          </div>
        }
      >
        <PlacesWorkspace
          app={app}
          auth={auth}
          collab={collab}
          onOpenAccount={openAccount}
        />
      </Suspense>
    )
  } else if (!app.scenario || app.ui.activeStep === 'welcome') {
    body = <WelcomeStep app={app} />
  } else if (app.ui.activeStep === 'stay') {
    body = <StayStep app={app} />
  } else if (app.ui.activeStep === 'move') {
    body = <MoveStep app={app} />
  } else {
    body = <PictureStep app={app} />
  }

  return (
    <ErrorBoundary>
      <AppShell
        app={app}
        auth={auth}
        collab={collab}
        guideAllowed={guideAllowed}
        onOpenAccount={openAccount}
        accountActive={false}
      >
        {app.error || collab.error ? (
          <div className="mb-4 rounded-2xl bg-honey-soft p-4 text-ink">
            {app.error ?? collab.error}
          </div>
        ) : null}

        <PageTransition viewKey={viewKey}>{body}</PageTransition>
      </AppShell>
    </ErrorBoundary>
  )
}
