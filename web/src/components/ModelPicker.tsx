import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { Check, ChevronDown, ChevronRight } from 'lucide-react'
import type { AgentBackendInfo, AgentSelection } from '@/types/agent'

interface ModelPickerProps {
  backends: AgentBackendInfo[]
  selection: AgentSelection | null
  onChange: (selection: AgentSelection) => void
  placement?: 'above' | 'below'
}

interface ProviderModel {
  id: string
  label: string
}

/** One entry of the provider column: a whole agent, or one provider inside an agent such as Pi. */
interface Provider {
  key: string
  backend: string
  /** The agent's label when the agent is split into several providers. */
  group: string | null
  name: string
  note: string | null
  models: ProviderModel[]
}

const HOVER_DELAY_MS = 150

const providerOf = (id: string) => (id.includes('/') ? id.slice(0, id.indexOf('/')) : null)

/**
 * Splits an agent's models by the provider prefix of their ids ("google/gemini-2.5-pro"), and
 * drops the provider suffix the label repeats ("Gemini 2.5 Pro (google)").
 */
function toProviders(backends: AgentBackendInfo[]): Provider[] {
  return backends.flatMap((backend): Provider[] => {
    const note = backend.status.state === 'ready' ? null : backend.status.state.replace('_', ' ')
    const byProvider = new Map<string | null, ProviderModel[]>()
    for (const model of backend.models) {
      const prefix = providerOf(model.id)
      const suffix = prefix ? ` (${prefix})` : ''
      const label = suffix && model.label.endsWith(suffix) ? model.label.slice(0, -suffix.length) : model.label
      byProvider.set(prefix, [...(byProvider.get(prefix) ?? []), { id: model.id, label }])
    }
    if (byProvider.size <= 1) {
      return [{ key: backend.id, backend: backend.id, group: null, name: backend.label, note, models: [...byProvider.values()][0] ?? [] }]
    }
    return [...byProvider].map(([prefix, models]) => ({
      key: `${backend.id}/${prefix ?? ''}`,
      backend: backend.id,
      group: backend.label,
      name: prefix ?? backend.label,
      note,
      models,
    }))
  })
}

const holds = (provider: Provider, selection: AgentSelection | null) =>
  !!selection && provider.backend === selection.backend && provider.models.some((m) => m.id === selection.model)

const focusIn = (root: HTMLElement | null, selector: string) => {
  const el = root?.querySelector<HTMLElement>(selector)
  el?.focus()
  el?.scrollIntoView?.({ block: 'nearest' })
}

/**
 * Picks an agent's model in two steps: a provider column, and the models of the provider under
 * the pointer or keyboard beside it. The panel can open above a bottom-docked trigger.
 */
export function ModelPicker({ backends, selection, onChange, placement = 'below' }: ModelPickerProps) {
  const providers = toProviders(backends)
  const current = providers.find((p) => holds(p, selection)) ?? null
  const [open, setOpen] = useState(false)
  const [browsing, setBrowsing] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const panelId = useId()
  const hoverTimer = useRef<number | undefined>(undefined)

  const shown = providers.find((p) => p.key === browsing) ?? current ?? providers[0] ?? null
  const currentModel = current?.models.find((m) => m.id === selection?.model)
  const prefix = current
    ? [current.group, current.name].filter(Boolean).join(' · ')
    : backends.find((b) => b.id === selection?.backend)?.label
  const summary = backends.length === 0 ? 'Looking for agents…' : selection ? `${prefix ?? selection.backend} · ${currentModel?.label ?? selection.model}` : 'Choose a model'

  const close = (refocus: boolean) => {
    setOpen(false)
    if (refocus) triggerRef.current?.focus()
  }

  useEffect(() => {
    if (!open) return
    panelRef.current?.scrollIntoView?.({ block: 'nearest' })
    panelRef.current?.querySelector('[data-models] [aria-selected="true"]')?.scrollIntoView?.({ block: 'nearest' })
    focusIn(panelRef.current, `[data-provider="${CSS.escape(shown?.key ?? '')}"]`)
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('pointerdown', onPointer)
    return () => window.removeEventListener('pointerdown', onPointer)
    // Focus lands once per opening; browsing afterwards moves focus itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // A short rest before a hovered provider opens, so a diagonal move to the models does not swap them.
  const hoverBrowse = (key: string | null) => {
    window.clearTimeout(hoverTimer.current)
    if (key) hoverTimer.current = window.setTimeout(() => setBrowsing(key), HOVER_DELAY_MS)
  }

  useEffect(() => () => window.clearTimeout(hoverTimer.current), [])

  const browse = (key: string) => {
    window.clearTimeout(hoverTimer.current)
    setBrowsing(key)
    focusIn(panelRef.current, `[data-provider="${CSS.escape(key)}"]`)
  }

  const enterModels = () => focusIn(panelRef.current, '[data-models] [tabindex="0"]')

  const onProviderKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const at = providers.findIndex((p) => p.key === shown?.key)
    const move = { ArrowDown: 1, ArrowUp: -1 }[event.key]
    if (move) {
      event.preventDefault()
      browse(providers[(at + move + providers.length) % providers.length].key)
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      browse(providers[event.key === 'Home' ? 0 : providers.length - 1].key)
    } else if (event.key === 'ArrowRight' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      enterModels()
    }
  }

  const onModelKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const options = [...event.currentTarget.querySelectorAll<HTMLElement>('[role="option"]')]
    const at = options.indexOf(document.activeElement as HTMLElement)
    const move = { ArrowDown: 1, ArrowUp: -1 }[event.key]
    if (move) {
      event.preventDefault()
      const next = options[(at + move + options.length) % options.length]
      next.focus()
      next.scrollIntoView?.({ block: 'nearest' })
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      options[event.key === 'Home' ? 0 : options.length - 1]?.focus()
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      focusIn(panelRef.current, `[data-provider="${CSS.escape(shown?.key ?? '')}"]`)
    }
  }

  const providerRow = (provider: Provider) => {
    const active = provider.key === shown?.key
    return (
      <button
        key={provider.key}
        type="button"
        role="option"
        aria-selected={active}
        data-provider={provider.key}
        tabIndex={active ? 0 : -1}
        onClick={() => browse(provider.key)}
        onPointerEnter={(e) => e.pointerType === 'mouse' && hoverBrowse(provider.key)}
        onPointerLeave={() => hoverBrowse(null)}
        className="t-ui flex min-h-8 w-full items-center gap-2 px-3 text-left"
        style={{
          color: active ? 'var(--label)' : 'var(--label-2)',
          background: active ? 'var(--raise)' : undefined,
          fontWeight: provider === current ? 600 : 400,
        }}
      >
        <span className="min-w-0 truncate">{provider.name}</span>
        {provider.note && ' '}
        {provider.note && (
          <span className="t-small shrink-0" style={{ color: 'var(--warn)' }}>
            {provider.note}
          </span>
        )}
        <ChevronRight aria-hidden="true" className="ml-auto h-3.5 w-3.5 shrink-0" style={{ color: 'var(--label-3)' }} strokeWidth={2} />
      </button>
    )
  }

  // Agents split into providers share a heading; a whole agent stands as one row.
  const providerColumn = backends.map((backend) => {
    const rows = providers.filter((p) => p.backend === backend.id)
    if (rows.length === 0) return null
    if (rows[0].group === null) return providerRow(rows[0])
    return (
      <div key={backend.id} role="group" aria-label={backend.label} className="flex flex-col">
        <div className="t-small px-3 pt-2.5 pb-1" style={{ color: 'var(--label-3)' }}>
          {backend.label}
        </div>
        {rows.map(providerRow)}
      </div>
    )
  })

  const chosenHere = shown && holds(shown, selection)

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Agent and model: ${summary}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        disabled={backends.length === 0}
        onClick={() => {
          if (open) return close(false)
          setBrowsing(null)
          setOpen(true)
        }}
        onKeyDown={(e) => {
          if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            e.preventDefault()
            setBrowsing(null)
            setOpen(true)
          }
        }}
        className="t-ui flex h-9 w-full min-w-0 items-center gap-2 rounded-[6px] border px-3 text-left hover:bg-[var(--raise)] disabled:cursor-not-allowed disabled:hover:bg-transparent"
        style={{ borderColor: open ? 'var(--accent)' : 'var(--seam-strong)', background: 'var(--panel)' }}
      >
        <span className="min-w-0 flex-1 truncate">
          {selection && backends.length > 0 ? (
            <>
              <span style={{ color: 'var(--label-2)' }}>{prefix ?? selection.backend} · </span>
              <span className="font-semibold" style={{ color: 'var(--label)' }}>
                {currentModel?.label ?? selection.model}
              </span>
            </>
          ) : (
            <span style={{ color: 'var(--label-2)' }}>{summary}</span>
          )}
        </span>
        <ChevronDown
          aria-hidden="true"
          className="h-3.5 w-3.5 shrink-0 transition-transform duration-150"
          style={{ color: 'var(--label-2)', transform: open ? 'rotate(180deg)' : undefined }}
          strokeWidth={2}
        />
      </button>

      {open && (
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label="Choose agent and model"
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault()
              close(true)
            }
          }}
          onBlur={(e) => {
            if (!rootRef.current?.contains(e.relatedTarget as Node | null) && e.relatedTarget) setOpen(false)
          }}
          className={`absolute z-30 grid h-[min(20rem,55dvh)] grid-cols-[minmax(0,2fr)_minmax(0,3fr)] overflow-hidden rounded-lg border ${placement === 'above' ? 'bottom-[calc(100%+6px)] right-0 w-[min(28rem,calc(100vw-24px))]' : 'top-[calc(100%+6px)] right-0 left-0'}`}
          style={{ background: 'var(--panel)', borderColor: 'var(--seam-strong)', boxShadow: '0 16px 40px -16px rgba(0,0,0,0.45)' }}
        >
          <div
            role="listbox"
            aria-label="Provider"
            onKeyDown={onProviderKey}
            className="flex min-h-0 flex-col overflow-y-auto border-r py-1"
            style={{ borderColor: 'var(--seam)' }}
          >
            {providerColumn}
          </div>
          <div role="listbox" aria-label="Model" data-models onKeyDown={onModelKey} className="flex min-h-0 flex-col overflow-y-auto py-1">
            {shown?.models.map((model, i) => {
              const chosen = !!chosenHere && model.id === selection?.model
              return (
                <button
                  key={model.id}
                  type="button"
                  role="option"
                  aria-selected={chosen}
                  tabIndex={chosen || (!chosenHere && i === 0) ? 0 : -1}
                  onClick={() => {
                    onChange({ backend: shown.backend, model: model.id })
                    close(true)
                  }}
                  className="t-ui flex min-h-8 w-full shrink-0 items-center gap-2 px-3 text-left hover:bg-[var(--raise)] hover:text-[var(--label)]"
                  style={{ color: chosen ? 'var(--label)' : 'var(--label-2)', fontWeight: chosen ? 600 : 400 }}
                >
                  <span aria-hidden="true" className="grid w-3.5 shrink-0 place-items-center">
                    {chosen && <Check className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} strokeWidth={2.5} />}
                  </span>
                  <span className="min-w-0 truncate">{model.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
