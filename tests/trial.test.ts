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

test('duration reservation is atomic across uploads, survives restart, and preserves daily caps',async()=>{
 let db=openDatabase();seed(db);const judge=createJudge(db,false);const dir=mkdtempSync('.data/trial-test-');
 const file={name:'tone.wav',buffer:testTone(),date:Date.now()};
 const remaining=()=>(db.prepare('SELECT trial_seconds FROM workspaces WHERE id=?').get(judge.id) as {trial_seconds:number}).trial_seconds;
 try {
  db.prepare('UPDATE workspaces SET trial_verified=1,trial_seconds=5 WHERE id=?').run(judge.id);
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


test('paused trials cannot create a notebook or claim credit',async()=>{
 const db=openDatabase();seed(db);const app=createApp(db,{secureCookies:false,trialsPaused:true});
 const server=app.listen(18573,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const base='http://127.0.0.1:18573';
 try {
  const visit=await fetch(base+'/api/waitlist');const cookie=visit.headers.get('set-cookie')!.split(';')[0];
  const r=await fetch(base+'/api/waitlist',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({email:randomUUID()+'@example.invalid',trial:true})});
  assert.equal(r.status,503);assert.equal((db.prepare('SELECT count(*) n FROM workspaces').get() as {n:number}).n,1);
  assert.equal((db.prepare('SELECT count(*) n FROM waitlist').get() as {n:number}).n,0);
 }finally{await app.locals.queue.stop();await new Promise<void>(r=>server.close(()=>r()));db.close()}
});

test('forged audio headers cannot request more provider time than reserved; overruns end a trial',async()=>{
 const {assemblyTranscriber,queueWorker}=await import('../src/server/audio');
 const {reserveReading}=await import('../src/server/reading');
 const db=openDatabase();seed(db);const judge=createJudge(db,false),dir=mkdtempSync('.data/trial-duration-');
 db.prepare('UPDATE workspaces SET trial_seconds=3600,trial_verified=1 WHERE id=?').run(judge.id);
 const tone=testTone(),fact=Buffer.alloc(12);fact.write('fact');fact.writeUInt32LE(4,4);fact.writeUInt32LE(16000,8);
 const forged=Buffer.concat([tone.subarray(0,36),fact,tone.subarray(36)]);forged.writeUInt32LE(forged.length-8,4);
 const original=globalThis.fetch;let providerDuration=1,requested=0;
 globalThis.fetch=async(input,init)=>{
  const url=String(input);
  if(url.endsWith('/gateway/list'))return Response.json(['https://api.sprites.dev/v1/gateway/anthropic/test','https://api.sprites.dev/v1/gateway/assemblyai/test']);
  if(url.endsWith('/v2/upload'))return Response.json({upload_url:'https://example.invalid/audio'});
  if(url.endsWith('/v2/transcript')){const body=JSON.parse(String(init?.body));assert.equal(body.audio_start_from,0);assert.equal(body.audio_end_at,1000);requested++;return Response.json({id:'invented-job'});}
  if(init?.method==='DELETE')return Response.json({});
  return Response.json({status:'completed',audio_duration:providerDuration,text:'Invented words.'});
 };
 const reader=async(_input:unknown,call:any)=>{call('describe_recording',{title:'Invented recording',summary:'A made-up update.\nNothing to do.'})};
 let worker:ReturnType<typeof queueWorker>|undefined;
 try {
  const [id]=await addAudio(db,judge.id,[{name:'forged.wav',buffer:forged,date:Date.now()}],dir);
  assert.equal((db.prepare('SELECT reserved_seconds FROM conversations WHERE id=?').get(id) as {reserved_seconds:number}).reserved_seconds,1);
  worker=queueWorker(db,reader,assemblyTranscriber);await worker.kick();await worker.stop();
  assert.equal(requested,1);assert.equal((db.prepare('SELECT status FROM conversations WHERE id=?').get(id) as {status:string}).status,'ready');
  providerDuration=2;
  await addAudio(db,judge.id,[{name:'forged.wav',buffer:forged,date:Date.now()},{name:'forged.wav',buffer:forged,date:Date.now()}],dir);
  worker=queueWorker(db,reader,assemblyTranscriber);await worker.kick();await worker.stop();
  assert.equal(requested,2);assert.throws(()=>reserveReading(db,judge.id),/trial has ended/);
  const reopened=openDatabase(db.serialize());assert.throws(()=>reserveReading(reopened,judge.id),/trial has ended/);reopened.close();
 }finally{await worker?.stop();globalThis.fetch=original;db.close();rmSync(dir,{recursive:true,force:true})}
});
