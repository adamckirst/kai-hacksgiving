import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac,randomUUID} from 'node:crypto';
import {existsSync,mkdtempSync,rmSync} from 'node:fs';
import {openDatabase,seed} from '../src/server/db';
import {createApp,type AppOptions} from '../src/server/app';
import {createJudge,createBrowserSession} from '../src/server/access';
import {persistentJudgeSecret} from '../src/server/config';
import {trialGrantCount,trialAlreadyClaimed} from '../src/server/account';
import {reserveReading,reserveRecording,type Reader} from '../src/server/reading';
import {addAudio,type Transcriber} from '../src/server/audio';
import {TERMS_VERSION} from '../src/terms';

function tone(){const b=Buffer.alloc(44+16000);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(8000,24);b.writeUInt32LE(16000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(16000,40);return b}
async function fixture(run:(f:Awaited<ReturnType<typeof setup>>)=>Promise<void>,extra:AppOptions={}){const f=await setup(extra);try{await run(f)}finally{await f.close()}}
async function setup(extra:AppOptions={}){
 let db=openDatabase();seed(db);const directory=mkdtempSync('.data/account-test-'),codes=new Map<string,string>();let now=Date.now();
 const options:AppOptions={secureCookies:false,trustSpriteProxy:true,audioDirectory:directory,now:()=>now,sendCode:async(email,code)=>{codes.set(email,code)},...extra};
 let app=createApp(db,options),server=app.listen(18760,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const base='http://127.0.0.1:18760';
 const cookie=(r:Response,name='kai_entry')=>r.headers.getSetCookie().find(c=>c.startsWith(name+'='))?.split(';')[0]??'';
 const get=(route:string,session='')=>fetch(base+route,{headers:{Cookie:session,Connection:'close'}});
 const post=(route:string,body:object,session='',ip='192.0.2.210',origin?:string)=>fetch(base+route,{method:'POST',headers:{Cookie:session,Connection:'close','Content-Type':'application/json','Sprite-Client-IP':ip,...origin?{Origin:origin}:{}},body:JSON.stringify(body)});
 function owner(verified=true){const j=createJudge(db,true),email=randomUUID()+'@example.invalid',network='192.0.2.'+(210+(db.prepare('SELECT count(*) n FROM waitlist').get() as {n:number}).n);const ip=createHmac('sha256',persistentJudgeSecret(db)).update('ip:'+network).digest('hex');db.prepare('UPDATE workspaces SET trial_seconds=1800,trial_verified=? WHERE id=?').run(Number(verified),j.id);db.prepare('INSERT INTO waitlist(email,created_at,workspace_id,verified_at,trial_ip,terms_version,terms_accepted_at) VALUES (?,?,?,?,?,?,?)').run(email,'2026-11-27',j.id,verified?'2026-11-27':null,verified?ip:null,TERMS_VERSION,'2026-11-27');return {...j,email,ip,network,session:'kai_session='+j.cookie}}
 const stop=async()=>{await app.locals.queue.stop();await new Promise<void>(r=>server.close(()=>r()));db.close()};
 return {get db(){return db},get app(){return app},directory,codes,cookie,get,post,owner,advance:()=>{now+=3600001},restart:async()=>{const data=db.serialize();await stop();db=openDatabase(data);app=createApp(db,options);server=app.listen(18760,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r))},close:async()=>{await stop();rmSync(directory,{recursive:true,force:true})}};
}
test('account email is owner-only; deletion requires confirmation and revokes only its notebook',()=>fixture(async f=>{
 const a=f.owner(),b=f.owner(),invitation=createJudge(f.db,false);const second='kai_session='+createBrowserSession(f.db,a.id);
 const account=await f.get('/api/account',a.session);assert.equal(account.headers.get('cache-control'),'no-store');assert.deepEqual(await account.json(),{signedIn:true,email:a.email});
 assert.deepEqual(await(await f.get('/api/account')).json(),{signedIn:false,email:null});assert.deepEqual(await(await f.get('/api/account','kai_session='+invitation.cookie)).json(),{signedIn:true,email:null});
 for(const route of ['/api/home','/api/people','/api/library','/api/login/session'])assert.ok(!(await(await f.get(route,a.session)).text()).includes(a.email));
 assert.equal((await f.post('/api/account/delete',{confirm:true})).status,403);assert.equal((await f.post('/api/account/delete',{confirm:true},'kai_session='+invitation.cookie)).status,403);
 assert.equal((await f.post('/api/account/delete',{},a.session)).status,400);assert.equal((await f.post('/api/account/delete',{confirm:true,workspace:b.id},a.session)).status,400);assert.equal((await f.post('/api/account/delete',{confirm:true},a.session,a.network,'https://outside.invalid')).status,403);
 const connection=await(await f.get('/api/connect',a.session)).json();const dataBefore=f.db.prepare('SELECT * FROM people WHERE workspace_id=?').all(b.id);
 const ids=await addAudio(f.db,a.id,[{name:'memo.wav',buffer:tone(),date:Date.now()}],f.directory,'shared',{awaitingPerson:true});const audio=(f.db.prepare('SELECT audio_path FROM conversations WHERE id=?').get(ids[0]) as {audio_path:string}).audio_path;assert.ok(existsSync(audio));
 const challenge=await f.post('/api/entry/code',{email:a.email});const proof=f.cookie(challenge),code=f.codes.get(a.email)!;
 const removed=await f.post('/api/account/delete',{confirm:true},a.session);assert.equal(removed.status,200);assert.ok(!existsSync(audio));
 for(const table of ['workspaces','people','conversations','notes','todos','suggestions','waitlist','browser_sessions','recording_emails','quota_emails','login_challenges'])assert.equal((f.db.prepare(`SELECT count(*) n FROM ${table} WHERE workspace_id=?`).get(a.id) as {n:number}).n,0);
 assert.deepEqual(f.db.prepare('SELECT * FROM people WHERE workspace_id=?').all(b.id),dataBefore);
 for(const session of [a.session,second])assert.equal((await(await f.get('/api/access',session)).json()).kind,'public');
 assert.equal((await f.get(connection.uploadPath)).status,404);assert.equal((await f.post(connection.mcpPath,{})).status,404);
 assert.equal((await f.post('/api/entry/verify',{email:a.email,code},proof)).status,409);assert.equal((await f.post('/api/account/delete',{confirm:true},a.session)).status,403);
 assert.equal(trialGrantCount(f.db),2);assert.equal(trialAlreadyClaimed(f.db,a.email,a.ip),true);assert.equal(f.db.prepare('PRAGMA foreign_key_check').all().length,0);
 await f.restart();assert.equal((await(await f.get('/api/access',second)).json()).kind,'public');assert.equal(trialGrantCount(f.db),2);
}));
test('deleted grants retain email/IP, 100-user and daily/send caps across all signup paths and restart',()=>fixture(async f=>{
 const a=f.owner(),b=f.owner();const day=new Date().toISOString().slice(0,10);
 f.db.prepare('UPDATE workspaces SET reading_day=?,readings_today=150,recording_day=?,recordings_today=60 WHERE id=?').run(day,day,a.id);
 for(let i=0;i<60;i++)f.db.prepare('INSERT INTO notification_sends VALUES (?,?,?)').run(randomUUID(),a.id,Date.now());
 assert.equal((await f.post('/api/account/delete',{confirm:true},a.session)).status,200);
 assert.throws(()=>reserveReading(f.db,b.id),/limit/);assert.throws(()=>reserveRecording(f.db,b.id),/limit/);assert.equal((f.db.prepare('SELECT count(*) n FROM notification_sends').get() as {n:number}).n,60);
 await f.restart();assert.throws(()=>reserveReading(f.db,b.id),/limit/);
 async function blocked(email:string,ip:string){const r=await f.post('/api/entry/code',{email},'',ip);assert.equal(r.status,200);const result=await f.post('/api/entry/verify',{email,code:f.codes.get(email)},f.cookie(r),ip);assert.equal(result.status,409);assert.match((await result.json()).error,/already been claimed/)}
 await blocked(a.email,'198.51.100.23');await blocked('other@example.invalid',a.network);
 f.advance();assert.equal((await f.post('/api/trial/code',{email:a.email,termsVersion:TERMS_VERSION},'','198.51.100.24')).status,200);assert.equal(f.db.prepare('SELECT 1 FROM trial_challenges WHERE email=?').get(a.email),undefined);
 // Even a valid legacy challenge prepared before another grant cannot regrant.
 const pending='pending@example.invalid',ip='198.51.100.25';const r=await f.post('/api/trial/code',{email:pending,termsVersion:TERMS_VERSION},'',ip);assert.equal(r.status,200);const row=f.db.prepare('SELECT ip_hash FROM trial_challenges WHERE email=?').get(pending) as {ip_hash:string};
 f.db.prepare('INSERT INTO deleted_trial_grants VALUES (?,?)').run(randomUUID(),row.ip_hash);
 assert.equal((await f.post('/api/trial/verify',{email:pending,code:f.codes.get(pending),termsVersion:TERMS_VERSION},'',ip)).status,409);
 for(let i=trialGrantCount(f.db);i<100;i++)f.db.prepare('INSERT INTO deleted_trial_grants VALUES (?,?)').run(randomUUID(),randomUUID());
 assert.deepEqual(await(await f.get('/api/trial')).json(),{available:false});f.advance();assert.equal((await f.post('/api/trial/code',{email:'cap@example.invalid',termsVersion:TERMS_VERSION},'','198.51.100.26')).status,409);
 assert.equal((f.db.prepare('SELECT count(*) n FROM waitlist').get() as {n:number}).n,1);
}));
test('deletion during transcription aborts the job and cannot recreate content or mail after completion',async()=>{
 let started!:()=>void,finish!:(text:string)=>void;const listening=new Promise<void>(r=>started=r);let signal:AbortSignal|undefined,reads=0,mails=0;
 const transcriber:Transcriber=async(_audio,s)=>{signal=s;started();return new Promise<string>(r=>finish=r)};
 await fixture(async f=>{const a=f.owner();await addAudio(f.db,a.id,[{name:'memo.wav',buffer:tone(),date:Date.now()}],f.directory,'recording',{person:{person_id:null,recording_type:'memo'}});
 const work=f.app.locals.queue.kick();await listening;assert.equal((await f.post('/api/account/delete',{confirm:true},a.session)).status,200);assert.equal(signal?.aborted,true);finish('An invented memo.');await work;await f.app.locals.queue.kick();assert.equal(reads,0);assert.equal(mails,0);assert.equal((f.db.prepare('SELECT count(*) n FROM conversations WHERE workspace_id=?').get(a.id) as {n:number}).n,0);
 },{transcriber,reader:async()=>{reads++},sendReady:async()=>{mails++}});
});
test('deletion during reading rejects late suggestions',async()=>{
 let started!:()=>void,finish!:()=>void;const reading=new Promise<void>(r=>started=r);let late:()=>void=()=>{};
 const reader:Reader=async(_input,call)=>{late=()=>{assert.throws(()=>call('propose_person',{name:'Tess Vale',company:'Loomwork',role:'Founder',quote:'Tess Vale'}))};started();await new Promise<void>(r=>finish=r);late()};
 await fixture(async f=>{const a=f.owner();f.db.prepare("INSERT INTO conversations(id,workspace_id,title,summary,source,text,happened_on,status) VALUES ('pending',?,'New recording','','paste','Tess Vale','2026-11-27','waiting')").run(a.id);const work=f.app.locals.queue.kick();await reading;assert.equal((await f.post('/api/account/delete',{confirm:true},a.session)).status,200);finish();await work;assert.equal(f.db.prepare("SELECT 1 FROM conversations WHERE id='pending'").get(),undefined);assert.equal(f.db.prepare('SELECT 1 FROM suggestions WHERE workspace_id=?').get(a.id),undefined);
 },{reader});
});
test('deletion suppresses queued mail while an already handed-off message remains charged',async()=>{
 let started!:()=>void,finish!:()=>void;const sending=new Promise<void>(r=>started=r);let sends=0;
 await fixture(async f=>{const a=f.owner();f.db.prepare("UPDATE conversations SET source='recording',notify_ready=1,transcribed=1 WHERE workspace_id=?").run(a.id);const work=f.app.locals.queue.kick();await sending;assert.equal((await f.post('/api/account/delete',{confirm:true},a.session)).status,200);finish();await work;await f.app.locals.queue.stop();assert.equal(sends,1);assert.equal(f.db.prepare('SELECT 1 FROM recording_emails WHERE workspace_id=?').get(a.id),undefined);assert.equal((f.db.prepare('SELECT count(*) n FROM notification_sends').get() as {n:number}).n,1);await f.restart();await f.app.locals.queue.kick();assert.equal(sends,1);
 },{sendReady:async()=>{sends++;started();await new Promise<void>(r=>finish=r)}});
});
test('deletion rolls back completely on a database failure and durable audio cleanup resumes after restart',()=>fixture(async f=>{
 const a=f.owner();const ids=await addAudio(f.db,a.id,[{name:'memo.wav',buffer:tone(),date:Date.now()}],f.directory,'shared',{awaitingPerson:true});const audio=(f.db.prepare('SELECT audio_path FROM conversations WHERE id=?').get(ids[0]) as {audio_path:string}).audio_path;
 const before=f.db.prepare('SELECT * FROM people WHERE workspace_id=?').all(a.id);
 f.db.exec("CREATE TRIGGER refuse_delete BEFORE DELETE ON workspaces BEGIN SELECT RAISE(ABORT,'Invented failure'); END");assert.equal((await f.post('/api/account/delete',{confirm:true},a.session)).status,500);assert.ok(existsSync(audio));assert.deepEqual(f.db.prepare('SELECT * FROM people WHERE workspace_id=?').all(a.id),before);assert.equal(f.db.prepare('SELECT 1 FROM deleted_trial_grants').get(),undefined);assert.equal(f.db.prepare('SELECT 1 FROM deleted_audio').get(),undefined);
 f.db.exec('DROP TRIGGER refuse_delete');assert.equal((await f.post('/api/account/delete',{confirm:true},a.session)).status,200);
 // Model a process stopping after its atomic deletion but before file cleanup.
 const {writeFileSync}=await import('node:fs');writeFileSync(audio,tone());f.db.prepare('INSERT INTO deleted_audio VALUES (?)').run(audio);await f.restart();assert.ok(!existsSync(audio));assert.equal(f.db.prepare('SELECT 1 FROM deleted_audio').get(),undefined);
}));
