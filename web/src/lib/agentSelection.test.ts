import { describe, it, expect, beforeEach } from 'vitest'
import { chooseSelection } from './agentSelection'
import {
  STORAGE_KEY_AGENT_FOLDER,
  STORAGE_KEY_AGENT_SELECTION,
  getStoredAgentFolder,
  getStoredAgentSelection,
  setStoredAgentFolder,
  setStoredAgentSelection,
} from './storage'
import type { AgentBackendInfo } from '@/types/agent'

const backends: AgentBackendInfo[] = [
  {
    id: 'claude-code',
    label: 'Claude Code',
    models: [{ id: 'sonnet', label: 'Sonnet' }, { id: 'opus', label: 'Opus' }],
    status: { state: 'ready', message: '' },
  },
  {
    id: 'pi',
    label: 'Pi',
    models: [{ id: 'local', label: 'Local' }],
    status: { state: 'unreachable', message: 'Pi is not running' },
  },
]

describe('chooseSelection', () => {
  it('keeps the stored selection when the server still offers it', () => {
    expect(chooseSelection(backends, { backend: 'pi', model: 'local' }, null)).toEqual({ backend: 'pi', model: 'local' })
  })

  it('falls back to the server default when the stored model is gone', () => {
    const fallback = { backend: 'claude-code', model: 'sonnet' }

    expect(chooseSelection(backends, { backend: 'claude-code', model: 'gone' }, fallback)).toEqual(fallback)
    expect(chooseSelection(backends, { backend: 'gone', model: 'x' }, fallback)).toEqual(fallback)
  })

  it('falls back to the first offered model when there is no usable default', () => {
    expect(chooseSelection(backends, null, null)).toEqual({ backend: 'claude-code', model: 'sonnet' })
    expect(chooseSelection(backends, null, { backend: 'gone', model: 'x' })).toEqual({ backend: 'claude-code', model: 'sonnet' })
  })

  it('has nothing to choose without backends', () => {
    expect(chooseSelection([], { backend: 'pi', model: 'local' }, null)).toBeNull()
  })
})

describe('agent storage', () => {
  beforeEach(() => window.localStorage.clear())

  it('remembers the backend and model across reloads', () => {
    setStoredAgentSelection({ backend: 'claude-code', model: 'opus' })

    expect(getStoredAgentSelection()).toEqual({ backend: 'claude-code', model: 'opus' })
  })

  it('ignores a malformed stored selection', () => {
    window.localStorage.setItem(STORAGE_KEY_AGENT_SELECTION, '{"backend": 5}')
    expect(getStoredAgentSelection()).toBeNull()

    window.localStorage.setItem(STORAGE_KEY_AGENT_SELECTION, 'not json')
    expect(getStoredAgentSelection()).toBeNull()
  })

  it('remembers the last folder', () => {
    expect(getStoredAgentFolder()).toBeNull()

    setStoredAgentFolder('C:\\work')

    expect(window.localStorage.getItem(STORAGE_KEY_AGENT_FOLDER)).toBe('C:\\work')
    expect(getStoredAgentFolder()).toBe('C:\\work')
  })
})
