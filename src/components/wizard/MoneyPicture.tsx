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
  buildSaleWaterfall,
  formatMoney,
} from '../../domain/finance/calculations'
import { cn } from '../../lib/utils'

const KEEP = '#4a6d8c'
const MOVE = '#6b7f4a'
const SEA = '#5b8a84'
const HONEY = '#c47b3a'

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
  const monthly = [
    { name: 'Stay', total: Math.round(finance.stayMonthly), fill: KEEP },
    { name: 'Rent', total: Math.round(finance.moveMonthly), fill: MOVE },
  ]

  const cumulative = buildCumulativeSeries(finance)
  const waterfall = buildSaleWaterfall(home, move)
  const chartWaterfall = waterfall.map((step) => ({
    name: step.label,
    // For total row show the cash amount positively as a bar
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

      {hasMonthly && !compact ? (
        <>
          <section className="rounded-[1.75rem] border border-line bg-panel p-5 shadow-[var(--shadow-soft)] lg:col-span-2">
            <h3 className="font-display text-2xl font-semibold text-ink">
              Five-year housing spend
            </h3>
            <p className="mt-2 max-w-2xl text-ink-soft">
              Cumulative cost of housing. Rent path includes one-time move costs up
              front. Not a forecast of home prices or rent growth.
            </p>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={cumulative}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#c9d6d3" />
                  <XAxis dataKey="label" tick={{ fill: '#3d524f' }} />
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
                    dot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="move"
                    name="Rent"
                    stroke={MOVE}
                    strokeWidth={3}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-3 text-base font-bold text-ink">
              After five years:{' '}
              {finance.fiveYearStay > finance.fiveYearMove
                ? `staying totals about ${formatMoney(finance.fiveYearStay - finance.fiveYearMove)} more in housing spend than renting (at these inputs).`
                : finance.fiveYearMove > finance.fiveYearStay
                  ? `renting totals about ${formatMoney(finance.fiveYearMove - finance.fiveYearStay)} more in housing spend than staying (at these inputs).`
                  : 'five-year totals look similar.'}
            </p>
          </section>
        </>
      ) : null}
    </div>
  )
}
