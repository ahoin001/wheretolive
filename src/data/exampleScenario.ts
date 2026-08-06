import { DEFAULT_PRIORITIES, type Scenario } from '../domain/types'
import { blankScenario } from '../domain/scenario/defaults'

export function createExampleScenario(): Scenario {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    version: 1,
    name: 'Miramar example',
    createdAt: now,
    updatedAt: now,
    household: {
      owners: [
        {
          label: 'Owner 1',
          ageRange: '55_59',
          retirementPlan: '5_to_10',
          incomeDirection: 'steady',
        },
        {
          label: 'Owner 2',
          ageRange: '60_64',
          retirementPlan: 'within_5',
          incomeDirection: 'decreasing',
        },
      ],
      peopleNow: 3,
      peopleSoon: 2,
      mayHostAgain: 'maybe',
      accessibilityNeeds: 'not_sure',
      maintenanceFeel: 'sometimes_heavy',
      supportNearby: 'yes',
      attachment: 'mixed',
      notes: '',
    },
    home: {
      address: '19506 SW 49th Ct',
      city: 'Miramar',
      state: 'FL',
      zip: '33029',
      bedrooms: 4,
      bathrooms: 3,
      hasYard: true,
      loanBalance: 326544.19,
      interestRate: 4.75,
      originated: '2014-03-01',
      maturity: '2044-05-01',
      accountFlag: 2501.48,
      // Lean guide stores combined other costs on misc; tax/insurance shown when not escrowed.
      mortgagePayment: 3800,
      escrowIncluded: false,
      propertyTaxMonthly: 1700,
      insuranceMonthly: 0,
      hoaMonthly: 0,
      utilitiesMonthly: 0,
      maintenanceMonthly: 0,
      miscMonthly: 700,
      estimatedValueLow: 1250000,
      estimatedValueMid: 1250000,
      estimatedValueHigh: 1250000,
    },
    move: {
      mode: 'rent',
      label: 'A simpler rental',
      monthlyHousing: 2800,
      hoaMonthly: 0,
      insuranceMonthly: 0,
      taxMonthly: 0,
      utilitiesMonthly: 0,
      maintenanceMonthly: 0,
      miscMonthly: 315,
      depositOrDown: 5600,
      closingCosts: 0,
      movingCosts: 4500,
      sellerCostsPercent: 6,
      repairsBeforeSale: 5000,
    },
    priorities: { ...DEFAULT_PRIORITIES },
    conversationNotes: '',
  }
}

export function createBlankScenario(name = 'Our household'): Scenario {
  return blankScenario(name)
}
