import { useCallback, useEffect, useRef, useState } from 'react'
import type { ProtocolState, TurnMode } from '@/types/exam'
import { MicVAD } from '@ricky0123/vad-web'
import { AnswerSegmenter } from '@/lib/answerSegmenter'
import { encodeWAVBase64, hasSpeech } from '@/lib/wav'

const VAD_BASE_PATH = '/vad-assets/'
const PTT_MIN_HOLD_MS = 300
const VAD_SAMPLE_RATE = 16_000
// The legacy model's default 1400 ms redemption rounds down to 14 frames of 96 ms.
const VAD_REDEMPTION_MS = 1344

export interface UseMicCaptureOptions {
  protocolState: ProtocolState
  mode: TurnMode
  silenceTimeoutMs: number
  /** Increments on each server listening message, including re-answer. */
  listeningEpoch?: number
  /** Selected microphone; '' or undefined uses the system default. */
  deviceId?: string
  onFinalize: (base64: string) => void
}

export interface UseMicCaptureResult {
  micError: string | null
  /** The selected microphone could not be opened, so the system default is in use. */
  micFallback: boolean
  getInputVolume: () => number
  silenceCountdownMs: number
  onTalkingChange: (talking: boolean) => void
}

interface AudioCapture {
  stream: MediaStream
  context: AudioContext
  analyser: AnalyserNode
  samples: Uint8Array<ArrayBuffer>
  sourceNode: MediaStreamAudioSourceNode
}

function buildAudioCapture(stream: MediaStream): AudioCapture {
  const context = new AudioContext()
  try {
    const analyser = context.createAnalyser()
    analyser.fftSize = 512
    const sourceNode = context.createMediaStreamSource(stream)
    sourceNode.connect(analyser)
    const samples = new Uint8Array(analyser.fftSize)
    return { stream, context, analyser, samples, sourceNode }
  } catch (error) {
    void context.close().catch(() => {})
    stream.getTracks().forEach((track) => track.stop())
    throw error
  }
}

async function teardownCapture(capture: AudioCapture | null): Promise<void> {
  if (!capture) return
  try { capture.sourceNode.disconnect() } catch { /* already disconnected */ }
  try { capture.analyser.disconnect() } catch { /* already disconnected */ }
  for (const track of capture.stream.getTracks()) track.stop()
  try { await capture.context.close() } catch { /* already closed */ }
}

function audioConstraints(deviceId?: string): MediaStreamConstraints {
  const processing = { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
  return { audio: deviceId ? { ...processing, deviceId: { exact: deviceId } } : processing }
}

/** The selected device is unplugged or no longer matches any input. */
function isMissingDevice(error: unknown): boolean {
  const name = (error as { name?: string } | null)?.name
  return name === 'OverconstrainedError' || name === 'NotFoundError'
}

interface OpenedStream {
  stream: MediaStream
  /** The selected deviceId that could not be opened, or null. */
  fallbackFor: string | null
}

/** Opens the selected microphone, or the system default when it is gone. */
async function openStream(selected: string): Promise<OpenedStream> {
  if (selected) {
    try {
      return { stream: await navigator.mediaDevices.getUserMedia(audioConstraints(selected)), fallbackFor: null }
    } catch (error) {
      if (!isMissingDevice(error)) throw error
      return { stream: await navigator.mediaDevices.getUserMedia(audioConstraints()), fallbackFor: selected }
    }
  }
  return { stream: await navigator.mediaDevices.getUserMedia(audioConstraints()), fallbackFor: null }
}

function micErrorMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === 'NotAllowedError') {
    return 'Microphone access was denied. Please allow microphone access and try again.'
  }
  if (error instanceof DOMException && error.name === 'NotFoundError') {
    return 'No microphone found. Please connect a microphone and try again.'
  }
  return 'Could not access microphone. Check browser permissions.'
}

export function useMicCapture({
  protocolState, mode, silenceTimeoutMs, listeningEpoch = 0, deviceId = '', onFinalize,
}: UseMicCaptureOptions): UseMicCaptureResult {
  const [micError, setMicError] = useState<string | null>(null)
  const [fallbackFor, setFallbackFor] = useState<string | null>(null)
  // Derived, so a new selection hides a note that belonged to the previous one.
  const micFallback = fallbackFor !== null && fallbackFor === deviceId
  const [silenceCountdownMs, setSilenceCountdownMs] = useState(0)
  const captureRef = useRef<AudioCapture | null>(null)
  const vadRef = useRef<MicVAD | null>(null)
  const segmenterRef = useRef(new AnswerSegmenter())
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownRafRef = useRef<number | null>(null)
  const generationRef = useRef(0)
  const sentRef = useRef(false)
  const listeningEpochRef = useRef(listeningEpoch)
  const pttRequestRef = useRef(0)
  const pttPressedRef = useRef(false)
  const pttPressTimeRef = useRef(0)
  const pttChunksRef = useRef<Float32Array[]>([])
  const pttProcessorRef = useRef<ScriptProcessorNode | null>(null)
  const onFinalizeRef = useRef(onFinalize)
  useEffect(() => { onFinalizeRef.current = onFinalize }, [onFinalize])
  const silenceTimeoutRef = useRef(silenceTimeoutMs)
  useEffect(() => { silenceTimeoutRef.current = silenceTimeoutMs }, [silenceTimeoutMs])
  const deviceIdRef = useRef(deviceId)
  useEffect(() => { deviceIdRef.current = deviceId }, [deviceId])

  const getInputVolume = useCallback(() => {
    const capture = captureRef.current
    if (!capture || capture.context.state !== 'running') return 0
    capture.analyser.getByteTimeDomainData(capture.samples)
    let sum = 0
    for (const s of capture.samples) sum += (s / 128 - 1) ** 2
    return Math.min(1, Math.sqrt(sum / capture.samples.length) * 3)
  }, [])

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current !== null) clearTimeout(silenceTimerRef.current)
    silenceTimerRef.current = null
    if (countdownRafRef.current !== null) cancelAnimationFrame(countdownRafRef.current)
    countdownRafRef.current = null
    setSilenceCountdownMs(0)
  }, [])

  const stopCapture = useCallback(() => {
    clearSilenceTimer()
    pttPressedRef.current = false
    ++pttRequestRef.current
    const proc = pttProcessorRef.current
    pttProcessorRef.current = null
    if (proc) {
      proc.onaudioprocess = null
      try { proc.disconnect() } catch { /* already disconnected */ }
    }
    pttChunksRef.current = []
    // Detach synchronously: a slow destroy must not take the next turn's resources.
    const capture = captureRef.current
    captureRef.current = null
    const vad = vadRef.current
    vadRef.current = null
    void teardownCapture(capture)
    if (vad) void vad.destroy().catch(() => {})
    segmenterRef.current.send({ kind: 'reset' })
  }, [clearSilenceTimer])

  const doFinalize = useCallback((segments: Float32Array[]) => {
    clearSilenceTimer()
    if (sentRef.current) return
    const merged = AnswerSegmenter.merge(segments)
    if (!hasSpeech(merged)) {
      segmenterRef.current.send({ kind: 'reset' })
      return
    }
    const base64 = encodeWAVBase64(merged, VAD_SAMPLE_RATE)
    if (base64) {
      sentRef.current = true
      stopCapture()
      onFinalizeRef.current(base64)
    }
  }, [clearSilenceTimer, stopCapture])

  const handleSegmenterAction = useCallback((action: ReturnType<AnswerSegmenter['send']>) => {
    if (!action) return
    if (action.type === 'startTimer') {
      clearSilenceTimer()
      // VAD has already waited through redemption since the last speech frame.
      const ms = Math.max(0, silenceTimeoutRef.current - VAD_REDEMPTION_MS)
      const deadline = Date.now() + ms
      const tick = () => {
        const remaining = Math.max(0, deadline - Date.now())
        setSilenceCountdownMs(remaining)
        countdownRafRef.current = remaining > 0 ? requestAnimationFrame(tick) : null
      }
      setSilenceCountdownMs(ms)
      countdownRafRef.current = requestAnimationFrame(tick)
      silenceTimerRef.current = setTimeout(() => {
        silenceTimerRef.current = null
        handleSegmenterAction(segmenterRef.current.send({ kind: 'silenceExpired' }))
      }, ms)
    } else if (action.type === 'cancelTimer') {
      clearSilenceTimer()
    } else {
      doFinalize(action.segments)
    }
  }, [clearSilenceTimer, doFinalize])

  const startAutoVAD = useCallback(async (generation: number) => {
    const isCurrent = () => generation === generationRef.current && !sentRef.current
    setMicError(null)
    let opened: OpenedStream
    try {
      opened = await openStream(deviceIdRef.current)
    } catch (error) {
      if (isCurrent()) setMicError(micErrorMessage(error))
      return
    }
    const { stream } = opened
    if (!isCurrent()) {
      stream.getTracks().forEach((track) => track.stop())
      return
    }
    setFallbackFor(opened.fallbackFor)
    let capture: AudioCapture | null = null
    try {
      capture = buildAudioCapture(stream)
      captureRef.current = capture
      segmenterRef.current = new AnswerSegmenter()
      const vad = await MicVAD.new({
        getStream: async () => stream,
        // Own this context even if VAD initialization finishes after cleanup.
        audioContext: capture.context,
        baseAssetPath: VAD_BASE_PATH,
        onnxWASMBasePath: VAD_BASE_PATH,
        startOnLoad: true,
        redemptionMs: VAD_REDEMPTION_MS,
        onSpeechStart: () => {
          if (isCurrent()) handleSegmenterAction(segmenterRef.current.send({ kind: 'speechStart' }))
        },
        onSpeechEnd: (audio: Float32Array) => {
          if (isCurrent()) handleSegmenterAction(segmenterRef.current.send({ kind: 'speechEnd', audio }))
        },
        onVADMisfire: () => {
          if (isCurrent()) handleSegmenterAction(segmenterRef.current.send({ kind: 'speechMisfire' }))
        },
      })
      if (!isCurrent()) {
        await vad.destroy()
        return
      }
      vadRef.current = vad
    } catch (error) {
      console.error('VAD init failed:', error)
      // Dispose only this initialization's resources, not a replacement turn.
      if (captureRef.current === capture) {
        captureRef.current = null
        await teardownCapture(capture)
      } else if (!capture) {
        stream.getTracks().forEach((track) => track.stop())
      }
      if (isCurrent()) setMicError('Voice activity detection could not start. Check console for details.')
    }
  }, [handleSegmenterAction])

  const finalizePTT = useCallback(() => {
    const chunks = pttChunksRef.current
    const capture = captureRef.current
    const holdMs = Date.now() - pttPressTimeRef.current
    const sampleRate = capture?.context.sampleRate ?? 44100
    stopCapture() // Also release short and empty captures.
    if (holdMs < PTT_MIN_HOLD_MS || sentRef.current) return
    const merged = AnswerSegmenter.merge(chunks)
    if (!hasSpeech(merged)) return
    const base64 = encodeWAVBase64(merged, sampleRate)
    if (base64) {
      sentRef.current = true
      onFinalizeRef.current(base64)
    }
  }, [stopCapture])

  const onTalkingChange = useCallback((talking: boolean) => {
    if (protocolState !== 'listening' || mode !== 'push-to-talk' || sentRef.current) return
    if (pttPressedRef.current === talking) return
    pttPressedRef.current = talking
    if (!talking) {
      finalizePTT()
      return
    }
    const request = ++pttRequestRef.current
    const generation = generationRef.current
    const isCurrent = () => request === pttRequestRef.current && generation === generationRef.current && pttPressedRef.current && !sentRef.current
    pttPressTimeRef.current = Date.now()
    pttChunksRef.current = []
    setMicError(null)
    // The promise boundary also catches an unavailable mediaDevices API.
    void Promise.resolve().then(() => openStream(deviceIdRef.current)).then(({ stream, fallbackFor: failed }) => {
      if (!isCurrent()) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      setFallbackFor(failed)
      try {
        captureRef.current = buildAudioCapture(stream)
        const { context, sourceNode } = captureRef.current
        const proc = context.createScriptProcessor(4096, 1, 1)
        pttProcessorRef.current = proc
        proc.onaudioprocess = (event) => {
          if (isCurrent()) pttChunksRef.current.push(new Float32Array(event.inputBuffer.getChannelData(0)))
        }
        sourceNode.connect(proc)
        proc.connect(context.destination)
      } catch (error) {
        stream.getTracks().forEach((track) => track.stop())
        throw error
      }
    }).catch((error) => {
      if (!isCurrent()) return
      stopCapture()
      setMicError(micErrorMessage(error))
    })
  }, [finalizePTT, mode, protocolState, stopCapture])

  // A new deviceId restarts listening on that microphone; unsent audio of the turn is dropped.
  useEffect(() => {
    const generation = ++generationRef.current
    if (listeningEpochRef.current !== listeningEpoch) {
      listeningEpochRef.current = listeningEpoch
      sentRef.current = false
    }
    if (protocolState !== 'listening') {
      sentRef.current = false
      stopCapture()
      return
    }
    if (mode === 'auto' && !sentRef.current) void startAutoVAD(generation)
    return () => {
      ++generationRef.current
      stopCapture()
    }
  }, [protocolState, mode, listeningEpoch, deviceId, startAutoVAD, stopCapture])

  return { micError, micFallback, getInputVolume, silenceCountdownMs, onTalkingChange }
}
