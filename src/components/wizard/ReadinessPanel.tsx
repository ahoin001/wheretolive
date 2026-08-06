import type { ReadinessResult } from '../../domain/types'
import {
  fitLabel,
  pathLabel,
  readinessCopy,
} from '../../domain/insights/readiness'
import { cn } from '../../lib/utils'

export function ReadinessPanel({ result }: { result: ReadinessResult }) {
  return (
    <section className="rounded-[1.75rem] border border-line bg-panel p-5 shadow-[var(--shadow-soft)] md:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <h2 className="font-display text-3xl font-semibold text-ink">
            How the paths fit right now
          </h2>
          <p className="mt-3 text-lg text-ink-soft">{result.summary}</p>
        </div>
        <div className="rounded-2xl bg-folio px-4 py-3">
          <p className="text-sm text-ink-soft">Confidence</p>
          <p className="font-display text-2xl font-semibold capitalize text-sea-deep">
            {result.confidence}
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <Pill
          label="Overall lean"
          value={pathLabel(result.pathLean)}
          tone={result.pathLean === 'downsize' ? 'move' : result.pathLean === 'keep' ? 'keep' : 'mixed'}
        />
        <Pill label="Keep fit" value={fitLabel(result.keepFit)} tone="keep" />
        <Pill label="Downsize fit" value={fitLabel(result.downsizeFit)} tone="move" />
      </div>

      <p className="mt-4 text-base text-ink">
        Action readiness:{' '}
        <strong>{readinessCopy(result.readiness)}</strong>
        {' — '}
        this is about whether you have enough clarity to act, not whether one
        choice is morally better.
      </p>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <ReasonList
          title="Reasons this points toward keeping"
          items={result.keepReasons}
          empty="No strong keep signals yet — try answering a few more questions."
          tone="keep"
        />
        <ReasonList
          title="Reasons this points toward downsizing"
          items={result.downsizeReasons}
          empty="No strong downsize signals yet — money inputs and household answers will fill this in."
          tone="move"
        />
      </div>

      {result.missingFacts.length || result.nextQuestions.length ? (
        <div className="mt-6 rounded-2xl bg-honey-soft/60 p-4">
          <h3 className="font-bold text-ink">What would clarify this</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-soft">
            {result.missingFacts.map((item) => (
              <li key={item}>{item}</li>
            ))}
            {result.nextQuestions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="mt-4 text-sm text-ink-soft">
        Planning aid only — not financial, tax, legal, or real-estate advice.
      </p>
    </section>
  )
}

function Pill({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'keep' | 'move' | 'mixed'
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border px-4 py-3',
        tone === 'keep' && 'border-keep/30 bg-[#eef3f7]',
        tone === 'move' && 'border-move/30 bg-[#f1f5ea]',
        tone === 'mixed' && 'border-line bg-folio',
      )}
    >
      <p className="text-sm text-ink-soft">{label}</p>
      <p className="mt-1 font-bold text-ink">{value}</p>
    </div>
  )
}

function ReasonList({
  title,
  items,
  empty,
  tone,
}: {
  title: string
  items: ReadinessResult['keepReasons']
  empty: string
  tone: 'keep' | 'move'
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border p-4',
        tone === 'keep' ? 'border-keep/25 bg-[#f7fafc]' : 'border-move/25 bg-[#f8faf5]',
      )}
    >
      <h3 className="font-bold text-ink">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-2 text-ink-soft">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {items.map((item) => (
            <li key={item.id} className="rounded-xl bg-panel/80 p-3">
              <p className="font-bold text-ink">{item.title}</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-ink-soft">
                {item.because.map((line) => (
                  <li key={line}>Because: {line}</li>
                ))}
              </ul>
              <p className="mt-2 text-sm text-ink">{item.suggestion}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
