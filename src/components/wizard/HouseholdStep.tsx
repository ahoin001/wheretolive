import type { AppController } from '../../hooks/useApp'
import type { OwnerProfile } from '../../domain/types'
import {
  ageOptions,
  attachmentOptions,
  incomeOptions,
  likelihoodOptions,
  maintenanceOptions,
  retirementOptions,
} from '../../domain/insights/questions'
import { ChoiceGroup } from '../ui/ChoiceGroup'
import { Button } from '../ui/Button'
import { Field, NumberInput, TextTextarea } from '../ui/Field'
import { canShowReadiness } from '../../domain/insights/readinessGate'
import { ReadinessPanel } from './ReadinessPanel'

export function HouseholdStep({ app }: { app: AppController }) {
  const scenario = app.scenario
  if (!scenario || !app.readiness) return null
  const h = scenario.household

  const updateOwner = (index: number, patch: Partial<OwnerProfile>) => {
    const owners = h.owners.map((owner, i) =>
      i === index ? { ...owner, ...patch } : owner,
    )
    app.patchScenario({ household: { ...h, owners } })
  }

  return (
    <div className="space-y-6">
      <header className="rounded-[1.75rem] border border-line bg-panel p-6 shadow-[var(--shadow-soft)] md:p-8">
        <h1 className="font-display text-4xl font-semibold text-ink">
          About your next chapter
        </h1>
        <p className="mt-3 max-w-3xl text-lg text-ink-soft">
          Answer what you can. Every question is optional, and “Not sure” is a perfectly
          good answer. These help us tailor the keep-versus-downsize fit — they are not
          a test.
        </p>
      </header>

      <section className="rounded-[1.75rem] border border-line bg-panel p-5 shadow-[var(--shadow-soft)] md:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-2xl font-semibold">Who lives this decision</h2>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() =>
                app.patchScenario({
                  household: {
                    ...h,
                    owners: [
                      ...h.owners,
                      {
                        label: `Owner ${h.owners.length + 1}`,
                        ageRange: 'not_sure',
                        retirementPlan: 'not_sure',
                        incomeDirection: 'not_sure',
                      },
                    ],
                  },
                })
              }
            >
              Add person
            </Button>
            {h.owners.length > 1 ? (
              <Button
                variant="ghost"
                onClick={() =>
                  app.patchScenario({
                    household: { ...h, owners: h.owners.slice(0, -1) },
                  })
                }
              >
                Remove last
              </Button>
            ) : null}
          </div>
        </div>

        <div className="mt-6 space-y-8">
          {h.owners.map((owner, index) => (
            <div key={`${owner.label}-${index}`} className="rounded-2xl bg-folio p-4 md:p-5">
              <Field label="Name or label">
                <input
                  className="min-h-12 w-full rounded-2xl border border-line bg-panel px-4"
                  value={owner.label}
                  onChange={(e) => updateOwner(index, { label: e.target.value })}
                />
              </Field>
              <div className="mt-4 grid gap-5">
                <ChoiceGroup
                  legend="Age range"
                  options={ageOptions}
                  value={owner.ageRange}
                  onChange={(ageRange) => updateOwner(index, { ageRange })}
                  columns={3}
                />
                <ChoiceGroup
                  legend="Retirement timing"
                  options={retirementOptions}
                  value={owner.retirementPlan}
                  onChange={(retirementPlan) => updateOwner(index, { retirementPlan })}
                />
                <ChoiceGroup
                  legend="Expected income direction"
                  options={incomeOptions}
                  value={owner.incomeDirection}
                  onChange={(incomeDirection) => updateOwner(index, { incomeDirection })}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 rounded-[1.75rem] border border-line bg-panel p-5 shadow-[var(--shadow-soft)] md:grid-cols-2 md:p-7">
        <Field label="People living here now" hint="Count everyone currently in the home.">
          <NumberInput
            value={h.peopleNow}
            onChange={(peopleNow) =>
              app.patchScenario({ household: { ...h, peopleNow } })
            }
            min={1}
          />
        </Field>
        <Field
          label="People expected soon"
          hint="For example after an adult child moves out."
        >
          <NumberInput
            value={h.peopleSoon}
            onChange={(peopleSoon) =>
              app.patchScenario({ household: { ...h, peopleSoon } })
            }
            min={1}
          />
        </Field>
        <ChoiceGroup
          legend="Might you need to house family again later?"
          options={likelihoodOptions}
          value={h.mayHostAgain}
          onChange={(mayHostAgain) =>
            app.patchScenario({ household: { ...h, mayHostAgain } })
          }
        />
        <ChoiceGroup
          legend="Any accessibility needs to plan for?"
          options={likelihoodOptions}
          value={h.accessibilityNeeds}
          onChange={(accessibilityNeeds) =>
            app.patchScenario({ household: { ...h, accessibilityNeeds } })
          }
        />
        <ChoiceGroup
          legend="How does home upkeep feel lately?"
          options={maintenanceOptions}
          value={h.maintenanceFeel}
          onChange={(maintenanceFeel) =>
            app.patchScenario({ household: { ...h, maintenanceFeel } })
          }
        />
        <ChoiceGroup
          legend="Is helpful support nearby?"
          options={likelihoodOptions}
          value={h.supportNearby}
          onChange={(supportNearby) =>
            app.patchScenario({ household: { ...h, supportNearby } })
          }
        />
        <div className="md:col-span-2">
          <ChoiceGroup
            legend="How attached do you feel to this home?"
            options={attachmentOptions}
            value={h.attachment}
            onChange={(attachment) =>
              app.patchScenario({ household: { ...h, attachment } })
            }
          />
        </div>
        <div className="md:col-span-2">
          <Field label="Anything else that matters" hint="Optional notes for yourselves.">
            <TextTextarea
              value={h.notes}
              onChange={(e) =>
                app.patchScenario({ household: { ...h, notes: e.target.value } })
              }
              placeholder="Neighbors, memories, health, commute, pets…"
            />
          </Field>
        </div>
      </section>

      {canShowReadiness(scenario) ? (
        <ReadinessPanel result={app.readiness} />
      ) : (
        <section className="rounded-[1.75rem] border border-dashed border-line bg-folio/80 p-5 md:p-6">
          <h2 className="font-display text-2xl font-semibold text-ink">
            Fit summary comes after a few basics
          </h2>
          <p className="mt-2 max-w-2xl text-ink-soft">
            We’ll show a personalized keep-or-downsize fit once you’ve answered a bit about
            this chapter of life <strong>and</strong> entered stay-and-move housing costs
            on the next steps. That way the summary never feels like it’s guessing.
          </p>
        </section>
      )}
    </div>
  )
}
