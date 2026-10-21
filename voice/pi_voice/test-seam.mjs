import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from './client.mjs';

test('client and real backend communicate via JSONL stdio', async () => {
  process.env.VOICE_NO_PLAYBACK = '1';
  const root = fileURLToPath(new URL('..', import.meta.url));
  const events = [];
  let onReadyResolve;
  const readyPromise = new Promise(resolve => { onReadyResolve = resolve; });
  let onIdleResolve;
  const idlePromise = new Promise(resolve => { onIdleResolve = resolve; });

  const client = createClient({
    root,
    onEvent: ev => {
      events.push(ev);
      if (ev.event === 'ready') onReadyResolve();
      if (ev.event === 'idle' && ev.id === 'seam-1') onIdleResolve();
    },
    onError: err => {
      assert.fail(`Unexpected client error: ${err.message}`);
    },
  });

  try {
    client.start();
    assert.ok(client.child, 'Child process should be created');

    // Wait for ready event (model loading may take 1-4s)
    await Promise.race([
      readyPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timed out waiting for ready event')), 10000)),
    ]);
    assert.ok(events.some(e => e.event === 'ready'), 'Ready event should be emitted');

    client.speak('seam-1', 'Hola. Probando la integración con README y API.');

    await Promise.race([
      idlePromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timed out waiting for idle event')), 15000)),
    ]);

    assert.ok(events.some(e => e.event === 'accepted' && e.id === 'seam-1'), 'Accepted event should be emitted');
    assert.ok(events.some(e => e.event === 'speaking' && e.id === 'seam-1'), 'Speaking event should be emitted');
    const idle = events.find(e => e.event === 'idle' && e.id === 'seam-1');
    assert.ok(idle, 'Idle event should be emitted');
    assert.ok(idle.duration_seconds > 0, 'Duration should be positive');
  } finally {
    await client.shutdown();
    assert.equal(client.child, null, 'Child should be cleaned up after shutdown');
  }
});
