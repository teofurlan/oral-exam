import { useEffect, useReducer, useRef, useCallback } from 'react'
import type {
  ClientMessage,
  ServerMessage,
  TurnMode,
} from '@/types/exam'
import { examReducer, initialExamState } from '@/state/examReducer'
import { getStoredTurnMode, setStoredTurnMode } from '@/lib/storage'
import { useExamAudio } from './useExamAudio'

export const DEFAULT_SOCKET_URL = 'ws://localhost:8766/ws'

const MOCK_QUESTIONS = [
  {
    text: 'What is the fundamental difference between a process and a thread in modern operating systems?',
    partialAnswer: 'A process is an execution environment with its own memory space...',
    finalAnswer:
      'A process is an execution environment with its own dedicated virtual memory space, whereas threads are lightweight execution units within a process that share the same address space and resources.',
  },
  {
    text: 'How does virtual memory protect memory isolation between different user processes?',
    partialAnswer: 'Virtual memory maps virtual addresses to physical pages using page tables...',
    finalAnswer:
      'Virtual memory assigns each process its own page table managed by the OS and hardware MMU. Addresses are translated dynamically, preventing a process from accessing physical memory pages mapped to another process.',
  },
  {
    text: 'Explain the three-way handshake used to establish a TCP connection.',
    partialAnswer: 'The client sends SYN, the server responds with SYN-ACK...',
    finalAnswer:
      'The client sends a SYN packet with an initial sequence number. The server responds with a SYN-ACK packet acknowledging the client sequence number and proposing its own. Finally, the client sends an ACK packet back, establishing the bidirectional connection.',
  },
]

export interface UseExamSocketOptions {
  url?: string
  forceMock?: boolean
}

export function useExamSocket(options: UseExamSocketOptions = {}) {
  const { url = DEFAULT_SOCKET_URL, forceMock } = options
  const { playAudio, getOutputVolume } = useExamAudio()
  const [state, dispatch] = useReducer(examReducer, {
    ...initialExamState,
    mode: getStoredTurnMode('auto'),
  })

  const socketRef = useRef<WebSocket | null>(null)
  const mockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isMockActiveRef = useRef<boolean>(false)
  const currentQuestionIdxRef = useRef<number>(0)
  const unmountedRef = useRef<boolean>(false)

  const clearMockTimers = useCallback(() => {
    if (mockTimerRef.current) {
      clearTimeout(mockTimerRef.current)
      mockTimerRef.current = null
    }
  }, [])

  const startMockDriver = useCallback(() => {
    if (unmountedRef.current) return
    isMockActiveRef.current = true
    clearMockTimers()
    dispatch({ type: 'set_status', status: 'mock' })

    const runMockCycle = () => {
      if (!isMockActiveRef.current || unmountedRef.current) return

      const total = MOCK_QUESTIONS.length
      const qIndex = (currentQuestionIdxRef.current % total) + 1
      const qData = MOCK_QUESTIONS[qIndex - 1]

      // Step 1: Thinking (1.5s)
      dispatch({ type: 'state', state: 'thinking' })

      mockTimerRef.current = setTimeout(() => {
        if (!isMockActiveRef.current || unmountedRef.current) return

        // Step 2: Emit question & change state to speaking (3s)
        dispatch({
          type: 'question',
          index: qIndex,
          total,
          text: qData.text,
        })
        dispatch({ type: 'state', state: 'speaking' })

        // 3s speaking duration
        mockTimerRef.current = setTimeout(() => {
          if (!isMockActiveRef.current || unmountedRef.current) return

          // Step 3: Listening
          dispatch({ type: 'state', state: 'listening' })

          // Step 4: Fake partial transcript after 1.5s
          mockTimerRef.current = setTimeout(() => {
            if (!isMockActiveRef.current || unmountedRef.current) return

            dispatch({
              type: 'transcript',
              text: qData.partialAnswer,
              final: false,
            })

            // Step 5: Fake final transcript after 1.5s
            mockTimerRef.current = setTimeout(() => {
              if (!isMockActiveRef.current || unmountedRef.current) return

              dispatch({
                type: 'transcript',
                text: qData.finalAnswer,
                final: true,
              })

              // Step 6: Wait 3s before advancing to next question
              mockTimerRef.current = setTimeout(() => {
                if (!isMockActiveRef.current || unmountedRef.current) return
                currentQuestionIdxRef.current += 1
                runMockCycle()
              }, 3000)
            }, 1500)
          }, 1500)
        }, 3000)
      }, 1500)
    }

    runMockCycle()
  }, [clearMockTimers])

  const send = useCallback((message: ClientMessage) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message))
    }
  }, [])

  const setMode = useCallback(
    (newMode: TurnMode) => {
      setStoredTurnMode(newMode)
      dispatch({ type: 'set_mode', mode: newMode })
      send({ type: 'mode', mode: newMode })
    },
    [send]
  )

  const reanswer = useCallback(() => {
    dispatch({ type: 'reanswer' })
    send({ type: 'reanswer' })

    // If mock driver is active, simulate listening for an answer again
    if (isMockActiveRef.current) {
      clearMockTimers()
      const total = MOCK_QUESTIONS.length
      const qIndex = (currentQuestionIdxRef.current % total) + 1
      const qData = MOCK_QUESTIONS[qIndex - 1]

      mockTimerRef.current = setTimeout(() => {
        if (!isMockActiveRef.current || unmountedRef.current) return
        dispatch({
          type: 'transcript',
          text: qData.partialAnswer,
          final: false,
        })

        mockTimerRef.current = setTimeout(() => {
          if (!isMockActiveRef.current || unmountedRef.current) return
          dispatch({
            type: 'transcript',
            text: qData.finalAnswer,
            final: true,
          })

          mockTimerRef.current = setTimeout(() => {
            if (!isMockActiveRef.current || unmountedRef.current) return
            currentQuestionIdxRef.current += 1
            startMockDriver()
          }, 3000)
        }, 1500)
      }, 1500)
    }
  }, [send, clearMockTimers, startMockDriver])

  const sendAudio = useCallback(
    (base64Data: string) => {
      send({ type: 'answer_audio', format: 'wav', data: base64Data })
    },
    [send]
  )

  useEffect(() => {
    unmountedRef.current = false

    const isExplicitMock =
      forceMock ??
      (typeof window !== 'undefined' &&
        new URLSearchParams(window.location.search).get('mock') === '1')

    if (isExplicitMock) {
      startMockDriver()
      return () => {
        unmountedRef.current = true
        isMockActiveRef.current = false
        clearMockTimers()
      }
    }

    let socket: WebSocket | null = null
    let hasConnected = false
    let disposed = false
    let fellBack = false

    const detachSocket = () => {
      if (!socket) return
      socket.onopen = null
      socket.onmessage = null
      socket.onerror = null
      socket.onclose = null
    }
    const fallBack = () => {
      if (disposed || fellBack) return
      fellBack = true
      detachSocket()
      socket?.close()
      socketRef.current = null
      startMockDriver()
    }

    try {
      socket = new WebSocket(url)
      socketRef.current = socket

      socket.onopen = () => {
        if (disposed || fellBack) return
        hasConnected = true
        dispatch({ type: 'set_status', status: 'connected' })
        const currentMode = getStoredTurnMode('auto')
        socket?.send(JSON.stringify({ type: 'mode', mode: currentMode }))
      }

      socket.onmessage = (event) => {
        if (disposed || fellBack) return
        try {
          const data = JSON.parse(event.data) as ServerMessage
          if (data.type === 'tts_audio') {
            if (data.format === 'wav') playAudio(data.data)
          } else {
            dispatch(data)
          }
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err)
        }
      }

      socket.onerror = () => {
        if (!disposed && !hasConnected) fallBack()
      }

      socket.onclose = () => {
        if (disposed || fellBack) return
        if (!hasConnected) {
          fallBack()
        } else {
          dispatch({ type: 'set_status', status: 'disconnected' })
        }
      }
    } catch {
      fallBack()
    }

    return () => {
      disposed = true
      unmountedRef.current = true
      isMockActiveRef.current = false
      clearMockTimers()
      detachSocket()
      if (!fellBack) socket?.close()
      socketRef.current = null
    }
  }, [url, forceMock, startMockDriver, clearMockTimers, playAudio])

  return {
    state,
    setMode,
    reanswer,
    sendAudio,
    getOutputVolume,
    dispatch,
  }
}
