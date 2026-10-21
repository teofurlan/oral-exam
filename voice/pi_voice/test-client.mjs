import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import path from 'node:path';
import { createClient } from './client.mjs';
function fakeChild(){const c=new EventEmitter();c.stdin={writes:[],write(x){this.writes.push(x);return true;}};c.stdout=new EventEmitter();c.stderr=new EventEmitter();c.kills=0;c.kill=()=>{c.kills++;c.emit('exit',null,'SIGKILL');};return c;}
test('client launches worker with required args and JSONL messages',async()=>{
 const child=fakeChild();let args;const events=[];
 const client=createClient({root:'C:/project',spawn:(...a)=>(args=a,child),onEvent:e=>events.push(e)});
 client.start();assert.equal(path.normalize(args[0]),path.normalize('C:/project/.venv/Scripts/python.exe'));
 assert.deepEqual(args[1],['-B','-u','-X','utf8','pi_voice/backend.py']);assert.equal(args[2].shell,false);assert.equal(args[2].cwd,'C:/project');
 client.speak('id','hola');client.stop();assert.deepEqual(child.stdin.writes.map(JSON.parse),[{op:'speak',id:'id',text:'hola'},{op:'stop'}]);
 child.stdout.emit('data',Buffer.from('{"event":"ready"}\n'));assert.deepEqual(events,[{event:'ready'}]);
 await client.shutdown();assert.equal(client.child,null);
});
test('client rejects over-limit text, handles spawn failure, and ignores stale child events',()=>{
 const c=fakeChild();const errors=[];const client=createClient({root:'C:/project',spawn:()=>c,onError:e=>errors.push(e)});client.start();
 assert.throws(()=>client.speak('id','x'.repeat(20001)),/20000/);
 client.close();c.emit('error',new Error('late'));c.emit('exit',1);assert.equal(client.child,null);assert.equal(errors.length,0);
 const broken=createClient({root:'C:/project',spawn(){throw new Error('spawn denied');},onError:e=>errors.push(e)});
 assert.throws(()=>broken.start(),/spawn denied/);
});
test('shutdown sends graceful request before bounded owned-child kill',async()=>{
 const c=fakeChild();let now=0;const client=createClient({root:'C:/p',spawn:()=>c,killTimeoutMs:5});client.start();
 await client.shutdown();assert.deepEqual(c.stdin.writes.map(JSON.parse),[{op:'shutdown'}]);assert.equal(c.kills,1);assert.equal(client.child,null);
});
