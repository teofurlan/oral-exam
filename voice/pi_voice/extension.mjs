import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from './client.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const help = 'Local Kokoro voice. Usage: /voice on|off|stop|status|test (default: status).';
const testSentence = 'Hola. Esta es una prueba local de voz en español; README se pronuncia en inglés.';

export default function register(pi, dependencies = {}) {
  let enabled=false, client=null, runTexts=[], runToken=0, disposed=false;
  const modeIsTui = ctx => ctx?.mode === 'tui';
  const notice=(ctx,text,level='info')=>{ if (modeIsTui(ctx)) { try { ctx.ui.notify(text,level); } catch {} } };
  const status=(ctx,text)=>{ if (modeIsTui(ctx)) { try { ctx.ui.setStatus('voice',text); } catch {} } };
  function closeClient() { const old=client; client=null; if(old) old.close(); }
  function ensureClient(ctx) {
    if (!modeIsTui(ctx)) return null;
    if (!client) client=createClient({ root:projectRoot, spawn:dependencies.spawn, killTimeoutMs:dependencies.killTimeoutMs,
      onEvent:event=>{ if(client && !disposed && event.event==='error') notice(ctx,`Voice error: ${event.message || 'worker error'}`,'error'); },
      onError:error=>notice(ctx,`Voice worker error: ${error.message}`,'error') });
    try { client.start(); return client; } catch(error) { client=null; notice(ctx,`Unable to start local voice: ${error.message}`,'error'); return null; }
  }
  async function handle(raw,ctx) {
    if (!modeIsTui(ctx)) return;
    const arg=String(raw ?? '').trim().toLowerCase();
    if (!arg || arg==='status') { notice(ctx,`Local voice is ${enabled?'on':'off'}. ${help}`); return; }
    if (arg==='on') { if(!enabled){ enabled=true; ensureClient(ctx); } notice(ctx,`Local voice ${enabled?'on':'unavailable'}.`); return; }
    if (arg==='off') { enabled=false; runTexts=[]; ++runToken; if(client) client.stop(); closeClient(); status(ctx,''); notice(ctx,'Local voice off.'); return; }
    if (arg==='stop') { runTexts=[]; ++runToken; if(client) client.stop(); notice(ctx,`Current speech stopped; voice remains ${enabled?'on':'off'}.`); return; }
    if (arg==='test') { const c=ensureClient(ctx); if(c){ try { c.speak(`manual-${Date.now()}`,testSentence); notice(ctx,'Playing the manual Spanish voice test.'); } catch(error) { notice(ctx,error.message,'error'); } } return; }
    notice(ctx,help,'warning');
  }
  pi.registerCommand('voice',{ description:help, handler:handle });
  pi.on('agent_start',()=>{ runTexts=[]; ++runToken; });
  pi.on('message_end',event=>{
    const message=event?.message;
    if (!enabled || message?.role!=='assistant' || message.stopReason!=='stop' || !Array.isArray(message.content)) return;
    const text=message.content.filter(block=>block?.type==='text' && typeof block.text==='string').map(block=>block.text).join('\n').trim();
    if(text) runTexts.push({token:runToken,text});
  });
  pi.on('agent_settled',event=>{
    const captured=runTexts; runTexts=[];
    if(event?.aborted || !enabled || !captured.length) return;
    const final=captured.at(-1);
    if(final.token!==runToken) return;
    const c=client; if(!c) return;
    try { c.speak(`answer-${Date.now()}`,final.text); } catch(error) { notice({mode:'tui',ui:dependencies.ui},error.message,'error'); }
  });
  pi.on('session_start',()=>{ runTexts=[]; ++runToken; enabled=false; closeClient(); });
  pi.on('session_shutdown',()=>{ disposed=true; enabled=false; runTexts=[]; ++runToken; closeClient(); });
}
