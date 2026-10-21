import React, { useEffect, useId, useRef, useState } from 'react'
import { Settings, Timer } from 'lucide-react'
import { ModeToggle } from '@/components/ModeToggle'
import { ORB_PALETTES } from '@/components/orbPalettes'
import { MIN_SILENCE_TIMEOUT_MS, MAX_SILENCE_TIMEOUT_MS } from '@/lib/storage'
import type { TurnMode } from '@/types/exam'

export interface SettingsMenuProps {
  mode: TurnMode
  onModeChange: (mode: TurnMode) => void
  silenceTimeoutMs: number
  onSilenceChange: (ms: number) => void
  paletteId: string
  onPaletteChange: (id: string) => void
}

const swatch = (colors: [string, string]) =>
  `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`

/** Gear button top-right; every setting lives in the popover behind it. */
export const SettingsMenu: React.FC<SettingsMenuProps> = ({
  mode,
  onModeChange,
  silenceTimeoutMs,
  onSilenceChange,
  paletteId,
  onPaletteChange,
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

  const options: { id: string; name: string; colors: [string, string] }[] = [
    { id: 'state', name: 'By state', colors: ['#818cf8', '#f472b6'] },
    ...ORB_PALETTES,
  ]

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        data-testid="settings-button"
        aria-label="Settings"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="press glass-chip grid h-10 w-10 place-items-center rounded-full text-white/80 hover:text-white"
      >
        <Settings
          className="h-[18px] w-[18px]"
          strokeWidth={2}
          style={{
            transform: open ? 'rotate(60deg)' : undefined,
            transition: 'transform 0.6s var(--spring)',
          }}
        />
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Settings"
          data-testid="settings-panel"
          className="materialize glass absolute right-0 top-12 z-30 flex w-[min(20rem,calc(100vw-2.5rem))] origin-top-right flex-col gap-5 rounded-3xl p-5"
        >
          <section className="flex flex-col gap-2.5">
            <h2 className="t-title">Turn mode</h2>
            <ModeToggle mode={mode} onChange={onModeChange} />
          </section>

          {mode === 'auto' && (
            <section className="flex flex-col gap-2.5" data-testid="silence-timeout-control">
              <label htmlFor={`${panelId}-silence`} className="t-title inline-flex items-center gap-2">
                <Timer className="h-3.5 w-3.5" strokeWidth={2} />
                Silence before sending
                <span className="ml-auto tabular-nums" style={{ color: 'var(--label-2)' }}>
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
            </section>
          )}

          <section className="flex flex-col gap-2.5">
            <h2 className="t-title">Orb colors</h2>
            <div role="radiogroup" aria-label="Orb colors" className="grid grid-cols-4 gap-2">
              {options.map((o) => {
                const active = paletteId === o.id
                return (
                  <button
                    key={o.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    data-testid={`palette-${o.id}`}
                    onClick={() => onPaletteChange(o.id)}
                    className="press flex flex-col items-center gap-1.5 rounded-2xl px-1 py-2 t-caption"
                    style={{
                      color: active ? 'var(--label)' : 'var(--label-2)',
                      background: active ? 'rgba(255,255,255,0.1)' : 'transparent',
                    }}
                  >
                    <span
                      aria-hidden
                      className="h-8 w-8 rounded-full"
                      style={{
                        background: swatch(o.colors),
                        boxShadow: active
                          ? '0 0 0 2px var(--bg), 0 0 0 4px rgba(255,255,255,0.85)'
                          : '0 1px 3px rgba(0,0,0,0.5)',
                        transition: 'box-shadow 0.3s var(--ease-settle)',
                      }}
                    />
                    {o.name}
                  </button>
                )
              })}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
