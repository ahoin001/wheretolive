import { ExternalLink } from 'lucide-react'
import { getMarketPulse } from '../../data/marketPulse'
import type { CurrentHome } from '../../domain/types'

export function MarketPulseCard({ home }: { home: CurrentHome }) {
  const pulse = getMarketPulse(home.zip, home.city)

  return (
    <section className="rounded-[1.75rem] border border-line bg-panel p-5 shadow-[var(--shadow-soft)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-2xl font-semibold text-ink">Market pulse</h3>
          <p className="mt-1 text-ink-soft">{pulse.addressLabel}</p>
        </div>
        <span className="rounded-full bg-folio px-3 py-1 text-sm font-bold capitalize text-sea-deep">
          Outlook: {pulse.outlook}
        </span>
      </div>

      <p className="mt-4 text-lg text-ink">{pulse.summary}</p>
      <p className="mt-2 text-sm text-ink-soft">{pulse.estimateNote}</p>

      <ul className="mt-5 space-y-3">
        {pulse.notes.map((note) => (
          <li key={note.id} className="rounded-2xl bg-folio p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-bold text-ink">{note.title}</p>
              <span className="text-xs font-bold uppercase tracking-wide text-ink-soft">
                {note.confidence} confidence · {note.asOf}
              </span>
            </div>
            <p className="mt-2 text-ink-soft">{note.body}</p>
            <a
              href={note.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-sea-deep underline-offset-2 hover:underline"
            >
              {note.sourceLabel}
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap gap-3">
        {pulse.links.map((link) => (
          <a
            key={link.url}
            href={link.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-full border border-line bg-panel px-3 py-2 text-sm font-bold text-ink hover:border-sea"
          >
            {link.label}
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ))}
      </div>
    </section>
  )
}
