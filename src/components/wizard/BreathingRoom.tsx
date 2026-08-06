import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { FinanceBreakdown } from '../../domain/types'
import { formatMoney } from '../../domain/finance/calculations'

export function BreathingRoom({ finance }: { finance: FinanceBreakdown }) {
  const monthly = [
    { name: 'Keep', total: Math.round(finance.stayMonthly), fill: '#4a6d8c' },
    { name: 'Move', total: Math.round(finance.moveMonthly), fill: '#6b7f4a' },
  ]

  const yearly = [
    {
      name: '1 year',
      Keep: Math.round(finance.stayAnnual),
      Move: Math.round(finance.moveAnnual),
    },
    {
      name: '5 years',
      Keep: Math.round(finance.fiveYearStay),
      Move: Math.round(finance.fiveYearMove),
    },
  ]

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-[1.75rem] border border-line bg-panel p-5 shadow-[var(--shadow-soft)]">
        <h3 className="font-display text-2xl font-semibold text-ink">
          Monthly breathing room
        </h3>
        <p className="mt-2 text-ink-soft">
          Watch how the monthly load changes as you edit the numbers. Lower is not
          always better — it depends on what life you want.
        </p>
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#c9d6d3" />
              <XAxis dataKey="name" tick={{ fill: '#3d524f' }} />
              <YAxis tickFormatter={(v) => formatMoney(v, true)} tick={{ fill: '#3d524f' }} />
              <Tooltip formatter={(v) => formatMoney(Number(v))} />
              <Bar dataKey="total" radius={[12, 12, 0, 0]}>
                {monthly.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-3 text-lg font-bold text-ink">
          {finance.monthlyDelta > 0
            ? `Moving could free about ${formatMoney(finance.monthlyDelta)} each month.`
            : finance.monthlyDelta < 0
              ? `Keeping looks about ${formatMoney(Math.abs(finance.monthlyDelta))} lighter per month with current inputs.`
              : 'Monthly costs look about even with current inputs.'}
        </p>
      </section>

      <section className="rounded-[1.75rem] border border-line bg-panel p-5 shadow-[var(--shadow-soft)]">
        <h3 className="font-display text-2xl font-semibold text-ink">
          Longer view
        </h3>
        <p className="mt-2 text-ink-soft">
          Rough cumulative housing spend. This is a planning sketch, not a forecast.
        </p>
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={yearly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#c9d6d3" />
              <XAxis dataKey="name" tick={{ fill: '#3d524f' }} />
              <YAxis tickFormatter={(v) => formatMoney(v, true)} tick={{ fill: '#3d524f' }} />
              <Tooltip formatter={(v) => formatMoney(Number(v))} />
              <Legend />
              <Bar dataKey="Keep" fill="#4a6d8c" radius={[12, 12, 0, 0]} />
              <Bar dataKey="Move" fill="#6b7f4a" radius={[12, 12, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  )
}
