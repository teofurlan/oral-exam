import { ChoiceList } from '@/components/ChoiceList'
import type { VoiceOption } from '@/types/voice'

export function VoicePicker({
  voices,
  current,
  onChange,
}: {
  voices: VoiceOption[]
  current: string | null
  onChange: (id: string) => void
}) {
  return (
    <div data-testid="voice-picker">
      <ChoiceList
        label="Voice"
        value={current ?? ''}
        onChange={onChange}
        groups={[{ choices: voices.map((v) => ({ value: v.id, label: v.label })) }]}
        empty="Voices load when the server connects."
      />
    </div>
  )
}
