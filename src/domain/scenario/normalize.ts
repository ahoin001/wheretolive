import {
  type AgeRange,
  type Attachment,
  type CurrentHome,
  type HouseholdAnswers,
  type IncomeDirection,
  type Likelihood,
  type MaintenanceFeel,
  type MoveMode,
  type MoveScenario,
  type OwnerProfile,
  type RetirementPlan,
  type Scenario,
  type ScenarioPriorities,
  DEFAULT_PRIORITIES,
} from '../types'
import { blankHome, blankHousehold, blankMove, blankScenario } from './defaults'

const AGE: readonly AgeRange[] = [
  'under_50',
  '50_54',
  '55_59',
  '60_64',
  '65_69',
  '70_plus',
  'prefer_not',
  'not_sure',
]

const RETIREMENT: readonly RetirementPlan[] = [
  'already_retired',
  'within_5',
  '5_to_10',
  'over_10',
  'not_planning',
  'not_sure',
  'prefer_not',
]

const INCOME: readonly IncomeDirection[] = [
  'increasing',
  'steady',
  'decreasing',
  'variable',
  'not_sure',
  'prefer_not',
]

const LIKELIHOOD: readonly Likelihood[] = [
  'yes',
  'maybe',
  'no',
  'not_sure',
  'prefer_not',
]

const MAINTENANCE: readonly MaintenanceFeel[] = [
  'manageable',
  'sometimes_heavy',
  'often_heavy',
  'not_sure',
  'prefer_not',
]

const ATTACHMENT: readonly Attachment[] = [
  'deeply_attached',
  'somewhat_attached',
  'ready_for_change',
  'mixed',
  'not_sure',
  'prefer_not',
]

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback
}

function num(value: unknown, fallback = 0): number {
  if (value == null || value === '') return fallback
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function bool(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function normalizeOwner(raw: unknown, index: number): OwnerProfile {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return {
    label: str(o.label, `Owner ${index + 1}`) || `Owner ${index + 1}`,
    ageRange: oneOf(o.ageRange, AGE, 'not_sure'),
    retirementPlan: oneOf(o.retirementPlan, RETIREMENT, 'not_sure'),
    incomeDirection: oneOf(o.incomeDirection, INCOME, 'not_sure'),
  }
}

function normalizeHousehold(raw: unknown): HouseholdAnswers {
  const base = blankHousehold()
  if (!raw || typeof raw !== 'object') return base
  const h = raw as Record<string, unknown>
  const ownersRaw = Array.isArray(h.owners) ? h.owners : null
  const owners =
    ownersRaw && ownersRaw.length > 0
      ? ownersRaw.map((o, i) => normalizeOwner(o, i))
      : base.owners

  return {
    owners,
    peopleNow: Math.max(0, Math.round(num(h.peopleNow, base.peopleNow))),
    peopleSoon: Math.max(0, Math.round(num(h.peopleSoon, base.peopleSoon))),
    mayHostAgain: oneOf(h.mayHostAgain, LIKELIHOOD, base.mayHostAgain),
    accessibilityNeeds: oneOf(h.accessibilityNeeds, LIKELIHOOD, base.accessibilityNeeds),
    maintenanceFeel: oneOf(h.maintenanceFeel, MAINTENANCE, base.maintenanceFeel),
    supportNearby: oneOf(h.supportNearby, LIKELIHOOD, base.supportNearby),
    attachment: oneOf(h.attachment, ATTACHMENT, base.attachment),
    notes: str(h.notes, base.notes),
  }
}

function normalizeHome(raw: unknown): CurrentHome {
  const base = blankHome()
  if (!raw || typeof raw !== 'object') return base
  const h = raw as Record<string, unknown>
  return {
    address: str(h.address, base.address),
    city: str(h.city, base.city),
    state: str(h.state, base.state),
    zip: str(h.zip, base.zip),
    bedrooms: Math.max(0, num(h.bedrooms, base.bedrooms)),
    bathrooms: Math.max(0, num(h.bathrooms, base.bathrooms)),
    hasYard: bool(h.hasYard, base.hasYard),
    loanBalance: Math.max(0, num(h.loanBalance, base.loanBalance)),
    interestRate: Math.max(0, num(h.interestRate, base.interestRate)),
    originated: str(h.originated, base.originated),
    maturity: str(h.maturity, base.maturity),
    accountFlag: Math.max(0, num(h.accountFlag, base.accountFlag)),
    mortgagePayment: Math.max(0, num(h.mortgagePayment, base.mortgagePayment)),
    escrowIncluded: bool(h.escrowIncluded, base.escrowIncluded),
    propertyTaxMonthly: Math.max(0, num(h.propertyTaxMonthly, base.propertyTaxMonthly)),
    insuranceMonthly: Math.max(0, num(h.insuranceMonthly, base.insuranceMonthly)),
    hoaMonthly: Math.max(0, num(h.hoaMonthly, base.hoaMonthly)),
    utilitiesMonthly: Math.max(0, num(h.utilitiesMonthly, base.utilitiesMonthly)),
    maintenanceMonthly: Math.max(0, num(h.maintenanceMonthly, base.maintenanceMonthly)),
    miscMonthly: Math.max(0, num(h.miscMonthly, base.miscMonthly)),
    estimatedValueLow: Math.max(0, num(h.estimatedValueLow, base.estimatedValueLow)),
    estimatedValueMid: Math.max(0, num(h.estimatedValueMid, base.estimatedValueMid)),
    estimatedValueHigh: Math.max(0, num(h.estimatedValueHigh, base.estimatedValueHigh)),
  }
}

function normalizeMove(raw: unknown): MoveScenario {
  const base = blankMove()
  if (!raw || typeof raw !== 'object') return base
  const m = raw as Record<string, unknown>
  const mode: MoveMode = m.mode === 'buy' ? 'buy' : 'rent'
  return {
    mode,
    label: str(m.label, base.label),
    monthlyHousing: Math.max(0, num(m.monthlyHousing, base.monthlyHousing)),
    hoaMonthly: Math.max(0, num(m.hoaMonthly, base.hoaMonthly)),
    insuranceMonthly: Math.max(0, num(m.insuranceMonthly, base.insuranceMonthly)),
    taxMonthly: Math.max(0, num(m.taxMonthly, base.taxMonthly)),
    utilitiesMonthly: Math.max(0, num(m.utilitiesMonthly, base.utilitiesMonthly)),
    maintenanceMonthly: Math.max(0, num(m.maintenanceMonthly, base.maintenanceMonthly)),
    miscMonthly: Math.max(0, num(m.miscMonthly, base.miscMonthly)),
    depositOrDown: Math.max(0, num(m.depositOrDown, base.depositOrDown)),
    closingCosts: Math.max(0, num(m.closingCosts, base.closingCosts)),
    movingCosts: Math.max(0, num(m.movingCosts, base.movingCosts)),
    sellerCostsPercent: Math.max(0, num(m.sellerCostsPercent, base.sellerCostsPercent)),
    repairsBeforeSale: Math.max(0, num(m.repairsBeforeSale, base.repairsBeforeSale)),
  }
}

function normalizePriorities(raw: unknown): ScenarioPriorities {
  const base = { ...DEFAULT_PRIORITIES }
  if (!raw || typeof raw !== 'object') return base
  const p = raw as Record<string, unknown>
  const clamp = (v: unknown, fb: number) => {
    const n = num(v, fb)
    return Math.min(5, Math.max(1, Math.round(n)))
  }
  return {
    cashFlow: clamp(p.cashFlow, base.cashFlow),
    spaceFit: clamp(p.spaceFit, base.spaceFit),
    upkeep: clamp(p.upkeep, base.upkeep),
    retirementResilience: clamp(p.retirementResilience, base.retirementResilience),
    futureFlexibility: clamp(p.futureFlexibility, base.futureFlexibility),
    emotionalCommunity: clamp(p.emotionalCommunity, base.emotionalCommunity),
  }
}

/**
 * Coerce untrusted scenario blobs (imports, localStorage, cloud) into a safe
 * Scenario. Keeps household answers on the domain default rail so readiness UI
 * never sees undefined owners or invalid enum strings.
 */
export function normalizeScenario(raw: unknown): Scenario | null {
  if (!raw || typeof raw !== 'object') return null
  const s = raw as Record<string, unknown>
  const base = blankScenario()
  const now = new Date().toISOString()

  return {
    id: str(s.id) || base.id,
    version: Math.max(1, Math.round(num(s.version, 1))),
    name: str(s.name, base.name) || base.name,
    createdAt: str(s.createdAt, now) || now,
    updatedAt: str(s.updatedAt, now) || now,
    household: normalizeHousehold(s.household),
    home: normalizeHome(s.home),
    move: normalizeMove(s.move),
    priorities: normalizePriorities(s.priorities),
    conversationNotes: str(s.conversationNotes, ''),
  }
}
