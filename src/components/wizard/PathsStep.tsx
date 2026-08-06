import type { AppController } from '../../hooks/useApp'
import { formatMoney } from '../../domain/finance/calculations'
import { ChoiceGroup } from '../ui/ChoiceGroup'
import { CurrencyInput, Field, NumberInput, TextInput } from '../ui/Field'
import { BreathingRoom } from './BreathingRoom'

export function PathsStep({ app }: { app: AppController }) {
  const scenario = app.scenario
  const finance = app.finance
  if (!scenario || !finance) return null
  const move = scenario.move

  const patchMove = (patch: Partial<typeof move>) => {
    app.patchScenario({ move: { ...move, ...patch } })
  }

  return (
    <div className="space-y-6">
      <header className="rounded-[1.75rem] border border-line bg-panel p-6 shadow-[var(--shadow-soft)] md:p-8">
        <h1 className="font-display text-4xl font-semibold text-ink">The two paths</h1>
        <p className="mt-3 max-w-3xl text-lg text-ink-soft">
          Neither path is “good” or “bad.” One may simply fit this season of life better.
          Edit the move-side budget to see the money story change live.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-[1.75rem] border border-keep/30 bg-[#f7fafc] p-5 shadow-[var(--shadow-soft)] md:p-6">
          <p className="font-bold text-keep">Option A</p>
          <h2 className="mt-1 font-display text-3xl font-semibold text-ink">Keep the house</h2>
          <p className="mt-3 text-ink-soft">
            Stay put, keep the known space, and continue the current monthly load.
          </p>
          <ul className="mt-5 space-y-3">
            <ProCon
              kind="pro"
              text={`The ${scenario.home.interestRate}% rate is a genuine advantage in today’s market.`}
            />
            <ProCon kind="pro" text="Familiar neighborhood, rooms for hosting, and no moving upheaval." />
            <ProCon
              kind="con"
              text={`Monthly housing-related costs look near ${formatMoney(finance.stayMonthly)} with current inputs.`}
            />
            <ProCon
              kind="con"
              text="A larger home still needs repairs, insurance attention, and day-to-day upkeep — even with fewer people living there."
            />
            {scenario.home.accountFlag > 0 ? (
              <ProCon
                kind="con"
                text={`There is about ${formatMoney(scenario.home.accountFlag)} in flagged fees/advances to understand and clear.`}
              />
            ) : null}
          </ul>
        </article>

        <article className="rounded-[1.75rem] border border-move/30 bg-[#f8faf5] p-5 shadow-[var(--shadow-soft)] md:p-6">
          <p className="font-bold text-move">Option B</p>
          <h2 className="mt-1 font-display text-3xl font-semibold text-ink">
            Cash out & simplify
          </h2>
          <p className="mt-3 text-ink-soft">
            Sell, unlock equity built since the loan began, and choose a lower-cost home
            that matches today’s household.
          </p>
          <ul className="mt-5 space-y-3">
            <ProCon
              kind="pro"
              text={`Mid-estimate net proceeds look near ${formatMoney(finance.netProceedsMid)} before move-in costs.`}
            />
            <ProCon
              kind="pro"
              text={`Target move budget is about ${formatMoney(finance.moveMonthly)}/month — ${formatMoney(Math.abs(finance.monthlyDelta))} ${finance.monthlyDelta >= 0 ? 'lighter' : 'different'} than staying.`}
            />
            <ProCon kind="pro" text="Less house to clean, insure, tax, and repair can buy back time and calm." />
            <ProCon kind="con" text="Moving is work. Saying goodbye to a long-time home can be emotional." />
            <ProCon kind="con" text="You give up the current rate and the option value of the larger layout." />
          </ul>
        </article>
      </div>

      <section className="rounded-[1.75rem] border border-line bg-panel p-5 shadow-[var(--shadow-soft)] md:p-7">
        <h2 className="font-display text-2xl font-semibold">Paint the simpler home</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Field label="Nickname for the next place">
            <TextInput value={move.label} onChange={(e) => patchMove({ label: e.target.value })} />
          </Field>
          <ChoiceGroup
            legend="Rent or buy next?"
            options={[
              { value: 'rent', label: 'Rent' },
              { value: 'buy', label: 'Buy' },
            ]}
            value={move.mode}
            onChange={(mode) => patchMove({ mode })}
            columns={2}
          />
          <Field label="Monthly housing cost (rent or new payment)">
            <CurrencyInput
              value={move.monthlyHousing}
              onChange={(monthlyHousing) => patchMove({ monthlyHousing })}
            />
          </Field>
          <Field label="HOA / month">
            <CurrencyInput value={move.hoaMonthly} onChange={(hoaMonthly) => patchMove({ hoaMonthly })} />
          </Field>
          <Field label="Insurance / month">
            <CurrencyInput
              value={move.insuranceMonthly}
              onChange={(insuranceMonthly) => patchMove({ insuranceMonthly })}
            />
          </Field>
          <Field label="Property tax / month">
            <CurrencyInput value={move.taxMonthly} onChange={(taxMonthly) => patchMove({ taxMonthly })} />
          </Field>
          <Field label="Utilities / month">
            <CurrencyInput
              value={move.utilitiesMonthly}
              onChange={(utilitiesMonthly) => patchMove({ utilitiesMonthly })}
            />
          </Field>
          <Field label="Repairs & upkeep / month">
            <CurrencyInput
              value={move.maintenanceMonthly}
              onChange={(maintenanceMonthly) => patchMove({ maintenanceMonthly })}
            />
          </Field>
          <Field label="Other monthly">
            <CurrencyInput value={move.miscMonthly} onChange={(miscMonthly) => patchMove({ miscMonthly })} />
          </Field>
          <Field label={move.mode === 'rent' ? 'Deposit' : 'Down payment'}>
            <CurrencyInput
              value={move.depositOrDown}
              onChange={(depositOrDown) => patchMove({ depositOrDown })}
            />
          </Field>
          <Field label="Closing / move-in fees">
            <CurrencyInput
              value={move.closingCosts}
              onChange={(closingCosts) => patchMove({ closingCosts })}
            />
          </Field>
          <Field label="Moving costs">
            <CurrencyInput
              value={move.movingCosts}
              onChange={(movingCosts) => patchMove({ movingCosts })}
            />
          </Field>
          <Field label="Seller costs (% of sale price)" hint="Often around 6–8% all-in, depending on market.">
            <NumberInput
              value={move.sellerCostsPercent}
              onChange={(sellerCostsPercent) => patchMove({ sellerCostsPercent })}
              step={0.1}
            />
          </Field>
          <Field label="Repairs before selling">
            <CurrencyInput
              value={move.repairsBeforeSale}
              onChange={(repairsBeforeSale) => patchMove({ repairsBeforeSale })}
            />
          </Field>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <MiniStat label="Equity at mid estimate" value={formatMoney(finance.equityMid)} />
          <MiniStat label="Net after selling costs" value={formatMoney(finance.netProceedsMid)} />
          <MiniStat label="Cash after relocating" value={formatMoney(finance.cashAfterMoveMid)} />
        </div>
      </section>

      <BreathingRoom finance={finance} />
    </div>
  )
}

function ProCon({ kind, text }: { kind: 'pro' | 'con'; text: string }) {
  return (
    <li className="rounded-2xl bg-panel/80 px-4 py-3 text-ink">
      <span className="font-bold">{kind === 'pro' ? 'Helpful: ' : 'Worth weighing: '}</span>
      {text}
    </li>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-folio p-4">
      <p className="text-sm text-ink-soft">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold text-ink">{value}</p>
    </div>
  )
}
