import type { AppController } from '../../hooks/useApp'
import { Button } from '../ui/Button'

const TITLES = [
  'Room for the Next Chapter',
  'Home, Money & Peace of Mind',
  'What Would Make Life Lighter?',
]

export function WelcomeStep({ app }: { app: AppController }) {
  return (
    <section className="overflow-hidden rounded-[2rem] border border-line bg-panel shadow-[var(--shadow-lift)]">
      <div className="grid lg:grid-cols-[1.2fr_0.8fr]">
        <div className="p-6 md:p-10">
          <p className="font-display text-4xl font-semibold tracking-[-0.03em] text-ink md:text-5xl text-balance">
            {TITLES[0]}
          </p>
          <p className="mt-4 max-w-2xl text-xl leading-relaxed text-ink-soft">
            A gentle place to look at keeping a home or choosing something simpler —
            with your numbers, your season of life, and no pressure to decide today.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button variant="honey" onClick={app.startExample}>
              Start with Miramar example
            </Button>
            <Button variant="secondary" onClick={app.startFresh}>
              Start fresh with our numbers
            </Button>
          </div>

          <ul className="mt-8 space-y-3 text-ink-soft">
            <li>Private on this device — nothing is uploaded unless you add cloud sync later.</li>
            <li>Plain English, large controls, jump to any step anytime.</li>
            <li>Also includes a Places board for saving homes you find online.</li>
          </ul>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {TITLES.map((title) => (
              <div key={title} className="rounded-2xl bg-folio p-4">
                <p className="text-sm text-ink-soft">Title idea</p>
                <p className="mt-1 font-display text-lg font-semibold text-ink">{title}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative min-h-72 bg-gradient-to-br from-sea/20 via-folio to-honey-soft p-8">
          <div className="absolute inset-6 rounded-[1.75rem] border border-white/50 bg-white/50 p-6 backdrop-blur-sm">
            <p className="font-display text-2xl font-semibold text-ink">
              This is a conversation tool
            </p>
            <p className="mt-3 text-ink-soft">
              It will show which path currently fits better and whether you seem ready
              to act — never as a scolding verdict, always with the reasons behind it.
            </p>
            <div className="mt-6 space-y-3">
              <div className="rounded-2xl bg-keep/10 px-4 py-3 font-bold text-keep">
                Option A · Keep
              </div>
              <div className="rounded-2xl bg-move/10 px-4 py-3 font-bold text-move">
                Option B · Downsize
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
