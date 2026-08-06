import type { Scenario } from '../types'
import { sumParts, stayMonthlyParts, moveMonthlyParts } from '../finance/calculations'

function isAnswered(value: string): boolean {
  return Boolean(value) && value !== 'not_sure' && value !== 'prefer_not'
}

/** Optional life chips — any one improves personalization. */
export function hasLifeContext(scenario: Scenario): boolean {
  const h = scenario.household
  return (
    isAnswered(h.maintenanceFeel) ||
    isAnswered(h.attachment) ||
    h.peopleSoon !== h.peopleNow ||
    h.peopleSoon > 0
  )
}

/** Enough cost inputs so money-based readiness isn’t mostly empty. */
export function hasMoneyBasics(scenario: Scenario): boolean {
  const stay = sumParts(stayMonthlyParts(scenario.home))
  const move = sumParts(moveMonthlyParts(scenario.move))
  return stay >= 100 && move >= 100
}

/** Show readiness once money basics exist (life context optional). */
export function canShowReadiness(scenario: Scenario | null | undefined): boolean {
  if (!scenario) return false
  return hasMoneyBasics(scenario)
}
