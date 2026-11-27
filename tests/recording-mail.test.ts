import {TERMS_VERSION} from '../src/terms';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {openDatabase,seed,type KaiDatabase} from '../src/server/db';
import {createJudge} from '../src/server/access';
import {addAudio,queueWorker,fakeTranscriber} from '../src/server/audio';
import {testTone} from '../src/server/gateway';
import {recordingMailWorker,type ReadyCounts} from '../src/server/recording-mail';
import {readyMessage,resendReadySender} from '../src/server/trial-mail';
import {createApp} from '../src/server/app';
const day=86400000;
function actor(db:KaiDatabase,verified=true) {
 const judge=createJudge(db,false),email=randomUUID()+'@example.invalid';
 db.prepare('UPDATE workspaces SET trial_seconds=3600,trial_verified=? WHERE id=?').run(Number(verified),judge.id);
 db.prepare('INSERT INTO waitlist(email,created_at,workspace_id,verified_at) VALUES (?,?,?,?)').run(email,new Date().toISOString(),judge.id,verified ? new Date().toISOString():null);
 return {...judge,email};
}
function recording(db:KaiDatabase,workspace:string,options:{status?:string;source?:string;notify?:number;transcribed?:number}={}) {
 const id=randomUUID();
 db.prepare('INSERT INTO conversations(id,workspace_id,title,summary,source,text,happened_on,status,notify_ready,transcribed) VALUES (?,?,?,?,?,?,?,?,?,?)').run(id,workspace,'Private invented title','Private invented summary',options.source??'recording','Private invented words','2026-11-26',options.status??'ready',options.notify??1,options.transcribed??1);
 return id;
}
test('recording mail isolates verified recipients, sends counts only, and skips other sources and unfinished work',async()=>{
 const db=openDatabase();seed(db);const first=actor(db),second=actor(db),unverified=actor(db,false);
 const id=recording(db,first.id),empty=recording(db,second.id,{source:'shared'});
 for(const kind of ['person','note','todo','done'])db.prepare("INSERT INTO suggestions VALUES (?,?,?,?,?,?,'proposed')").run(randomUUID(),first.id,id,kind,JSON.stringify({text:'Private invented action'}),'Private invented quote');
 for(const options of [{status:'listening'},{status:'reading'},{status:'waiting'},{source:'sample'},{source:'paste'},{notify:0},{transcribed:0}])recording(db,first.id,options);
 recording(db,unverified.id);recording(db,'public');
 const sent:{email:string;id:string;counts:ReadyCounts}[]=[];
 const worker=recordingMailWorker(db,async(email,id,counts)=>{sent.push({email,id,counts})});
 try {
  await Promise.all([worker.kick(),worker.kick()]);await worker.kick();
  assert.equal(sent.length,2);
  assert.deepEqual(sent.find(s=>s.id===id),{email:first.email,id,counts:{person:1,note:1,todo:1,done:1}});
  assert.deepEqual(sent.find(s=>s.id===empty),{email:second.email,id:empty,counts:{person:0,note:0,todo:0,done:0}});
  for(const result of sent) {
   const text=readyMessage('https://kai.example.invalid',result.id,result.counts);
   assert.ok(text.includes('/recordings/'+result.id));assert.ok(text.includes('sign in with a fresh email code'));
   for(const privateText of ['Private invented',first.email,second.email,first.cookie,second.cookie])assert.ok(!text.includes(privateText));
  }
  assert.match(readyMessage('https://kai.example.invalid',empty,sent.find(s=>s.id===empty)!.counts),/no new suggestions/);
  assert.equal((db.prepare("SELECT count(*) n FROM suggestions WHERE conversation_id=? AND status='proposed'").get(id) as {n:number}).n,4);
 }finally{await worker.stop();db.close()}
});
test('new shared audio queues one completion email after reading; mail failure leaves its suggestions ready',async()=>{
 mkdirSync('.data',{recursive:true});
 const db=openDatabase();seed(db);const judge=actor(db),directory=mkdtempSync('.data/mail-audio-');let sends=0;
 const mail=recordingMailWorker(db,async()=>{sends++;throw new Error('Invented failure')});
 const worker=queueWorker(db,async(_input,call)=>{call('describe_recording',{title:'Invented update',summary:'A made-up summary.\nNo new promises.'})},fakeTranscriber,()=>{void mail.kick()});
 try {
  const [id]=await addAudio(db,judge.id,[{name:'memo.wav',buffer:testTone(),date:Date.now()}],directory,'shared',{awaitingPerson:true});
  await worker.kick();await mail.kick();assert.equal(sends,0);
  db.prepare('UPDATE conversations SET awaiting_person=0 WHERE id=?').run(id);
  await worker.kick();await mail.kick();assert.equal(sends,1);
  assert.equal((db.prepare('SELECT status FROM conversations WHERE id=?').get(id) as {status:string}).status,'ready');
 }finally{await worker.stop();await mail.stop();db.close();rmSync(directory,{recursive:true,force:true})}
});
test('recording mail retries the same payload and key after restart, bounded by attempts and idempotency lifetime',async()=>{
 let db=openDatabase();seed(db);const judge=actor(db),id=recording(db,judge.id);let now=Date.now(),fail=true;
 const sent:{id:string;counts:ReadyCounts}[]=[];
 const send=async(_email:string,id:string,counts:ReadyCounts)=>{sent.push({id,counts});if(fail)throw new Error('Invented timeout after provider accepted mail')};
 let worker=recordingMailWorker(db,send,()=>now);
 try {
  await worker.kick();await worker.stop();assert.equal(sent.length,1);
  const snapshot=db.serialize();db.close();db=openDatabase(snapshot);now+=60001;
  db.prepare("INSERT INTO suggestions VALUES (?,?,?,?,?,?,'proposed')").run(randomUUID(),judge.id,id,'note','{}','Invented quote');
  worker=recordingMailWorker(db,send,()=>now);await worker.kick();now+=60001;fail=false;await worker.kick();await worker.kick();
  assert.equal(sent.length,3);assert.deepEqual(sent[0],sent[1]);assert.deepEqual(sent[1],sent[2]);
  const rejected=recording(db,judge.id);fail=true;
  await worker.kick();now+=60001;await worker.kick();now+=60001;await worker.kick();now+=60001;await worker.kick();
  assert.equal(sent.filter(s=>s.id===rejected).length,3);
  const expired=recording(db,judge.id);await worker.kick();now+=23*3600000;await worker.kick();
  assert.equal(sent.filter(s=>s.id===expired).length,1);
 }finally{await worker.stop();db.close()}
});
test('recording mail enforces per-notebook, global and shared verification send caps across restart',async()=>{
 let db=openDatabase();seed(db);let now=Date.now(),sends=0;
 const actors=Array.from({length:7},()=>actor(db));for(const who of actors)for(let i=0;i<11;i++)recording(db,who.id);
 let worker=recordingMailWorker(db,async()=>{sends++},()=>now);
 try {
  await worker.kick();assert.equal(sends,60);
  const counts=db.prepare('SELECT workspace_id,count(*) n FROM notification_sends GROUP BY workspace_id').all() as {n:number}[];assert.ok(counts.every(r=>r.n<=10));
  await worker.stop();const snapshot=db.serialize();db.close();db=openDatabase(snapshot);
  worker=recordingMailWorker(db,async()=>{sends++},()=>now);await worker.kick();assert.equal(sends,60);
  now+=day+1;
  const insert=db.prepare('INSERT INTO trial_sends(id,ip_hash,email_hash,sent_at) VALUES (?,?,?,?)');for(let i=0;i<99;i++)insert.run(randomUUID(),'invented-ip-'+i,'invented-email-'+i,now);
  await worker.kick();assert.equal(sends,61);await worker.kick();assert.equal(sends,61);
 }finally{await worker.stop();db.close()}
});
test('verification shares the 100-attempt cap with recording emails',async()=>{
 const db=openDatabase();seed(db);const judge=actor(db),now=Date.now();let sends=0;
 const insert=db.prepare('INSERT INTO notification_sends(id,workspace_id,sent_at) VALUES (?,?,?)');for(let i=0;i<60;i++)insert.run(randomUUID(),judge.id,now);
 const codes=db.prepare('INSERT INTO trial_sends(id,ip_hash,email_hash,sent_at) VALUES (?,?,?,?)');for(let i=0;i<40;i++)codes.run(randomUUID(),'invented-ip-'+i,'invented-email-'+i,now);
 const app=createApp(db,{secureCookies:false,sendCode:async()=>{sends++}}),server=app.listen(18576,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
 try {
  const r=await fetch('http://127.0.0.1:18576/api/trial/code',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:randomUUID()+'@example.invalid',termsVersion:TERMS_VERSION})});assert.equal(r.status,429);assert.equal(sends,0);
 }finally{await app.locals.queue.stop();await new Promise<void>(r=>server.close(()=>r()));db.close()}
});
test('Resend completion mail uses one stable idempotency key and a secret-free HTTPS review link',async()=>{
 const original=globalThis.fetch;const requests:{body:any;key:string}[]=[];
 globalThis.fetch=async(input,init)=>{
  if(String(input).endsWith('/gateway/list'))return Response.json(['https://api.sprites.dev/v1/gateway/resend/invented']);
  requests.push({body:JSON.parse(String(init?.body)),key:new Headers(init?.headers).get('Idempotency-Key')!});return Response.json({id:'invented-email'});
 };
 try {
  const send=resendReadySender('KAI <kai@example.invalid>','https://kai.example.invalid');
  const email=randomUUID()+'@example.invalid',id=randomUUID(),counts={person:1,note:2,todo:3,done:0};
  await send(email,id,counts,'An invented catch-up');await send(email,id,counts,'An invented catch-up');assert.deepEqual(requests[0],requests[1]);
  assert.deepEqual(requests[0].body.to,[email]);assert.match(requests[0].body.text,/3 suggested to-dos/);assert.ok(!requests[0].body.text.includes(email));
  assert.throws(()=>resendReadySender('KAI <kai@example.invalid>','https://kai.example.invalid/?private=yes'));
 }finally{globalThis.fetch=original}
});

test('a second recording finishing during mail delivery is sent without a new browser request',async()=>{
 const db=openDatabase();seed(db);const judge=actor(db),first=recording(db,judge.id),second=recording(db,judge.id,{status:'reading'});
 const sent:string[]=[];let begin!:()=>void,release!:()=>void;
 const begun=new Promise<void>(r=>begin=r),held=new Promise<void>(r=>release=r);
 const worker=recordingMailWorker(db,async(_email,id)=>{sent.push(id);if(id===first){begin();await held}});
 try {
  const run=worker.kick();await begun;
  db.prepare("UPDATE conversations SET status='ready' WHERE id=?").run(second);void worker.kick();release();await run;
  assert.deepEqual(sent,[first,second]);
 }finally{release();await worker.stop();db.close()}
});

test('styled email escapes the recording title and snapshots it for identical retries',async()=>{
 const {readyEmail}=await import('../src/email/ready');
 const title='<img src=x onerror="bad()">\r\nA made-up call';
 const message=readyEmail('https://kai.example.invalid','invented-recording',{person:1,note:2,todo:1,done:0},title);
 assert.ok(message.subject.includes('A made-up call'));assert.ok(!/[\r\n]/.test(message.subject));
 assert.ok(!message.html.includes('<img'));assert.ok(message.html.includes('&lt;img'));assert.ok(message.html.includes('Review in KAI'));
 assert.ok(message.text.includes('A made-up call'));
 const db=openDatabase();seed(db);const judge=actor(db),id=recording(db,judge.id);let now=Date.now();const titles:string[]=[];
 const worker=recordingMailWorker(db,async(_email,_id,_counts,title)=>{titles.push(title);throw new Error('Invented failure')},()=>now);
 try {
  await worker.kick();db.prepare('UPDATE conversations SET title=? WHERE id=?').run('A later title',id);now+=60001;await worker.kick();
  assert.deepEqual(titles,['Private invented title','Private invented title']);
 }finally{await worker.stop();db.close()}
});


test('one private failure email survives restarts, suppresses stale sends and allows a later ready message',async()=>{
 let db=openDatabase();seed(db);const judge=actor(db),other=actor(db,false),id=recording(db,judge.id,{status:'failed',transcribed:0});
 recording(db,other.id,{status:'failed'});recording(db,judge.id,{status:'failed',source:'paste'});recording(db,judge.id,{status:'failed',notify:0});
 let now=Date.now();const sent:{id:string;kind:string;title:string;counts:ReadyCounts}[]=[];
 const send=async(_email:string,id:string,counts:ReadyCounts,title:string,kind='ready')=>{sent.push({id,kind,title,counts});};
 let worker=recordingMailWorker(db,send,()=>now);
 try {
  await worker.kick();await worker.kick();assert.deepEqual(sent,[{id,kind:'failed',title:'Your recording',counts:{person:0,note:0,todo:0,done:0}}]);
  await worker.stop();const snapshot=db.serialize();db.close();db=openDatabase(snapshot);worker=recordingMailWorker(db,send,()=>now);
  await worker.kick();assert.equal(sent.length,1);
  db.prepare("UPDATE conversations SET status='reading' WHERE id=?").run(id);await worker.kick();assert.equal(sent.length,1);
  db.prepare("UPDATE conversations SET status='failed' WHERE id=?").run(id);await worker.kick();assert.equal(sent.length,1);
  db.prepare("UPDATE conversations SET status='ready',transcribed=1 WHERE id=?").run(id);await worker.kick();assert.equal(sent.length,2);assert.equal(sent[1].kind,'ready');
  const stale=recording(db,judge.id,{status:'failed'});await worker.stop();
  worker=recordingMailWorker(db,async()=>{throw new Error('Invented temporary mail failure')},()=>now);await worker.kick();await worker.stop();
  db.prepare("UPDATE conversations SET status='ready' WHERE id=?").run(stale);now+=60001;
  worker=recordingMailWorker(db,send,()=>now);await worker.kick();assert.equal(sent.filter(s=>s.id===stale&&s.kind==='failed').length,0);assert.equal(sent.filter(s=>s.id===stale&&s.kind==='ready').length,1);
 }finally{await worker.stop();db.close()}
});

test('listening and reading failures wake the email worker without another page request',async()=>{
 const db=openDatabase();seed(db);const judge=actor(db),directory=mkdtempSync('.data/mail-failures-');const sent:string[]=[];
 const mail=recordingMailWorker(db,async(_email,_id,_counts,_title,kind)=>{sent.push(kind!)});
 let queue=queueWorker(db,async()=>{throw new Error('Invented reading failure')},async()=>{throw new Error('Private invented provider detail')},()=>{void mail.kick()});
 try {
  await addAudio(db,judge.id,[{name:'invented.wav',buffer:testTone(),date:Date.now()}],directory);
  await queue.kick();await mail.kick();assert.deepEqual(sent,['failed']);await queue.stop();
  queue=queueWorker(db,async()=>{throw new Error('Private invented words')},fakeTranscriber,()=>{void mail.kick()});
  await addAudio(db,judge.id,[{name:'invented.wav',buffer:testTone(),date:Date.now()}],directory);
  await queue.kick();await mail.kick();assert.deepEqual(sent,['failed','failed']);
 }finally{await queue.stop();await mail.stop();db.close();rmSync(directory,{recursive:true,force:true})}
});

test('failure email excludes content and uses a separate stable key from completion mail',async()=>{
 const original=globalThis.fetch;const requests:{body:any;key:string}[]=[];
 globalThis.fetch=async(input,init)=>{
  if(String(input).endsWith('/gateway/list'))return Response.json(['https://api.sprites.dev/v1/gateway/resend/invented']);
  requests.push({body:JSON.parse(String(init?.body)),key:new Headers(init?.headers).get('Idempotency-Key')!});return Response.json({id:'invented-email'});
 };
 try {
  const send=resendReadySender('KAI <kai@example.invalid>','https://kai.example.invalid');const counts={person:2,note:4,todo:3,done:1};
  await send('reader@example.invalid','invented-recording',counts,'Private invented title','failed');
  await send('reader@example.invalid','invented-recording',counts,'Changed private title','failed');
  await send('reader@example.invalid','invented-recording',counts,'Private invented title','ready');
  assert.deepEqual(requests[0],requests[1]);assert.notEqual(requests[0].key,requests[2].key);
  const message=requests[0].body;assert.match(message.subject,/another try/);assert.match(message.text,/recordings\/invented-recording/);assert.match(message.html,/#7f22fe/);
  for(const value of [message.subject,message.text,message.html]){assert.ok(!value.includes('Private'));assert.ok(!value.includes('reader@example.invalid'));assert.ok(!value.includes('suggested'));}
 }finally{globalThis.fetch=original}
});


test('mail queued just after an empty scan is sent without another request',async()=>{
 const db=openDatabase();seed(db);const a=actor(db);let sends=0;
 const worker=recordingMailWorker(db,async()=>{sends++});
 try {const idle=worker.kick();recording(db,a.id,{status:'failed'});const queued=worker.kick();await Promise.all([idle,queued]);assert.equal(sends,1);}
 finally{await worker.stop();db.close()}
});

test('failure sends use the same notebook and global caps as ready sends',async()=>{
 const db=openDatabase();seed(db);const actors=Array.from({length:7},()=>actor(db));let sends=0;
 for(const a of actors)for(let i=0;i<11;i++)recording(db,a.id,{status:i%2?'ready':'failed'});
 const worker=recordingMailWorker(db,async()=>{sends++});
 try {await worker.kick();assert.equal(sends,60);assert.ok((db.prepare('SELECT count(*) n FROM notification_sends GROUP BY workspace_id').all() as {n:number}[]).every(r=>r.n<=10));}
 finally{await worker.stop();db.close()}
});


test('mail migration preserves ready delivery state and does not send it again',async()=>{
 let db=openDatabase();seed(db);const a=actor(db),id=recording(db,a.id);const now=Date.now();
 db.exec(`DROP TABLE recording_emails; CREATE TABLE recording_emails(id TEXT PRIMARY KEY REFERENCES conversations(id),workspace_id TEXT NOT NULL REFERENCES workspaces(id),counts TEXT NOT NULL,queued_at INTEGER NOT NULL,first_attempt_at INTEGER,attempts INTEGER NOT NULL DEFAULT 0,next_attempt_at INTEGER NOT NULL DEFAULT 0,sent_at INTEGER,closed INTEGER NOT NULL DEFAULT 0,title TEXT NOT NULL DEFAULT 'Your recording')`);
 db.prepare('INSERT INTO recording_emails(id,workspace_id,counts,queued_at,first_attempt_at,attempts,sent_at,title) VALUES (?,?,?,?,?,?,?,?)').run(id,a.id,JSON.stringify({person:0,note:0,todo:0,done:0}),now,now,1,now,'Invented frozen title');
 const snapshot=db.serialize();db.close();db=openDatabase(snapshot);let sends=0;const worker=recordingMailWorker(db,async()=>{sends++});
 try {await worker.kick();assert.equal(sends,0);assert.deepEqual(db.prepare('SELECT kind,attempts,sent_at,title FROM recording_emails WHERE id=?').get(id),{kind:'ready',attempts:1,sent_at:now,title:'Invented frozen title'});}
 finally{await worker.stop();db.close()}
});
