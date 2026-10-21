import type { AgentBackendInfo, AgentSelection } from '@/types/agent'

function offered(backends: AgentBackendInfo[], selection: AgentSelection | null): boolean {
  if (!selection) return false
  const backend = backends.find((candidate) => candidate.id === selection.backend)
  return !!backend?.models.some((model) => model.id === selection.model)
}

/** The stored choice if the server still offers it, else its default, else the first model. */
export function chooseSelection(
  backends: AgentBackendInfo[],
  stored: AgentSelection | null,
  serverDefault: AgentSelection | null,
): AgentSelection | null {
  if (offered(backends, stored)) return stored
  if (offered(backends, serverDefault)) return serverDefault
  for (const backend of backends) {
    if (backend.models.length > 0) return { backend: backend.id, model: backend.models[0].id }
  }
  return null
}
