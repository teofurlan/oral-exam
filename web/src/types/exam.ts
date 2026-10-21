export type ProtocolState = 'idle' | 'speaking' | 'listening' | 'thinking'

export type TurnMode = 'auto' | 'push-to-talk'

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'mock'

export interface QuestionData {
  index: number
  total: number
  text: string
}

export interface TranscriptData {
  text: string
  final: boolean
}

// Server -> Client messages
export type ServerMessage =
  | { type: 'state'; state: ProtocolState }
  | { type: 'question'; index: number; total: number; text: string }
  | { type: 'tts_audio'; format: string; data: string }
  | { type: 'transcript'; text: string; final: boolean }

// Client -> Server messages
export type ClientMessage =
  | { type: 'answer_audio'; format: string; data: string }
  | { type: 'reanswer' }
  | { type: 'mode'; mode: TurnMode }

export interface ExamState {
  connectionStatus: ConnectionStatus
  protocolState: ProtocolState
  question: QuestionData | null
  transcript: TranscriptData
  mode: TurnMode
}
