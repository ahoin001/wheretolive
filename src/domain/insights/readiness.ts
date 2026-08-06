import { computeFinance, formatMoney } from '../finance/calculations'
import type {
  FinanceBreakdown,
  HouseholdAnswers,
  InsightSignal,
  PathLean,
  ReadinessResult,
  Scenario,
  ScenarioPriorities,
} from '../types'

function unanswered(value: string): boolean {
  return value === 'not_sure' || value === 'prefer_not' || !value
}

function scoreSignal(
  signal: InsightSignal,
  priorities: ScenarioPriorities,
): number {
  const weight = priorities[signal.dimension] ?? 3
  const direction = signal.leans === 'downsize' ? 1 : signal.leans === 'keep' ? -1 : 0
  return direction * signal.strength * weight
}

export function evaluateReadiness(scenario: Scenario): ReadinessResult {
  const finance = computeFinance(scenario.home, scenario.move)
  const h = scenario.household
  const signals: InsightSignal[] = []
  const missingFacts: string[] = []
  const nextQuestions: string[] = []

  collectFinanceSignals(finance, scenario, signals, missingFacts)
  collectHouseholdSignals(h, scenario, signals, missingFacts, nextQuestions)

  const keepReasons = signals.filter((s) => s.leans === 'keep')
  const downsizeReasons = signals.filter((s) => s.leans === 'downsize')

  const total = signals.reduce(
    (sum, s) => sum + scoreSignal(s, scenario.priorities),
    0,
  )

  let pathLean: PathLean = 'mixed'
  if (total >= 8) pathLean = 'downsize'
  else if (total <= -8) pathLean = 'keep'

  const answeredCount = countAnswered(h)
  const confidence =
    answeredCount >= 8 && Math.abs(total) >= 10
      ? 'high'
      : answeredCount >= 5
        ? 'medium'
        : 'low'

  if (answeredCount < 5) {
    missingFacts.push('A few more household answers would make the fit summary clearer.')
  }
  if (Math.abs(finance.monthlyDelta) < 400) {
    missingFacts.push('Monthly costs are close enough that small assumption changes can flip the money picture.')
  }

  const keepFit =
    pathLean === 'keep' ? 'strong' : pathLean === 'mixed' ? 'possible' : 'closer_look'
  const downsizeFit =
    pathLean === 'downsize' ? 'strong' : pathLean === 'mixed' ? 'possible' : 'closer_look'

  const readiness =
    pathLean === 'mixed' || confidence === 'low'
      ? 'exploring'
      : missingFacts.length > 1 || h.attachment === 'deeply_attached'
        ? 'preparing'
        : 'ready'

  return {
    pathLean,
    keepFit,
    downsizeFit,
    readiness,
    confidence,
    summary: buildSummary(pathLean, readiness, finance, h),
    keepReasons,
    downsizeReasons,
    missingFacts: Array.from(new Set(missingFacts)),
    nextQuestions: Array.from(new Set(nextQuestions)).slice(0, 4),
  }
}

function collectFinanceSignals(
  finance: FinanceBreakdown,
  scenario: Scenario,
  signals: InsightSignal[],
  missingFacts: string[],
) {
  if (finance.stayMonthly <= 0) {
    missingFacts.push('Add current monthly housing costs so the money comparison can run.')
    return
  }

  if (finance.monthlyDelta >= 1200) {
    signals.push({
      id: 'cash-flow-heavy',
      dimension: 'cashFlow',
      leans: 'downsize',
      strength: 3,
      title: 'Housing is taking a large monthly bite',
      because: [
        `Staying looks like about ${formatMoney(finance.stayMonthly)}/month.`,
        `A simpler place at your target budget looks like about ${formatMoney(finance.moveMonthly)}/month.`,
        `That is roughly ${formatMoney(finance.monthlyDelta)} more breathing room each month.`,
      ],
      suggestion: 'Lower monthly load can matter more near retirement than keeping unused space.',
    })
  } else if (finance.monthlyDelta <= 200) {
    signals.push({
      id: 'cash-flow-close',
      dimension: 'cashFlow',
      leans: 'keep',
      strength: 1,
      title: 'Monthly costs may not change much',
      because: [
        'Your keep and move budgets are relatively close.',
        'If the home still fits daily life, money alone may not decide this.',
      ],
      suggestion: 'Focus next on upkeep, space needs, and what feels lighter day to day.',
    })
  }

  if (scenario.home.interestRate > 0 && scenario.home.interestRate <= 5) {
    signals.push({
      id: 'good-rate',
      dimension: 'cashFlow',
      leans: 'keep',
      strength: 2,
      title: 'The current mortgage rate is a real advantage',
      because: [
        `Your rate is about ${scenario.home.interestRate}%.`,
        'A newer loan or renting somewhere else may not match that rate.',
      ],
      suggestion: 'Weigh the rate benefit against the full monthly cost of the property.',
    })
  }

  if (finance.netProceedsMid > 150000) {
    signals.push({
      id: 'equity-unlock',
      dimension: 'retirementResilience',
      leans: 'downsize',
      strength: 2,
      title: 'There may be meaningful equity to unlock',
      because: [
        `At a mid estimate of ${formatMoney(scenario.home.estimatedValueMid)}, net proceeds after loan and common selling costs look near ${formatMoney(finance.netProceedsMid)}.`,
        'That cash could support a simpler home, reserves, or both.',
      ],
      suggestion: 'Get a local market opinion before treating any estimate as a sale price.',
    })
  }

  if (scenario.home.accountFlag > 1000) {
    signals.push({
      id: 'fee-flag',
      dimension: 'retirementResilience',
      leans: 'downsize',
      strength: 1,
      title: 'Unexpected housing extras are already showing up',
      because: [
        `There is about ${formatMoney(scenario.home.accountFlag)} in flagged fees, advances, or deferred interest.`,
        'Escrow and insurance swings can keep adding surprise costs.',
      ],
      suggestion: 'Ask the servicer for a plain-English breakdown of that balance.',
    })
  }
}

function collectHouseholdSignals(
  h: HouseholdAnswers,
  scenario: Scenario,
  signals: InsightSignal[],
  missingFacts: string[],
  nextQuestions: string[],
) {
  const rooms = scenario.home.bedrooms
  const soon = h.peopleSoon || h.peopleNow

  if (soon > 0 && rooms >= 4 && soon <= 2) {
    signals.push({
      id: 'space-surplus',
      dimension: 'spaceFit',
      leans: 'downsize',
      strength: 2,
      title: 'The home may be larger than daily life needs',
      because: [
        `This home has ${rooms} bedrooms.`,
        `You expect about ${soon} people living here soon.`,
      ],
      suggestion: 'Extra rooms can be a gift—or an unpaid chore. Name which they are for you.',
    })
  }

  if (h.mayHostAgain === 'yes') {
    signals.push({
      id: 'host-again',
      dimension: 'futureFlexibility',
      leans: 'keep',
      strength: 2,
      title: 'You may still need room for family',
      because: ['You said someone may need to live here again.'],
      suggestion: 'If hosting is important, look for a smaller place that still has one flexible guest room.',
    })
  } else if (h.mayHostAgain === 'no' && soon <= 2 && rooms >= 4) {
    signals.push({
      id: 'no-host',
      dimension: 'futureFlexibility',
      leans: 'downsize',
      strength: 1,
      title: 'You are not planning to fill the extra rooms',
      because: ['You said it is unlikely others will need to move back in.'],
      suggestion: 'A right-sized home can still welcome overnight guests without year-round upkeep.',
    })
  }

  if (h.maintenanceFeel === 'often_heavy') {
    signals.push({
      id: 'upkeep-heavy',
      dimension: 'upkeep',
      leans: 'downsize',
      strength: 3,
      title: 'Upkeep already feels heavy',
      because: ['You said caring for the home often feels like a lot.'],
      suggestion: 'A townhome or apartment can trade yard and repair work for more free time.',
    })
  } else if (h.maintenanceFeel === 'manageable') {
    signals.push({
      id: 'upkeep-ok',
      dimension: 'upkeep',
      leans: 'keep',
      strength: 1,
      title: 'Upkeep still feels workable',
      because: ['You said home care is mostly manageable right now.'],
      suggestion: 'Revisit this if energy, health, or repair costs change.',
    })
  }

  if (h.accessibilityNeeds === 'yes') {
    signals.push({
      id: 'access-needs',
      dimension: 'upkeep',
      leans: 'downsize',
      strength: 2,
      title: 'Accessibility may matter more soon',
      because: ['You noted accessibility needs or expectations.'],
      suggestion: 'Favor single-level living, fewer stairs, and lower outdoor maintenance.',
    })
  }

  const nearRetirement = h.owners.some(
    (o) =>
      o.retirementPlan === 'already_retired' ||
      o.retirementPlan === 'within_5' ||
      o.retirementPlan === '5_to_10',
  )
  const incomePressure = h.owners.some(
    (o) => o.incomeDirection === 'decreasing' || o.incomeDirection === 'variable',
  )

  if (nearRetirement && incomePressure) {
    signals.push({
      id: 'retirement-cash',
      dimension: 'retirementResilience',
      leans: 'downsize',
      strength: 3,
      title: 'Retirement timing and income point toward lower fixed costs',
      because: [
        'Someone in the household is near or in retirement.',
        'Income looks like it may decrease or vary.',
      ],
      suggestion: 'Protecting monthly cash flow can create more peace of mind than holding unused square footage.',
    })
  } else if (nearRetirement) {
    signals.push({
      id: 'retirement-horizon',
      dimension: 'retirementResilience',
      leans: 'downsize',
      strength: 1,
      title: 'This decade is a natural time to simplify',
      because: ['Retirement is already here or approaching.'],
      suggestion: 'Age alone is not a reason to move—but it is a good reason to choose housing that stays easy.',
    })
  }

  if (h.attachment === 'deeply_attached' || h.attachment === 'somewhat_attached') {
    signals.push({
      id: 'attachment',
      dimension: 'emotionalCommunity',
      leans: 'keep',
      strength: h.attachment === 'deeply_attached' ? 3 : 2,
      title: 'This home still carries important meaning',
      because: ['You feel attached to this place.'],
      suggestion: 'Honor that. Any move should feel like an upgrade in daily life, not a loss you are pushed into.',
    })
  } else if (h.attachment === 'ready_for_change') {
    signals.push({
      id: 'ready-change',
      dimension: 'emotionalCommunity',
      leans: 'downsize',
      strength: 2,
      title: 'Emotionally, a change already feels welcome',
      because: ['You said you feel ready for a change.'],
      suggestion: 'Use that openness to tour options without rushing a final decision.',
    })
  }

  if (h.supportNearby === 'yes') {
    signals.push({
      id: 'support-here',
      dimension: 'emotionalCommunity',
      leans: 'keep',
      strength: 2,
      title: 'Nearby support is part of what makes this area work',
      because: ['You have helpful people or community nearby.'],
      suggestion: 'If you look at other homes, keep that support network in the “must stay close” list.',
    })
  }

  h.owners.forEach((owner, index) => {
    if (unanswered(owner.ageRange)) {
      missingFacts.push(`Age range for ${owner.label || `person ${index + 1}`} is unanswered.`)
    }
    if (unanswered(owner.retirementPlan)) {
      nextQuestions.push(`When does ${owner.label || 'each person'} hope to retire, roughly?`)
    }
    if (unanswered(owner.incomeDirection)) {
      nextQuestions.push('Do you expect household income to stay steady, rise, or ease down?')
    }
  })

  if (unanswered(h.maintenanceFeel)) {
    nextQuestions.push('On a normal month, does caring for the house feel light, doable, or draining?')
  }
  if (unanswered(h.mayHostAgain)) {
    nextQuestions.push('Is there a real chance someone else will need to live here again?')
  }
}

function countAnswered(h: HouseholdAnswers): number {
  let count = 0
  h.owners.forEach((o) => {
    if (!unanswered(o.ageRange)) count += 1
    if (!unanswered(o.retirementPlan)) count += 1
    if (!unanswered(o.incomeDirection)) count += 1
  })
  if (h.peopleNow > 0) count += 1
  if (h.peopleSoon > 0) count += 1
  if (!unanswered(h.mayHostAgain)) count += 1
  if (!unanswered(h.accessibilityNeeds)) count += 1
  if (!unanswered(h.maintenanceFeel)) count += 1
  if (!unanswered(h.supportNearby)) count += 1
  if (!unanswered(h.attachment)) count += 1
  return count
}

function buildSummary(
  lean: PathLean,
  readiness: ReadinessResult['readiness'],
  finance: FinanceBreakdown,
  h: HouseholdAnswers,
): string {
  const moneyLine =
    finance.monthlyDelta > 0
      ? `A simpler housing target could free about ${formatMoney(finance.monthlyDelta)} a month.`
      : 'Monthly costs look fairly close between the two paths right now.'

  if (lean === 'downsize') {
    return `Right now, the picture leans toward a smaller, lower-cost home. ${moneyLine} That does not mean you must rush—readiness looks like “${readinessLabel(readiness)}.”`
  }
  if (lean === 'keep') {
    return `Right now, keeping the home still has a strong case—especially if it still fits daily life and nearby support. ${moneyLine} Treat this as a fit check, not a final vote.`
  }
  return `The signals are mixed, and that is okay. ${moneyLine} With about ${h.peopleSoon || h.peopleNow || 'your'} household size ahead, the kindest next step is gathering a few clearer facts before choosing.`
}

function readinessLabel(value: ReadinessResult['readiness']): string {
  if (value === 'ready') return 'ready to decide with eyes open'
  if (value === 'preparing') return 'preparing—good direction, more homework first'
  return 'still exploring'
}

export function pathLabel(lean: PathLean): string {
  if (lean === 'downsize') return 'Currently leans toward downsizing'
  if (lean === 'keep') return 'Currently leans toward keeping'
  return 'Currently mixed — keep gathering clarity'
}

export function fitLabel(fit: ReadinessResult['keepFit']): string {
  if (fit === 'strong') return 'Strong fit'
  if (fit === 'possible') return 'Possible fit'
  return 'Needs a closer look'
}

export function readinessCopy(value: ReadinessResult['readiness']): string {
  if (value === 'ready') return 'Ready now'
  if (value === 'preparing') return 'Preparing'
  return 'Exploring'
}
