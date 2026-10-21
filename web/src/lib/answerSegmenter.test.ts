import { describe, it, expect } from 'vitest'
import { AnswerSegmenter } from '@/lib/answerSegmenter'

const makeAudio = (len = 160, fill = 0.5) => new Float32Array(len).fill(fill)

describe('AnswerSegmenter', () => {
  // ── initial state ─────────────────────────────────────────────────────────

  it('starts in idle state with no segments', () => {
    const s = new AnswerSegmenter()
    expect(s.state).toBe('idle')
    expect(s.segments).toHaveLength(0)
    expect(s.timerRunning).toBe(false)
  })

  // ── R2-a: pause shorter than silence keeps accumulating ───────────────────

  it('accumulates two speechEnd events and keeps the timer running', () => {
    const s = new AnswerSegmenter()
    const audio1 = makeAudio()
    const audio2 = makeAudio()

    const a1 = s.send({ kind: 'speechEnd', audio: audio1 })
    expect(s.state).toBe('accumulating')
    expect(s.segments).toHaveLength(1)
    expect(s.timerRunning).toBe(true)
    expect(a1).toEqual({ type: 'startTimer' })

    // Second speech end: timer is restarted (another startTimer)
    const a2 = s.send({ kind: 'speechEnd', audio: audio2 })
    expect(s.state).toBe('accumulating')
    expect(s.segments).toHaveLength(2)
    expect(s.timerRunning).toBe(true)
    expect(a2).toEqual({ type: 'startTimer' })
  })

  // ── R2-b: new speech cancels the timer ────────────────────────────────────

  it('cancels the timer when speech starts during accumulation', () => {
    const s = new AnswerSegmenter()
    s.send({ kind: 'speechEnd', audio: makeAudio() }) // start timer

    const action = s.send({ kind: 'speechStart' })
    expect(action).toEqual({ type: 'cancelTimer' })
    expect(s.timerRunning).toBe(false)
    expect(s.state).toBe('accumulating') // still accumulating
  })

  it('returns null for speechStart when idle (no timer to cancel)', () => {
    const s = new AnswerSegmenter()
    const action = s.send({ kind: 'speechStart' })
    expect(action).toBeNull()
    expect(s.timerRunning).toBe(false)
  })

  // ── R2-c: silence finalizes once ──────────────────────────────────────────

  it('finalizes exactly once when silence expires', () => {
    const s = new AnswerSegmenter()
    const audio = makeAudio()
    s.send({ kind: 'speechEnd', audio })

    const action = s.send({ kind: 'silenceExpired' })

    expect(action).not.toBeNull()
    expect(action?.type).toBe('finalize')
    if (action?.type === 'finalize') {
      expect(action.segments).toHaveLength(1)
      expect(action.segments[0]).toBe(audio)
    }
    expect(s.state).toBe('finalized')
    expect(s.timerRunning).toBe(false)
    // Segments are cleared from the segmenter after finalization
    expect(s.segments).toHaveLength(0)
  })

  it('ignores silenceExpired when not accumulating', () => {
    const s = new AnswerSegmenter()
    expect(s.send({ kind: 'silenceExpired' })).toBeNull()

    const s2 = new AnswerSegmenter()
    const audio = makeAudio()
    s2.send({ kind: 'speechEnd', audio })
    s2.send({ kind: 'silenceExpired' }) // finalize
    // A second expiry on a finalized segmenter must be a no-op
    expect(s2.send({ kind: 'silenceExpired' })).toBeNull()
  })

  // ── reset ─────────────────────────────────────────────────────────────────

  it('reset from accumulating cancels timer and clears segments', () => {
    const s = new AnswerSegmenter()
    s.send({ kind: 'speechEnd', audio: makeAudio() })

    const action = s.send({ kind: 'reset' })
    expect(action).toEqual({ type: 'cancelTimer' })
    expect(s.state).toBe('idle')
    expect(s.segments).toHaveLength(0)
    expect(s.timerRunning).toBe(false)
  })

  it('reset from idle returns null', () => {
    const s = new AnswerSegmenter()
    expect(s.send({ kind: 'reset' })).toBeNull()
  })

  // ── full lifecycle ─────────────────────────────────────────────────────────

  it('full lifecycle: two segments, cancelled, third, then finalizes', () => {
    const s = new AnswerSegmenter()
    const a1 = makeAudio(200, 0.3)
    const a2 = makeAudio(300, 0.4)
    const a3 = makeAudio(100, 0.5)

    s.send({ kind: 'speechEnd', audio: a1 })
    s.send({ kind: 'speechEnd', audio: a2 })
    // student resumes speaking — cancel the pending timer
    const cancel = s.send({ kind: 'speechStart' })
    expect(cancel?.type).toBe('cancelTimer')

    s.send({ kind: 'speechEnd', audio: a3 })
    const fin = s.send({ kind: 'silenceExpired' })

    expect(fin?.type).toBe('finalize')
    if (fin?.type === 'finalize') {
      expect(fin.segments).toHaveLength(3)
      expect(fin.segments[0]).toBe(a1)
      expect(fin.segments[1]).toBe(a2)
      expect(fin.segments[2]).toBe(a3)
    }
  })

  // ── AnswerSegmenter.merge ─────────────────────────────────────────────────

  it('merge concatenates arrays in order', () => {
    const a = new Float32Array([1, 2, 3])
    const b = new Float32Array([4, 5])
    const merged = AnswerSegmenter.merge([a, b])
    expect(Array.from(merged)).toEqual([1, 2, 3, 4, 5])
  })

  it('merge of empty array yields zero-length Float32Array', () => {
    expect(AnswerSegmenter.merge([])).toHaveLength(0)
  })
})
