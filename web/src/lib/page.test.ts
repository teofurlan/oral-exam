import { describe, it, expect } from 'vitest'
import { modeHref, pageForSearch } from './page'

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

describe('modeHref', () => {
  it('keeps the plain tab links when the page has no ?ws', () => {
    expect(modeHref('exam', '')).toBe('/')
    expect(modeHref('agent', '?mode=agent')).toBe('/?mode=agent')
  })

  it('keeps the server WebSocket port when switching modes', () => {
    expect(modeHref('agent', '?ws=51001')).toBe('/?ws=51001&mode=agent')
    expect(modeHref('exam', '?ws=51001&mode=agent')).toBe('/?ws=51001')
  })
})
