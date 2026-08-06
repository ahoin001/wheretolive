import type {
  AgeRange,
  Attachment,
  IncomeDirection,
  Likelihood,
  MaintenanceFeel,
  RetirementPlan,
} from '../types'

export const ageOptions: { value: AgeRange; label: string }[] = [
  { value: 'under_50', label: 'Under 50' },
  { value: '50_54', label: '50–54' },
  { value: '55_59', label: '55–59' },
  { value: '60_64', label: '60–64' },
  { value: '65_69', label: '65–69' },
  { value: '70_plus', label: '70+' },
  { value: 'not_sure', label: 'Not sure' },
  { value: 'prefer_not', label: 'Prefer not to answer' },
]

export const retirementOptions: { value: RetirementPlan; label: string }[] = [
  { value: 'already_retired', label: 'Already retired' },
  { value: 'within_5', label: 'Within about 5 years' },
  { value: '5_to_10', label: 'About 5–10 years away' },
  { value: 'over_10', label: 'More than 10 years away' },
  { value: 'not_planning', label: 'Not planning to retire soon' },
  { value: 'not_sure', label: 'Not sure yet' },
  { value: 'prefer_not', label: 'Prefer not to answer' },
]

export const incomeOptions: { value: IncomeDirection; label: string }[] = [
  { value: 'increasing', label: 'Likely increasing' },
  { value: 'steady', label: 'About the same' },
  { value: 'decreasing', label: 'Likely decreasing' },
  { value: 'variable', label: 'It varies a lot' },
  { value: 'not_sure', label: 'Not sure' },
  { value: 'prefer_not', label: 'Prefer not to answer' },
]

export const likelihoodOptions: { value: Likelihood; label: string }[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'no', label: 'No' },
  { value: 'not_sure', label: 'Not sure' },
  { value: 'prefer_not', label: 'Prefer not to answer' },
]

export const maintenanceOptions: { value: MaintenanceFeel; label: string }[] = [
  { value: 'manageable', label: 'Mostly manageable' },
  { value: 'sometimes_heavy', label: 'Sometimes feels heavy' },
  { value: 'often_heavy', label: 'Often feels heavy' },
  { value: 'not_sure', label: 'Not sure' },
  { value: 'prefer_not', label: 'Prefer not to answer' },
]

export const attachmentOptions: { value: Attachment; label: string }[] = [
  { value: 'deeply_attached', label: 'Deeply attached' },
  { value: 'somewhat_attached', label: 'Somewhat attached' },
  { value: 'mixed', label: 'Mixed feelings' },
  { value: 'ready_for_change', label: 'Ready for a change' },
  { value: 'not_sure', label: 'Not sure' },
  { value: 'prefer_not', label: 'Prefer not to answer' },
]

export const conversationStarters = [
  'What parts of this home still make life better, and what parts feel heavy now?',
  'If housing cost less each month, what would you want that freedom to make possible?',
  'What would we need to learn before either option felt safe?',
]
