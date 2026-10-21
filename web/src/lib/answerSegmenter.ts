/**
 * AnswerSegmenter — pure state machine (no side effects, no timers).
 *
 * The VAD fires `onSpeechEnd(audio)` repeatedly during a single exam answer
 * (the student thinks, pauses, continues). We must accumulate those segments
 * and only finalize after a long enough silence gap.
 *
 * Transitions:
 *   idle  ──onSpeechEnd──►  accumulating  ──onSpeechEnd──►  accumulating
 *   accumulating  ──onSilenceExpired──►  finalized
 *   accumulating  ──onSpeechStart──►  accumulating  (cancel pending timer)
 *   finalized / idle  ──reset──►  idle
 *
 * The caller owns the timer; this class tells it when to start/cancel.
 */
export type SegmenterEvent =
  | { kind: 'speechEnd'; audio: Float32Array }
  | { kind: 'speechStart' }
  | { kind: 'speechMisfire' }
  | { kind: 'silenceExpired' }
  | { kind: 'reset' }

export type SegmenterAction =
  | { type: 'startTimer' }   // caller must start the silence countdown
  | { type: 'cancelTimer' }  // caller must cancel any running countdown
  | { type: 'finalize'; segments: Float32Array[] } // send the answer
  | null                     // no side effect needed

export type SegmenterState = 'idle' | 'accumulating' | 'finalized'

export interface SegmenterStatus {
  state: SegmenterState
  /** Seconds remaining in the silence countdown (0 when not running) */
  silenceCountdownMs: number
  /** Number of collected speech segments so far */
  segmentCount: number
}

export class AnswerSegmenter {
  private _state: SegmenterState = 'idle'
  private _segments: Float32Array[] = []
  private _timerRunning = false

  get state(): SegmenterState {
    return this._state
  }

  get segments(): Float32Array[] {
    return [...this._segments]
  }

  get timerRunning(): boolean {
    return this._timerRunning
  }

  /** Feed an event; returns the side-effect action the caller must perform. */
  send(event: SegmenterEvent): SegmenterAction {
    if (this._state === 'finalized' && event.kind !== 'reset') return null
    switch (event.kind) {
      case 'speechEnd': {
        this._segments.push(event.audio)
        this._state = 'accumulating'
        // (re-)start the silence timer; any previously running one is replaced
        this._timerRunning = true
        return { type: 'startTimer' }
      }

      case 'speechStart': {
        if (this._state === 'accumulating' && this._timerRunning) {
          // New speech cancels the pending finalization
          this._timerRunning = false
          return { type: 'cancelTimer' }
        }
        return null
      }

      case 'speechMisfire': {
        if (this._state !== 'accumulating') return null
        this._timerRunning = true
        return { type: 'startTimer' }
      }

      case 'silenceExpired': {
        if (this._state !== 'accumulating' || !this._timerRunning) return null
        this._timerRunning = false
        const segments = [...this._segments]
        this._segments = []
        this._state = 'finalized'
        return { type: 'finalize', segments }
      }

      case 'reset': {
        this._state = 'idle'
        this._segments = []
        const wasRunning = this._timerRunning
        this._timerRunning = false
        return wasRunning ? { type: 'cancelTimer' } : null
      }
    }
  }

  /**
   * Merge all collected Float32 segments into one flat array.
   */
  static merge(segments: Float32Array[]): Float32Array {
    const total = segments.reduce((s, a) => s + a.length, 0)
    const out = new Float32Array(total)
    let offset = 0
    for (const seg of segments) {
      out.set(seg, offset)
      offset += seg.length
    }
    return out
  }
}
