import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { BackgroundPattern } from './BackgroundPattern'

describe('BackgroundPattern', () => {
  let frames: Map<number, FrameRequestCallback>
  let nextFrame: number
  let reduced: MediaQueryList
  let fine: MediaQueryList
  const media = (matches: boolean) => Object.assign(new EventTarget(), { matches }) as MediaQueryList
  const move = (pointerType = 'mouse') => fireEvent(window, Object.assign(new Event('pointermove'), {
    pointerType, clientX: 320, clientY: 240,
  }))
  const tick = (time: number) => {
    const callbacks = [...frames.values()]
    frames.clear()
    callbacks.forEach(callback => callback(time))
  }

  beforeEach(() => {
    frames = new Map()
    nextFrame = 0
    reduced = media(false)
    fine = media(true)
    vi.stubGlobal('matchMedia', (query: string) => query.includes('reduced-motion') ? reduced : fine)
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      frames.set(++nextFrame, callback)
      return nextFrame
    }))
    vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => frames.delete(id)))
    vi.spyOn(performance, 'now').mockReturnValue(0)
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('is decorative and does no animation work before pointer movement', () => {
    const { container } = render(<BackgroundPattern />)
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true')
    expect(requestAnimationFrame).not.toHaveBeenCalled()
  })

  it('coalesces mouse movement, drifts locally, and stops after settling', () => {
    const { container } = render(<BackgroundPattern />)
    const response = container.querySelector<HTMLElement>('.background-pattern-response')!
    move()
    move()
    expect(frames.size).toBe(1)
    tick(100)
    expect(Number(response.style.opacity)).toBeGreaterThan(0)
    expect(response.style.transform).toContain('200px, 120px')
    expect(response.style.backgroundPosition).not.toBe('')
    tick(800)
    expect(response.style.opacity).toBe('0')
    expect(frames.size).toBe(0)
  })

  it('cancels immediately while hidden and waits for fresh input on return', () => {
    const { container } = render(<BackgroundPattern />)
    move()
    tick(100)
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
    fireEvent(document, new Event('visibilitychange'))
    expect(frames.size).toBe(0)
    expect(container.querySelector<HTMLElement>('.background-pattern-response')!.style.opacity).toBe('0')
    move()
    expect(frames.size).toBe(0)
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
    fireEvent(document, new Event('visibilitychange'))
    expect(frames.size).toBe(0)
    move()
    expect(frames.size).toBe(1)
  })

  it('stays static for reduced motion and responds to live preference changes', () => {
    Object.assign(reduced, { matches: true })
    render(<BackgroundPattern />)
    move()
    expect(frames.size).toBe(0)
    Object.assign(reduced, { matches: false })
    reduced.dispatchEvent(new Event('change'))
    move()
    expect(frames.size).toBe(1)
    Object.assign(reduced, { matches: true })
    reduced.dispatchEvent(new Event('change'))
    expect(frames.size).toBe(0)
  })

  it('stays static on touch, including hybrid devices and live pointer changes', () => {
    render(<BackgroundPattern />)
    move('touch')
    expect(frames.size).toBe(0)
    Object.assign(fine, { matches: false })
    fine.dispatchEvent(new Event('change'))
    move()
    expect(frames.size).toBe(0)
    Object.assign(fine, { matches: true })
    fine.dispatchEvent(new Event('change'))
    move()
    expect(frames.size).toBe(1)
    Object.assign(fine, { matches: false })
    fine.dispatchEvent(new Event('change'))
    expect(frames.size).toBe(0)
  })

  it('cancels on pointer exit, blur, and unmount without leaking StrictMode listeners', () => {
    const { unmount } = render(<StrictMode><BackgroundPattern /></StrictMode>)
    move()
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1)
    fireEvent(document.documentElement, new Event('pointerleave'))
    expect(frames.size).toBe(0)
    move()
    fireEvent(window, new Event('blur'))
    expect(frames.size).toBe(0)
    move()
    unmount()
    expect(frames.size).toBe(0)
    move()
    expect(frames.size).toBe(0)
  })
})
