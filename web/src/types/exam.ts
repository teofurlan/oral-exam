export type ProtocolState = 'idle' | 'speaking' | 'listening' | 'thinking'

export type TurnMode = 'auto' | 'push-to-talk'

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'mock' | 'reconnecting'

export interface QuestionData {
  index: number
  total: number
  text: string
  code?: string
}

export interface TranscriptData {
  text: string
  final: boolean
}

// Server -> Client messages
export type ServerMessage =
  | { type: 'state'; state: ProtocolState }
  | { type: 'question'; index: number; total: number; text: string; code?: string }
  | { type: 'finished' }
  | { type: 'tts_audio'; format: string; data: string }
  | { type: 'transcript'; text: string; final: boolean }
  | { type: 'notice'; text: string }

// Client -> Server messages
export type ClientMessage =
  | { type: 'answer_audio'; format: string; data: string }
  | { type: 'answer_text'; text: string }
  | { type: 'reanswer' }
  | { type: 'mode'; mode: TurnMode }
  | { type: 'playback_done' }

export interface ExamState {
  connectionStatus: ConnectionStatus
  protocolState: ProtocolState
  question: QuestionData | null
  finished: boolean
  transcript: TranscriptData
  mode: TurnMode
  notice: string | null
}
