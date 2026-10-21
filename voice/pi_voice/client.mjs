import { spawn as nodeSpawn } from 'node:child_process';
import { StringDecoder } from 'node:string_decoder';
import path from 'node:path';

export function createClient({ root, spawn = nodeSpawn, onEvent = () => {}, onError = () => {}, killTimeoutMs = 1500 } = {}) {
  let child = null, generation = 0, decoder, buffer = '', closed = false, killTimer = null;
  const emitError = error => { try { onError(error); } catch {} };
  function start() {
    if (closed) throw new Error('Voice client is closed');
    if (child) return child;
    const myGeneration = ++generation;
    const python = path.join(root, '.venv', 'Scripts', 'python.exe');
    const proc = spawn(python, ['-B','-u','-X','utf8','pi_voice/backend.py'], { cwd: root, shell: false, stdio: ['pipe','pipe','inherit'] });
    child = proc; decoder = new StringDecoder('utf8'); buffer = '';
    proc.stdout?.on('data', chunk => {
      if (generation !== myGeneration || child !== proc) return;
      buffer += decoder.write(chunk);
      let nl;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0,nl); buffer = buffer.slice(nl+1);
        try { const event = JSON.parse(line); if (event && typeof event.event === 'string') onEvent(event); } catch (error) { emitError(new Error(`Invalid voice worker JSONL: ${error.message}`)); }
      }
    });
    proc.on?.('error', error => { if (generation === myGeneration && child === proc) { child=null; emitError(error); } });
    proc.on?.('exit', (code, signal) => { if (generation === myGeneration && child === proc) { child=null; if (!closed && code !== 0) emitError(new Error(`Voice worker exited (${code ?? signal})`)); } });
    return proc;
  }
  function send(value) {
    if (!child || closed) return false;
    try { return child.stdin.write(`${JSON.stringify(value)}\n`); } catch (error) { emitError(error); return false; }
  }
  function speak(id, text) {
    if (typeof text !== 'string' || text.length > 20000) throw new RangeError('Voice text must be at most 20000 characters');
    if (!child) start();
    return send({ op:'speak', id:String(id), text });
  }
  function stop() { return send({ op:'stop' }); }
  async function shutdown() {
    if (closed) return;
    const proc = child; if (!proc) { closed=true; generation++; return; }
    send({op:'shutdown'});
    await new Promise(resolve => {
      let finished=false;
      const done=()=>{if(finished)return; finished=true; clearTimeout(killTimer); proc.off?.('exit',done); child=null; closed=true; generation++; resolve();};
      proc.once?.('exit',done);
      killTimer=setTimeout(()=>{ try { if (child===proc) proc.kill(); } catch {} done(); },killTimeoutMs);
    });
  }
  function close() {
    const proc=child; if (!proc) { generation++; closed=true; return; }
    closed=true; generation++; child=null;
    try { proc.stdin?.write(`${JSON.stringify({op:'shutdown'})}\n`); } catch {}
    killTimer=setTimeout(()=>{ try { proc.kill(); } catch {} },killTimeoutMs); killTimer.unref?.();
  }
  return { start, speak, stop, shutdown, close, get child(){return child;} };
}
