import {test} from 'node:test';
import {Client,StreamableHTTPClientTransport} from '@modelcontextprotocol/client';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {openDatabase,seed} from '../src/server/db';
import {createApp} from '../src/server/app';
import {createJudge} from '../src/server/access';
import {addAudio} from '../src/server/audio';
import {testTone} from '../src/server/gateway';

test('trial signup is empty, isolated and idempotent; an email never authenticates another browser',async()=>{
 const db=openDatabase();seed(db);let calls=0;
 const app=createApp(db,{secureCookies:false,reader:async()=>{calls++},transcriber:async()=>{calls++;return ''}});
 const server=app.listen(18572,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const base='http://127.0.0.1:18572';
 const visitor=async()=> (await fetch(base+'/api/waitlist')).headers.get('set-cookie')!.split(';')[0];
 const signup=(cookie:string,email:string)=>fetch(base+'/api/waitlist',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({email,trial:true})});
 try {
  const email=randomUUID()+'@example.invalid',v=await visitor();
  const responses=await Promise.all([signup(v,email),signup(v,email)]);
  assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);
  const session=responses.find(r=>r.status===200)!.headers.get('set-cookie')!.split(';')[0],cookie=v+'; '+session;
  const get=async(route:string,c=session)=>(await fetch(base+route,{headers:{Cookie:c}})).json();
  const home=await get('/api/home');assert.equal(home.trialSeconds,3600);assert.equal(home.peopleCount,0);assert.equal(home.todos.length,0);assert.equal(home.conversations.length,0);
  const id=(db.prepare('SELECT workspace_id FROM waitlist WHERE email=?').get(email) as {workspace_id:string}).workspace_id;
  db.prepare('UPDATE workspaces SET trial_seconds=42 WHERE id=?').run(id);
  assert.equal((await signup(cookie,email.toUpperCase())).status,200);
  assert.equal((await signup(cookie,randomUUID()+'@example.invalid')).status,200);
  assert.equal((await get('/api/home')).trialSeconds,42);
  assert.equal((await signup(await visitor(),email)).status,409);
  const second=await signup(await visitor(),randomUUID()+'@example.invalid');assert.equal(second.status,200);
  const other=second.headers.get('set-cookie')!.split(';')[0];assert.equal((await get('/api/home',other)).trialSeconds,3600);
  assert.equal((await get('/api/home','')).peopleCount,3);
  assert.equal((await fetch(base+'/api/readings',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,403);
  const text=JSON.stringify([await get('/api/home'),await get('/api/people'),await get('/api/todos'),await get('/api/access')]);assert.ok(!text.includes(email));
  for(const table of ['workspaces','conversations','people','todos','notes','suggestions'])assert.ok(!JSON.stringify(db.prepare('SELECT * FROM '+table).all()).includes(email));
  const connection=await get('/api/connect');
  const client=new Client({name:'Invented trial check',version:'1.0.0'});
  try {
    await client.connect(new StreamableHTTPClientTransport(new URL(base+connection.mcpPath)));
    const tools=await client.listTools();assert.equal(tools.tools.length,4);
    const answer=await client.callTool({name:'list_people',arguments:{}});
    assert.ok(!JSON.stringify(answer).includes(email));assert.ok(!JSON.stringify(answer).includes('Dana'));
  }finally{await client.close()}
  assert.equal(calls,0);
 }finally{await app.locals.queue.stop();await new Promise<void>(r=>server.close(()=>r()));db.close()}
});

test('duration reservation is atomic across uploads, survives restart, and preserves daily caps',async()=>{
 let db=openDatabase();seed(db);const judge=createJudge(db,false);const dir=mkdtempSync('.data/trial-test-');
 const file={name:'tone.wav',buffer:testTone(),date:Date.now()};
 const remaining=()=>(db.prepare('SELECT trial_seconds FROM workspaces WHERE id=?').get(judge.id) as {trial_seconds:number}).trial_seconds;
 try {
  db.prepare('UPDATE workspaces SET trial_seconds=5 WHERE id=?').run(judge.id);
  await assert.rejects(()=>addAudio(db,judge.id,[file,file,file],dir),/remaining recording time/);assert.equal(remaining(),5);
  const results=await Promise.allSettled([addAudio(db,judge.id,[file,file],dir),addAudio(db,judge.id,[file,file],dir,'shared',{awaitingPerson:true})]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(remaining(),1);
  const image=db.serialize();db.close();db=openDatabase(image);assert.equal(remaining(),1);
  await assert.rejects(()=>addAudio(db,judge.id,[file],dir,'shared',{awaitingPerson:true}),/remaining recording time/);
  db.prepare('UPDATE workspaces SET trial_seconds=3600,recording_day=?,recordings_today=10 WHERE id=?').run(new Date().toISOString().slice(0,10),judge.id);
  await assert.rejects(()=>addAudio(db,judge.id,[file],dir),/today’s recording limit/);assert.equal(remaining(),3600);
  db.prepare('UPDATE workspaces SET recordings_today=0 WHERE id=?').run(judge.id);
  db.prepare("UPDATE workspaces SET recording_day=?,recordings_today=60 WHERE id='public'").run(new Date().toISOString().slice(0,10));
  await assert.rejects(()=>addAudio(db,judge.id,[file],dir),/today’s recording limit/);assert.equal(remaining(),3600);
 }finally{db.close();rmSync(dir,{recursive:true,force:true})}
});
