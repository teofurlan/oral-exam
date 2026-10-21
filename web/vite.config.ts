import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { viteStaticCopy } from 'vite-plugin-static-copy'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    viteStaticCopy({
      targets: [
        // VAD worklet bundle (production)
        {
          src: 'node_modules/@ricky0123/vad-web/dist/vad.worklet.bundle.min.js',
          dest: 'vad-assets',
          rename: { stripBase: true },
        },
        // Silero ONNX models
        {
          src: 'node_modules/@ricky0123/vad-web/dist/*.onnx',
          dest: 'vad-assets',
          rename: { stripBase: true },
        },
        // ONNX needs both the WASM binary and its dynamically imported loader.
        {
          src: 'node_modules/onnxruntime-web/dist/ort-wasm-*.{wasm,mjs}',
          dest: 'vad-assets',
          rename: { stripBase: true },
        },
      ],
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
