/**
 * Particle field behind the exam screen: particles drift loose over the whole screen while
 * nothing is said, and gather around the visualizer's slot, into a rotating sphere or a sound
 * wave, whenever there is a voice (speaking, listening) or the examiner is thinking.
 *
 * Plain TypeScript with no React, so the physics can be tested without a canvas.
 */

export type FieldState = 'idle' | 'speaking' | 'listening' | 'thinking'
export type ParticleStyle = 'lines' | 'letters' | 'grid'
export type FieldShape = 'sphere' | 'wave'

export interface FieldFrame {
  /** Seconds since the previous frame. */
  dt: number
  /** Seconds, monotonic. */
  time: number
  width: number
  height: number
  /** Centre and radius of the visualizer's slot, in the same pixels as width/height. */
  cx: number
  cy: number
  radius: number
  state: FieldState
  /** Raw voice level 0..1; the field smooths it. */
  volume: number
  reducedMotion: boolean
}

export interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  /** Loose position, normalised to 0..1 of the screen. */
  hx: number
  hy: number
  /** How far this particle has gathered, 0..1. */
  g: number
  /** Unit-sphere direction it takes in the formation. */
  dx: number
  dy: number
  dz: number
  /** Sound-wave strand it belongs to, its place along it (-1..1) and across it (about -1..1). */
  strand: number
  u: number
  v: number
  hue: number
  rate: number
  ph: number
  spd: number
  letter: string
  // Render attributes, refreshed by step().
  depth: number
  ang: number
  alpha: number
  size: number
  /** Where in the two-colour gradient it is painted, 0..1. */
  tint: number
}

const TAU = Math.PI * 2
const TILT = 0.38
/** Five sine strands that cross one another; each pinches to a point at both ends. */
const STRANDS = [
  { amp: 1.0, f: 1.35, s: 2.3, ph: 0.0, thick: 1.0, alpha: 1.0, hue: 0.0 },
  { amp: 0.78, f: 2.05, s: -1.9, ph: 1.7, thick: 0.85, alpha: 0.85, hue: 1.0 },
  { amp: 0.6, f: 2.9, s: 3.0, ph: 3.1, thick: 0.7, alpha: 0.72, hue: 0.35 },
  { amp: 0.46, f: 1.75, s: -2.6, ph: 4.4, thick: 0.6, alpha: 0.6, hue: 0.7 },
  { amp: 0.32, f: 3.6, s: 1.6, ph: 5.2, thick: 0.5, alpha: 0.5, hue: 0.5 },
]
const FALLBACK_LETTERS = 'abcdefghijklmnopqrstuvwxyz0123456789?'.split('')
const MONO = 'ui-monospace, "Cascadia Mono", "SF Mono", Consolas, monospace'
const BUCKETS = 10
const CELL_W = 7.4
const CELL_H = 12

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const smooth = (t: number) => t * t * (3 - 2 * t)

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Points spread evenly over the unit sphere (golden-angle spiral). */
export function fibonacciSphere(n: number): { x: number; y: number; z: number }[] {
  const golden = Math.PI * (3 - Math.sqrt(5))
  return Array.from({ length: n }, (_, i) => {
    const y = 1 - (2 * (i + 0.5)) / n
    const r = Math.sqrt(1 - y * y)
    return { x: Math.cos(i * golden) * r, y, z: Math.sin(i * golden) * r }
  })
}

/** The characters the "letters" look draws: the question itself, or a plain alphabet. */
export function lettersFrom(text: string | undefined): string[] {
  const chars = Array.from(text ?? '').filter((c) => c.trim() !== '')
  return chars.length > 0 ? chars : FALLBACK_LETTERS
}

/** Enough particles to fill the screen without drowning it, scaled by area. */
export function particleCount(width: number, height: number): number {
  return Math.round(clamp((width * height) / 900, 400, 1800))
}

/** A speech-like level for when no real audio level is available. */
export function simulatedVoice(t: number): number {
  const phrase = clamp((Math.sin(t * 1.1) + Math.sin(t * 0.37 + 1) + 0.4) * 2, 0, 1)
  const syllable = Math.pow(Math.abs(Math.sin(t * 5 * Math.PI + Math.sin(t * 1.7) * 1.2)), 1.4)
  return phrase * (0.22 + 0.78 * syllable)
}

export interface ParticleFieldOptions {
  count: number
  style: ParticleStyle
  shape?: FieldShape
  letters?: string[]
  random?: () => number
}

export class ParticleField {
  particles: Particle[] = []
  style: ParticleStyle
  shape: FieldShape
  private letters: string[]
  private random: () => number
  private width = 1
  private height = 1
  private level = 0
  private rot = 0
  private col0: [number, number, number] = [129, 140, 248]
  private col1: [number, number, number] = [192, 132, 252]
  private target0 = this.col0
  private target1 = this.col1
  /** Additive light reads on a dark ground; a light ground needs plain paint. */
  private additive = 'lighter' as GlobalCompositeOperation

  constructor({ count, style, shape = 'sphere', letters = FALLBACK_LETTERS, random = Math.random }: ParticleFieldOptions) {
    this.style = style
    this.shape = shape
    this.letters = letters
    this.random = random
    this.setCount(count)
  }

  private sized = false

  resize(width: number, height: number) {
    this.width = width
    this.height = height
    // Particles are built before the screen size is known: put them at their homes once.
    if (!this.sized) {
      this.sized = true
      for (const p of this.particles) {
        p.x = p.hx * width
        p.y = p.hy * height
      }
    }
  }

  /** Rebuilds the formation for a new count, keeping existing particles where they are. */
  setCount(count: number) {
    const rnd = this.random
    const sphere = fibonacciSphere(count)
    const perStrand = Math.ceil(count / STRANDS.length)
    this.particles = sphere.map((d, i) => {
      const old = this.particles[i]
      const hx = old ? old.hx : rnd()
      const hy = old ? old.hy : rnd()
      const hue = rnd()
      return {
        x: old ? old.x : hx * this.width,
        y: old ? old.y : hy * this.height,
        vx: 0,
        vy: 0,
        hx,
        hy,
        g: old ? old.g : 0,
        dx: d.x,
        dy: d.y,
        dz: d.z,
        strand: i % STRANDS.length,
        u: -1 + 2 * ((Math.floor(i / STRANDS.length) + rnd()) / perStrand),
        v: (rnd() + rnd() + rnd()) / 1.5 - 1,
        hue,
        rate: 0.8 + rnd() * 2.6,
        ph: rnd() * TAU,
        spd: 0.4 + rnd() * 0.6,
        letter: this.letters[i % this.letters.length],
        depth: 0.5,
        ang: 0,
        alpha: 0,
        size: 1,
        tint: hue,
      }
    })
  }

  setLetters(letters: string[]) {
    this.letters = letters
    this.particles.forEach((p, i) => {
      p.letter = letters[i % letters.length]
    })
  }

  /** The particles keep their places and glide into the new formation. */
  setShape(shape: FieldShape) {
    this.shape = shape
  }

  setLightBackground(light: boolean) {
    this.additive = light ? 'source-over' : 'lighter'
  }

  setColors(colors: [string, string]) {
    this.target0 = hexToRgb(colors[0])
    this.target1 = hexToRgb(colors[1])
  }

  step(f: FieldFrame) {
    const { dt, time: t, width: W, height: H, cx, cy } = f
    this.width = W
    this.height = H
    const motion = f.reducedMotion ? 0.4 : 1

    this.level += (f.volume - this.level) * (1 - Math.exp(-dt * (f.volume > this.level ? 26 : 8)))
    const vol = this.level
    this.rot += dt * (f.state === 'thinking' ? 0.9 : 0.22 + vol * 0.7) * motion

    const ck = 1 - Math.exp(-dt * 3)
    for (let i = 0; i < 3; i++) {
      this.col0[i] = lerp(this.col0[i], this.target0[i], ck)
      this.col1[i] = lerp(this.col1[i], this.target1[i], ck)
    }

    const G = f.state === 'idle' ? 0 : 1
    const R = f.radius * 0.85 * (1 + vol * 0.1)
    const cr = Math.cos(this.rot), sr = Math.sin(this.rot)
    const ct = Math.cos(TILT), st = Math.sin(TILT)
    const wave = this.shape === 'wave'
    const halfW = Math.min(f.radius * 2.4, W * 0.45)

    for (const p of this.particles) {
      // Loose home: a slow flow field over the whole screen, wrapping at the edges.
      const da = p.ph + Math.sin(t * 0.11 + p.hy * 3.3) * 1.6 + Math.cos(t * 0.07 + p.hx * 2.7)
      p.hx += Math.cos(da) * 0.006 * dt * p.spd * motion * (H / W)
      p.hy += Math.sin(da) * 0.006 * dt * p.spd * motion
      let wx = 0, wy = 0
      if (p.hx < -0.04) { p.hx += 1.08; wx = 1.08 } else if (p.hx > 1.04) { p.hx -= 1.08; wx = -1.08 }
      if (p.hy < -0.04) { p.hy += 1.08; wy = 1.08 } else if (p.hy > 1.04) { p.hy -= 1.08; wy = -1.08 }

      p.g += (G - p.g) * (1 - Math.exp(-dt * p.rate))
      const e = smooth(clamp(p.g, 0, 1))
      if (wx || wy) {
        p.x += wx * W * (1 - e)
        p.y += wy * H * (1 - e)
      }

      let fx: number, fy: number, fa: number, depth: number
      if (wave) {
        // Formation: a thick strand of a sound wave whose height follows the voice.
        const c = STRANDS[p.strand]
        const A = R * 0.65 * (0.06 + 0.94 * vol) * c.amp
        const base = Math.max(0, 1 - p.u * p.u)
        const env = Math.pow(base, 1.6)
        const arg = p.u * c.f * Math.PI + t * c.s * motion + c.ph
        const sn = Math.sin(arg), cs = Math.cos(arg)
        const thick = R * (0.03 + 0.15 * vol * c.thick) * (0.35 + 0.65 * env)
        fx = cx + p.u * halfW
        fy = cy + sn * A * env + p.v * thick
        fa = Math.atan2(A * (cs * c.f * Math.PI * env + sn * -3.2 * p.u * Math.pow(base, 0.6)), halfW)
        depth = c.alpha
      } else {
        // Formation: a rotating, tilted sphere whose surface ripples with the voice.
        const n = Math.sin(p.dx * 3.1 + t * 1.9) * Math.sin(p.dy * 3.7 - t * 1.4) * Math.sin(p.dz * 2.9 + t * 1.1)
        const d = 1 + vol * 0.34 * n + 0.025 * Math.sin(t * 1.2)
        const x = p.dx * d, y = p.dy * d, z = p.dz * d
        const x1 = x * cr + z * sr, z1 = -x * sr + z * cr
        const y2 = y * ct - z1 * st, z2 = y * st + z1 * ct
        const s = 1 / (1 - z2 * 0.28)
        fx = cx + x1 * R * s
        fy = cy + y2 * R * s
        fa = Math.atan2(x1 * st, z1)
        depth = clamp((z2 + 1) / 2, 0, 1)
      }

      // Spring toward a blend of the loose home and the formation, swirling while in transit.
      const tx = lerp(p.hx * W, fx, e), ty = lerp(p.hy * H, fy, e)
      const k = lerp(9, 95, e), c = 2 * Math.sqrt(k) * 0.78
      let ax = (tx - p.x) * k - p.vx * c
      let ay = (ty - p.y) * k - p.vy * c
      const transit = e * (1 - e) * 4 * (f.reducedMotion ? 0.3 : 1)
      if (transit > 0.01) {
        const rx = p.x - cx, ry = p.y - cy, rl = Math.hypot(rx, ry) + 1
        ax += (-ry / rl) * 700 * transit
        ay += (rx / rl) * 700 * transit
      }
      p.vx += ax * dt
      p.vy += ay * dt
      p.x += p.vx * dt
      p.y += p.vy * dt

      // Lines point along their drift or flight while loose, along the spin or the strand once
      // gathered (blended on doubled angles, since a line has no head or tail).
      const speed = Math.hypot(p.vx, p.vy), w = clamp(speed / 140, 0, 1)
      const va = Math.atan2(p.vy, p.vx)
      let sx = lerp(Math.cos(2 * da), Math.cos(2 * va), w)
      let sy = lerp(Math.sin(2 * da), Math.sin(2 * va), w)
      sx = lerp(sx, Math.cos(2 * fa), e)
      sy = lerp(sy, Math.sin(2 * fa), e)
      p.ang = Math.atan2(sy, sx) / 2

      const twinkle = 0.7 + 0.3 * Math.sin(t * (0.8 + p.spd) + p.ph)
      p.depth = lerp(0.5, depth, e)
      p.alpha = lerp(0.16 * twinkle, wave ? 0.35 + 0.65 * depth : 0.22 + 0.78 * depth, e)
      const scale = wave ? 0.85 + 0.25 * depth : 0.75 + 0.55 * depth
      p.size = lerp(7, 4 + 10 * vol + 3 * depth, e) * lerp(1, scale, e) + w * 6 * (1 - e)
      // On the wave each strand leans toward its own colour.
      p.tint = wave ? lerp(p.hue, STRANDS[p.strand].hue, 0.75 * e) : p.hue
    }
  }

  draw(ctx: CanvasRenderingContext2D, dpr: number) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
    ctx.clearRect(0, 0, this.width, this.height)

    const colors: string[] = []
    for (let b = 0; b < BUCKETS; b++) {
      const m = b / (BUCKETS - 1)
      const [a, c] = [this.col0, this.col1]
      colors.push(`rgb(${lerp(a[0], c[0], m) | 0},${lerp(a[1], c[1], m) | 0},${lerp(a[2], c[2], m) | 0})`)
    }

    if (this.style === 'lines') {
      ctx.globalCompositeOperation = this.additive
      ctx.lineCap = 'round'
      for (const p of this.particles) {
        const hx = (Math.cos(p.ang) * p.size) / 2, hy = (Math.sin(p.ang) * p.size) / 2
        ctx.globalAlpha = p.alpha
        ctx.strokeStyle = colors[Math.min(BUCKETS - 1, (p.tint * BUCKETS) | 0)]
        ctx.lineWidth = 1 + 0.5 * p.depth
        ctx.beginPath()
        ctx.moveTo(p.x - hx, p.y - hy)
        ctx.lineTo(p.x + hx, p.y + hy)
        ctx.stroke()
      }
    } else if (this.style === 'grid') {
      // Letters snap to a terminal grid, like text art.
      ctx.font = `400 12px ${MONO}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      for (const p of this.particles) {
        ctx.globalAlpha = p.alpha
        ctx.fillStyle = colors[Math.min(BUCKETS - 1, (p.tint * BUCKETS) | 0)]
        ctx.fillText(p.letter, Math.round(p.x / CELL_W) * CELL_W, Math.round(p.y / CELL_H) * CELL_H)
      }
    } else {
      // Free letters float where the particle is and grow with it, nearer ones larger.
      ctx.globalCompositeOperation = this.additive
      ctx.font = `400 12px ${MONO}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      for (const p of this.particles) {
        const s = clamp(p.size / 8, 0.6, 2) * dpr
        ctx.globalAlpha = p.alpha
        ctx.fillStyle = colors[Math.min(BUCKETS - 1, (p.tint * BUCKETS) | 0)]
        ctx.setTransform(s, 0, 0, s, p.x * dpr, p.y * dpr)
        ctx.fillText(p.letter, 0, 0)
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
  }
}
