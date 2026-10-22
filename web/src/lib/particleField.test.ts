import { describe, it, expect } from 'vitest'
import { ParticleField, fibonacciSphere, lettersFrom, particleCount, type FieldFrame } from './particleField'

/** Small deterministic PRNG so the physics runs the same way every time. */
function seeded(seed = 1) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

const BASE: Omit<FieldFrame, 'state' | 'volume' | 'time'> = {
  dt: 1 / 60,
  width: 800,
  height: 600,
  cx: 400,
  cy: 300,
  radius: 100,
  reducedMotion: false,
}

function run(field: ParticleField, state: FieldFrame['state'], seconds: number, start: number) {
  let time = start
  for (let i = 0; i < seconds * 60; i++) {
    time += BASE.dt
    field.step({ ...BASE, state, volume: state === 'idle' ? 0 : 0.5, time })
  }
  return time
}

function meanDistance(field: ParticleField) {
  const ps = field.particles
  return ps.reduce((sum, p) => sum + Math.hypot(p.x - BASE.cx, p.y - BASE.cy), 0) / ps.length
}

describe('fibonacciSphere', () => {
  it('returns the requested number of points, all on the unit sphere', () => {
    const points = fibonacciSphere(500)
    expect(points).toHaveLength(500)
    for (const p of points) expect(Math.hypot(p.x, p.y, p.z)).toBeCloseTo(1, 6)
  })
})

describe('lettersFrom', () => {
  it('uses the characters of the text without whitespace', () => {
    expect(lettersFrom('Why  a\nBST?')).toEqual(['W', 'h', 'y', 'a', 'B', 'S', 'T', '?'])
  })

  it('falls back to a default alphabet when there is no text', () => {
    expect(lettersFrom(undefined).length).toBeGreaterThan(10)
    expect(lettersFrom('   ').length).toBeGreaterThan(10)
  })
})

describe('particleCount', () => {
  it('scales with the screen area within fixed bounds', () => {
    expect(particleCount(375, 812)).toBeLessThan(particleCount(1440, 900))
    expect(particleCount(10, 10)).toBeGreaterThanOrEqual(400)
    expect(particleCount(10_000, 10_000)).toBeLessThanOrEqual(1800)
  })
})

describe('ParticleField', () => {
  it('stays scattered while idle, gathers into the sphere for a voice, and scatters again', () => {
    const field = new ParticleField({ count: 400, style: 'lines', random: seeded(7) })
    field.resize(BASE.width, BASE.height)

    let t = run(field, 'idle', 2, 0)
    expect(meanDistance(field)).toBeGreaterThan(180)

    t = run(field, 'speaking', 4, t)
    const gathered = meanDistance(field)
    expect(gathered).toBeGreaterThan(BASE.radius * 0.5)
    expect(gathered).toBeLessThan(BASE.radius * 1.3)

    run(field, 'idle', 6, t)
    expect(meanDistance(field)).toBeGreaterThan(180)
  })

  it('also gathers while listening and thinking', () => {
    for (const state of ['listening', 'thinking'] as const) {
      const field = new ParticleField({ count: 300, style: 'letters', random: seeded(3) })
      field.resize(BASE.width, BASE.height)
      run(field, state, 4, 0)
      expect(meanDistance(field)).toBeLessThan(BASE.radius * 1.3)
    }
  })

  it('adds light on a dark page and paints normally on a light one', () => {
    const modes = (light: boolean) => {
      const field = new ParticleField({ count: 20, style: 'lines', random: seeded(2) })
      field.resize(BASE.width, BASE.height)
      field.setLightBackground(light)
      const seen: string[] = []
      const ctx = {
        setTransform: () => {},
        clearRect: () => {},
        beginPath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        stroke(this: { globalCompositeOperation: string }) {
          seen.push(this.globalCompositeOperation)
        },
        globalCompositeOperation: 'source-over',
      } as unknown as CanvasRenderingContext2D
      field.draw(ctx, 1)
      return new Set(seen)
    }
    expect(modes(false)).toEqual(new Set(['lighter']))
    expect(modes(true)).toEqual(new Set(['source-over']))
  })

  it('starts scattered over the first screen size instead of piled in the corner', () => {
    const field = new ParticleField({ count: 300, style: 'lines', random: seeded(3) })
    field.resize(BASE.width, BASE.height)

    const xs = field.particles.map((p) => p.x)
    const ys = field.particles.map((p) => p.y)
    expect(Math.max(...xs)).toBeGreaterThan(BASE.width * 0.8)
    expect(Math.max(...ys)).toBeGreaterThan(BASE.height * 0.8)
  })

  it('draws free letters off the grid and grid letters on it', () => {
    const at = (style: 'letters' | 'grid') => {
      const field = new ParticleField({ count: 60, style, random: seeded(5) })
      field.resize(BASE.width, BASE.height)
      run(field, 'speaking', 1, 0)
      const spots: [number, number][] = []
      const ctx = {
        setTransform: (_a: number, _b: number, _c: number, _d: number, e: number, f: number) => spots.push([e, f]),
        clearRect: () => {},
        fillText: (_t: string, x: number, y: number) => spots.push([x, y]),
        beginPath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        stroke: () => {},
      } as unknown as CanvasRenderingContext2D
      field.draw(ctx, 1)
      return { field, spots }
    }
    const onGrid = (x: number, y: number) =>
      Math.abs(x / 7.4 - Math.round(x / 7.4)) < 1e-6 && Math.abs(y / 12 - Math.round(y / 12)) < 1e-6

    const grid = at('grid')
    const gridText = grid.spots.filter(([x, y]) => x !== 0 || y !== 0)
    expect(gridText.length).toBeGreaterThan(0)
    expect(gridText.every(([x, y]) => onGrid(x, y))).toBe(true)

    const free = at('letters')
    const freeText = free.spots.filter(([x, y]) => x !== 0 || y !== 0)
    expect(freeText.some(([x, y]) => !onGrid(x, y))).toBe(true)
  })

  it('gathers into a wide band of strands for the sound wave, the sphere staying round', () => {
    const spread = (shape: 'sphere' | 'wave') => {
      const field = new ParticleField({ count: 400, style: 'lines', shape, random: seeded(9) })
      field.resize(BASE.width, BASE.height)
      run(field, 'speaking', 4, 0)
      const dx = field.particles.map((p) => Math.abs(p.x - BASE.cx))
      const dy = field.particles.map((p) => Math.abs(p.y - BASE.cy))
      return { field, dx, dy, w: Math.max(...dx), h: Math.max(...dy) }
    }

    const sphere = spread('sphere')
    expect(sphere.w).toBeLessThan(BASE.radius * 1.5)
    expect(sphere.h).toBeLessThan(BASE.radius * 1.5)

    const wave = spread('wave')
    expect(wave.w).toBeGreaterThan(BASE.radius * 1.8)
    expect(wave.h).toBeLessThan(BASE.radius * 0.9)
    // The strands cross and pinch together at both ends of the wave.
    const ends = wave.field.particles.filter((p) => Math.abs(p.x - BASE.cx) > BASE.radius * 2)
    expect(ends.length).toBeGreaterThan(0)
    for (const p of ends) expect(Math.abs(p.y - BASE.cy)).toBeLessThan(BASE.radius * 0.3)
  })

  it('places every wave particle on one of five strands', () => {
    const field = new ParticleField({ count: 400, style: 'lines', shape: 'wave', random: seeded(4) })
    const strands = new Set(field.particles.map((p) => p.strand))
    expect(strands).toEqual(new Set([0, 1, 2, 3, 4]))
    for (const p of field.particles) {
      expect(p.u).toBeGreaterThanOrEqual(-1)
      expect(p.u).toBeLessThanOrEqual(1)
    }
  })

  it('switches between the sphere and the wave without rebuilding the particles', () => {
    const field = new ParticleField({ count: 300, style: 'lines', random: seeded(6) })
    field.resize(BASE.width, BASE.height)
    expect(field.shape).toBe('sphere')
    const before = field.particles
    let t = run(field, 'speaking', 4, 0)

    field.setShape('wave')
    expect(field.particles).toBe(before)
    t = run(field, 'speaking', 3, t)
    expect(Math.max(...field.particles.map((p) => Math.abs(p.x - BASE.cx)))).toBeGreaterThan(BASE.radius * 1.8)

    field.setShape('sphere')
    run(field, 'speaking', 3, t)
    expect(Math.max(...field.particles.map((p) => Math.abs(p.x - BASE.cx)))).toBeLessThan(BASE.radius * 1.5)
  })

  it('keeps every particle position finite', () => {
    const field = new ParticleField({ count: 200, style: 'lines', random: seeded(11) })
    field.resize(BASE.width, BASE.height)
    run(field, 'speaking', 2, 0)
    for (const p of field.particles) {
      expect(Number.isFinite(p.x)).toBe(true)
      expect(Number.isFinite(p.y)).toBe(true)
    }
  })
})
