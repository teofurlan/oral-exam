// Run after `pnpm -C web build` to validate the production asset contract.
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const web = new URL('../', import.meta.url)
const vad = new URL('dist/vad-assets/', web)

test('VAD model and worklet exist at the exact URLs configured in useMicCapture', () => {
  for (const file of ['silero_vad_legacy.onnx', 'silero_vad_v5.onnx', 'silero_vad_v6.onnx', 'vad.worklet.bundle.min.js']) {
    assert.ok(readFileSync(new URL(file, vad)).length > 0, file)
  }
})

test('every ONNX WASM binary and its runtime module are copied locally', () => {
  const runtime = new URL('node_modules/onnxruntime-web/dist/', web)
  const files = readdirSync(runtime).filter((file) => /^ort-wasm-.*\.(wasm|mjs)$/.test(file))
  assert.ok(files.some((file) => file.endsWith('.mjs')))
  for (const file of files) {
    assert.deepEqual(readFileSync(new URL(file, vad)), readFileSync(new URL(file, runtime)), file)
  }
  console.log('Local runtime assets:', files.join(', '))
})

console.log('Checking:', fileURLToPath(vad))
