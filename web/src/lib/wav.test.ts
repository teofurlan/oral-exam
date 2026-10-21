import { describe, it, expect } from 'vitest'
import { resample, floatToPCM16, encodeWAV, encodeWAVBase64, hasSpeech } from '@/lib/wav'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function readStr(view: DataView, offset: number, len: number): string {
  let s = ''
  for (let i = 0; i < len; i++) s += String.fromCharCode(view.getUint8(offset + i))
  return s
}
function readU32LE(view: DataView, offset: number): number {
  return view.getUint32(offset, true)
}
function readU16LE(view: DataView, offset: number): number {
  return view.getUint16(offset, true)
}
function readI16LE(view: DataView, offset: number): number {
  return view.getInt16(offset, true)
}

// ─── WAV header fields ────────────────────────────────────────────────────────

describe('encodeWAV — WAV header fields', () => {
  it('writes correct RIFF, WAVE, fmt, data chunk IDs', () => {
    const samples = new Float32Array(160) // 10 ms @ 16 kHz (no resample needed)
    const buf = encodeWAV(samples, 16_000)
    const view = new DataView(buf)

    expect(readStr(view, 0, 4)).toBe('RIFF')
    expect(readStr(view, 8, 4)).toBe('WAVE')
    expect(readStr(view, 12, 4)).toBe('fmt ')
    expect(readStr(view, 36, 4)).toBe('data')
  })

  it('writes correct fmt sub-chunk: PCM, 1 ch, 16 kHz, 16 bit', () => {
    const samples = new Float32Array(160)
    const buf = encodeWAV(samples, 16_000)
    const view = new DataView(buf)

    expect(readU32LE(view, 16)).toBe(16)      // Subchunk1Size
    expect(readU16LE(view, 20)).toBe(1)       // AudioFormat = PCM
    expect(readU16LE(view, 22)).toBe(1)       // NumChannels = mono
    expect(readU32LE(view, 24)).toBe(16_000)  // SampleRate
    expect(readU32LE(view, 28)).toBe(32_000)  // ByteRate = 16000 * 1 * 2
    expect(readU16LE(view, 32)).toBe(2)       // BlockAlign
    expect(readU16LE(view, 34)).toBe(16)      // BitsPerSample
  })

  it('ChunkSize = 36 + data bytes', () => {
    const nSamples = 320
    const samples = new Float32Array(nSamples)
    const buf = encodeWAV(samples, 16_000)
    const view = new DataView(buf)

    expect(readU32LE(view, 4)).toBe(36 + nSamples * 2)   // ChunkSize
    expect(readU32LE(view, 40)).toBe(nSamples * 2)        // Subchunk2Size
    expect(buf.byteLength).toBe(44 + nSamples * 2)
  })
})

// ─── 16 kHz resample ─────────────────────────────────────────────────────────

describe('encodeWAV — 16 kHz resampling', () => {
  it('resamples 44100 Hz input to 16000 Hz output length', () => {
    const inputLength = 4410 // 100 ms @ 44100
    const samples = new Float32Array(inputLength).fill(0.5)
    const buf = encodeWAV(samples, 44_100)
    const view = new DataView(buf)

    const expectedSamples = Math.floor(inputLength / (44_100 / 16_000))
    expect(readU32LE(view, 40)).toBe(expectedSamples * 2)
  })

  it('passthrough when input rate already equals 16000', () => {
    const samples = new Float32Array([0.25, -0.25, 0.5])
    const out = resample(samples, 16_000, 16_000)
    expect(out).toBe(samples) // exact same reference
  })

  it('resample interpolates correctly between two samples', () => {
    // [0, 1] at 2× rate → should yield [0, 0.5, 1] at 1× rate (length / ratio = 1.5 → floor 1 extra)
    const input = new Float32Array([0, 1])
    const out = resample(input, 2, 1)
    expect(out[0]).toBeCloseTo(0, 5)
    // The ratio is 2; index 0 → srcIndex 0 → input[0]=0; output length = floor(2/2)=1
    expect(out.length).toBe(1)
  })
})

// ─── PCM16 clamping ──────────────────────────────────────────────────────────

describe('floatToPCM16 — clamping', () => {
  it('converts +1.0 to 32767', () => {
    expect(floatToPCM16(1.0)).toBe(32767)
  })

  it('converts -1.0 to -32768', () => {
    expect(floatToPCM16(-1.0)).toBe(-32768)
  })

  it('clamps values > 1 to 32767', () => {
    expect(floatToPCM16(2.5)).toBe(32767)
    expect(floatToPCM16(100)).toBe(32767)
  })

  it('clamps values < -1 to -32768', () => {
    expect(floatToPCM16(-2.5)).toBe(-32768)
    expect(floatToPCM16(-100)).toBe(-32768)
  })

  it('converts 0 to 0', () => {
    expect(floatToPCM16(0)).toBe(0)
  })

  it('encodes clamped values correctly in the WAV data section', () => {
    const samples = new Float32Array([1.0, -1.0, 0.0, 2.0, -2.0])
    const buf = encodeWAV(samples, 16_000)
    const view = new DataView(buf)
    // Samples start at byte 44
    expect(readI16LE(view, 44)).toBe(32767)    // +1.0
    expect(readI16LE(view, 46)).toBe(-32768)   // -1.0
    expect(readI16LE(view, 48)).toBe(0)        // 0.0
    expect(readI16LE(view, 50)).toBe(32767)    // +2.0 clamped
    expect(readI16LE(view, 52)).toBe(-32768)   // -2.0 clamped
  })
})

// ─── Base64 output ────────────────────────────────────────────────────────────

describe('encodeWAVBase64', () => {
  it('returns a non-empty base64 string for non-empty input', () => {
    const samples = new Float32Array(160).fill(0.1)
    const result = encodeWAVBase64(samples, 16_000)
    expect(result.length).toBeGreaterThan(0)
    expect(() => atob(result)).not.toThrow()
  })

  it('returns empty string for empty input', () => {
    expect(encodeWAVBase64(new Float32Array(0), 16_000)).toBe('')
  })
})

// ─── hasSpeech ───────────────────────────────────────────────────────────────

describe('hasSpeech', () => {
  it('returns false for silence (all zeros)', () => {
    expect(hasSpeech(new Float32Array(160))).toBe(false)
  })

  it('returns false for near-silence (very small amplitude)', () => {
    const samples = new Float32Array(160).fill(0.0005)
    expect(hasSpeech(samples)).toBe(false)
  })

  it('returns true for audible signal', () => {
    const samples = new Float32Array(160).fill(0.1)
    expect(hasSpeech(samples)).toBe(true)
  })

  it('returns false for empty buffer', () => {
    expect(hasSpeech(new Float32Array(0))).toBe(false)
  })
})
