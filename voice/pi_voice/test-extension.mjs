import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import extension from './extension.mjs';
function setup(mode='tui'){
 const handlers=new Map(),commands=new Map(),children=[],notices=[];
 const pi={on:(e,h)=>{const list=handlers.get(e)||[];list.push(h);handlers.set(e,list);},registerCommand:(n,c)=>commands.set(n,c)};
 const ctx={mode,cwd:'C:/ignored',ui:{notify:(...a)=>notices.push(a),setStatus(){}}};
 extension(pi,{spawn:(...args)=>{const c=new EventEmitter();c.args=args;c.stdin={writes:[],write(s){this.writes.push(s);return true;}};c.stdout=new EventEmitter();c.stderr=new EventEmitter();c.kill=()=>c.emit('exit',null,'SIGKILL');children.push(c);return c;},killTimeoutMs:1});
 const emit=(type,event={})=>{for(const h of handlers.get(type)||[])h({type,...event},ctx);};
 return {handlers,commands,children,notices,ctx,emit};
}
const call=(x,arg)=>x.commands.get('voice').handler(arg,x.ctx);
test('factory registers /voice and starts disabled without child creation; mode is TUI-only',async()=>{
 const x=setup('json');assert.deepEqual(x.children,[]);assert.equal(x.commands.get('voice').description.includes('/voice'),true);
 await call(x,'status');await call(x,'on');await call(x,'test');assert.equal(x.children.length,0);
 const y=setup();assert.equal(y.children.length,0);await call(y,'status');assert.equal(y.children.length,0);
});
test('commands on, status, stop, off and test have explicit lifecycle semantics',async()=>{
 const x=setup();await call(x,'on');assert.equal(x.children.length,1);assert.equal(x.children[0].args[1].at(-1),'pi_voice/backend.py');
 await call(x,'stop');assert.equal(JSON.parse(x.children[0].stdin.writes.at(-1)).op,'stop');assert.equal(x.children.length,1);
 await call(x,'test');assert.equal(JSON.parse(x.children[0].stdin.writes.at(-1)).text,'Hola. Esta es una prueba local de voz en español; README se pronuncia en inglés.');
 await call(x,'status');assert.equal(x.children.length,1);await call(x,'off');assert.equal(x.children[0].stdin.writes.map(JSON.parse).some(x=>x.op==='shutdown'),true);
});
test('only final assistant text is enqueued at non-aborted settled boundary',async()=>{
 const x=setup();await call(x,'on');x.emit('agent_start');
 const original={role:'assistant',stopReason:'stop',content:[{type:'text',text:'final text'},{type:'thinking',thinking:'private'}]};
 x.emit('message_end',{message:original});x.emit('message_end',{message:{role:'toolResult',content:[{type:'text',text:'tool output'}]}});
 assert.equal(x.children[0].stdin.writes.length,0);x.emit('agent_settled',{aborted:false});
 const speaks=x.children[0].stdin.writes.map(JSON.parse).filter(m=>m.op==='speak');assert.equal(speaks.length,1);assert.equal(speaks[0].text,'final text');
 assert.equal(original.content[0].text,'final text');
});
test('abort, errors, tool-call assistant, and stale previous-run candidates are ignored',async()=>{
 const x=setup();await call(x,'on');x.emit('agent_start');x.emit('message_end',{message:{role:'assistant',stopReason:'stop',content:[{type:'text',text:'stale'}]}});x.emit('agent_settled',{aborted:true});
 x.emit('agent_start');x.emit('message_end',{message:{role:'assistant',stopReason:'toolUse',content:[{type:'text',text:'not final'}]}});x.emit('agent_settled',{aborted:false});
 assert.equal(x.children[0].stdin.writes.length,0);
});
test('invalid commands preserve current client and message objects; session transition unloads',async()=>{
 const x=setup();await call(x,'on');const child=x.children[0],message={role:'assistant',stopReason:'stop',content:[{type:'text',text:'same'}]};
 await call(x,'nonsense');assert.equal(x.children[0],child);x.emit('message_end',{message});x.emit('session_start');assert.equal(x.children[0].stdin.writes.map(JSON.parse).some(m=>m.op==='shutdown'),true);
 x.emit('agent_settled',{aborted:false});assert.equal(x.children[0].stdin.writes.map(JSON.parse).some(m=>m.op==='speak'),false);assert.equal(message.content[0].text,'same');
});
