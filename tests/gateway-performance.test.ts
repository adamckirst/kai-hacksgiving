import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setImmediate as nextTurn} from 'node:timers/promises';
import {existsSync,mkdtempSync,rmSync} from 'node:fs';
import {discoverGateways,gatewayRequest,invalidateGateways,testTone} from '../src/server/gateway';
import {addAudio,assemblyTranscriber,queueWorker} from '../src/server/audio';
import {openDatabase,seed} from '../src/server/db';
import {createJudge} from '../src/server/access';

const addresses=(suffix='fixture')=>[
 `https://api.sprites.dev/v1/gateway/anthropic/${suffix}`,
 `https://api.sprites.dev/v1/gateway/assemblyai/${suffix}`,
];

test('simultaneous and successive processing stages share one validated discovery until its bounded expiry',async context=>{
 const original=globalThis.fetch;let calls=0,now=1000,release!:()=>void;
 context.mock.method(Date,'now',()=>now);
 const gate=new Promise<void>(resolve=>{release=resolve});
 globalThis.fetch=async()=>{calls++;await gate;return Response.json(addresses())};
 try{
  const stages=Array.from({length:4},()=>discoverGateways());assert.equal(calls,1);release();
  const results=await Promise.all(stages);assert.ok(results.every(value=>value===results[0]));assert.ok(Object.isFrozen(results[0]));
  await discoverGateways();await discoverGateways();assert.equal(calls,1);
  now+=5*60*1000+1;await discoverGateways();assert.equal(calls,2);
 }finally{globalThis.fetch=original;invalidateGateways()}
});

test('failed or ambiguous discovery is not cached, and transport changes cannot reuse another cache',async()=>{
 const original=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{
  calls++;
  if(calls===1)return new Response(null,{status:503});
  if(calls===2)return Response.json([...addresses(),addresses('duplicate')[0]]);
  return Response.json(addresses());
 };
 try{
  await assert.rejects(discoverGateways(),/Gateway discovery refused/);
  await assert.rejects(discoverGateways(),/Expected one accessible anthropic connector/);
  const valid=await discoverGateways();assert.equal(calls,3);
  let replacementCalls=0;globalThis.fetch=async()=>{replacementCalls++;return Response.json(addresses('replacement'))};
  const replaced=await discoverGateways();assert.equal(replacementCalls,1);assert.notEqual(replaced.anthropic,valid.anthropic);
 }finally{globalThis.fetch=original;invalidateGateways()}
});

test('a refused connector invalidates discovery without replaying the provider request',async()=>{
 const original=globalThis.fetch;let discoveries=0,posts=0;
 globalThis.fetch=async(input,init)=>{
  if(String(input).endsWith('/gateway/list')){discoveries++;return Response.json(addresses('fixture-'+discoveries))}
  assert.equal(init?.method,'POST');posts++;return new Response(null,{status:403});
 };
 try{
  const first=await discoverGateways();
  await assert.rejects(gatewayRequest(first.assemblyai,'/v2/upload',{method:'POST'}),/Connector request failed \(403\)/);
  assert.equal(posts,1);const second=await discoverGateways();assert.equal(discoveries,2);assert.notEqual(second.assemblyai,first.assemblyai);
  // An older in-flight request must not discard a newer validated discovery.
  invalidateGateways(first.assemblyai);await discoverGateways();assert.equal(discoveries,2);
 }finally{globalThis.fetch=original;invalidateGateways()}
});

test('cancellation interrupts the transcription poll pause without another status request',async()=>{
 const original=globalThis.fetch,controller=new AbortController();let polls=0,deleted=0,polled!:()=>void;
 const firstPoll=new Promise<void>(resolve=>{polled=resolve});
 globalThis.fetch=async(input,init)=>{
  const url=String(input);
  if(url.endsWith('/gateway/list'))return Response.json(addresses());
  if(url.endsWith('/v2/upload'))return Response.json({upload_url:'https://example.invalid/invented-audio'});
  if(url.endsWith('/v2/transcript'))return Response.json({id:'invented-job'});
  if(init?.method==='DELETE'){deleted++;return Response.json({})}
  polls++;polled();return Response.json({status:'queued'});
 };
 try{
  const transcribing=assemblyTranscriber(testTone(),controller.signal,2);
  // Register rejection handling before cancellation, then let the queued poll enter its pause.
  const rejected=assert.rejects(transcribing,{name:'AbortError'});await firstPoll;await nextTurn();controller.abort();
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{await Promise.race([rejected,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('Cancellation waited for the full poll interval.')),500)})])}finally{clearTimeout(timer)}
  assert.equal(polls,1);assert.equal(deleted,1);
 }finally{globalThis.fetch=original;invalidateGateways()}
});

test('validated words are returned while provider deletion is pending; invalid transcripts still wait for cleanup',async()=>{
 const original=globalThis.fetch;let valid=true;
 try{
  for(const expectedSuccess of [true,false]) {
   valid=expectedSuccess;let release!:()=>void,deleting!:()=>void,returned=false,deleted=false;
   const cleanupGate=new Promise<void>(resolve=>{release=resolve}),deletionStarted=new Promise<void>(resolve=>{deleting=resolve});
   globalThis.fetch=async(input,init)=>{
    const url=String(input);
    if(url.endsWith('/gateway/list'))return Response.json(addresses());
    if(url.endsWith('/v2/upload'))return Response.json({upload_url:'https://example.invalid/invented-audio'});
    if(url.endsWith('/v2/transcript'))return Response.json({id:'invented-job'});
    if(init?.method==='DELETE'){deleting();await cleanupGate;deleted=true;return Response.json({})}
    return Response.json({status:'completed',audio_duration:valid?2:3,text:'Invented words.'});
   };
   const result=assemblyTranscriber(testTone(),new AbortController().signal,2).then(value=>{returned=true;return value},error=>{returned=true;return error});
   try{
    await deletionStarted;await nextTurn();assert.equal(returned,expectedSuccess);assert.equal(deleted,false);
    if(expectedSuccess){const transcript=await result;assert.equal(transcript.text,'Invented words.');assert.ok(transcript.cleanup instanceof Promise);release();await transcript.cleanup;assert.equal(deleted,true)}
    else {release();assert.equal((await result).constructor.name,'AudioDurationError');assert.equal(deleted,true)}
   }finally{release();await result;invalidateGateways()}
  }
 }finally{globalThis.fetch=original;invalidateGateways()}
});

test('reading and local audio deletion finish before remote cleanup, but the next job and stop await it',async()=>{
 const db=openDatabase();seed(db);const owner=createJudge(db,false),directory=mkdtempSync('.data/processing-cleanup-');
 let release!:()=>void,read!:()=>void,transcriptions=0,reads=0,finished=false,stopped=false;
 const cleanup=new Promise<void>(resolve=>{release=resolve}),readingStarted=new Promise<void>(resolve=>{read=resolve});
 const reader=async(_input:unknown,call:any)=>{reads++;call('describe_recording',{title:'Invented note',summary:'An invented update.\nNo personal details.'});read()};
 const transcribe=async()=>({text:'Invented words.',utterances:[],cleanup:++transcriptions===1?cleanup:Promise.resolve()});
 let worker=queueWorker(db,reader,transcribe);
 try{
  const [first]=await addAudio(db,owner.id,[{name:'first.wav',buffer:testTone(),date:Date.now()-1000}],directory,'recording',{person:{recording_type:'memo'}});
  const [second]=await addAudio(db,owner.id,[{name:'second.wav',buffer:testTone(),date:Date.now()}],directory,'recording',{person:{recording_type:'memo'}});
  const original=db.prepare('SELECT audio_path FROM conversations WHERE id=?').get(first) as {audio_path:string};
  const processing=worker.kick().then(()=>{finished=true});await readingStarted;await nextTurn();
  assert.deepEqual(db.prepare('SELECT transcribed,status,audio_path FROM conversations WHERE id=?').get(first),{transcribed:1,status:'ready',audio_path:null});assert.equal(existsSync(original.audio_path),false);
  assert.equal(transcriptions,1);assert.equal(reads,1);assert.equal(finished,false);
  const stopping=worker.stop().then(()=>{stopped=true});await nextTurn();assert.equal(stopped,false);
  release();await Promise.all([processing,stopping]);assert.equal(stopped,true);
  assert.equal((db.prepare('SELECT status FROM conversations WHERE id=?').get(second) as {status:string}).status,'waiting');
  worker=queueWorker(db,reader,transcribe);await worker.kick();assert.equal(transcriptions,2);assert.equal(reads,2);
  assert.equal((db.prepare('SELECT status FROM conversations WHERE id=?').get(first) as {status:string}).status,'ready');
 }finally{release();await worker.stop();db.close();rmSync(directory,{recursive:true,force:true})}
});
