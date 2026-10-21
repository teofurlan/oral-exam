import { describe, it, expect } from 'vitest'
import { examReducer, initialExamState } from './examReducer'
import type { ServerMessage } from '@/types/exam'

describe('examReducer', () => {
  it('applies protocol state messages correctly', () => {
    const states = ['speaking', 'listening', 'thinking', 'idle'] as const

    let currentState = initialExamState
    for (const st of states) {
      const action: ServerMessage = { type: 'state', state: st }
      currentState = examReducer(currentState, action)
      expect(currentState.protocolState).toBe(st)
    }
  })

  it('applies question message and resets transcript correctly', () => {
    const stateWithTranscript = {
      ...initialExamState,
      transcript: {
        text: 'Old answer from previous question',
        final: true,
      },
    }

    const questionAction: ServerMessage = {
      type: 'question',
      index: 3,
      total: 10,
      text: 'Explain virtual memory.',
    }

    const newState = examReducer(stateWithTranscript, questionAction)

    expect(newState.question).toEqual({
      index: 3,
      total: 10,
      text: 'Explain virtual memory.',
    })
    expect(newState.transcript).toEqual({
      text: '',
      final: false,
    })
  })

  it('applies partial and final transcript messages correctly', () => {
    const partialAction: ServerMessage = {
      type: 'transcript',
      text: 'Virtual memory uses paging...',
      final: false,
    }

    const partialState = examReducer(initialExamState, partialAction)
    expect(partialState.transcript).toEqual({
      text: 'Virtual memory uses paging...',
      final: false,
    })

    const finalAction: ServerMessage = {
      type: 'transcript',
      text: 'Virtual memory uses paging to map virtual addresses to physical frames.',
      final: true,
    }

    const finalState = examReducer(partialState, finalAction)
    expect(finalState.transcript).toEqual({
      text: 'Virtual memory uses paging to map virtual addresses to physical frames.',
      final: true,
    })
  })

  it('handles reanswer action by clearing transcript and switching to listening', () => {
    const answeredState = {
      ...initialExamState,
      protocolState: 'idle' as const,
      transcript: {
        text: 'Some existing answer',
        final: true,
      },
    }

    const newState = examReducer(answeredState, { type: 'reanswer' })
    expect(newState.transcript).toEqual({
      text: '',
      final: false,
    })
    expect(newState.protocolState).toBe('listening')
  })

  it('handles set_mode action correctly', () => {
    const newState = examReducer(initialExamState, {
      type: 'set_mode',
      mode: 'push-to-talk',
    })
    expect(newState.mode).toBe('push-to-talk')
  })

  it('handles set_status action correctly', () => {
    const newState = examReducer(initialExamState, {
      type: 'set_status',
      status: 'connected',
    })
    expect(newState.connectionStatus).toBe('connected')
  })

  it('handles notice and clear_notice actions correctly', () => {
    const noticeAction: ServerMessage = {
      type: 'notice',
      text: "Didn't catch that. Please answer again.",
    }
    const stateWithNotice = examReducer(initialExamState, noticeAction)
    expect(stateWithNotice.notice).toBe("Didn't catch that. Please answer again.")

    const cleared = examReducer(stateWithNotice, { type: 'clear_notice' })
    expect(cleared.notice).toBeNull()
  })

  it('resets notice on question or finished', () => {
    const stateWithNotice = {
      ...initialExamState,
      notice: 'Some notice',
    }
    const qState = examReducer(stateWithNotice, {
      type: 'question',
      index: 1,
      total: 2,
      text: 'Question?',
    })
    expect(qState.notice).toBeNull()

    const finState = examReducer(stateWithNotice, { type: 'finished' })
    expect(finState.notice).toBeNull()
  })
})
