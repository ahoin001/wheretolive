import { CheckCircle2 } from 'lucide-react'
import type { AppController } from '../../hooks/useApp'
import { Button } from '../ui/Button'

const STEPS = [
  {
    title: 'Name what “lighter” means',
    body: 'Less monthly cost, less yard work, closer to family, fewer stairs — write the top three.',
  },
  {
    title: 'Get a grounded sale picture',
    body: 'Ask a trusted local agent for comps. Compare that with your low / mid / high estimates here.',
  },
  {
    title: 'Tour without deciding',
    body: 'Visit a few townhomes or apartments that match the budget. Notice what feels like an upgrade.',
  },
  {
    title: 'Test the monthly life',
    body: 'Live on the target move budget for one or two months on paper (or in practice) before listing.',
  },
  {
    title: 'Talk with the right helpers',
    body: 'A fiduciary planner, tax pro, and real-estate agent can answer different pieces — no one person owns the whole decision.',
  },
  {
    title: 'Prepare the home gently',
    body: 'Small repairs and decluttering can help — and also make daily life easier even if you stay.',
  },
  {
    title: 'Choose timing that respects energy',
    body: 'You can decide the direction now and the calendar later. Readiness is allowed to be gradual.',
  },
]

export function EasierStep({ app }: { app: AppController }) {
  return (
    <div className="space-y-6">
      <header className="rounded-[1.75rem] border border-line bg-panel p-6 shadow-[var(--shadow-soft)] md:p-8">
        <h1 className="font-display text-4xl font-semibold text-ink">
          Ways to make life easier
        </h1>
        <p className="mt-3 max-w-3xl text-lg text-ink-soft">
          If a move is on the table, treat it like buying back freedom — not like losing a house.
          If staying is right, these steps still help you stay with clearer eyes.
        </p>
      </header>

      <ol className="space-y-3">
        {STEPS.map((step, index) => (
          <li
            key={step.title}
            className="flex gap-4 rounded-[1.5rem] border border-line bg-panel p-5 shadow-[var(--shadow-soft)]"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sea text-lg font-bold text-white">
              {index + 1}
            </div>
            <div>
              <h2 className="font-display text-2xl font-semibold text-ink">{step.title}</h2>
              <p className="mt-2 text-ink-soft">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <section className="rounded-[1.75rem] border border-line bg-honey-soft/50 p-6">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-1 h-6 w-6 text-honey" />
          <div>
            <h2 className="font-display text-2xl font-semibold text-ink">
              Ready to collect real options?
            </h2>
            <p className="mt-2 text-ink-soft">
              Use the Places board to save links from Zillow, Realtor, Facebook Marketplace,
              or anywhere else — with notes, favorites, and a simple tier list.
            </p>
            <Button className="mt-4" variant="honey" onClick={() => app.setMode('places')}>
              Open Places
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
