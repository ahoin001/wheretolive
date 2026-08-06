import type { AppController } from '../../hooks/useApp'
import { formatMoney } from '../../domain/finance/calculations'
import { canShowReadiness } from '../../domain/insights/readinessGate'
import { ReadinessPanel } from './ReadinessPanel'

export function PeaceStep({ app }: { app: AppController }) {
  const finance = app.finance
  const readiness = app.readiness
  if (!finance || !readiness || !app.scenario) return null

  return (
    <div className="space-y-6">
      <header className="rounded-[1.75rem] border border-line bg-panel p-6 shadow-[var(--shadow-soft)] md:p-8">
        <h1 className="font-display text-4xl font-semibold text-ink">
          What peace of mind looks like now
        </h1>
        <p className="mt-3 max-w-3xl text-lg text-ink-soft">
          In the late 50s and 60s, housing is less about maximum space and more about
          steady cash flow, manageable work, and options if life changes. This page
          translates that into plain English.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <Card
          title="1-year housing spend"
          body={`Keep ≈ ${formatMoney(finance.stayAnnual)} · Move ≈ ${formatMoney(finance.moveAnnual)}`}
        />
        <Card
          title="5-year housing spend"
          body={`Keep ≈ ${formatMoney(finance.fiveYearStay)} · Move ≈ ${formatMoney(finance.fiveYearMove)}`}
        />
        <Card
          title="Cash that could become flexible"
          body={`About ${formatMoney(finance.cashAfterMoveMid)} after a mid-estimate sale and relocating costs.`}
        />
      </section>

      <section className="rounded-[1.75rem] border border-line bg-panel p-5 shadow-[var(--shadow-soft)] md:p-7">
        <h2 className="font-display text-2xl font-semibold">Why cash flow matters in this decade</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <p className="rounded-2xl bg-folio p-4 text-ink">
            A house can be an asset and still be a heavy monthly commitment. Near
            retirement, many households sleep better when fewer dollars are locked into
            upkeep, insurance swings, and unused rooms.
          </p>
          <p className="rounded-2xl bg-folio p-4 text-ink">
            Keeping a strong mortgage rate can still make sense — if the full cost of
            the property fits the life you want. The question is not “is the rate good?”
            It is “does this whole home still serve us?”
          </p>
          <p className="rounded-2xl bg-folio p-4 text-ink">
            Freeing equity is not about spending wildly. It can mean a smaller place,
            an emergency cushion, less stress when something breaks, and more choice if
            income changes.
          </p>
          <p className="rounded-2xl bg-folio p-4 text-ink">
            Ranges beat false precision. Use low / mid / high sale estimates and notice
            whether the conclusion still holds when numbers move.
          </p>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-line bg-panel p-5 shadow-[var(--shadow-soft)] md:p-7">
        <h2 className="font-display text-2xl font-semibold">What changes the answer?</h2>
        <p className="mt-2 text-ink-soft">
          Try nudging these on the previous pages and watch whether the lean stays stable.
        </p>
        <ul className="mt-4 grid gap-3 md:grid-cols-2">
          <li className="rounded-2xl bg-folio p-4">Sale price (low vs high estimate)</li>
          <li className="rounded-2xl bg-folio p-4">Moving costs and repairs before listing</li>
          <li className="rounded-2xl bg-folio p-4">Future maintenance and insurance on the current home</li>
          <li className="rounded-2xl bg-folio p-4">Rent or payment on the next place</li>
        </ul>
      </section>

      {canShowReadiness(app.scenario) ? (
        <ReadinessPanel result={readiness} />
      ) : (
        <section className="rounded-[1.75rem] border border-dashed border-line bg-folio/80 p-5">
          <p className="text-ink-soft">
            Add a few household answers and both keep/move monthly costs to unlock the
            personalized fit summary.
          </p>
        </section>
      )}
    </div>
  )
}

function Card({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[1.5rem] border border-line bg-panel p-5 shadow-[var(--shadow-soft)]">
      <p className="text-sm text-ink-soft">{title}</p>
      <p className="mt-2 text-lg font-bold text-ink">{body}</p>
    </div>
  )
}
