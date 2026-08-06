import { useState } from 'react'
import type { AppController } from '../../hooks/useApp'
import {
  formatMoney,
  moveOtherMonthly,
  sumParts,
  moveMonthlyParts,
  withMoveOtherMonthly,
} from '../../domain/finance/calculations'
import { CurrencyInput, Field, NumberInput } from '../ui/Field'
import { MoneyPicture } from './MoneyPicture'

export function MoveStep({ app }: { app: AppController }) {
  const scenario = app.scenario
  const finance = app.finance
  const [advanced, setAdvanced] = useState(false)
  if (!scenario || !finance) return null

  const move = scenario.move
  const patchMove = (patch: Partial<typeof move>) => {
    app.patchScenario({
      move: {
        ...move,
        mode: 'rent',
        label: move.label || 'A simpler rental',
        ...patch,
      },
    })
  }

  const moveTotal = sumParts(moveMonthlyParts(move))

  return (
    <div className="space-y-6">
      <header className="rounded-[1.75rem] border border-line bg-panel p-6 shadow-[var(--shadow-soft)] md:p-8">
        <p className="text-sm font-bold text-sea-deep">Step 2 of 3 · If you move</p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-[-0.02em] text-ink md:text-4xl">
          What could renting cost?
        </h1>
        <p className="mt-3 max-w-2xl text-lg text-ink-soft">
          Paint a simple rental picture — the common path when selling a larger home.
          Use a real listing or a range you’re curious about.
        </p>
      </header>

      <section className="rounded-[1.75rem] border border-line bg-panel p-5 shadow-[var(--shadow-soft)] md:p-7">
        <h2 className="font-display text-2xl font-semibold text-ink">Monthly to rent</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Field label="Expected rent / month">
            <CurrencyInput
              value={move.monthlyHousing}
              onChange={(monthlyHousing) => patchMove({ monthlyHousing })}
            />
          </Field>
          <Field
            label="Other housing costs / month"
            hint="Utilities, renter insurance, parking…"
          >
            <CurrencyInput
              value={moveOtherMonthly(move)}
              onChange={(other) =>
                patchMove(withMoveOtherMonthly(move, other))
              }
            />
          </Field>
        </div>
        <div className="mt-6 rounded-2xl bg-folio px-4 py-3">
          <p className="text-sm text-ink-soft">Rent path monthly total</p>
          <p className="font-display text-3xl font-semibold tabular-nums text-move">
            {formatMoney(moveTotal)}
            <span className="text-lg font-bold text-ink-soft">/mo</span>
          </p>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-line bg-panel p-5 shadow-[var(--shadow-soft)] md:p-7">
        <h2 className="font-display text-2xl font-semibold text-ink">One-time costs</h2>
        <p className="mt-1 text-ink-soft">
          Cash you need when you leave — on top of (or after) selling proceeds.
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Field label="Security deposit" hint="Often 1–2 months of rent">
            <CurrencyInput
              value={move.depositOrDown}
              onChange={(depositOrDown) => patchMove({ depositOrDown })}
            />
          </Field>
          <Field label="Cost to move">
            <CurrencyInput
              value={move.movingCosts}
              onChange={(movingCosts) => patchMove({ movingCosts })}
            />
          </Field>
        </div>

        <button
          type="button"
          className="mt-4 text-sm font-bold text-sea-deep underline-offset-2 hover:underline"
          onClick={() => setAdvanced((v) => !v)}
        >
          {advanced ? 'Hide selling assumptions' : 'Selling assumptions (optional)'}
        </button>
        {advanced ? (
          <div className="mt-4 grid gap-4 border-t border-line pt-4 md:grid-cols-3">
            <Field label="Seller costs %" hint="Agents + fees; often ~5–7%">
              <NumberInput
                value={move.sellerCostsPercent}
                onChange={(sellerCostsPercent) => patchMove({ sellerCostsPercent })}
              />
            </Field>
            <Field label="Fix-up before sale">
              <CurrencyInput
                value={move.repairsBeforeSale}
                onChange={(repairsBeforeSale) => patchMove({ repairsBeforeSale })}
              />
            </Field>
            <Field label="Other closing costs">
              <CurrencyInput
                value={move.closingCosts}
                onChange={(closingCosts) => patchMove({ closingCosts })}
              />
            </Field>
          </div>
        ) : null}

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-folio px-4 py-3">
            <p className="text-sm text-ink-soft">Cash free after a mid-value sale</p>
            <p className="font-display text-2xl font-semibold tabular-nums text-sea-deep">
              {formatMoney(finance.cashAfterMoveMid)}
            </p>
          </div>
          <div className="rounded-2xl bg-folio px-4 py-3">
            <p className="text-sm text-ink-soft">Monthly difference (stay − rent)</p>
            <p className="font-display text-2xl font-semibold tabular-nums text-honey">
              {finance.monthlyDelta >= 0 ? '+' : ''}
              {formatMoney(finance.monthlyDelta)}
            </p>
          </div>
        </div>
      </section>

      {moveTotal >= 100 || finance.stayMonthly >= 100 ? (
        <MoneyPicture
          finance={finance}
          home={scenario.home}
          move={move}
          compact
        />
      ) : null}
    </div>
  )
}
