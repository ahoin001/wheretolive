import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Compass,
  MoreHorizontal,
  Trash2,
  UserRound,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { AppController } from '../../hooks/useApp'
import type { AuthController } from '../../hooks/useAuth'
import type { CollaborationController } from '../../hooks/useCollaboration'
import type { WizardStepId } from '../../domain/types'
import { formatMoney } from '../../domain/finance/calculations'
import { cssMotion } from '../../lib/motion'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { cn } from '../../lib/utils'

/** Main guide boards */
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
  const [footerMenuOpen, setFooterMenuOpen] = useState(false)
  const footerMenuRef = useRef<HTMLDivElement>(null)
  const { ui, finance, stepIndex, steps } = app
  const showGuideChrome = guideAllowed && ui.mode === 'guide'
  const showNav = Boolean(app.scenario)
  const workStepIndex = STEP_META.findIndex((s) => s.id === ui.activeStep)

  useEffect(() => {
    if (!footerMenuOpen) return
    const onPointer = (e: MouseEvent) => {
      if (
        footerMenuRef.current &&
        !footerMenuRef.current.contains(e.target as Node)
      ) {
        setFooterMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointer)
    return () => document.removeEventListener('mousedown', onPointer)
  }, [footerMenuOpen])

  return (
    <div className="mx-auto flex min-h-screen w-full min-w-0 max-w-7xl flex-col gap-3 px-4 py-4 md:gap-4 md:px-6 md:py-6">
      <header className="no-print flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-[1.75rem] border border-line bg-panel/90 px-4 py-3 shadow-[var(--shadow-soft)] backdrop-blur">
        <div className="min-w-0 flex-1">
          <p className="font-display text-xl font-semibold leading-tight tracking-[-0.02em] text-ink sm:text-2xl md:text-3xl">
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
                className="min-h-11 px-3 md:min-h-12 md:px-4"
              >
                <Bookmark className="h-4 w-4" />
                <span className="sr-only sm:not-sr-only">Places</span>
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
                className="min-h-11 px-3 md:min-h-12 md:px-4"
              >
                <Compass className="h-4 w-4" />
                <span className="sr-only sm:not-sr-only">Guide</span>
              </Button>
            </>
          ) : null}
          <Button
            variant={accountActive ? 'primary' : 'secondary'}
            onClick={onOpenAccount}
            title="Account settings"
            className="min-h-11 px-3 md:min-h-12 md:px-4"
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

      {showGuideChrome && finance && app.scenario ? (
        <aside
          className={cn(
            'no-print rounded-[1.25rem] border border-line bg-folio/90',
            'flex min-w-0 gap-2 overflow-x-auto px-3 py-2.5 md:grid md:grid-cols-4 md:gap-3 md:overflow-visible md:rounded-[1.5rem] md:p-4',
          )}
        >
          <Stat
            label="Stay / mo"
            shortLabel="Stay"
            value={formatMoney(finance.stayMonthly)}
            tone="keep"
            compact
          />
          <Stat
            label="Rent / mo"
            shortLabel="Rent"
            value={formatMoney(finance.moveMonthly)}
            tone="move"
            compact
          />
          <Stat
            label="Difference"
            shortLabel="Δ"
            value={`${finance.monthlyDelta >= 0 ? '+' : ''}${formatMoney(finance.monthlyDelta)}`}
            tone="honey"
            compact
          />
          <Stat
            label="Cash after sale"
            shortLabel="Cash"
            value={formatMoney(finance.cashAfterMoveMid)}
            tone="sea"
            compact
          />
        </aside>
      ) : null}

      <main
        className={cn(
          'min-w-0 max-w-full flex-1',
          showGuideChrome &&
            showNav &&
            'pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-0',
        )}
      >
        {children}
      </main>

      {showGuideChrome && showNav ? (
        <footer
          className={cn(
            'no-print sticky z-10 flex items-center justify-between gap-2 rounded-[1.5rem] border border-line bg-panel/95 px-3 py-2.5 shadow-[var(--shadow-lift)] backdrop-blur sm:gap-3 sm:px-4 sm:py-3',
            'bottom-[max(0.75rem,env(safe-area-inset-bottom))]',
          )}
        >
          <Button
            variant="secondary"
            onClick={app.prevStep}
            disabled={stepIndex <= 0}
            className="min-h-11 shrink-0 px-3 sm:min-h-12 sm:px-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <p className="hidden text-sm text-ink-soft sm:block">
            {workStepIndex >= 0
              ? `Step ${workStepIndex + 1} of ${STEP_META.length}`
              : `Step ${stepIndex + 1} of ${steps.length}`}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <div className="relative sm:hidden" ref={footerMenuRef}>
              <Button
                type="button"
                variant="ghost"
                className="min-h-11 min-w-11 px-2"
                aria-label="More actions"
                aria-expanded={footerMenuOpen}
                onClick={() => setFooterMenuOpen((o) => !o)}
              >
                <MoreHorizontal className="h-5 w-5" />
              </Button>
              {footerMenuOpen ? (
                <div className="absolute bottom-full right-0 mb-2 min-w-[9rem] overflow-hidden rounded-xl border border-line bg-panel py-1 shadow-[var(--shadow-lift)]">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-bold text-ink hover:bg-folio"
                    onClick={() => {
                      setFooterMenuOpen(false)
                      setEraseOpen(true)
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                    Erase
                  </button>
                </div>
              ) : null}
            </div>
            <Button
              variant="ghost"
              onClick={() => setEraseOpen(true)}
              className="hidden sm:inline-flex"
            >
              <Trash2 className="h-4 w-4" />
              Erase
            </Button>
            <Button
              onClick={app.nextStep}
              disabled={stepIndex >= steps.length - 1}
              className="min-h-11 px-3 sm:min-h-12 sm:px-4"
            >
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
  shortLabel,
  value,
  tone,
  compact = false,
}: {
  label: string
  shortLabel?: string
  value: string
  tone: 'keep' | 'move' | 'honey' | 'sea'
  compact?: boolean
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
    <div
      className={cn(
        compact &&
          'min-w-0 flex-1 basis-0 md:min-w-0 md:flex-none md:basis-auto',
      )}
    >
      <p className="truncate text-[11px] text-ink-soft sm:text-sm">
        <span className="md:hidden">{shortLabel ?? label}</span>
        <span className="hidden md:inline">{label}</span>
      </p>
      <p
        className={cn(
          'font-display font-semibold tabular-nums',
          cssMotion.color,
          color,
          compact
            ? 'truncate text-base leading-tight sm:text-lg md:text-2xl'
            : 'text-2xl',
        )}
      >
        {value}
      </p>
    </div>
  )
}
