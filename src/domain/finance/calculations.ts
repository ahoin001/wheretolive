import type { CurrentHome, FinanceBreakdown, MoveScenario } from '../types'

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
    fiveYearMove: moveMonthly * 12 * 5 + money(move.movingCosts) + money(move.closingCosts),
    stayParts,
    moveParts,
  }
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
