import React, { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Ellipsis } from 'lucide-react'
import { ChoiceList } from '@/components/ChoiceList'
import { ModeToggle } from '@/components/ModeToggle'
import { ORB_PALETTES, STATE_PALETTES } from '@/components/orbPalettes'
import { VISUALIZERS, DEFAULT_VISUALIZER, type VisualizerId } from '@/components/visualizers'
import type { Microphone } from '@/hooks/useAudioInputs'
import { MIN_SILENCE_TIMEOUT_MS, MAX_SILENCE_TIMEOUT_MS } from '@/lib/storage'
import type { TurnMode } from '@/types/exam'

export interface SettingsMenuProps {
  mode: TurnMode
  onModeChange: (mode: TurnMode) => void
  silenceTimeoutMs: number
  onSilenceChange: (ms: number) => void
  paletteId: string
  onPaletteChange: (id: string) => void
  /** Omit onVisualizerChange to hide the visualizer choice. */
  visualizer?: VisualizerId
  onVisualizerChange?: (id: VisualizerId) => void
  microphones: Microphone[]
  /** '' = system default. */
  micDeviceId: string
  onMicChange: (deviceId: string) => void
  /** Capture is using the system default because the selected microphone failed. */
  micFallback: boolean
  /** Called each time the menu opens, to refresh the device list. */
  onOpen?: () => void
}

function Section({ title, children, testId }: { title: ReactNode; children: ReactNode; testId?: string }) {
  return (
    <section className="flex flex-col gap-2" data-testid={testId}>
      <h2 className="t-small m-0 flex items-center gap-2 font-normal" style={{ color: 'var(--label-2)' }}>
        {title}
        <span aria-hidden="true" className="h-px flex-1" style={{ background: 'var(--rule)' }} />
      </h2>
      {children}
    </section>
  )
}

/** The status bar's last segment: a "…" button that opens every setting above the bar. */
export const SettingsMenu: React.FC<SettingsMenuProps> = ({
  mode,
  onModeChange,
  silenceTimeoutMs,
  onSilenceChange,
  paletteId,
  onPaletteChange,
  visualizer = DEFAULT_VISUALIZER,
  onVisualizerChange,
  microphones,
  micDeviceId,
  onMicChange,
  micFallback,
  onOpen,
}) => {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onPointer)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onPointer)
    }
  }, [open])

  const palettes: { id: string; name: string; colors: [string, string] }[] = [
    { id: 'state', name: 'By state', colors: [STATE_PALETTES.listening[0], STATE_PALETTES.speaking[0]] },
    ...ORB_PALETTES,
  ]

  // An empty list means names are hidden until access is granted, not that the device is gone.
  const micMissing =
    micDeviceId !== '' && microphones.length > 0 && !microphones.some((m) => m.deviceId === micDeviceId)

  return (
    <div ref={rootRef} className="relative flex items-stretch">
      <button
        ref={buttonRef}
        type="button"
        data-testid="settings-button"
        aria-label="Settings"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        title="Settings"
        onClick={() => {
          if (!open) onOpen?.()
          setOpen(!open)
        }}
        className="grid min-w-10 place-items-center border-l px-[1ch] hover:text-[var(--label)]"
        style={{
          borderColor: 'var(--bg)',
          background: open ? 'var(--accent)' : 'var(--bar-seg)',
          color: open ? '#0d1324' : 'var(--label-2)',
        }}
      >
        <Ellipsis aria-hidden="true" className="h-4 w-4" strokeWidth={2.25} />
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Settings"
          data-testid="settings-panel"
          className="pane absolute right-1 bottom-[calc(100%+12px)] z-30 flex max-h-[calc(100dvh-5rem)] w-[min(22rem,calc(100vw-1rem))] flex-col gap-5 overflow-y-auto px-4 pt-5 pb-4"
          style={{ background: 'var(--bg)', borderColor: 'var(--rule-strong)', boxShadow: '0 18px 40px -12px rgba(0,0,0,0.75)' }}
        >
          <Section title="microphone" testId="mic-control">
            <ChoiceList
              label="Microphone"
              value={micDeviceId}
              onChange={onMicChange}
              groups={[
                {
                  choices: [
                    { value: '', label: 'System default' },
                    ...microphones.map((m) => ({ value: m.deviceId, label: m.label })),
                    ...(micMissing ? [{ value: micDeviceId, label: 'Disconnected microphone', note: 'unplugged', disabled: true }] : []),
                  ],
                },
              ]}
            />
            {(micMissing || micFallback) && (
              <p data-testid="mic-fallback-note" className="t-small m-0" style={{ color: 'var(--warn)' }}>
                The selected microphone is not available. Using the system default.
              </p>
            )}
            {microphones.length === 0 && (
              <p className="t-small m-0" style={{ color: 'var(--label-2)' }}>
                Allow microphone access to see device names.
              </p>
            )}
          </Section>

          <Section title="turns">
            <ModeToggle mode={mode} onChange={onModeChange} />
            {mode === 'auto' && (
              <div className="flex flex-col" data-testid="silence-timeout-control">
                <label htmlFor={`${panelId}-silence`} className="t-small flex items-center gap-2" style={{ color: 'var(--label-2)' }}>
                  Silence before sending
                  <span className="ml-auto tabular-nums" style={{ color: 'var(--label)' }}>
                    {(silenceTimeoutMs / 1000).toFixed(1)}s
                  </span>
                </label>
                <input
                  id={`${panelId}-silence`}
                  type="range"
                  className="slim w-full"
                  min={MIN_SILENCE_TIMEOUT_MS}
                  max={MAX_SILENCE_TIMEOUT_MS}
                  step={500}
                  value={silenceTimeoutMs}
                  onChange={(e) => onSilenceChange(Number(e.target.value))}
                  aria-label="End-of-answer silence duration"
                />
              </div>
            )}
          </Section>

          {onVisualizerChange && (
            <Section title="visualizer">
              <div role="radiogroup" aria-label="Visualizer" className="grid grid-cols-3 gap-1">
                {VISUALIZERS.map((v) => {
                  const active = visualizer === v.id
                  return (
                    <button
                      key={v.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      data-testid={`visualizer-${v.id}`}
                      onClick={() => onVisualizerChange(v.id)}
                      className="key t-small"
                      style={active ? { borderColor: 'var(--accent)', color: 'var(--label)', background: 'var(--raise)' } : { color: 'var(--label-2)' }}
                    >
                      {v.name}
                    </button>
                  )
                })}
              </div>
            </Section>
          )}

          <Section title="colors">
            <div role="radiogroup" aria-label="Particle colors" className="grid grid-cols-2 gap-1">
              {palettes.map((o) => {
                const active = paletteId === o.id
                return (
                  <button
                    key={o.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    data-testid={`palette-${o.id}`}
                    onClick={() => onPaletteChange(o.id)}
                    className="t-small flex min-h-8 items-center gap-[1.25ch] rounded-[3px] px-[1ch] text-left hover:bg-[var(--raise)]"
                    style={{ color: active ? 'var(--label)' : 'var(--label-2)', background: active ? 'var(--raise)' : undefined }}
                  >
                    <span aria-hidden="true" className="flex shrink-0">
                      <span className="h-3 w-2" style={{ background: o.colors[0] }} />
                      <span className="h-3 w-2" style={{ background: o.colors[1] }} />
                    </span>
                    {o.name}
                    {active && <span aria-hidden="true" className="ml-auto h-[5px] w-[5px] rounded-full" style={{ background: 'var(--accent)' }} />}
                  </button>
                )
              })}
            </div>
          </Section>
        </div>
      )}
    </div>
  )
}
