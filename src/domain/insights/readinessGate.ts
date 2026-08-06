import type { HouseholdAnswers, Scenario } from '../types'
import { sumParts, stayMonthlyParts, moveMonthlyParts } from '../finance/calculations'

function isAnswered(value: string): boolean {
  return Boolean(value) && value !== 'not_sure' && value !== 'prefer_not'
}

/** Enough life-context to personalize insights. */
export function hasHouseholdBasics(household: HouseholdAnswers): boolean {
  const ownerReady = household.owners.some(
    (o) =>
      isAnswered(o.ageRange) ||
      isAnswered(o.retirementPlan) ||
      isAnswered(o.incomeDirection),
  )
  const lifeReady =
    isAnswered(household.maintenanceFeel) ||
    isAnswered(household.attachment) ||
    isAnswered(household.mayHostAgain) ||
    household.peopleSoon > 0

  return ownerReady && lifeReady
}

/** Enough cost inputs so money-based readiness isn’t mostly empty. */
export function hasMoneyBasics(scenario: Scenario): boolean {
  const stay = sumParts(stayMonthlyParts(scenario.home))
  const move = sumParts(moveMonthlyParts(scenario.move))
  return stay >= 100 && move >= 100
}

export function canShowReadiness(scenario: Scenario | null | undefined): boolean {
  if (!scenario) return false
  return hasHouseholdBasics(scenario.household) && hasMoneyBasics(scenario)
}
