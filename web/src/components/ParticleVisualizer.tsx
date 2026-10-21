import React, { useEffect, useRef } from 'react'
import {
  ParticleField,
  lettersFrom,
  particleCount,
  simulatedVoice,
  type FieldState,
  type ParticleStyle,
} from '@/lib/particleField'

export interface ParticleVisualizerProps {
  protocolState: FieldState
  style: ParticleStyle
  colors: [string, string]
  getOutputVolume?: () => number
  getInputVolume?: () => number
  /** Text the "letters" look is made of, usually the current question. */
  letters?: string
  className?: string
}

/**
 * Holds the visualizer's slot in the layout and paints a screen-wide canvas behind the
 * content: particles roam the whole screen and gather into a sphere in this slot.
 */
export const ParticleVisualizer: React.FC<ParticleVisualizerProps> = ({
  protocolState,
  style,
  colors,
  getOutputVolume,
  getInputVolume,
  letters,
  className = '',
}) => {
  const slotRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fieldRef = useRef<ParticleField | null>(null)
  const live = useRef({ protocolState, colors, getOutputVolume, getInputVolume })
  live.current = { protocolState, colors, getOutputVolume, getInputVolume }

  useEffect(() => {
    const canvas = canvasRef.current
    const slot = slotRef.current
    let ctx: CanvasRenderingContext2D | null = null
    try {
      ctx = canvas?.getContext('2d') ?? null
    } catch {
      ctx = null
    }
    if (!canvas || !slot || !ctx) return

    const field = new ParticleField({
      count: particleCount(window.innerWidth, window.innerHeight),
      style,
      letters: lettersFrom(letters),
    })
    fieldRef.current = field
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

    let dpr = 1
    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1)
      canvas.width = Math.round(window.innerWidth * dpr)
      canvas.height = Math.round(window.innerHeight * dpr)
      field.resize(window.innerWidth, window.innerHeight)
      const count = particleCount(window.innerWidth, window.innerHeight)
      if (Math.abs(count - field.particles.length) > 150) field.setCount(count)
    }
    resize()
    window.addEventListener('resize', resize)

    let raf = 0
    let last = performance.now() / 1000
    const frame = () => {
      const now = performance.now() / 1000
      const dt = Math.min(1 / 30, now - last)
      last = now
      const { protocolState: state, colors: c, getOutputVolume: out, getInputVolume: inp } = live.current
      const volume =
        state === 'speaking' ? (out ? out() : simulatedVoice(now))
        : state === 'listening' ? (inp ? inp() : simulatedVoice(now + 7))
        : state === 'thinking' ? 0.14 + 0.08 * Math.sin(now * 2.2)
        : 0
      const rect = slot.getBoundingClientRect()
      field.setColors(c)
      field.step({
        dt,
        time: now,
        width: window.innerWidth,
        height: window.innerHeight,
        cx: rect.left + rect.width / 2,
        cy: rect.top + rect.height / 2,
        radius: Math.min(rect.width, rect.height) / 2,
        state,
        volume,
        reducedMotion,
      })
      field.draw(ctx, dpr)
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      fieldRef.current = null
    }
    // The letters are applied by the effect below without rebuilding the field.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [style])

  useEffect(() => {
    fieldRef.current?.setLetters(lettersFrom(letters))
  }, [letters])

  return (
    <div ref={slotRef} data-testid="particle-visualizer" data-style={style} className={className}>
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 h-full w-full"
      />
    </div>
  )
}
