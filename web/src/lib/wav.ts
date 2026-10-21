/**
 * WAV encoder: accepts raw Float32 PCM at any sample rate,
 * resamples to 16 kHz mono, encodes as PCM16 WAV, returns a base64 string.
 */

const TARGET_SAMPLE_RATE = 16_000

/**
 * Linearly resample a Float32Array from `fromRate` to `toRate`.
 * For short buffers (< 10 s) the quality is acceptable for STT.
 */
export function resample(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return input
  const ratio = fromRate / toRate
  const outputLength = Math.floor(input.length / ratio)
  const output = new Float32Array(outputLength)
  for (let i = 0; i < outputLength; i++) {
    const srcIndex = i * ratio
    const lo = Math.floor(srcIndex)
    const hi = Math.min(lo + 1, input.length - 1)
    const frac = srcIndex - lo
    output[i] = input[lo] * (1 - frac) + input[hi] * frac
  }
  return output
}

/**
 * Clamp and convert a Float32 sample [-1, 1] to PCM16 (int16).
 * Values outside [-1, 1] are clamped.
 */
export function floatToPCM16(sample: number): number {
  const clamped = Math.max(-1, Math.min(1, sample))
  // Map [-1, 1] → [-32768, 32767]
  return clamped < 0 ? Math.round(clamped * 32768) : Math.round(clamped * 32767)
}

function writeUint32LE(view: DataView, offset: number, value: number): void {
  view.setUint32(offset, value, true)
}
function writeUint16LE(view: DataView, offset: number, value: number): void {
  view.setUint16(offset, value, true)
}

/**
 * Encode Float32 PCM (any rate, mono or first-channel-taken from interleaved)
 * to a 16 kHz mono PCM16 WAV ArrayBuffer.
 *
 * @param samples  Float32Array of audio samples in [-1, 1]
 * @param inputSampleRate  Sample rate of `samples`
 */
export function encodeWAV(samples: Float32Array, inputSampleRate: number): ArrayBuffer {
  const mono = resample(samples, inputSampleRate, TARGET_SAMPLE_RATE)
  const numSamples = mono.length
  const numChannels = 1
  const bitsPerSample = 16
  const byteRate = (TARGET_SAMPLE_RATE * numChannels * bitsPerSample) / 8
  const blockAlign = (numChannels * bitsPerSample) / 8
  const dataBytes = numSamples * blockAlign

  const buffer = new ArrayBuffer(44 + dataBytes)
  const view = new DataView(buffer)

  // RIFF chunk descriptor
  // ChunkID
  view.setUint8(0, 0x52) // 'R'
  view.setUint8(1, 0x49) // 'I'
  view.setUint8(2, 0x46) // 'F'
  view.setUint8(3, 0x46) // 'F'
  // ChunkSize = 36 + dataBytes
  writeUint32LE(view, 4, 36 + dataBytes)
  // Format
  view.setUint8(8, 0x57)  // 'W'
  view.setUint8(9, 0x41)  // 'A'
  view.setUint8(10, 0x56) // 'V'
  view.setUint8(11, 0x45) // 'E'

  // fmt sub-chunk
  view.setUint8(12, 0x66) // 'f'
  view.setUint8(13, 0x6d) // 'm'
  view.setUint8(14, 0x74) // 't'
  view.setUint8(15, 0x20) // ' '
  writeUint32LE(view, 16, 16) // Subchunk1Size (PCM = 16)
  writeUint16LE(view, 20, 1)  // AudioFormat (PCM = 1)
  writeUint16LE(view, 22, numChannels)
  writeUint32LE(view, 24, TARGET_SAMPLE_RATE)
  writeUint32LE(view, 28, byteRate)
  writeUint16LE(view, 32, blockAlign)
  writeUint16LE(view, 34, bitsPerSample)

  // data sub-chunk
  view.setUint8(36, 0x64) // 'd'
  view.setUint8(37, 0x61) // 'a'
  view.setUint8(38, 0x74) // 't'
  view.setUint8(39, 0x61) // 'a'
  writeUint32LE(view, 40, dataBytes)

  // PCM16 samples
  let offset = 44
  for (let i = 0; i < numSamples; i++) {
    view.setInt16(offset, floatToPCM16(mono[i]), true)
    offset += 2
  }

  return buffer
}

/**
 * Encode to WAV and return as a base64 string (no data-URL prefix).
 */
export function encodeWAVBase64(samples: Float32Array, inputSampleRate: number): string {
  if (samples.length === 0) return ''
  const buffer = encodeWAV(samples, inputSampleRate)
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

/**
 * Check whether a Float32 buffer contains any non-silence.
 * Silence threshold: RMS < 0.001
 */
export function hasSpeech(samples: Float32Array): boolean {
  if (samples.length === 0) return false
  let sum = 0
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i]
  const rms = Math.sqrt(sum / samples.length)
  return rms > 0.001
}
