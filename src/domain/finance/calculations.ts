import type {
  CumulativeYearPoint,
  CurrentHome,
  FinanceBreakdown,
  MoveScenario,
  SaleWaterfallStep,
} from '../types'

const money = (n: number) => (Number.isFinite(n) ? Math.max(0, n) : 0)

export function stayMonthlyParts(home: CurrentHome): Record<string, number> {
  const tax = home.escrowIncluded ? 0 : money(home.propertyTaxMonthly)
  const insurance = home.escrowIncluded ? 0 : money(home.insuranceMonthly)

  return {
    Mortgage: money(home.mortgagePayment),
    'Property tax': tax,
    Insurance: insurance,
    HOA: money(home.hoaMonthly),
    Utilities: money(home.utilitiesMonthly),
    'Home care / repairs': money(home.maintenanceMonthly),
    Miscellaneous: money(home.miscMonthly),
  }
}

export function moveMonthlyParts(move: MoveScenario): Record<string, number> {
  return {
    Housing: money(move.monthlyHousing),
    HOA: money(move.hoaMonthly),
    Insurance: money(move.insuranceMonthly),
    'Property tax': money(move.taxMonthly),
    Utilities: money(move.utilitiesMonthly),
    'Home care / repairs': money(move.maintenanceMonthly),
    Miscellaneous: money(move.miscMonthly),
  }
}

export function sumParts(parts: Record<string, number>): number {
  return Object.values(parts).reduce((a, b) => a + money(b), 0)
}

export function estimateEquity(value: number, home: CurrentHome): number {
  return money(value) - money(home.loanBalance) - money(home.accountFlag)
}

export function estimateNetProceeds(
  value: number,
  home: CurrentHome,
  move: MoveScenario,
): number {
  const equity = estimateEquity(value, home)
  const sellerCosts = money(value) * (money(move.sellerCostsPercent) / 100)
  return equity - sellerCosts - money(move.repairsBeforeSale)
}

export function estimateCashAfterMove(
  value: number,
  home: CurrentHome,
  move: MoveScenario,
): number {
  return (
    estimateNetProceeds(value, home, move) -
    money(move.depositOrDown) -
    money(move.closingCosts) -
    money(move.movingCosts)
  )
}

export function moveOneTimeTotal(move: MoveScenario): number {
  return (
    money(move.depositOrDown) +
    money(move.closingCosts) +
    money(move.movingCosts)
  )
}

export function computeFinance(
  home: CurrentHome,
  move: MoveScenario,
): FinanceBreakdown {
  const stayParts = stayMonthlyParts(home)
  const moveParts = moveMonthlyParts(move)
  const stayMonthly = sumParts(stayParts)
  const moveMonthly = sumParts(moveParts)
  const monthlyDelta = stayMonthly - moveMonthly
  const mid = money(home.estimatedValueMid)
  const oneTime = moveOneTimeTotal(move)

  return {
    stayMonthly,
    stayAnnual: stayMonthly * 12,
    moveMonthly,
    moveAnnual: moveMonthly * 12,
    monthlyDelta,
    annualDelta: monthlyDelta * 12,
    equityMid: estimateEquity(mid, home),
    netProceedsMid: estimateNetProceeds(mid, home, move),
    cashAfterMoveMid: estimateCashAfterMove(mid, home, move),
    fiveYearStay: stayMonthly * 12 * 5,
    // Housing spend over 5 years + one-time cash to leave the house
    fiveYearMove: moveMonthly * 12 * 5 + oneTime,
    moveOneTimeTotal: oneTime,
    stayParts,
    moveParts,
  }
}

/** Steps for “cash from selling” story (mid value). */
export function buildSaleWaterfall(
  home: CurrentHome,
  move: MoveScenario,
): SaleWaterfallStep[] {
  const value = money(home.estimatedValueMid)
  const loan = money(home.loanBalance)
  const extra = money(home.accountFlag)
  const seller = value * (money(move.sellerCostsPercent) / 100)
  const repairs = money(move.repairsBeforeSale)
  const deposit = money(move.depositOrDown)
  const closing = money(move.closingCosts)
  const moving = money(move.movingCosts)

  let running = 0
  const steps: SaleWaterfallStep[] = []

  const push = (
    id: string,
    label: string,
    amount: number,
    kind: SaleWaterfallStep['kind'],
  ) => {
    running += amount
    steps.push({ id, label, amount, running, kind })
  }

  push('value', 'Home value', value, 'in')
  if (loan > 0) push('loan', 'Loan payoff', -loan, 'out')
  if (extra > 0) push('flag', 'Other home loans', -extra, 'out')
  if (seller > 0) push('seller', 'Selling costs', -seller, 'out')
  if (repairs > 0) push('repairs', 'Fix-up before sale', -repairs, 'out')
  if (deposit > 0) push('deposit', 'Deposit / move-in', -deposit, 'out')
  if (closing > 0) push('closing', 'Closing & other', -closing, 'out')
  if (moving > 0) push('moving', 'Moving costs', -moving, 'out')
  // Final row is a snapshot of the running balance, not another addend.
  steps.push({
    id: 'cash',
    label: 'Cash free after move',
    amount: running,
    running,
    kind: 'total',
  })

  return steps
}

/** Cumulative housing spend for years 1–5. */
export function buildCumulativeSeries(
  finance: FinanceBreakdown,
): CumulativeYearPoint[] {
  const oneTime = money(finance.moveOneTimeTotal)
  const points: CumulativeYearPoint[] = []
  for (let year = 1; year <= 5; year++) {
    points.push({
      year,
      label: `Year ${year}`,
      keep: Math.round(finance.stayMonthly * 12 * year),
      // One-time costs hit once at the start of the move path
      move: Math.round(finance.moveMonthly * 12 * year + oneTime),
    })
  }
  return points
}

export function formatMoney(n: number, compact = false): string {
  const value = Number.isFinite(n) ? n : 0
  if (compact && Math.abs(value) >= 1000) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value)
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatMoneyExact(n: number): string {
  const value = Number.isFinite(n) ? n : 0
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function yearsRemaining(maturity: string): number | null {
  const end = Date.parse(maturity)
  if (Number.isNaN(end)) return null
  const ms = end - Date.now()
  return Math.max(0, Math.round((ms / (1000 * 60 * 60 * 24 * 365.25)) * 10) / 10)
}

/** Lean form helpers: “other stay costs” store in misc, zero thinner lines. */
export function stayOtherMonthly(home: CurrentHome): number {
  return (
    money(home.hoaMonthly) +
    money(home.utilitiesMonthly) +
    money(home.maintenanceMonthly) +
    money(home.miscMonthly)
  )
}

export function stayTaxesInsuranceMonthly(home: CurrentHome): number {
  return money(home.propertyTaxMonthly) + money(home.insuranceMonthly)
}

export function moveOtherMonthly(move: MoveScenario): number {
  return (
    money(move.hoaMonthly) +
    money(move.insuranceMonthly) +
    money(move.taxMonthly) +
    money(move.utilitiesMonthly) +
    money(move.maintenanceMonthly) +
    money(move.miscMonthly)
  )
}

/** Patch home so “other costs” live on misc (single simplified input). */
export function withStayOtherMonthly(
  home: CurrentHome,
  other: number,
): CurrentHome {
  return {
    ...home,
    hoaMonthly: 0,
    utilitiesMonthly: 0,
    maintenanceMonthly: 0,
    miscMonthly: money(other),
  }
}

export function withStayTaxesInsurance(
  home: CurrentHome,
  combined: number,
): CurrentHome {
  return {
    ...home,
    propertyTaxMonthly: money(combined),
    insuranceMonthly: 0,
  }
}

export function withMoveOtherMonthly(
  move: MoveScenario,
  other: number,
): MoveScenario {
  return {
    ...move,
    hoaMonthly: 0,
    insuranceMonthly: 0,
    taxMonthly: 0,
    utilitiesMonthly: 0,
    maintenanceMonthly: 0,
    miscMonthly: money(other),
  }
}
