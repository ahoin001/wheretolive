import type { AppController } from '../../hooks/useApp'
import { Button } from '../ui/Button'

export function WelcomeStep({ app }: { app: AppController }) {
  return (
    <section className="overflow-hidden rounded-[2rem] border border-line bg-panel shadow-[var(--shadow-lift)]">
      <div className="grid lg:grid-cols-[1.15fr_0.85fr]">
        <div className="p-6 md:p-10">
          <p className="font-display text-4xl font-semibold tracking-[-0.03em] text-ink md:text-5xl text-balance">
            Stay or rent simpler?
          </p>
          <p className="mt-4 max-w-2xl text-xl leading-relaxed text-ink-soft">
            A short picture of what keeping your home costs versus selling and
            renting something smaller — with charts, your numbers, and no pressure
            to decide today.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button variant="honey" onClick={app.startFresh}>
              Start with our numbers
            </Button>
            <Button variant="secondary" onClick={app.startExample}>
              Try the Miramar example
            </Button>
          </div>

          <ul className="mt-8 space-y-2 text-ink-soft">
            <li>Three short steps: your home → a rental path → the full picture.</li>
            <li>Only the money fields that move the charts.</li>
            <li>Saved privately on this device (or your account when signed in).</li>
          </ul>
        </div>

        <div className="relative min-h-64 bg-gradient-to-br from-sea/15 via-folio to-honey-soft p-8">
          <div className="absolute inset-6 flex flex-col justify-center rounded-[1.75rem] border border-white/50 bg-white/55 p-6 backdrop-blur-sm">
            <p className="font-display text-2xl font-semibold text-ink">
              You’ll see
            </p>
            <ul className="mt-4 space-y-3 text-ink-soft">
              <li className="rounded-2xl bg-keep/10 px-4 py-3 font-bold text-keep">
                Monthly stay vs rent
              </li>
              <li className="rounded-2xl bg-sea/10 px-4 py-3 font-bold text-sea-deep">
                Cash after a sale
              </li>
              <li className="rounded-2xl bg-move/10 px-4 py-3 font-bold text-move">
                A five-year spend sketch
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
