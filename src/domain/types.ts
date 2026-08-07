export type AgeRange =
  | 'under_50'
  | '50_54'
  | '55_59'
  | '60_64'
  | '65_69'
  | '70_plus'
  | 'prefer_not'
  | 'not_sure'

export type RetirementPlan =
  | 'already_retired'
  | 'within_5'
  | '5_to_10'
  | 'over_10'
  | 'not_planning'
  | 'not_sure'
  | 'prefer_not'

export type IncomeDirection =
  | 'increasing'
  | 'steady'
  | 'decreasing'
  | 'variable'
  | 'not_sure'
  | 'prefer_not'

export type Likelihood = 'yes' | 'maybe' | 'no' | 'not_sure' | 'prefer_not'

export type MaintenanceFeel =
  | 'manageable'
  | 'sometimes_heavy'
  | 'often_heavy'
  | 'not_sure'
  | 'prefer_not'

export type Attachment =
  | 'deeply_attached'
  | 'somewhat_attached'
  | 'ready_for_change'
  | 'mixed'
  | 'not_sure'
  | 'prefer_not'

export type MoveMode = 'rent' | 'buy'

export type FitLevel = 'strong' | 'possible' | 'closer_look'
export type ReadinessLevel = 'ready' | 'preparing' | 'exploring'
export type PathLean = 'keep' | 'downsize' | 'mixed'

export type WizardStepId = 'stay' | 'move' | 'picture'

export type PlaceTier = 'dream' | 'strong' | 'maybe' | 'pass'
export type PlaceStatus = 'none' | 'visited' | 'offer'
export type PlaceListingKind = 'rent' | 'buy'
/** Dwelling style for filters and the place form */
export type PlaceHomeType =
  | 'apartment'
  | 'condo'
  | 'single_family'
  | 'townhome'
/** Whether pets are welcome at this place */
export type PetsPolicy = 'yes' | 'no' | 'limited'

/** Alphabetical labels for home type (form + filter options after “Any”) */
export const PLACE_HOME_TYPE_OPTIONS: {
  value: PlaceHomeType
  label: string
}[] = [
  { value: 'apartment', label: 'Apartment' },
  { value: 'condo', label: 'Condo' },
  { value: 'single_family', label: 'Single Family' },
  { value: 'townhome', label: 'Townhome' },
]

/**
 * Living-area bands (sqft). Ranges are [min, max) except the top band (min+).
 * Form still stores exact sqft.
 */
export const PLACE_SQFT_FILTER_OPTIONS: {
  value: string
  label: string
  min: number
  /** Exclusive upper bound; null = no upper limit */
  max: number | null
}[] = [
  { value: 'under_1000', label: 'Under 1,000', min: 0, max: 1000 },
  { value: '1000_1200', label: '1,000 – 1,200', min: 1000, max: 1200 },
  { value: '1200_1400', label: '1,200 – 1,400', min: 1200, max: 1400 },
  { value: '1400_1600', label: '1,400 – 1,600', min: 1400, max: 1600 },
  { value: '1600_plus', label: '1,600+', min: 1600, max: null },
]

export interface OwnerProfile {
  label: string
  ageRange: AgeRange
  retirementPlan: RetirementPlan
  incomeDirection: IncomeDirection
}

export interface HouseholdAnswers {
  owners: OwnerProfile[]
  peopleNow: number
  peopleSoon: number
  mayHostAgain: Likelihood
  accessibilityNeeds: Likelihood
  maintenanceFeel: MaintenanceFeel
  supportNearby: Likelihood
  attachment: Attachment
  notes: string
}

export interface CurrentHome {
  address: string
  city: string
  state: string
  zip: string
  bedrooms: number
  bathrooms: number
  hasYard: boolean
  loanBalance: number
  interestRate: number
  originated: string
  maturity: string
  accountFlag: number
  mortgagePayment: number
  escrowIncluded: boolean
  propertyTaxMonthly: number
  insuranceMonthly: number
  hoaMonthly: number
  utilitiesMonthly: number
  maintenanceMonthly: number
  miscMonthly: number
  estimatedValueLow: number
  estimatedValueMid: number
  estimatedValueHigh: number
}

export interface MoveScenario {
  mode: MoveMode
  label: string
  monthlyHousing: number
  hoaMonthly: number
  insuranceMonthly: number
  taxMonthly: number
  utilitiesMonthly: number
  maintenanceMonthly: number
  miscMonthly: number
  depositOrDown: number
  closingCosts: number
  movingCosts: number
  sellerCostsPercent: number
  repairsBeforeSale: number
}

export interface ScenarioPriorities {
  cashFlow: number
  spaceFit: number
  upkeep: number
  retirementResilience: number
  futureFlexibility: number
  emotionalCommunity: number
}

export interface Scenario {
  id: string
  version: number
  name: string
  createdAt: string
  updatedAt: string
  household: HouseholdAnswers
  home: CurrentHome
  move: MoveScenario
  priorities: ScenarioPriorities
  conversationNotes: string
}

export interface InsightSignal {
  id: string
  dimension: keyof ScenarioPriorities
  leans: PathLean
  strength: 1 | 2 | 3
  title: string
  because: string[]
  suggestion: string
}

export interface ReadinessResult {
  pathLean: PathLean
  keepFit: FitLevel
  downsizeFit: FitLevel
  readiness: ReadinessLevel
  confidence: 'high' | 'medium' | 'low'
  summary: string
  keepReasons: InsightSignal[]
  downsizeReasons: InsightSignal[]
  missingFacts: string[]
  nextQuestions: string[]
}

export interface FinanceBreakdown {
  stayMonthly: number
  stayAnnual: number
  moveMonthly: number
  moveAnnual: number
  monthlyDelta: number
  annualDelta: number
  equityMid: number
  netProceedsMid: number
  cashAfterMoveMid: number
  fiveYearStay: number
  fiveYearMove: number
  /** One-time cash leaving when you move (deposit + closing + moving) */
  moveOneTimeTotal: number
  stayParts: Record<string, number>
  moveParts: Record<string, number>
}

/** Sale-to-cash step for waterfall chart */
export interface SaleWaterfallStep {
  id: string
  label: string
  /** Signed amount: value positive, reductions negative, final cash positive */
  amount: number
  running: number
  kind: 'in' | 'out' | 'total'
}

export interface CumulativeYearPoint {
  year: number
  label: string
  keep: number
  move: number
}

export interface SavedPlace {
  id: string
  createdAt: string
  updatedAt: string
  title: string
  url: string
  listingKind: PlaceListingKind
  /** Apartment / condo / townhome / single family — optional */
  homeType: PlaceHomeType | null
  /** Purchase list price — used when listingKind is buy */
  price: number | null
  /** Monthly rent when listingKind is rent; null for buy listings */
  monthlyEstimate: number | null
  /** Street line (number, street, unit) */
  street: string
  /** City only — used for filters */
  city: string
  /** US state code, e.g. FL */
  state: string
  /** ZIP or ZIP+4 */
  zip: string
  /**
   * Display line rebuilt from street/city/state/zip on save.
   * Kept for older data and compact UI strings.
   */
  location: string
  bedrooms: number | null
  bathrooms: number | null
  /** Interior living area in square feet */
  sqft: number | null
  notes: string
  /** Whether pets are allowed */
  pets: PetsPolicy
  /** Optional one-line pet rules (size, breed, deposit, etc.) */
  petsNote: string
  /** Selected pro chips / custom labels */
  proTags: string[]
  /** Selected concern chips / custom labels */
  concernTags: string[]
  tier: PlaceTier
  status: PlaceStatus
  /**
   * Liked-by-me (local favorite or personal reaction when cloud).
   * On shared lists this is per-user, not a shared board field.
   */
  favorite: boolean
  /** Explicit personal like when present (mirrors favorite on cloud loads) */
  likedByMe?: boolean
  /**
   * When the current user last liked this place (ISO).
   * Used to sort “recently liked” without relying on place edits.
   */
  likedAt?: string | null
  /** User ids who liked this place (shared lists) */
  likedByUserIds?: string[]
  /** Display names + like times for shared-board “Liked by …” UI */
  likedBy?: PlaceLiker[]
  /** One or more photo URLs (index 0 is the main thumbnail) */
  images: string[]
  tags: string[]
}

/** One person who liked a place (collaboration boards) */
export interface PlaceLiker {
  userId: string
  displayName: string
  /** When they liked (ISO); newest first when present */
  likedAt?: string | null
}

export interface AppData {
  version: number
  scenario: Scenario | null
  places: SavedPlace[]
  ui: {
    activeStep: WizardStepId
    mode: 'guide' | 'places'
    completedSteps: WizardStepId[]
  }
}

export const DATA_VERSION = 1

export const DEFAULT_PRIORITIES: ScenarioPriorities = {
  cashFlow: 5,
  spaceFit: 4,
  upkeep: 4,
  retirementResilience: 5,
  futureFlexibility: 3,
  emotionalCommunity: 4,
}
