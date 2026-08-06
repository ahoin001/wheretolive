import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Compass,
  Trash2,
  UserRound,
} from 'lucide-react'
import { useState } from 'react'
import type { AppController } from '../../hooks/useApp'
import type { AuthController } from '../../hooks/useAuth'
import type { CollaborationController } from '../../hooks/useCollaboration'
import type { WizardStepId } from '../../domain/types'
import { formatMoney } from '../../domain/finance/calculations'
import { cssMotion } from '../../lib/motion'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { cn } from '../../lib/utils'

/** Main guide boards (welcome is start-only, not in the chip strip). */
const STEP_META: { id: WizardStepId; label: string; short: string }[] = [
  { id: 'stay', label: 'Your home', short: 'Home' },
  { id: 'move', label: 'If you move', short: 'Rent' },
  { id: 'picture', label: 'Your picture', short: 'Picture' },
]

export function AppShell({
  app,
  auth,
  collab,
  guideAllowed = false,
  onOpenAccount,
  accountActive = false,
  children,
}: {
  app: AppController
  auth: AuthController
  collab: CollaborationController
  /** Keep/downsize Guide is opt-in for allowlisted accounts only */
  guideAllowed?: boolean
  onOpenAccount: () => void
  accountActive?: boolean
  children: React.ReactNode
}) {
  const [eraseOpen, setEraseOpen] = useState(false)
  const { ui, finance, stepIndex, steps } = app
  const showGuideChrome = guideAllowed && ui.mode === 'guide'
  const showNav = Boolean(app.scenario) && ui.activeStep !== 'welcome'
  const workStepIndex = STEP_META.findIndex((s) => s.id === ui.activeStep)

  return (
    <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-4 px-4 py-4 md:px-6 md:py-6">
      <header className="no-print flex flex-wrap items-center justify-between gap-3 rounded-[1.75rem] border border-line bg-panel/90 px-4 py-3 shadow-[var(--shadow-soft)] backdrop-blur">
        <div>
          <p className="font-display text-2xl font-semibold tracking-[-0.02em] text-ink md:text-3xl">
            Room for the Next Chapter
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {guideAllowed ? (
            <>
              <Button
                variant={ui.mode === 'places' ? 'primary' : 'secondary'}
                onClick={() => app.setMode('places')}
                aria-current={ui.mode === 'places'}
              >
                <Bookmark className="h-4 w-4" />
                Places
                {collab.pendingInvites.length > 0 ? (
                  <span className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-honey px-1.5 text-xs text-white">
                    {collab.pendingInvites.length}
                  </span>
                ) : null}
              </Button>
              <Button
                variant={ui.mode === 'guide' ? 'primary' : 'secondary'}
                onClick={() => app.setMode('guide')}
                aria-current={ui.mode === 'guide'}
              >
                <Compass className="h-4 w-4" />
                Guide
              </Button>
            </>
          ) : null}
          <Button
            variant={accountActive ? 'primary' : 'secondary'}
            onClick={onOpenAccount}
            title="Account settings"
          >
            <UserRound className="h-4 w-4" />
            <span className="sr-only md:not-sr-only">
              {auth.profile?.displayName || 'Account'}
            </span>
            {!guideAllowed && collab.pendingInvites.length > 0 ? (
              <span className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-honey px-1.5 text-xs text-white">
                {collab.pendingInvites.length}
              </span>
            ) : null}
          </Button>
        </div>
      </header>

      {showGuideChrome && showNav ? (
        <nav
          aria-label="Guide steps"
          className="no-print overflow-x-auto rounded-[1.5rem] border border-line bg-panel/80 p-2 shadow-[var(--shadow-soft)]"
        >
          <ol className="flex min-w-max gap-2 md:grid md:min-w-0 md:grid-cols-3">
            {STEP_META.map((step, index) => {
              const active = ui.activeStep === step.id
              const done =
                ui.completedSteps.includes(step.id) ||
                (workStepIndex >= 0 && index < workStepIndex)
              return (
                <li key={step.id}>
                  <button
                    type="button"
                    onClick={() => app.goToStep(step.id)}
                    className={cn(
                      'flex w-full min-w-[7.5rem] flex-col rounded-2xl px-3 py-2 text-left md:min-w-0',
                      cssMotion.chip,
                      active && 'bg-sea text-white',
                      !active && done && 'bg-folio text-ink',
                      !active && !done && 'text-ink-soft hover:bg-folio',
                    )}
                  >
                    <span className="text-xs font-bold opacity-80">
                      {index + 1}. {step.short}
                    </span>
                    <span className="text-sm font-bold leading-tight">{step.label}</span>
                  </button>
                </li>
              )
            })}
          </ol>
        </nav>
      ) : null}

      {showGuideChrome && finance && app.scenario && ui.activeStep !== 'welcome' ? (
        <aside className="no-print grid gap-3 rounded-[1.5rem] border border-line bg-folio/90 p-4 md:grid-cols-4">
          <Stat label="Stay / mo" value={formatMoney(finance.stayMonthly)} tone="keep" />
          <Stat label="Rent / mo" value={formatMoney(finance.moveMonthly)} tone="move" />
          <Stat
            label="Difference"
            value={`${finance.monthlyDelta >= 0 ? '+' : ''}${formatMoney(finance.monthlyDelta)}`}
            tone="honey"
          />
          <Stat
            label="Cash after sale"
            value={formatMoney(finance.cashAfterMoveMid)}
            tone="sea"
          />
        </aside>
      ) : null}

      <main className="flex-1">{children}</main>

      {showGuideChrome && showNav ? (
        <footer className="no-print sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-[1.5rem] border border-line bg-panel/95 px-4 py-3 shadow-[var(--shadow-lift)] backdrop-blur">
          <Button variant="secondary" onClick={app.prevStep} disabled={stepIndex <= 0}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <p className="text-sm text-ink-soft">
            {workStepIndex >= 0
              ? `Step ${workStepIndex + 1} of ${STEP_META.length}`
              : `Step ${stepIndex + 1} of ${steps.length}`}
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setEraseOpen(true)}>
              <Trash2 className="h-4 w-4" />
              Erase
            </Button>
            <Button onClick={app.nextStep} disabled={stepIndex >= steps.length - 1}>
              Continue
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </footer>
      ) : null}

      <ConfirmDialog
        open={eraseOpen}
        title="Erase everything on this device?"
        description="This permanently removes your guide answers and all saved places from this browser. It cannot be undone."
        confirmLabel="Erase everything"
        cancelLabel="Cancel"
        tone="danger"
        onCancel={() => setEraseOpen(false)}
        onConfirm={() => {
          setEraseOpen(false)
          void app.eraseAll()
        }}
      />
    </div>
  )
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'keep' | 'move' | 'honey' | 'sea'
}) {
  const color =
    tone === 'keep'
      ? 'text-keep'
      : tone === 'move'
        ? 'text-move'
        : tone === 'honey'
          ? 'text-honey'
          : 'text-sea-deep'
  return (
    <div>
      <p className="text-sm text-ink-soft">{label}</p>
      <p className={cn('font-display text-2xl font-semibold tabular-nums', cssMotion.color, color)}>
        {value}
      </p>
    </div>
  )
}
