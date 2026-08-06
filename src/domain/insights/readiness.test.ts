import { describe, expect, it } from 'vitest'
import { createExampleScenario } from '../../data/exampleScenario'
import { evaluateReadiness } from './readiness'

describe('readiness insights', () => {
  it('returns explainable keep and downsize reasons for the example', () => {
    const result = evaluateReadiness(createExampleScenario())
    expect(result.summary.length).toBeGreaterThan(20)
    expect(result.keepReasons.length + result.downsizeReasons.length).toBeGreaterThan(0)
    expect(['keep', 'downsize', 'mixed']).toContain(result.pathLean)
    expect(result.keepReasons.every((r) => r.because.length > 0)).toBe(true)
  })

  it('does not treat unanswered age as a downsize push by itself', () => {
    const scenario = createExampleScenario()
    scenario.household.owners = [
      {
        label: 'Owner 1',
        ageRange: 'prefer_not',
        retirementPlan: 'not_sure',
        incomeDirection: 'not_sure',
      },
    ]
    scenario.household.maintenanceFeel = 'not_sure'
    scenario.household.attachment = 'not_sure'
    scenario.household.mayHostAgain = 'not_sure'
    scenario.home.mortgagePayment = 1000
    scenario.home.escrowIncluded = true
    scenario.move.monthlyHousing = 950
    const result = evaluateReadiness(scenario)
    expect(result.confidence).not.toBe('high')
  })
})
