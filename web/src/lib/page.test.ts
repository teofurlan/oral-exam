import { describe, it, expect } from 'vitest'
import { pageForSearch } from './page'

describe('pageForSearch', () => {
  it('keeps the exam page at the plain URL', () => {
    expect(pageForSearch('')).toBe('exam')
    expect(pageForSearch('?mock=1')).toBe('exam')
  })

  it('opens agent mode with ?mode=agent', () => {
    expect(pageForSearch('?mode=agent')).toBe('agent')
  })

  it('no longer has an orb gallery: ?orbs shows the exam page', () => {
    expect(pageForSearch('?orbs')).toBe('exam')
  })
})
