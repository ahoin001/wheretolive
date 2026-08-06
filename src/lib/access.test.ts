import { describe, expect, it } from 'vitest'
import { canAccessGuide } from './access'

describe('canAccessGuide', () => {
  it('allows the owner email case-insensitively', () => {
    expect(canAccessGuide('ahoin001@gmail.com')).toBe(true)
    expect(canAccessGuide('Ahoin001@Gmail.com')).toBe(true)
  })

  it('denies others and signed-out', () => {
    expect(canAccessGuide(null)).toBe(false)
    expect(canAccessGuide(undefined)).toBe(false)
    expect(canAccessGuide('someone@example.com')).toBe(false)
  })
})
