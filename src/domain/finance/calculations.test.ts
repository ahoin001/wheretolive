import { describe, expect, it } from 'vitest'
import { createExampleScenario } from '../../data/exampleScenario'
import {
  buildCumulativeSeries,
  buildSaleWaterfall,
  computeFinance,
  estimateCashAfterMove,
  moveOneTimeTotal,
  stayMonthlyParts,
  sumParts,
  withMoveOtherMonthly,
  withStayOtherMonthly,
  withStayTaxesInsurance,
} from './calculations'

describe('finance calculations', () => {
  it('does not double-count tax/insurance when escrow is included', () => {
    const scenario = createExampleScenario()
    scenario.home.escrowIncluded = true
    scenario.home.mortgagePayment = 5000
    scenario.home.propertyTaxMonthly = 1250
    scenario.home.insuranceMonthly = 400
    const parts = stayMonthlyParts(scenario.home)
    expect(parts['Property tax']).toBe(0)
    expect(parts.Insurance).toBe(0)
    expect(sumParts(parts)).toBe(
      5000 +
        scenario.home.hoaMonthly +
        scenario.home.utilitiesMonthly +
        scenario.home.maintenanceMonthly +
        scenario.home.miscMonthly,
    )
  })

  it('adds tax/insurance when escrow is not included', () => {
    const scenario = createExampleScenario()
    scenario.home.escrowIncluded = false
    scenario.home.mortgagePayment = 3000
    scenario.home.propertyTaxMonthly = 1250
    scenario.home.insuranceMonthly = 400
    const finance = computeFinance(scenario.home, scenario.move)
    expect(finance.stayParts['Property tax']).toBe(1250)
    expect(finance.stayParts.Insurance).toBe(400)
    expect(finance.stayMonthly).toBeGreaterThan(3000)
  })

  it('estimates cash after move from equity and costs', () => {
    const scenario = createExampleScenario()
    const cash = estimateCashAfterMove(
      scenario.home.estimatedValueMid,
      scenario.home,
      scenario.move,
    )
    expect(cash).toBeGreaterThan(0)
    const finance = computeFinance(scenario.home, scenario.move)
    expect(finance.cashAfterMoveMid).toBe(cash)
    expect(finance.monthlyDelta).toBe(finance.stayMonthly - finance.moveMonthly)
  })

  it('includes deposit and other one-time costs in 5-year move spend', () => {
    const scenario = createExampleScenario()
    const finance = computeFinance(scenario.home, scenario.move)
    const oneTime = moveOneTimeTotal(scenario.move)
    expect(finance.moveOneTimeTotal).toBe(oneTime)
    expect(finance.fiveYearMove).toBe(finance.moveMonthly * 12 * 5 + oneTime)
  })

  it('builds a sale waterfall ending at cash free', () => {
    const scenario = createExampleScenario()
    const steps = buildSaleWaterfall(scenario.home, scenario.move)
    expect(steps[0]?.id).toBe('value')
    expect(steps[0]?.amount).toBe(scenario.home.estimatedValueMid)
    const total = steps[steps.length - 1]
    expect(total?.kind).toBe('total')
    expect(total?.id).toBe('cash')
    expect(total?.running).toBe(
      estimateCashAfterMove(
        scenario.home.estimatedValueMid,
        scenario.home,
        scenario.move,
      ),
    )
  })

  it('builds cumulative keep vs move series for years 1–5', () => {
    const scenario = createExampleScenario()
    const finance = computeFinance(scenario.home, scenario.move)
    const series = buildCumulativeSeries(finance)
    expect(series).toHaveLength(5)
    expect(series[0]?.keep).toBe(Math.round(finance.stayMonthly * 12))
    expect(series[0]?.move).toBe(
      Math.round(finance.moveMonthly * 12 + finance.moveOneTimeTotal),
    )
    expect(series[4]?.keep).toBe(Math.round(finance.stayMonthly * 12 * 5))
    expect(series[4]?.move).toBe(Math.round(finance.fiveYearMove))
  })

  it('funnels lean form “other” costs onto misc', () => {
    const scenario = createExampleScenario()
    const stay = withStayOtherMonthly(scenario.home, 900)
    expect(stay.miscMonthly).toBe(900)
    expect(stay.hoaMonthly).toBe(0)
    const tax = withStayTaxesInsurance(scenario.home, 1600)
    expect(tax.propertyTaxMonthly).toBe(1600)
    expect(tax.insuranceMonthly).toBe(0)
    const move = withMoveOtherMonthly(scenario.move, 400)
    expect(move.miscMonthly).toBe(400)
    expect(move.utilitiesMonthly).toBe(0)
  })
})
