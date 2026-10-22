import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { wasReplaced } from '@/lib/replacedPage'
import type { AgentClientMessage, AgentSelection, AgentServerMessage } from '@/types/agent'
import { agentReducer, initialAgentState } from '@/state/agentReducer'
import { useExamAudio } from './useExamAudio'

export const AGENT_SOCKET_URL = 'ws://localhost:8766/ws/agent'
const NOTICE_MS = 4000
const FIRST_BACKOFF_MS = 500
const MAX_BACKOFF_MS = 5000

interface UseAgentSocketOptions {
  url?: string
}

/**
 * Agent-mode connection. Unlike the exam socket there is no mock fallback:
 * a missing server shows as reconnecting, and the hook keeps retrying.
 */
export function useAgentSocket({ url = AGENT_SOCKET_URL }: UseAgentSocketOptions = {}) {
  const [state, dispatch] = useReducer(agentReducer, initialAgentState)
  const [listeningEpoch, setListeningEpoch] = useState(0)
  const socketRef = useRef<WebSocket | null>(null)
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { playAudio, stopAudio, getOutputVolume } = useExamAudio()

  const send = useCallback((message: AgentClientMessage) => {
    const socket = socketRef.current
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message))
    }
  }, [])

  const pickFolder = useCallback(() => {
    dispatch({ type: 'folder_pick_requested' })
    send({ type: 'pick_folder' })
  }, [send])

  const start = useCallback((selection: AgentSelection, cwd: string) => {
    send({ type: 'start_agent', backend: selection.backend, model: selection.model, cwd })
  }, [send])

  const sendText = useCallback((text: string) => {
    dispatch({ type: 'user_text', text })
    send({ type: 'turn_text', text })
  }, [send])

  const sendAudio = useCallback((base64: string) => {
    send({ type: 'turn_audio', format: 'wav', data: base64 })
  }, [send])

  const answerPermission = useCallback((id: string, allow: boolean) => {
    dispatch({ type: 'permission_answered', id })
    send({ type: 'permission_response', id, allow })
  }, [send])

  const interrupt = useCallback(() => {
    send({ type: 'interrupt' })
    stopAudio()
  }, [send, stopAudio])

  useEffect(() => {
    let socket: WebSocket | null = null
    let disposed = false
    let backoffMs = FIRST_BACKOFF_MS
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null

    const scheduleReconnect = () => {
      dispatch({ type: 'set_status', status: 'reconnecting' })
      const delay = backoffMs
      backoffMs = Math.min(MAX_BACKOFF_MS, backoffMs * 2)
      if (reconnectTimer) clearTimeout(reconnectTimer)
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null
        connect()
      }, delay)
    }

    const handle = (message: AgentServerMessage) => {
      if (message.type === 'tts_audio') {
        const done = () => send({ type: 'playback_done' })
        if (message.format === 'wav') playAudio(message.data, done)
        else done()
        return
      }
      if (message.type === 'state' && message.state === 'listening') {
        setListeningEpoch((epoch) => epoch + 1)
      }
      if (message.type === 'notice') {
        if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current)
        noticeTimerRef.current = setTimeout(() => dispatch({ type: 'clear_notice' }), NOTICE_MS)
      }
      dispatch(message)
    }

    const connect = () => {
      if (disposed) return
      try {
        socket = new WebSocket(url)
      } catch {
        scheduleReconnect()
        return
      }
      socketRef.current = socket
      socket.onopen = () => {
        if (disposed) return
        backoffMs = FIRST_BACKOFF_MS
        dispatch({ type: 'set_status', status: 'connected' })
        send({ type: 'agent_hello' })
      }
      socket.onmessage = (event) => {
        if (disposed) return
        let message: unknown
        try {
          message = JSON.parse(event.data)
        } catch {
          console.error('Ignoring a malformed agent message:', event.data)
          return
        }
        if (typeof message !== 'object' || message === null || typeof (message as { type?: unknown }).type !== 'string') {
          console.error('Ignoring an agent message without a type:', message)
          return
        }
        handle(message as AgentServerMessage)
      }
      socket.onclose = (event) => {
        if (disposed) return
        if (wasReplaced(event)) dispatch({ type: 'set_status', status: 'replaced' })
        else scheduleReconnect()
      }
    }

    connect()

    return () => {
      disposed = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current)
      if (socket) {
        socket.onopen = null
        socket.onmessage = null
        socket.onclose = null
        socket.close()
      }
      socketRef.current = null
    }
  }, [url, send, playAudio])

  return {
    state,
    dispatch,
    listeningEpoch,
    getOutputVolume,
    pickFolder,
    start,
    sendText,
    sendAudio,
    answerPermission,
    interrupt,
  }
}
