import { useState } from 'react'
import type { AppController } from '../../hooks/useApp'
import {
  formatMoney,
  stayOtherMonthly,
  stayTaxesInsuranceMonthly,
  sumParts,
  stayMonthlyParts,
  withStayOtherMonthly,
  withStayTaxesInsurance,
} from '../../domain/finance/calculations'
import { CurrencyInput, Field, TextInput } from '../ui/Field'
import { Toggle } from '../ui/Toggle'
import { MoneyPicture } from './MoneyPicture'

export function StayStep({ app }: { app: AppController }) {
  const scenario = app.scenario
  const finance = app.finance
  const [advanced, setAdvanced] = useState(false)
  if (!scenario || !finance) return null

  const home = scenario.home
  const patchHome = (patch: Partial<typeof home>) => {
    app.patchScenario({ home: { ...home, ...patch } })
  }

  const stayTotal = sumParts(stayMonthlyParts(home))

  return (
    <div className="space-y-6">
      <header className="rounded-[1.75rem] border border-line bg-panel p-6 shadow-[var(--shadow-soft)] md:p-8">
        <p className="text-sm font-bold text-sea-deep">Step 1 of 3 · Your home</p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-[-0.02em] text-ink md:text-4xl">
          What does staying cost?
        </h1>
        <p className="mt-3 max-w-2xl text-lg text-ink-soft">
          A short snapshot of the home you own today — value, debt, and monthly load.
          Estimates are fine; you can refine later.
        </p>
      </header>

      <section className="rounded-[1.75rem] border border-line bg-panel p-5 shadow-[var(--shadow-soft)] md:p-7">
        <h2 className="font-display text-2xl font-semibold text-ink">Sale basics</h2>
        <p className="mt-1 text-ink-soft">What the house is worth and what you still owe.</p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Field label="Home value (your estimate)" hint="A mid range is fine">
            <CurrencyInput
              value={home.estimatedValueMid}
              onChange={(estimatedValueMid) =>
                patchHome({
                  estimatedValueMid,
                  estimatedValueLow: estimatedValueMid,
                  estimatedValueHigh: estimatedValueMid,
                })
              }
            />
          </Field>
          <Field label="Still owed on the loan">
            <CurrencyInput
              value={home.loanBalance}
              onChange={(loanBalance) => patchHome({ loanBalance })}
            />
          </Field>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-line bg-panel p-5 shadow-[var(--shadow-soft)] md:p-7">
        <h2 className="font-display text-2xl font-semibold text-ink">Monthly to stay</h2>
        <div className="mt-5 grid gap-4">
          <Field label="Mortgage payment / month">
            <CurrencyInput
              value={home.mortgagePayment}
              onChange={(mortgagePayment) => patchHome({ mortgagePayment })}
            />
          </Field>
          <Toggle
            label="That payment already includes tax and insurance (escrow)"
            hint="Turn off if you pay tax or insurance separately"
            checked={home.escrowIncluded}
            onChange={(escrowIncluded) => patchHome({ escrowIncluded })}
          />
          {!home.escrowIncluded ? (
            <Field label="Taxes & insurance / month" hint="Combined is fine">
              <CurrencyInput
                value={stayTaxesInsuranceMonthly(home)}
                onChange={(combined) =>
                  patchHome(withStayTaxesInsurance(home, combined))
                }
              />
            </Field>
          ) : null}
          <Field
            label="Other home costs / month"
            hint="HOA, utilities, repairs, etc."
          >
            <CurrencyInput
              value={stayOtherMonthly(home)}
              onChange={(other) => patchHome(withStayOtherMonthly(home, other))}
            />
          </Field>
        </div>

        <div className="mt-6 rounded-2xl bg-folio px-4 py-3">
          <p className="text-sm text-ink-soft">Stay monthly total</p>
          <p className="font-display text-3xl font-semibold tabular-nums text-keep">
            {formatMoney(stayTotal)}
            <span className="text-lg font-bold text-ink-soft">/mo</span>
          </p>
        </div>

        <button
          type="button"
          className="mt-4 text-sm font-bold text-sea-deep underline-offset-2 hover:underline"
          onClick={() => setAdvanced((v) => !v)}
        >
          {advanced ? 'Hide extra detail' : 'More detail (optional)'}
        </button>
        {advanced ? (
          <div className="mt-4 grid gap-4 border-t border-line pt-4 md:grid-cols-2">
            <Field label="Other debts on the home (HELOC, etc.)">
              <CurrencyInput
                value={home.accountFlag}
                onChange={(accountFlag) => patchHome({ accountFlag })}
              />
            </Field>
            <Field label="ZIP" hint="Optional — local context only">
              <TextInput
                value={home.zip}
                onChange={(e) => patchHome({ zip: e.target.value })}
                placeholder="33029"
              />
            </Field>
          </div>
        ) : null}
      </section>

      {stayTotal >= 100 ? (
        <MoneyPicture finance={finance} home={home} move={scenario.move} compact />
      ) : null}

      <p className="text-center text-sm text-ink-soft">
        Planning sketch only — not tax, legal, or real-estate advice.
      </p>
    </div>
  )
}
