import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {openDatabase,seed} from '../src/server/db';
import {createJudge} from '../src/server/access';
import {testTone} from '../src/server/gateway';
import {addAudio,queueWorker} from '../src/server/audio';
import {quotaMailWorker,queueQuotaEmail} from '../src/server/quota-mail';
import {quotaEmail} from '../src/email/quota';
import {createApp} from '../src/server/app';
function wav(seconds:number){const b=Buffer.alloc(44+seconds*800*2);testTone().copy(b);b.writeUInt32LE(b.length-8,4);b.writeUInt32LE(b.length-44,40);b.writeUInt32LE(800,24);b.writeUInt32LE(1600,28);return b}
function owner(db:ReturnType<typeof openDatabase>,time=1800){const j=createJudge(db,false);db.prepare('UPDATE workspaces SET trial_seconds=?,trial_verified=1 WHERE id=?').run(time,j.id);db.prepare('INSERT INTO waitlist(email,workspace_id,created_at,verified_at) VALUES (?,?,?,?)').run(j.id+'@example.invalid',j.id,'2026-11-26','2026-11-26');return j}
test('allowance migration deducts used time once; a 5m35 recording and long transcript can finish without recharging',async()=>{
 let db=openDatabase();seed(db);const j=owner(db,3356),spent=owner(db,100);db.exec('ALTER TABLE workspaces DROP COLUMN trial_allowance');let image=db.serialize();db.close();db=openDatabase(image);
 assert.equal((db.prepare('SELECT trial_seconds n FROM workspaces WHERE id=?').get(j.id) as {n:number}).n,1556);assert.equal((db.prepare('SELECT trial_seconds n FROM workspaces WHERE id=?').get(spent.id) as {n:number}).n,0);
 image=db.serialize();db.close();db=openDatabase(image);assert.equal((db.prepare('SELECT trial_seconds n FROM workspaces WHERE id=?').get(j.id) as {n:number}).n,1556);
 const dir=mkdtempSync('.data/long-audio-');try{
  const [id]=await addAudio(db,j.id,[{name:'invented.wav',buffer:wav(335),date:Date.now()}],dir);
  assert.equal((db.prepare('SELECT trial_seconds n FROM workspaces WHERE id=?').get(j.id) as {n:number}).n,1221);
  const worker=queueWorker(db,async(_input,call)=>{call('describe_recording',{title:'Invented longer memo',summary:'A made-up update.\nNo new tasks.'})},async(_audio,_signal,seconds)=>{assert.equal(seconds,335);return 'Invented words. '.repeat(2000)});await worker.kick();await worker.stop();assert.equal((db.prepare('SELECT status FROM conversations WHERE id=?').get(id) as {status:string}).status,'ready');
 }finally{db.close();rmSync(dir,{recursive:true,force:true})}
});
test('quota emails deduplicate, retry after restart and share sending caps without recording content',async()=>{
 let db=openDatabase();seed(db);const j=owner(db,1),unverified=createJudge(db,false);let now=Date.now();const dir=mkdtempSync('.data/quota-mail-');
 try{
  const file={name:'invented.wav',buffer:testTone(),date:now};for(let i=0;i<2;i++)await assert.rejects(()=>addAudio(db,j.id,[file],dir),/remaining recording time/);
  assert.equal((db.prepare('SELECT count(*) n FROM quota_emails').get() as {n:number}).n,1);assert.equal((db.prepare("SELECT count(*) n FROM conversations WHERE source='recording'").get() as {n:number}).n,0);
  queueQuotaEmail(db,unverified.id,[file.buffer],2,1);assert.equal((db.prepare('SELECT count(*) n FROM quota_emails').get() as {n:number}).n,1);
  const ids:string[]=[];let worker=quotaMailWorker(db,async(_email,id)=>{ids.push(id);throw Error('Fake failure')},()=>now);await worker.kick();await worker.stop();const image=db.serialize();db.close();db=openDatabase(image);now+=61000;
  worker=quotaMailWorker(db,async(email,id,requested,remaining)=>{assert.equal(email,j.id+'@example.invalid');ids.push(id);const mail=quotaEmail('https://example.invalid',requested,remaining);assert.match(mail.text,/Thank you/);assert.match(mail.text,/if KAI becomes a product/);assert.ok(!mail.text.includes(j.id));assert.match(mail.html,/#7f22fe/);},()=>now);await worker.kick();await worker.kick();await worker.stop();assert.equal(ids.length,2);assert.equal(ids[0],ids[1]);
  queueQuotaEmail(db,j.id,[Buffer.from('another invented batch')],3,1,now);for(let n=0;n<8;n++)db.prepare('INSERT INTO notification_sends VALUES (?,?,?)').run('invented-'+n,j.id,now);
  worker=quotaMailWorker(db,async()=>{assert.fail('Shared notebook cap must prevent sending')},()=>now);await worker.kick();await worker.stop();
  const other=owner(db,0);queueQuotaEmail(db,other.id,[Buffer.from('another quota rejection')],2,0,now);for(let n=0;n<50;n++)db.prepare('INSERT INTO notification_sends VALUES (?,?,?)').run('global-'+n,j.id,now);worker=quotaMailWorker(db,async()=>{assert.fail('Global notification cap must prevent sending')},()=>now);await worker.kick();await worker.stop();
  db.exec('DELETE FROM notification_sends');for(let n=0;n<100;n++)db.prepare('INSERT INTO trial_sends VALUES (?,?,?,?)').run('code-'+n,'invented-network','invented-email-hash',now);worker=quotaMailWorker(db,async()=>{assert.fail('Verification send cap must prevent sending')},()=>now);await worker.kick();await worker.stop();
 }finally{db.close();rmSync(dir,{recursive:true,force:true})}
});
test('browser and shared upload rejections wake the quota mail queue and charge no duration',async()=>{
 const db=openDatabase();seed(db);const j=owner(db,1);let sent=0;const dir=mkdtempSync('.data/quota-routes-');const app=createApp(db,{secureCookies:false,audioDirectory:dir,sendQuota:async()=>{sent++}});const server=app.listen(18588,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
 try{
  const address=(db.prepare('SELECT upload_token FROM workspaces WHERE id=?').get(j.id) as {upload_token:string}).upload_token;
  for(const route of ['/api/recordings','/in/'+address]){const form=new FormData();form.append('recordings',new Blob([testTone()]),'invented.wav');form.append('dates',JSON.stringify([Date.now()]));const r=await fetch('http://127.0.0.1:18588'+route,{method:'POST',headers:{Cookie:'kai_session='+j.cookie},body:form});assert.equal(r.status,429)}
  await app.locals.queue.kick();await app.locals.queue.stop();assert.equal(sent,1);assert.equal((db.prepare('SELECT trial_seconds n FROM workspaces WHERE id=?').get(j.id) as {n:number}).n,1);
 }finally{await app.locals.queue.stop();await new Promise<void>(r=>server.close(()=>r()));db.close();rmSync(dir,{recursive:true,force:true})}
});
