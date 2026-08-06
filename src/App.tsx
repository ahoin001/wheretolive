import { lazy, Suspense, useState } from 'react'
import { ErrorBoundary } from './components/ErrorBoundary'
import { AppShell } from './components/layout/AppShell'
import { AccountSettings } from './components/account/AccountSettings'
import { AuthPanel } from './components/account/AuthPanel'
import { EasierStep } from './components/wizard/EasierStep'
import { HouseholdStep } from './components/wizard/HouseholdStep'
import { PathsStep } from './components/wizard/PathsStep'
import { PeaceStep } from './components/wizard/PeaceStep'
import { SummaryStep } from './components/wizard/SummaryStep'
import { TalkStep } from './components/wizard/TalkStep'
import { TodayStep } from './components/wizard/TodayStep'
import { WelcomeStep } from './components/wizard/WelcomeStep'
import { useApp } from './hooks/useApp'
import { useAuth } from './hooks/useAuth'
import { useCollaboration } from './hooks/useCollaboration'

const PlacesWorkspace = lazy(async () => {
  const mod = await import('./components/places/PlacesWorkspace')
  return { default: mod.PlacesWorkspace }
})

export default function App() {
  const app = useApp()
  const auth = useAuth()
  const collab = useCollaboration({
    user: auth.user,
    localPlaces: app.places,
    replaceLocalPlaces: app.replacePlaces,
  })
  const [accountOpen, setAccountOpen] = useState(false)

  if (!app.ready || !auth.ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-ink-soft">
        Loading your saved answers…
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <AppShell
        app={app}
        auth={auth}
        collab={collab}
        accountOpen={accountOpen}
        onAccountOpenChange={setAccountOpen}
      >
        {app.error ? (
          <div className="mb-4 rounded-2xl bg-honey-soft p-4 text-ink">
            {app.error}
          </div>
        ) : null}

        {accountOpen ? (
          <div className="mb-6 space-y-4">
            {auth.signedIn ? (
              <AccountSettings
                auth={auth}
                onClose={() => setAccountOpen(false)}
              />
            ) : (
              <AuthPanel auth={auth} onClose={() => setAccountOpen(false)} />
            )}
          </div>
        ) : null}

        {app.ui.mode === 'places' ? (
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
              onOpenAccount={() => setAccountOpen(true)}
            />
          </Suspense>
        ) : !app.scenario || app.ui.activeStep === 'welcome' ? (
          <WelcomeStep app={app} />
        ) : (
          <>
            {app.ui.activeStep === 'household' ? <HouseholdStep app={app} /> : null}
            {app.ui.activeStep === 'today' ? <TodayStep app={app} /> : null}
            {app.ui.activeStep === 'paths' ? <PathsStep app={app} /> : null}
            {app.ui.activeStep === 'peace' ? <PeaceStep app={app} /> : null}
            {app.ui.activeStep === 'easier' ? <EasierStep app={app} /> : null}
            {app.ui.activeStep === 'talk' ? <TalkStep app={app} /> : null}
            {app.ui.activeStep === 'summary' ? <SummaryStep app={app} /> : null}
          </>
        )}
      </AppShell>
    </ErrorBoundary>
  )
}
