import { describe, expect, it } from 'vitest'
import { createExampleScenario } from '../../data/exampleScenario'
import {
  computeFinance,
  estimateCashAfterMove,
  stayMonthlyParts,
  sumParts,
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
})
