import { describe, expect, it } from 'vitest'
import { migrateAppData } from './migrations'

describe('wizard step migration', () => {
  it('maps legacy 8-step ids onto the 3-step guide', () => {
    const next = migrateAppData({
      version: 1,
      scenario: null,
      places: [],
      ui: {
        activeStep: 'paths',
        mode: 'guide',
        completedSteps: ['welcome', 'household', 'today', 'paths', 'peace'],
      },
    })
    expect(next.ui.activeStep).toBe('move')
    expect(next.ui.completedSteps).toEqual(['stay', 'move', 'picture'])
  })

  it('maps welcome and unknown steps to stay', () => {
    expect(
      migrateAppData({
        version: 1,
        scenario: null,
        places: [],
        ui: {
          activeStep: 'welcome',
          mode: 'guide',
          completedSteps: ['welcome'],
        },
      }).ui.activeStep,
    ).toBe('stay')

    const unknown = migrateAppData({
      version: 1,
      scenario: null,
      places: [],
      ui: {
        activeStep: 'unknown_board',
        mode: 'places',
        completedSteps: ['not_a_step'],
      },
    })
    expect(unknown.ui.activeStep).toBe('stay')
    expect(unknown.ui.completedSteps).toEqual([])
  })

  it('keeps current step ids', () => {
    const next = migrateAppData({
      version: 1,
      scenario: null,
      places: [],
      ui: {
        activeStep: 'picture',
        mode: 'guide',
        completedSteps: ['stay', 'move'],
      },
    })
    expect(next.ui.activeStep).toBe('picture')
    expect(next.ui.completedSteps).toEqual(['stay', 'move'])
  })
})
