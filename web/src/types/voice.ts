export interface VoiceOption {
  id: string
  label: string
}

export interface VoiceCatalog {
  voices: VoiceOption[]
  current: string | null
}

export const EMPTY_VOICE_CATALOG: VoiceCatalog = {
  voices: [],
  current: null,
}

export type VoicesMessage = {
  type: 'voices'
  voices: VoiceOption[]
  current: string
}

export type VoiceMessage = {
  type: 'voice'
  voice?: string
}
