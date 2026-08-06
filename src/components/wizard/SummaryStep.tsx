import type { AppController } from '../../hooks/useApp'
import { formatMoney } from '../../domain/finance/calculations'
import {
  fitLabel,
  pathLabel,
  readinessCopy,
} from '../../domain/insights/readiness'
import { canShowReadiness } from '../../domain/insights/readinessGate'
import { Button } from '../ui/Button'
import { ReadinessPanel } from './ReadinessPanel'

export function SummaryStep({ app }: { app: AppController }) {
  const scenario = app.scenario
  const finance = app.finance
  const readiness = app.readiness
  if (!scenario || !finance || !readiness) return null

  return (
    <div className="space-y-6">
      <header className="rounded-[1.75rem] border border-line bg-panel p-6 shadow-[var(--shadow-soft)] md:p-8 print-sheet">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl font-semibold text-ink">
              Conversation summary
            </h1>
            <p className="mt-3 max-w-3xl text-lg text-ink-soft">
              A one-page picture of the assumptions, both paths, and what still needs
              clarity. Print it or keep it here — it is a planning aid, not advice.
            </p>
          </div>
          <Button variant="secondary" className="no-print" onClick={() => window.print()}>
            Print / Save PDF
          </Button>
        </div>
      </header>

      <section className="grid gap-4 rounded-[1.75rem] border border-line bg-panel p-5 shadow-[var(--shadow-soft)] md:grid-cols-2 md:p-7 print-sheet">
        <SummaryRow label="Scenario" value={scenario.name} />
        <SummaryRow
          label="Home"
          value={`${scenario.home.address}, ${scenario.home.city}, ${scenario.home.state} ${scenario.home.zip}`}
        />
        <SummaryRow label="Stay monthly" value={formatMoney(finance.stayMonthly)} />
        <SummaryRow label="Move monthly" value={formatMoney(finance.moveMonthly)} />
        <SummaryRow label="Monthly difference" value={formatMoney(finance.monthlyDelta)} />
        <SummaryRow label="Cash after mid-estimate move" value={formatMoney(finance.cashAfterMoveMid)} />
        <SummaryRow label="Current lean" value={pathLabel(readiness.pathLean)} />
        <SummaryRow label="Readiness" value={readinessCopy(readiness.readiness)} />
        <SummaryRow label="Keep fit" value={fitLabel(readiness.keepFit)} />
        <SummaryRow label="Downsize fit" value={fitLabel(readiness.downsizeFit)} />
      </section>

      {canShowReadiness(scenario) ? (
        <ReadinessPanel result={readiness} />
      ) : (
        <section className="rounded-[1.75rem] border border-dashed border-line bg-folio/80 p-5 print-sheet">
          <p className="text-ink-soft">
            Fit summary unlocks after household basics plus keep-and-move money inputs.
          </p>
        </section>
      )}

      <section className="rounded-[1.75rem] border border-line bg-panel p-5 shadow-[var(--shadow-soft)] md:p-7 print-sheet">
        <h2 className="font-display text-2xl font-semibold">Suggested next steps</h2>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-ink">
          <li>Confirm the escrow / tax / insurance breakdown with the loan servicer.</li>
          <li>Ask a local agent for recent sold comps near the current home.</li>
          <li>Save 3–5 real next-home options in Places and compare monthly costs.</li>
          <li>Use one conversation starter and write down what still feels unresolved.</li>
        </ol>
        {scenario.conversationNotes ? (
          <div className="mt-5 rounded-2xl bg-folio p-4">
            <p className="text-sm font-bold text-ink-soft">Conversation notes</p>
            <p className="mt-2 whitespace-pre-wrap text-ink">{scenario.conversationNotes}</p>
          </div>
        ) : null}
      </section>
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-folio px-4 py-3">
      <p className="text-sm text-ink-soft">{label}</p>
      <p className="mt-1 font-bold text-ink">{value || '—'}</p>
    </div>
  )
}
