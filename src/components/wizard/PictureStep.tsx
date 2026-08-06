import type { AppController } from '../../hooks/useApp'
import type { Attachment, Likelihood, MaintenanceFeel } from '../../domain/types'
import { formatMoney } from '../../domain/finance/calculations'
import { canShowReadiness } from '../../domain/insights/readinessGate'
import { Button } from '../ui/Button'
import { ChoiceGroup } from '../ui/ChoiceGroup'
import { Field, NumberInput, TextTextarea } from '../ui/Field'
import { MoneyPicture } from './MoneyPicture'
import { ReadinessPanel } from './ReadinessPanel'

const UPKEEP: { value: MaintenanceFeel; label: string }[] = [
  { value: 'manageable', label: 'Manageable' },
  { value: 'sometimes_heavy', label: 'Sometimes heavy' },
  { value: 'often_heavy', label: 'Often heavy' },
]

const ATTACH: { value: Attachment; label: string }[] = [
  { value: 'ready_for_change', label: 'Ready for change' },
  { value: 'mixed', label: 'Mixed feelings' },
  { value: 'somewhat_attached', label: 'Still attached' },
]

const NEST: { value: Likelihood; label: string }[] = [
  { value: 'yes', label: 'Emptying soon' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'no', label: 'Still full' },
]

export function PictureStep({ app }: { app: AppController }) {
  const scenario = app.scenario
  const finance = app.finance
  if (!scenario || !finance) return null

  const h = scenario.household
  const patchHousehold = (patch: Partial<typeof h>) => {
    app.patchScenario({ household: { ...h, ...patch } })
  }

  const nestValue: Likelihood =
    h.peopleSoon < h.peopleNow
      ? 'yes'
      : h.peopleSoon > h.peopleNow
        ? 'no'
        : h.mayHostAgain === 'yes' || h.mayHostAgain === 'maybe' || h.mayHostAgain === 'no'
          ? h.mayHostAgain
          : 'not_sure'

  const plainEnglish = (() => {
    const parts: string[] = []
    if (finance.monthlyDelta > 50) {
      parts.push(
        `At these numbers, renting looks about ${formatMoney(finance.monthlyDelta)} lighter each month than staying.`,
      )
    } else if (finance.monthlyDelta < -50) {
      parts.push(
        `At these numbers, staying looks about ${formatMoney(Math.abs(finance.monthlyDelta))} lighter each month than renting.`,
      )
    } else {
      parts.push('Monthly costs look similar either way with your current inputs.')
    }
    if (scenario.home.estimatedValueMid > 0) {
      parts.push(
        `A mid-value sale could leave roughly ${formatMoney(finance.cashAfterMoveMid)} free after loan payoff, selling costs, and move-in cash.`,
      )
    }
    parts.push(
      'Money is only part of the story — how the house feels day to day matters too.',
    )
    return parts.join(' ')
  })()

  return (
    <div className="space-y-6">
      <header className="rounded-[1.75rem] border border-line bg-panel p-6 shadow-[var(--shadow-soft)] md:p-8">
        <p className="text-sm font-bold text-sea-deep">Step 3 of 3 · Your picture</p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-[-0.02em] text-ink md:text-4xl">
          Is it worth staying?
        </h1>
        <p className="mt-3 max-w-3xl text-lg leading-relaxed text-ink-soft">
          {plainEnglish}
        </p>
        <p className="mt-3 text-sm text-ink-soft">
          Planning sketch only — not financial, tax, or legal advice.
        </p>
      </header>

      <MoneyPicture finance={finance} home={scenario.home} move={scenario.move} />

      <section className="rounded-[1.75rem] border border-line bg-panel p-5 shadow-[var(--shadow-soft)] md:p-7">
        <h2 className="font-display text-2xl font-semibold text-ink">
          How the house feels
        </h2>
        <p className="mt-1 text-ink-soft">
          Optional — three quick notes to put the numbers in real life. Skip any.
        </p>
        <div className="mt-5 space-y-5">
          <ChoiceGroup
            legend="Upkeep right now?"
            options={UPKEEP}
            value={
              UPKEEP.some((o) => o.value === h.maintenanceFeel)
                ? h.maintenanceFeel
                : 'manageable'
            }
            onChange={(maintenanceFeel) => patchHousehold({ maintenanceFeel })}
            columns={3}
            size="compact"
          />
          <ChoiceGroup
            legend="How attached is the household to this home?"
            options={ATTACH}
            value={
              ATTACH.some((o) => o.value === h.attachment)
                ? h.attachment
                : 'mixed'
            }
            onChange={(attachment) => patchHousehold({ attachment })}
            columns={3}
            size="compact"
          />
          <ChoiceGroup
            legend="Household size over the next few years?"
            options={NEST}
            value={NEST.some((o) => o.value === nestValue) ? nestValue : 'maybe'}
            onChange={(v) => {
              if (v === 'yes') {
                patchHousehold({
                  mayHostAgain: 'no',
                  peopleSoon: Math.max(1, Math.min(h.peopleNow, h.peopleSoon || h.peopleNow - 1)),
                })
              } else if (v === 'no') {
                patchHousehold({
                  mayHostAgain: 'yes',
                  peopleSoon: Math.max(h.peopleNow, h.peopleSoon || h.peopleNow),
                })
              } else {
                patchHousehold({ mayHostAgain: 'maybe', peopleSoon: h.peopleNow })
              }
            }}
            columns={3}
            size="compact"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="People there now">
              <NumberInput
                value={h.peopleNow}
                onChange={(peopleNow) =>
                  patchHousehold({ peopleNow: Math.max(0, peopleNow) })
                }
              />
            </Field>
            <Field label="People in a few years">
              <NumberInput
                value={h.peopleSoon}
                onChange={(peopleSoon) =>
                  patchHousehold({ peopleSoon: Math.max(0, peopleSoon) })
                }
              />
            </Field>
          </div>
        </div>
      </section>

      {canShowReadiness(scenario) && app.readiness ? (
        <ReadinessPanel result={app.readiness} />
      ) : null}

      <section className="rounded-[1.75rem] border border-line bg-panel p-5 shadow-[var(--shadow-soft)] md:p-7">
        <h2 className="font-display text-2xl font-semibold text-ink">What next</h2>
        <p className="mt-2 text-ink-soft">
          Save listings you’re curious about, and note questions for an agent or
          family conversation.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button variant="honey" onClick={() => app.setMode('places')}>
            Save places you’re considering
          </Button>
          <Button variant="secondary" onClick={() => app.goToStep('stay')}>
            Adjust stay numbers
          </Button>
          <Button variant="secondary" onClick={() => app.goToStep('move')}>
            Adjust rent numbers
          </Button>
        </div>
        <div className="mt-5">
          <Field label="Notes for the conversation" hint="Optional">
            <TextTextarea
              value={scenario.conversationNotes}
              onChange={(e) =>
                app.patchScenario({ conversationNotes: e.target.value })
              }
              placeholder="Questions for an agent, partner, or family…"
            />
          </Field>
        </div>
      </section>
    </div>
  )
}
