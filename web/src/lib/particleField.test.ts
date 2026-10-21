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
