import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Texture } from 'three'
import { Orb } from './orb'

const { loadTexture, canvas } = vi.hoisted(() => ({
  loadTexture: vi.fn(),
  canvas: document.createElement('canvas'),
}))

vi.mock('@react-three/drei', () => ({
  useTexture: (url: string) => {
    loadTexture(url)
    // Model a browser whose only reachable origin is localhost.
    expect(new URL(url, window.location.href).origin).toBe(window.location.origin)
    return new Texture()
  },
}))

// R3F host primitives have no DOM equivalent; keep this test at the texture-loader boundary.
vi.mock('react/jsx-runtime', async (importOriginal) => {
  const runtime = await importOriginal<typeof import('react/jsx-runtime')>()
  const Mesh = () => null
  return {
    ...runtime,
    jsx: (type: Parameters<typeof runtime.jsx>[0], props: unknown, key?: string) =>
      runtime.jsx(type === 'mesh' ? Mesh : type, props, key),
    jsxs: (type: Parameters<typeof runtime.jsxs>[0], props: unknown, key?: string) =>
      runtime.jsxs(type === 'mesh' ? Mesh : type, props, key),
  }
})
vi.mock('react/jsx-dev-runtime', async (importOriginal) => {
  const runtime = await importOriginal<typeof import('react/jsx-dev-runtime')>()
  const Mesh = () => null
  return {
    ...runtime,
    jsxDEV: (...args: Parameters<typeof runtime.jsxDEV>) => {
      if (args[0] === 'mesh') args[0] = Mesh
      return runtime.jsxDEV(...args)
    },
  }
})

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => children,
  useFrame: vi.fn(),
  useThree: () => ({ gl: { domElement: canvas } }),
}))

describe('Orb offline assets', () => {
  it('renders with a bundled texture without requiring an external origin', () => {
    render(<Orb agentState="talking" />)
    expect(loadTexture).toHaveBeenCalledOnce()
    expect(loadTexture.mock.calls[0][0]).toMatch(/perlin-noise\.png/)
  })
})
