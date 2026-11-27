import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync,mkdtempSync,rmSync,existsSync,readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { openDatabase,seed } from '../src/server/db';
import { addAudio,queueWorker,fakeTranscriber } from '../src/server/audio';
import { reserveRecording,type Reader } from '../src/server/reading';
import { testTone } from '../src/server/gateway';
import { createApp } from '../src/server/app';
function setup(durable=false) {
  mkdirSync('.data',{recursive:true});const directory=mkdtempSync('.data/audio-check-');
  const file=durable ? directory+'/queue.sqlite' : ':memory:';
  const db=openDatabase(file);seed(db);
  // A test actor needs no session or provider credentials; none enter this file.
  db.prepare("INSERT INTO workspaces (id,workspace_id,kind,created_at) VALUES ('judge-a','judge-a','judge',?)").run(new Date().toISOString());
  return {db,directory,file};
}
const reader:Reader=async(_input,call)=>{call('describe_recording',{title:'A test recording',summary:'KAI kept the invented words.\nThere are no new promises.'});};
const dates=[Date.UTC(2026,10,24),Date.UTC(2026,10,22),Date.UTC(2026,10,23)];
test('separate imports are read oldest first and audio is deleted afterwards',async()=> {
  const {db,directory}=setup();const order:string[]=[];
  try {
    const ids:string[]=[];for(const date of dates)ids.push(...await addAudio(db,'judge-a',[{name:'memo.wav',buffer:testTone(),date}],directory));
    const paths=(db.prepare('SELECT audio_path FROM conversations WHERE audio_path IS NOT NULL').all() as {audio_path:string}[]).map(r=>r.audio_path);
    const worker=queueWorker(db,async(input,call)=>{order.push(input.happened_on);await reader(input,call);},fakeTranscriber);
    await worker.kick();
    assert.deepEqual(order,['2026-11-22','2026-11-23','2026-11-24']);assert.ok(paths.every(p=>!existsSync(p)));
    for(const id of ids) assert.equal((db.prepare('SELECT status FROM conversations WHERE id=?').get(id) as {status:string}).status,'ready');
    await worker.stop();
  } finally {db.close();rmSync(directory,{recursive:true,force:true});}
});
test('an existing batch stopped halfway finishes after reopening its persistent database',async()=> {
  const {db,directory,file}=setup(true);let resumed:ReturnType<typeof openDatabase>|undefined;
  let started!:()=>void;const secondStarted=new Promise<void>(resolve=>started=resolve);let calls=0;
  try {
    for(const date of dates)await addAudio(db,'judge-a',[{name:'memo.wav',buffer:testTone(),date}],directory);
    db.prepare("UPDATE conversations SET batch_id='legacy-batch' WHERE workspace_id='judge-a'").run();
    const worker=queueWorker(db,reader,async(_audio,signal)=> {
      if(++calls===1) return 'First invented memo.';
      started();await new Promise<void>((_resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('Stopped')),{once:true}));return '';
    });
    const run=worker.kick();await secondStarted;await worker.stop();await run;
    assert.equal((db.prepare("SELECT count(*) AS n FROM conversations WHERE source='recording' AND status='ready'").get() as {n:number}).n,1);
    db.close();resumed=openDatabase(file);
    const next=queueWorker(resumed,reader,fakeTranscriber);await next.kick();await next.stop();
    assert.equal((resumed.prepare("SELECT count(*) AS n FROM conversations WHERE source='recording' AND status='ready'").get() as {n:number}).n,3);
    assert.equal((resumed.prepare('SELECT count(*) AS n FROM conversations WHERE audio_path IS NOT NULL').get() as {n:number}).n,0);
  } finally {if(db.open)db.close();resumed?.close();rmSync(directory,{recursive:true,force:true});}
});
test('real generated m4a and opus files are accepted; 30-minute audio is refused',async()=> {
  const {db,directory}=setup();
  try {
    for(const [extension,codec] of [['m4a','aac'],['opus','libopus']]) {
      const filename=directory+'/generated.'+extension;
      execFileSync('ffmpeg',['-v','error','-f','wav','-i','pipe:0','-c:a',codec,filename],{input:testTone()});
      assert.equal((await addAudio(db,'judge-a',[{name:'memo.'+extension,buffer:readFileSync(filename),date:dates[0]}],directory)).length,1);
    }
    const long=Buffer.alloc(44+1800*800*2);testTone().copy(long);long.writeUInt32LE(long.length-8,4);long.writeUInt32LE(long.length-44,40);long.writeUInt32LE(800,24);long.writeUInt32LE(1600,28);
    await assert.rejects(()=>addAudio(db,'judge-a',[{name:'long.wav',buffer:long,date:dates[0]}],directory),/shorter than 30 minutes/);
  } finally {db.close();rmSync(directory,{recursive:true,force:true});}
});
test('11 MB and second file are refused by HTTP before anything is queued',async()=> {
  const {db,directory}=setup();const secret=randomBytes(32).toString('hex');
  const app=createApp(db,{judgeSecret:secret,audioDirectory:directory});const server=app.listen(18522,'127.0.0.1');
  await new Promise<void>(resolve=>server.once('listening',resolve));const base='http://127.0.0.1:18522';
  try {
    const auth=await fetch(base+'/api/access/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret})});
    const cookie=auth.headers.get('set-cookie')!.split(';')[0];
    for(const buffers of [[Buffer.alloc(11_000_000)],Array.from({length:2},()=>testTone())]) {
      const form=new FormData();buffers.forEach(b=>form.append('recordings',new Blob([new Uint8Array(b)]),'memo.wav'));form.append('dates',JSON.stringify(buffers.map(()=>dates[0])));
      const response=await fetch(base+'/api/recordings',{method:'POST',headers:{Cookie:cookie},body:form});assert.equal(response.status,400);
    }
    assert.equal((db.prepare("SELECT count(*) AS n FROM conversations WHERE source='recording'").get() as {n:number}).n,0);
  } finally {await app.locals.queue.stop();await new Promise<void>(resolve=>server.close(()=>resolve()));db.close();rmSync(directory,{recursive:true,force:true});}
});
test('recording allowances stop at 10 per workspace and 60 total',()=> {
  const {db,directory}=setup();try {
    for(let w=0;w<6;w++) {
      const id='limit-'+w;db.prepare('INSERT INTO workspaces (id,workspace_id,kind,created_at) VALUES (?,?,?,?)').run(id,id,'judge',new Date().toISOString());
      for(let n=0;n<10;n++) db.transaction(()=>reserveRecording(db,id))();
      assert.throws(()=>db.transaction(()=>reserveRecording(db,id))(),/limit/);
    }
    assert.throws(()=>db.transaction(()=>reserveRecording(db,'judge-a'))(),/limit/);
  } finally {db.close();rmSync(directory,{recursive:true,force:true});}
});
