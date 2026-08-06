import { describe, expect, it } from 'vitest'
import { migrateAppData } from './migrations'

describe('wizard step migration', () => {
  it('maps legacy 8-step ids onto the 4-step guide', () => {
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
    expect(next.ui.completedSteps).toEqual(['welcome', 'stay', 'move', 'picture'])
  })

  it('maps unknown step ids to welcome', () => {
    const next = migrateAppData({
      version: 1,
      scenario: null,
      places: [],
      ui: {
        activeStep: 'unknown_board',
        mode: 'places',
        completedSteps: ['not_a_step'],
      },
    })
    expect(next.ui.activeStep).toBe('welcome')
    expect(next.ui.completedSteps).toEqual([])
  })

  it('keeps current step ids', () => {
    const next = migrateAppData({
      version: 1,
      scenario: null,
      places: [],
      ui: {
        activeStep: 'picture',
        mode: 'guide',
        completedSteps: ['welcome', 'stay', 'move'],
      },
    })
    expect(next.ui.activeStep).toBe('picture')
    expect(next.ui.completedSteps).toEqual(['welcome', 'stay', 'move'])
  })
})
