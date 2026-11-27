import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readdirSync,rmSync} from 'node:fs';
import {openDatabase,seed} from '../src/server/db';
import {createJudge} from '../src/server/access';
import {createApp} from '../src/server/app';
import {testTone} from '../src/server/gateway';

test('both import routes reject two files without writes, quota, provider or mail calls; one still works',async()=>{
 const db=openDatabase();seed(db);const j=createJudge(db,false),dir=mkdtempSync('.data/single-import-');let listens=0,mails=0;
 db.prepare('UPDATE workspaces SET trial_seconds=1800,trial_verified=1 WHERE id=?').run(j.id);
 db.prepare('INSERT INTO waitlist(email,workspace_id,created_at,verified_at) VALUES (?,?,?,?)').run('invented@example.invalid',j.id,'2026-11-26','2026-11-26');
 const app=createApp(db,{secureCookies:false,audioDirectory:dir,transcriber:async()=>{listens++;return 'Invented words.'},reader:async(_input,call)=>{call('describe_recording',{title:'Invented memo',summary:'A made-up update.\nNo promises.'})},sendReady:async()=>{mails++},sendQuota:async()=>{mails++}});
 const server=app.listen(18635,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const base='http://127.0.0.1:18635',headers={Cookie:'kai_session='+j.cookie};
 const address=(db.prepare('SELECT upload_token FROM workspaces WHERE id=?').get(j.id) as {upload_token:string}).upload_token;
 const counters=()=>db.prepare('SELECT trial_seconds,recordings_today,readings_today FROM workspaces WHERE id=?').get(j.id);
 function form(count:number){const f=new FormData();for(let i=0;i<count;i++)f.append('recordings',new Blob([testTone()]),'invented.wav');f.append('dates',JSON.stringify(Array(count).fill(Date.now())));f.append('person',JSON.stringify({recording_type:'memo'}));return f}
 try{
  const before=counters();
  for(const route of ['/api/recordings','/in/'+address]){
   const r=await fetch(base+route,{method:'POST',headers,body:form(2)});assert.equal(r.status,400);assert.match((await r.json()).error,/one recording/i);
  }
  await app.locals.queue.kick();assert.deepEqual(counters(),before);assert.deepEqual(readdirSync(dir),[]);
  for(const table of ['conversations','people','recording_emails','quota_emails'])assert.equal((db.prepare(`SELECT count(*) n FROM ${table} WHERE workspace_id=?`).get(j.id) as {n:number}).n,0);
  assert.equal(listens,0);assert.equal(mails,0);
  for(const route of ['/api/recordings','/in/'+address]){
   const r=await fetch(base+route,{method:'POST',headers,body:form(1)});assert.equal(r.status,202);const {ids}=await r.json();assert.equal(ids.length,1);
   if(route.startsWith('/in/'))assert.equal((await fetch(base+'/api/uploads/'+ids[0]+'/start',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({recording_type:'memo'})})).status,200);
   await app.locals.queue.kick();
  }
  assert.equal(listens,2);assert.equal((db.prepare("SELECT count(*) n FROM conversations WHERE workspace_id=? AND status='ready'").get(j.id) as {n:number}).n,2);
 }finally{await app.locals.queue.stop();await new Promise<void>(r=>server.close(()=>r()));db.close();rmSync(dir,{recursive:true,force:true})}
});
