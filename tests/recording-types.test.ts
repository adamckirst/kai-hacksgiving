import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync,existsSync} from 'node:fs';
import {openDatabase,seed} from '../src/server/db';
import {acceptAll} from '../src/server/decisions';
import {personPage} from '../src/server/people-data';
import {createJudge} from '../src/server/access';
import {addAudio,queueWorker} from '../src/server/audio';
import {testTone} from '../src/server/gateway';
import {configureRecording,identifySpeakers} from '../src/server/recording-person';
import {readConversation,type ReadInput,type Reader} from '../src/server/reading';

test('recording type distinguishes the notebook owner from a selected sender and rejects missing speakers',async()=>{
 const db=openDatabase();seed(db);const a=createJudge(db),b=createJudge(db),dir=mkdtempSync('.data/recording-types-');
 const file={name:'invented.wav',buffer:testTone(),date:Date.now()};const inputs:ReadInput[]=[];
 const reader:Reader=async(input,call)=>{inputs.push(input);call('describe_recording',{title:'An invented promise',summary:'A speaker made a promise.\nIt needs review.'})};
 try{
  const [memo]=await addAudio(db,a.id,[file],dir,'recording',{person:{recording_type:'memo',person_id:null}});
  const [voice]=await addAudio(db,a.id,[file],dir,'recording',{person:{recording_type:'voice',person_id:a.id+':dana'}});
  await readConversation(db,memo,reader);await readConversation(db,voice,reader);
  assert.deepEqual(inputs[0].sender,{kind:'owner'});assert.equal(inputs[1].sender?.person?.id,a.id+':dana');
  assert.throws(()=>configureRecording(db,a.id,memo,{recording_type:'voice',person_id:null}),/who sent/);
  assert.throws(()=>configureRecording(db,a.id,memo,{recording_type:'voice',person_id:b.id+':dana'}),/not found/);
  assert.throws(()=>configureRecording(db,a.id,memo,{recording_type:'memo',person_id:a.id+':dana'}));
 }finally{db.close();rmSync(dir,{recursive:true,force:true})}
});

test('multiple speakers pause durably before reading; mapping is isolated and resumes without another listening charge',async()=>{
 let db=openDatabase();seed(db);const a=createJudge(db),b=createJudge(db),dir=mkdtempSync('.data/speakers-');
 db.prepare('UPDATE workspaces SET trial_seconds=120,trial_verified=1 WHERE id=?').run(a.id);
 let transcriptions=0,reads=0,finished=0;const seen:ReadInput[]=[];
 const reader:Reader=async(input,call)=>{reads++;seen.push(input);call('describe_recording',{title:'An invented meeting',summary:'Two people made plans.\nThe plans need review.'})};
 const transcriber:import('../src/server/audio').Transcriber=async(_audio,_signal,_seconds,multiple)=>{assert.equal(multiple,true);transcriptions++;return {text:'I will send the notes. I will review them.',utterances:[{speaker:'A',text:'I will send the notes.',start:0,end:1000},{speaker:'B',text:'I will review them.',start:1000,end:2000}]}};
 let queue=queueWorker(db,reader,transcriber,()=>{finished++});
 try {
  const [id]=await addAudio(db,a.id,[{name:'invented.wav',buffer:testTone(),date:Date.now()}],dir,'recording',{person:{recording_type:'multiple',person_id:null}});
  await queue.kick();await queue.stop();assert.equal(reads,0);assert.equal(finished,0);assert.equal(transcriptions,1);
  const state=db.prepare('SELECT status,audio_path,awaiting_speakers FROM conversations WHERE id=?').get(id);assert.deepEqual(state,{status:'waiting',audio_path:null,awaiting_speakers:1});
  const interruptedAudio=dir+'/interrupted.audio';writeFileSync(interruptedAudio,testTone());db.prepare("UPDATE conversations SET audio_path=?,status='listening' WHERE id=?").run(interruptedAudio,id);
  const image=db.serialize();db.close();db=openDatabase(image);queue=queueWorker(db,reader,transcriber,()=>{finished++});await queue.kick();assert.equal(reads,0);assert.equal(existsSync(interruptedAudio),false);
  assert.throws(()=>identifySpeakers(db,b.id,id,{A:{kind:'owner'},B:{kind:'person',person_id:b.id+':dana'}}),/not found/);
  assert.throws(()=>identifySpeakers(db,a.id,id,{A:{kind:'owner'}}),/each speaker/);
  assert.throws(()=>identifySpeakers(db,a.id,id,{A:{kind:'owner'},B:{kind:'person',person_id:b.id+':dana'}}),/not found/);
  identifySpeakers(db,a.id,id,{A:{kind:'owner'},B:{kind:'person',person_id:a.id+':dana'}});await queue.kick();
  assert.ok((personPage(db,a.id,a.id+':dana')!.conversations as {id:string}[]).some(c=>c.id===id));
  assert.equal(reads,1);assert.equal(transcriptions,1);assert.equal(finished,1);
  assert.deepEqual(seen[0].speakers?.A,{kind:'owner'});assert.equal(seen[0].speakers?.B.kind,'person');
  assert.equal((db.prepare('SELECT trial_seconds FROM workspaces WHERE id=?').get(a.id) as {trial_seconds:number}).trial_seconds,118);
  assert.throws(()=>identifySpeakers(db,a.id,id,{A:{kind:'owner'},B:{kind:'owner'}}),/not waiting/);
 }finally{await queue.stop();db.close();rmSync(dir,{recursive:true,force:true})}
});

test('AssemblyAI requests speaker labels only for multiple-speaker recordings and keeps the duration bound',async()=>{
 const {assemblyTranscriber}=await import('../src/server/audio');const original=globalThis.fetch;const requests:any[]=[];
 globalThis.fetch=async(input,init)=>{
  const url=String(input);
  if(url.endsWith('/gateway/list'))return Response.json(['https://api.sprites.dev/v1/gateway/anthropic/test','https://api.sprites.dev/v1/gateway/assemblyai/test']);
  if(url.endsWith('/v2/upload'))return Response.json({upload_url:'https://example.invalid/audio'});
  if(url.endsWith('/v2/transcript')){requests.push(JSON.parse(String(init?.body)));return Response.json({id:'invented-job'});}
  if(init?.method==='DELETE')return Response.json({});
  return Response.json({status:'completed',audio_duration:2,text:'I will send the notes.',utterances:[{speaker:'A',text:'I will send the notes.',start:0,end:2000}]});
 };
 try{
  const single=await assemblyTranscriber(testTone(),new AbortController().signal,2,false);assert.equal(typeof single,'object');if(typeof single==='object'){assert.equal(single.text,'I will send the notes.');assert.deepEqual(single.utterances,[]);await single.cleanup;}
  const result=await assemblyTranscriber(testTone(),new AbortController().signal,2,true);assert.equal(typeof result,'object');
  assert.equal(Object.hasOwn(requests[0],'speaker_labels'),false);assert.equal(requests[1].speaker_labels,true);
  assert.ok(requests.every(r=>r.audio_end_at===2000 && r.speech_models[0]==='assemblyai-stt-3-7'));
 }finally{globalThis.fetch=original}
});


test('a memo can propose and accept a personal task without inventing a contact',async()=>{
 const db=openDatabase();seed(db);const a=createJudge(db,false),dir=mkdtempSync('.data/personal-task-');
 try{
  const [id]=await addAudio(db,a.id,[{name:'invented.wav',buffer:testTone(),date:Date.now()}],dir,'recording',{person:{recording_type:'memo',person_id:null}});
  db.prepare('UPDATE conversations SET text=? WHERE id=?').run('I need to buy a notebook tomorrow.',id);
  await readConversation(db,id,async(input,call)=>{assert.equal(input.sender?.kind,'owner');call('describe_recording',{title:'A notebook reminder',summary:'A personal reminder.\nIt is for tomorrow.'});assert.equal(call('propose_todo',{person_id:null,owner_person_id:null,text:'Buy a notebook',due_on:null,quote:input.text}).ok,true)});
  acceptAll(db,a.id,id);assert.deepEqual(db.prepare('SELECT person_id,owner_person_id FROM todos WHERE conversation_id=?').get(id),{person_id:null,owner_person_id:null});
  assert.equal((db.prepare('SELECT count(*) n FROM people WHERE workspace_id=?').get(a.id) as {n:number}).n,0);
 }finally{db.close();rmSync(dir,{recursive:true,force:true})}
});


test('a kick just after an empty queue scan still processes a newly queued recording',async()=>{
 const db=openDatabase();seed(db);const a=createJudge(db),dir=mkdtempSync('.data/queue-wake-');let read=0;
 const queue=queueWorker(db,async(_input,call)=>{read++;call('describe_recording',{title:'Invented',summary:'An invented recording.\nReady to review.'})},async()=> 'Invented words');
 try {
  const [id]=await addAudio(db,a.id,[{name:'invented.wav',buffer:testTone(),date:Date.now()}],dir,'shared',{awaitingPerson:true});
  const idle=queue.kick();
  db.prepare('UPDATE conversations SET awaiting_person=0 WHERE id=?').run(id);
  const started=queue.kick();await Promise.all([idle,started]);
  assert.equal(read,1);assert.equal((db.prepare('SELECT status FROM conversations WHERE id=?').get(id) as {status:string}).status,'ready');
 }finally{await queue.stop();db.close();rmSync(dir,{recursive:true,force:true})}
});

test('listening failure categories retain no upstream content and leave audio retryable',async()=>{
 const {ListeningFailure}=await import('../src/server/audio');const db=openDatabase();seed(db);const a=createJudge(db),dir=mkdtempSync('.data/listening-failure-');
 const queue=queueWorker(db,async()=>{},async()=>{throw new ListeningFailure('speakers_missing')});
 try {
  const [id]=await addAudio(db,a.id,[{name:'invented.wav',buffer:testTone(),date:Date.now()}],dir,'recording',{person:{recording_type:'multiple'}});
  await queue.kick();const r=db.prepare('SELECT failure_code,audio_path,status FROM conversations WHERE id=?').get(id) as {failure_code:string;audio_path:string;status:string};
  assert.equal(r.failure_code,'speakers_missing');assert.equal(r.status,'failed');assert.ok(existsSync(r.audio_path));
 }finally{await queue.stop();db.close();rmSync(dir,{recursive:true,force:true})}
});
