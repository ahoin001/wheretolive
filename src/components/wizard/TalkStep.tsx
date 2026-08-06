import type { AppController } from '../../hooks/useApp'
import { conversationStarters } from '../../domain/insights/questions'
import { Field, TextTextarea } from '../ui/Field'

export function TalkStep({ app }: { app: AppController }) {
  const scenario = app.scenario
  if (!scenario) return null

  return (
    <div className="space-y-6">
      <header className="rounded-[1.75rem] border border-line bg-panel p-6 shadow-[var(--shadow-soft)] md:p-8">
        <h1 className="font-display text-4xl font-semibold text-ink">
          Gentle conversation starters
        </h1>
        <p className="mt-3 max-w-3xl text-lg text-ink-soft">
          These are open doors, not arguments. Ask one, then listen longer than feels
          natural. The goal is understanding, not winning.
        </p>
      </header>

      <ol className="space-y-4">
        {conversationStarters.map((question, index) => (
          <li
            key={question}
            className="rounded-[1.5rem] border border-line bg-panel p-5 shadow-[var(--shadow-soft)] md:p-6"
          >
            <p className="text-sm font-bold text-sea-deep">Question {index + 1}</p>
            <p className="mt-2 font-display text-2xl font-semibold text-ink text-balance">
              {question}
            </p>
          </li>
        ))}
      </ol>

      <section className="rounded-[1.75rem] border border-line bg-panel p-5 shadow-[var(--shadow-soft)] md:p-7">
        <Field
          label="Notes from the conversation"
          hint="Optional. Saved only on this device."
        >
          <TextTextarea
            value={scenario.conversationNotes}
            onChange={(e) => app.patchScenario({ conversationNotes: e.target.value })}
            placeholder="What felt important… what still feels unclear… what to look up next…"
          />
        </Field>
      </section>
    </div>
  )
}
