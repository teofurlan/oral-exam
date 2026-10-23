import { useEffect, useRef } from 'react'
import './BackgroundPattern.css'

/** A quiet ground texture. Only a small patch paints while the mouse is moving. */
export function BackgroundPattern() {
  const responseRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const response = responseRef.current
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    const fine = window.matchMedia?.('(any-pointer: fine)')
    if (!response || !reduced || !fine) return

    let frame = 0
    let x = 0
    let y = 0
    let movedAt = 0
    const stop = () => {
      cancelAnimationFrame(frame)
      frame = 0
      response.style.opacity = '0'
    }
    const enabled = () => !reduced.matches && fine.matches && !document.hidden
    const paint = (now: number) => {
      frame = 0
      if (!enabled()) return stop()
      const remaining = Math.max(0, 1 - (now - movedAt) / 650)
      const drift = Math.sin(now / 1800) * 3
      response.style.transform = `translate(${x - 120}px, ${y - 120}px)`
      // Align the local tile to the stationary ground before adding a 3px drift.
      response.style.backgroundPosition = `${120 - x + drift}px ${120 - y + drift}px`
      response.style.opacity = String(remaining * remaining)
      if (remaining > 0) frame = requestAnimationFrame(paint)
    }
    const move = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || !enabled()) return
      x = event.clientX
      y = event.clientY
      movedAt = performance.now()
      if (!frame) frame = requestAnimationFrame(paint)
    }
    const preferenceChanged = () => { if (!enabled()) stop() }

    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('blur', stop)
    document.documentElement.addEventListener('pointerleave', stop)
    document.addEventListener('visibilitychange', stop)
    reduced.addEventListener?.('change', preferenceChanged)
    fine.addEventListener?.('change', preferenceChanged)
    return () => {
      stop()
      window.removeEventListener('pointermove', move)
      window.removeEventListener('blur', stop)
      document.documentElement.removeEventListener('pointerleave', stop)
      document.removeEventListener('visibilitychange', stop)
      reduced.removeEventListener?.('change', preferenceChanged)
      fine.removeEventListener?.('change', preferenceChanged)
    }
  }, [])

  return (
    <div className="background-pattern" aria-hidden="true">
      <div ref={responseRef} className="background-pattern-response" />
    </div>
  )
}
