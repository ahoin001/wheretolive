import { describe, expect, it } from 'vitest'
import { normalizeScenario } from './normalize'

describe('normalizeScenario', () => {
  it('returns null for non-objects', () => {
    expect(normalizeScenario(null)).toBeNull()
    expect(normalizeScenario('x')).toBeNull()
  })

  it('fills missing household so readiness never receives undefined owners', () => {
    const scenario = normalizeScenario({
      id: 's1',
      name: 'Import',
      household: {},
      home: { mortgagePayment: '1200' },
      move: { mode: 'buy', monthlyHousing: 2000 },
    })
    expect(scenario).not.toBeNull()
    expect(scenario!.household.owners.length).toBeGreaterThan(0)
    expect(scenario!.household.owners[0].ageRange).toBe('not_sure')
    expect(scenario!.home.mortgagePayment).toBe(1200)
    expect(scenario!.move.mode).toBe('buy')
    expect(scenario!.move.monthlyHousing).toBe(2000)
  })

  it('coerces invalid enums to safe defaults', () => {
    const scenario = normalizeScenario({
      household: {
        owners: [{ label: 'A', ageRange: 'ancient', retirementPlan: 'nope' }],
        attachment: 'whatever',
      },
    })
    expect(scenario!.household.owners[0].ageRange).toBe('not_sure')
    expect(scenario!.household.owners[0].retirementPlan).toBe('not_sure')
    expect(scenario!.household.attachment).toBe('not_sure')
  })
})
