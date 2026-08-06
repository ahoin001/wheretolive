import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { CurrentHome, FinanceBreakdown, MoveScenario } from '../../domain/types'
import {
  buildCumulativeSeries,
  buildMonthlyComposition,
  buildSaleWaterfall,
  formatMoney,
  housingSpendAtHorizon,
  type CumulativeHorizon,
} from '../../domain/finance/calculations'
import { cn } from '../../lib/utils'

const KEEP = '#4a6d8c'
const MOVE = '#6b7f4a'
const SEA = '#5b8a84'
const HONEY = '#c47b3a'

/** Calm, distinct segments for monthly composition stacks */
const PART_COLORS = [
  '#4a6d8c',
  '#6b7f4a',
  '#5b8a84',
  '#c47b3a',
  '#7a8f9a',
  '#8a6f5a',
  '#5f7a6e',
  '#9a7b4f',
]

const HORIZONS: { years: CumulativeHorizon; label: string }[] = [
  { years: 5, label: '5 years' },
  { years: 10, label: '10 years' },
  { years: 20, label: '20 years' },
]

export function MoneyPicture({
  finance,
  home,
  move,
  compact = false,
}: {
  finance: FinanceBreakdown
  home: CurrentHome
  move: MoveScenario
  /** Smaller strip for stay/move preview */
  compact?: boolean
}) {
  const [horizon, setHorizon] = useState<CumulativeHorizon>(5)

  const monthly = [
    { name: 'Stay', total: Math.round(finance.stayMonthly), fill: KEEP },
    { name: 'Rent', total: Math.round(finance.moveMonthly), fill: MOVE },
  ]

  const cumulative = useMemo(
    () => buildCumulativeSeries(finance, horizon),
    [finance, horizon],
  )
  const horizonTotals = useMemo(
    () => housingSpendAtHorizon(finance, horizon),
    [finance, horizon],
  )
  const composition = useMemo(
    () => buildMonthlyComposition(finance),
    [finance],
  )

  const waterfall = buildSaleWaterfall(home, move)
  const chartWaterfall = waterfall.map((step) => ({
    name: step.label,
    amount:
      step.kind === 'total'
        ? Math.round(step.running)
        : Math.round(Math.abs(step.amount)),
    signed: Math.round(step.amount),
    running: Math.round(step.running),
    kind: step.kind,
    fill:
      step.kind === 'total'
        ? SEA
        : step.kind === 'in'
          ? KEEP
          : HONEY,
  }))

  const hasMonthly = finance.stayMonthly > 0 || finance.moveMonthly > 0
  const hasSale = home.estimatedValueMid > 0
  const hasComposition =
    composition.partKeys.length > 0 &&
    (finance.stayMonthly > 0 || finance.moveMonthly > 0)

  const xTickInterval =
    horizon === 20 ? 3 : horizon === 10 ? 1 : 0

  const horizonInsight = (() => {
    const stay = horizonTotals.stay
    const rent = horizonTotals.move
    const gap = Math.abs(stay - rent)
    if (stay > rent) {
      return `After ${horizon} years: staying totals about ${formatMoney(gap)} more in housing spend than renting (at these inputs).`
    }
    if (rent > stay) {
      return `After ${horizon} years: renting totals about ${formatMoney(gap)} more in housing spend than staying (at these inputs).`
    }
    return `${horizon}-year totals look similar.`
  })()

  return (
    <div className={cn('grid gap-5', compact ? 'lg:grid-cols-1' : 'lg:grid-cols-2')}>
      {hasMonthly ? (
        <section className="rounded-[1.75rem] border border-line bg-panel p-5 shadow-[var(--shadow-soft)]">
          <h3 className="font-display text-2xl font-semibold text-ink">
            Monthly housing load
          </h3>
          <p className="mt-2 text-ink-soft">
            What you pay each month to stay versus rent.
          </p>
          <div className={cn('mt-4', compact ? 'h-48' : 'h-64')}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#c9d6d3" />
                <XAxis dataKey="name" tick={{ fill: '#3d524f' }} />
                <YAxis
                  tickFormatter={(v) => formatMoney(v, true)}
                  tick={{ fill: '#3d524f' }}
                />
                <Tooltip formatter={(v) => formatMoney(Number(v))} />
                <Bar dataKey="total" radius={[12, 12, 0, 0]}>
                  {monthly.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-3 text-base font-bold text-ink">
            {finance.monthlyDelta > 50
              ? `Renting could free about ${formatMoney(finance.monthlyDelta)} each month.`
              : finance.monthlyDelta < -50
                ? `Staying looks about ${formatMoney(Math.abs(finance.monthlyDelta))} lighter per month right now.`
                : 'Monthly costs look about even with these numbers.'}
          </p>
        </section>
      ) : null}

      {hasSale && !compact ? (
        <section className="rounded-[1.75rem] border border-line bg-panel p-5 shadow-[var(--shadow-soft)]">
          <h3 className="font-display text-2xl font-semibold text-ink">
            Cash from selling
          </h3>
          <p className="mt-2 text-ink-soft">
            Rough path from home value to cash free after a move. Planning sketch only.
          </p>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartWaterfall} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#c9d6d3" />
                <XAxis
                  type="number"
                  tickFormatter={(v) => formatMoney(v, true)}
                  tick={{ fill: '#3d524f', fontSize: 12 }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={118}
                  tick={{ fill: '#3d524f', fontSize: 11 }}
                />
                <Tooltip
                  formatter={(v, _n, item) => {
                    const signed = Number(
                      (item?.payload as { signed?: number })?.signed ?? v,
                    )
                    return formatMoney(signed)
                  }}
                />
                <Bar dataKey="amount" radius={[0, 10, 10, 0]}>
                  {chartWaterfall.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-3 text-base font-bold text-ink">
            About {formatMoney(finance.cashAfterMoveMid)} free after a mid-value
            sale and relocating costs.
          </p>
        </section>
      ) : null}

      {hasMonthly && hasComposition && !compact ? (
        <section className="rounded-[1.75rem] border border-line bg-panel p-5 shadow-[var(--shadow-soft)] lg:col-span-2">
          <h3 className="font-display text-2xl font-semibold text-ink">
            What’s inside the monthly bill
          </h3>
          <p className="mt-2 max-w-2xl text-ink-soft">
            See which line items push the stay or rent number up — so the household can
            talk about the levers, not only the totals.
          </p>
          <div className="mt-4 h-72 sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={composition.rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#c9d6d3" />
                <XAxis dataKey="name" tick={{ fill: '#3d524f' }} />
                <YAxis
                  tickFormatter={(v) => formatMoney(v, true)}
                  tick={{ fill: '#3d524f' }}
                />
                <Tooltip
                  formatter={(v, name) => [formatMoney(Number(v)), String(name)]}
                />
                <Legend
                  wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                  iconType="circle"
                />
                {composition.partKeys.map((key, i) => (
                  <Bar
                    key={key}
                    dataKey={key}
                    stackId="load"
                    name={key}
                    fill={PART_COLORS[i % PART_COLORS.length]}
                    radius={
                      i === composition.partKeys.length - 1
                        ? [10, 10, 0, 0]
                        : [0, 0, 0, 0]
                    }
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-3 text-base font-bold text-ink">
            Stay stacks to {formatMoney(finance.stayMonthly)}/mo · rent stacks to{' '}
            {formatMoney(finance.moveMonthly)}/mo.
          </p>
        </section>
      ) : null}

      {hasMonthly && !compact ? (
        <section className="rounded-[1.75rem] border border-line bg-panel p-5 shadow-[var(--shadow-soft)] lg:col-span-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h3 className="font-display text-2xl font-semibold text-ink">
                Housing spend over time
              </h3>
              <p className="mt-2 max-w-2xl text-ink-soft">
                Cumulative cost of housing for the years you pick. Rent path includes
                one-time move costs up front. Not a forecast of home prices or rent
                growth.
              </p>
            </div>
            <div
              className="flex shrink-0 flex-wrap gap-1.5 rounded-2xl border border-line bg-folio/70 p-1"
              role="group"
              aria-label="Spend horizon"
            >
              {HORIZONS.map(({ years, label }) => {
                const on = horizon === years
                return (
                  <button
                    key={years}
                    type="button"
                    onClick={() => setHorizon(years)}
                    aria-pressed={on}
                    className={cn(
                      'min-h-10 rounded-xl px-3.5 text-sm font-bold transition',
                      on
                        ? 'bg-sea text-white shadow-[var(--shadow-soft)]'
                        : 'text-ink-soft hover:bg-panel hover:text-ink',
                    )}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cumulative}>
                <CartesianGrid strokeDasharray="3 3" stroke="#c9d6d3" />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#3d524f', fontSize: horizon === 20 ? 11 : 12 }}
                  interval={xTickInterval}
                />
                <YAxis
                  tickFormatter={(v) => formatMoney(v, true)}
                  tick={{ fill: '#3d524f' }}
                />
                <Tooltip formatter={(v) => formatMoney(Number(v))} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="keep"
                  name="Stay"
                  stroke={KEEP}
                  strokeWidth={3}
                  dot={horizon <= 5 ? { r: 4 } : { r: 2 }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="move"
                  name="Rent"
                  stroke={MOVE}
                  strokeWidth={3}
                  dot={horizon <= 5 ? { r: 4 } : { r: 2 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-3 text-base font-bold text-ink">{horizonInsight}</p>
          <p className="mt-1 text-sm text-ink-soft">
            Totals at {horizon} years — stay {formatMoney(horizonTotals.stay)} · rent{' '}
            {formatMoney(horizonTotals.move)}.
          </p>
        </section>
      ) : null}
    </div>
  )
}
