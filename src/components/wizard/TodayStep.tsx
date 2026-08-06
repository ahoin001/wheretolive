import type { AppController } from '../../hooks/useApp'
import { formatMoney, formatMoneyExact, yearsRemaining } from '../../domain/finance/calculations'
import { CurrencyInput, Field, NumberInput, TextInput } from '../ui/Field'
import { Toggle } from '../ui/Toggle'
import { BreathingRoom } from './BreathingRoom'
import { MarketPulseCard } from './MarketPulseCard'

export function TodayStep({ app }: { app: AppController }) {
  const scenario = app.scenario
  const finance = app.finance
  if (!scenario || !finance) return null
  const home = scenario.home
  const years = yearsRemaining(home.maturity)

  const patchHome = (patch: Partial<typeof home>) => {
    app.patchScenario({ home: { ...home, ...patch } })
  }

  return (
    <div className="space-y-6">
      <header className="rounded-[1.75rem] border border-line bg-panel p-6 shadow-[var(--shadow-soft)] md:p-8">
        <h1 className="font-display text-4xl font-semibold text-ink">
          Where we are today
        </h1>
        <p className="mt-3 max-w-3xl text-lg text-ink-soft">
          A clear snapshot of the home’s financial load and how the household is
          changing. Edit any number — the charts update as you go.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <Fact
          title="The home"
          body={`${home.bedrooms || '—'} bed · ${home.bathrooms || '—'} bath${home.hasYard ? ' · yard' : ''}`}
        />
        <Fact
          title="Household shift"
          body={`${scenario.household.peopleNow} people now → ${scenario.household.peopleSoon} soon`}
        />
        <Fact
          title="Loan runway"
          body={
            years != null
              ? `About ${years} years left · ${home.interestRate}% rate`
              : `${home.interestRate}% rate`
          }
        />
      </section>

      <section className="rounded-[1.75rem] border border-line bg-panel p-5 shadow-[var(--shadow-soft)] md:p-7">
        <h2 className="font-display text-2xl font-semibold">Home details</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Field label="Street address">
            <TextInput
              value={home.address}
              onChange={(e) => patchHome({ address: e.target.value })}
            />
          </Field>
          <Field label="City">
            <TextInput value={home.city} onChange={(e) => patchHome({ city: e.target.value })} />
          </Field>
          <Field label="State">
            <TextInput value={home.state} onChange={(e) => patchHome({ state: e.target.value })} />
          </Field>
          <Field label="ZIP">
            <TextInput value={home.zip} onChange={(e) => patchHome({ zip: e.target.value })} />
          </Field>
          <Field label="Bedrooms">
            <NumberInput value={home.bedrooms} onChange={(bedrooms) => patchHome({ bedrooms })} />
          </Field>
          <Field label="Bathrooms">
            <NumberInput value={home.bathrooms} onChange={(bathrooms) => patchHome({ bathrooms })} />
          </Field>
        </div>
        <div className="mt-4">
          <Toggle
            label="This home has a yard / outdoor upkeep"
            checked={home.hasYard}
            onChange={(hasYard) => patchHome({ hasYard })}
          />
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-line bg-panel p-5 shadow-[var(--shadow-soft)] md:p-7">
        <h2 className="font-display text-2xl font-semibold">Loan & monthly costs</h2>
        <p className="mt-2 text-ink-soft">
          Tip: if your mortgage payment already includes escrow for tax and insurance,
          turn that on so we do not count those twice.
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Field label="Remaining loan balance">
            <CurrencyInput
              value={home.loanBalance}
              onChange={(loanBalance) => patchHome({ loanBalance })}
            />
          </Field>
          <Field label="Interest rate (%)">
            <NumberInput
              value={home.interestRate}
              onChange={(interestRate) => patchHome({ interestRate })}
              step={0.01}
            />
          </Field>
          <Field label="Loan originated (YYYY-MM)">
            <TextInput
              value={home.originated.slice(0, 7)}
              onChange={(e) => patchHome({ originated: `${e.target.value}-01` })}
            />
          </Field>
          <Field label="Maturity (YYYY-MM)">
            <TextInput
              value={home.maturity.slice(0, 7)}
              onChange={(e) => patchHome({ maturity: `${e.target.value}-01` })}
            />
          </Field>
          <Field
            label="Flagged fees / advances / deferred interest"
            hint={`Example default: ${formatMoneyExact(2501.48)}`}
          >
            <CurrencyInput
              value={home.accountFlag}
              onChange={(accountFlag) => patchHome({ accountFlag })}
            />
          </Field>
          <Field
            label="Monthly loan payment"
            hint="What you send the lender each month for the loan itself (or the full bill if taxes/insurance are bundled)."
          >
            <CurrencyInput
              value={home.mortgagePayment}
              onChange={(mortgagePayment) => patchHome({ mortgagePayment })}
            />
          </Field>
        </div>
        <div className="mt-4">
          <Toggle
            label="Taxes and insurance are already inside that loan payment"
            checked={home.escrowIncluded}
            onChange={(escrowIncluded) => patchHome({ escrowIncluded })}
            hint={
              home.escrowIncluded
                ? 'We’ll treat the loan payment as all-in for loan + tax + insurance, so the tax and insurance boxes below stay out of the total.'
                : 'Default and usually clearest: enter loan, property tax, and insurance as separate lines so nothing is hidden.'
            }
          />
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Field
            label="Property tax / month"
            hint={
              home.escrowIncluded
                ? 'Not added (already in loan payment).'
                : 'About yearly taxes ÷ 12. Example seed uses ~$1,250/mo ($15k/year).'
            }
          >
            <CurrencyInput
              value={home.propertyTaxMonthly}
              onChange={(propertyTaxMonthly) => patchHome({ propertyTaxMonthly })}
              disabled={home.escrowIncluded}
              className={home.escrowIncluded ? 'opacity-50' : undefined}
            />
          </Field>
          <Field
            label="Home insurance / month"
            hint={
              home.escrowIncluded
                ? 'Not added (already in loan payment).'
                : 'Your premium ÷ 12 if you pay yearly.'
            }
          >
            <CurrencyInput
              value={home.insuranceMonthly}
              onChange={(insuranceMonthly) => patchHome({ insuranceMonthly })}
              disabled={home.escrowIncluded}
              className={home.escrowIncluded ? 'opacity-50' : undefined}
            />
          </Field>
          <Field label="HOA / month">
            <CurrencyInput value={home.hoaMonthly} onChange={(hoaMonthly) => patchHome({ hoaMonthly })} />
          </Field>
          <Field label="Utilities / month">
            <CurrencyInput
              value={home.utilitiesMonthly}
              onChange={(utilitiesMonthly) => patchHome({ utilitiesMonthly })}
            />
          </Field>
          <Field label="Repairs & upkeep / month" hint="A realistic average, not a perfect month.">
            <CurrencyInput
              value={home.maintenanceMonthly}
              onChange={(maintenanceMonthly) => patchHome({ maintenanceMonthly })}
            />
          </Field>
          <Field label="Other house odds & ends / month">
            <CurrencyInput value={home.miscMonthly} onChange={(miscMonthly) => patchHome({ miscMonthly })} />
          </Field>
        </div>

        <div className="mt-6 rounded-2xl bg-folio p-4">
          <p className="text-sm text-ink-soft">Estimated stay total</p>
          <p className="font-display text-3xl font-semibold text-keep">
            {formatMoney(finance.stayMonthly)}
            <span className="text-lg text-ink-soft"> / month</span>
          </p>
          <p className="mt-1 text-ink-soft">
            About {formatMoney(finance.stayAnnual)} per year with current inputs.
          </p>
          <ul className="mt-3 grid gap-1 sm:grid-cols-2">
            {Object.entries(finance.stayParts).map(([label, amount]) =>
              amount > 0 ? (
                <li key={label} className="flex justify-between gap-3 text-sm text-ink">
                  <span>{label}</span>
                  <span className="font-bold">{formatMoney(amount)}</span>
                </li>
              ) : null,
            )}
          </ul>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-line bg-panel p-5 shadow-[var(--shadow-soft)] md:p-7">
        <h2 className="font-display text-2xl font-semibold">What the home might sell for</h2>
        <p className="mt-2 text-ink-soft">
          Use a range. Online estimates often disagree — keep low, mid, and high.
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <Field label="Low estimate">
            <CurrencyInput
              value={home.estimatedValueLow}
              onChange={(estimatedValueLow) => patchHome({ estimatedValueLow })}
            />
          </Field>
          <Field label="Mid estimate">
            <CurrencyInput
              value={home.estimatedValueMid}
              onChange={(estimatedValueMid) => patchHome({ estimatedValueMid })}
            />
          </Field>
          <Field label="High estimate">
            <CurrencyInput
              value={home.estimatedValueHigh}
              onChange={(estimatedValueHigh) => patchHome({ estimatedValueHigh })}
            />
          </Field>
        </div>
      </section>

      <BreathingRoom finance={finance} />
      <MarketPulseCard home={home} />
    </div>
  )
}

function Fact({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[1.5rem] border border-line bg-panel p-5 shadow-[var(--shadow-soft)]">
      <p className="text-sm text-ink-soft">{title}</p>
      <p className="mt-2 font-display text-2xl font-semibold text-ink">{body}</p>
    </div>
  )
}
