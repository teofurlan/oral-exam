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

  it('keeps the orb gallery at ?orbs', () => {
    expect(pageForSearch('?orbs')).toBe('gallery')
  })
})
