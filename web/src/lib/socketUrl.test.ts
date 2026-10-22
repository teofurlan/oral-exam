import { describe, it, expect } from 'vitest'
import { pinnedToServer, socketUrl } from './socketUrl'

describe('socketUrl', () => {
  it('uses the default port when the page URL has no ?ws', () => {
    expect(socketUrl('/ws', '')).toBe('ws://localhost:8766/ws')
    expect(socketUrl('/ws/agent', '?mode=agent')).toBe('ws://localhost:8766/ws/agent')
  })

  it('connects to the port the server passed in ?ws', () => {
    expect(socketUrl('/ws', '?ws=51001')).toBe('ws://localhost:51001/ws')
    expect(socketUrl('/ws/agent', '?ws=51001&mode=agent')).toBe('ws://localhost:51001/ws/agent')
  })

  it('ignores an invalid ?ws value', () => {
    expect(socketUrl('/ws', '?ws=abc')).toBe('ws://localhost:8766/ws')
    expect(socketUrl('/ws', '?ws=0')).toBe('ws://localhost:8766/ws')
    expect(socketUrl('/ws', '?ws=70000')).toBe('ws://localhost:8766/ws')
    expect(socketUrl('/ws', '?ws=1.5')).toBe('ws://localhost:8766/ws')
  })
})

describe('pinnedToServer', () => {
  it('is true only for a socket off the default port', () => {
    expect(pinnedToServer('ws://localhost:8766/ws')).toBe(false)
    expect(pinnedToServer('ws://localhost:51001/ws')).toBe(true)
  })
})
