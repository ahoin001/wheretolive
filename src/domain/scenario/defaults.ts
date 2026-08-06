import {
  DEFAULT_PRIORITIES,
  type CurrentHome,
  type HouseholdAnswers,
  type MoveScenario,
  type Scenario,
} from '../types'

/** Default household answers for blank and migrated scenarios. */
export function blankHousehold(): HouseholdAnswers {
  return {
    owners: [
      {
        label: 'Owner 1',
        ageRange: 'not_sure',
        retirementPlan: 'not_sure',
        incomeDirection: 'not_sure',
      },
    ],
    peopleNow: 2,
    peopleSoon: 2,
    mayHostAgain: 'not_sure',
    accessibilityNeeds: 'not_sure',
    maintenanceFeel: 'not_sure',
    supportNearby: 'not_sure',
    attachment: 'not_sure',
    notes: '',
  }
}

export function blankHome(): CurrentHome {
  return {
    address: '',
    city: '',
    state: '',
    zip: '',
    bedrooms: 3,
    bathrooms: 2,
    hasYard: true,
    loanBalance: 0,
    interestRate: 0,
    originated: '',
    maturity: '',
    accountFlag: 0,
    mortgagePayment: 0,
    escrowIncluded: false,
    propertyTaxMonthly: 0,
    insuranceMonthly: 0,
    hoaMonthly: 0,
    utilitiesMonthly: 0,
    maintenanceMonthly: 0,
    miscMonthly: 0,
    estimatedValueLow: 0,
    estimatedValueMid: 0,
    estimatedValueHigh: 0,
  }
}

export function blankMove(): MoveScenario {
  return {
    mode: 'rent',
    label: 'A simpler rental',
    monthlyHousing: 0,
    hoaMonthly: 0,
    insuranceMonthly: 0,
    taxMonthly: 0,
    utilitiesMonthly: 0,
    maintenanceMonthly: 0,
    miscMonthly: 0,
    depositOrDown: 0,
    closingCosts: 0,
    movingCosts: 0,
    sellerCostsPercent: 6,
    repairsBeforeSale: 0,
  }
}

/** Canonical empty scenario — migrations and UI start from this shape. */
export function blankScenario(name = 'Our household'): Scenario {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    version: 1,
    name,
    createdAt: now,
    updatedAt: now,
    household: blankHousehold(),
    home: blankHome(),
    move: blankMove(),
    priorities: { ...DEFAULT_PRIORITIES },
    conversationNotes: '',
  }
}
