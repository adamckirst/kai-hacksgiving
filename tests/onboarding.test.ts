import {test} from 'node:test';
import assert from 'node:assert/strict';
import {openDatabase,seed} from '../src/server/db';
import {createJudge} from '../src/server/access';
import {createApp} from '../src/server/app';

test('first audio completion is notebook-scoped and survives restart; setup, pasted words and unfinished audio do not finish onboarding',async()=>{
 const db=openDatabase();seed(db);const owner=createJudge(db,false),other=createJudge(db,false);
 const insert=db.prepare("INSERT INTO conversations(id,workspace_id,title,summary,source,text,happened_on,status) VALUES (?,?,'Invented memo','',?,'Invented words','2026-11-28',?)");
 insert.run('other-ready',other.id,'shared','ready');insert.run('owner-paste',owner.id,'paste','ready');
 const app=createApp(db,{secureCookies:false}),server=app.listen(18861,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
 const home=async()=>await(await fetch('http://127.0.0.1:18861/api/home',{headers:{Cookie:'kai_session='+owner.cookie}})).json();
 try {
  assert.equal((await home()).hasReadyRecording,false);
  db.prepare('UPDATE workspaces SET shortcut_ready=1 WHERE id=?').run(owner.id);
  insert.run('owner-audio',owner.id,'recording','waiting');
  for(const status of ['waiting','listening','reading','failed']){db.prepare('UPDATE conversations SET status=? WHERE id=?').run(status,'owner-audio');assert.equal((await home()).hasReadyRecording,false);}
  db.prepare("UPDATE conversations SET status='ready' WHERE id='owner-audio'").run();assert.equal((await home()).hasReadyRecording,true);
  const restored=openDatabase(db.serialize());assert.equal((restored.prepare("SELECT count(*) n FROM conversations WHERE workspace_id=? AND source IN ('recording','shared') AND status='ready'").get(owner.id) as {n:number}).n,1);restored.close();
 }finally{await app.locals.queue.stop();await new Promise<void>(r=>server.close(()=>r()));db.close();}
});

test('assistant onboarding follows only the first started audio or example and completion is durable and isolated',async()=>{
 const {onboardingState,finishOnboarding}=await import('../src/server/onboarding');
 const db=openDatabase();seed(db);const a=createJudge(db,false),b=createJudge(db,false);
 db.prepare('UPDATE workspaces SET trial_verified=1,trial_seconds=1800 WHERE id IN (?,?)').run(a.id,b.id);
 assert.equal(onboardingState(db,a.id).needsShortcut,true);assert.throws(()=>finishOnboarding(db,a.id));
 db.prepare('UPDATE workspaces SET shortcut_ready=1 WHERE id=?').run(a.id);assert.equal(onboardingState(db,a.id).needsShortcut,false);assert.equal(onboardingState(db,a.id).needsRecording,true);
 db.prepare("INSERT INTO conversations(id,workspace_id,title,summary,source,text,happened_on,status,awaiting_person) VALUES ('first-audio',?,'Invented','','shared','','2026-11-28','waiting',1)").run(a.id);
 assert.equal(onboardingState(db,a.id).assistantRecordingId,null);
 db.prepare("UPDATE conversations SET awaiting_person=0,status='listening' WHERE id='first-audio'").run();assert.equal(onboardingState(db,a.id).assistantRecordingId,'first-audio');assert.equal(onboardingState(db,b.id).assistantRecordingId,null);
 db.prepare("UPDATE conversations SET awaiting_speakers=1 WHERE id='first-audio'").run();assert.equal(onboardingState(db,a.id).assistantRecordingId,null);
 db.prepare("UPDATE conversations SET awaiting_speakers=0,status='ready' WHERE id='first-audio'").run();finishOnboarding(db,a.id);finishOnboarding(db,a.id);
 const restored=openDatabase(db.serialize());assert.equal(onboardingState(restored,a.id).assistantRecordingId,null);assert.equal(onboardingState(restored,b.id).needsShortcut,true);restored.close();db.close();
});

test('example requests are fenced and idempotent, use no audio quota, and keep proposals private until acceptance',async()=>{
 const {fakeReader}=await import('../src/server/fake-reader');
 const db=openDatabase();seed(db);const a=createJudge(db,false),b=createJudge(db,false);let reads=0,listens=0;
 db.prepare('UPDATE workspaces SET trial_verified=1,trial_seconds=1800 WHERE id=?').run(a.id);
 const app=createApp(db,{secureCookies:false,reader:async(...args)=>{reads++;await fakeReader(...args)},transcriber:async()=>{listens++;throw Error('No audio expected')}});
 const server=app.listen(18862,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
 const post=(route:string,cookie=a.cookie)=>fetch('http://127.0.0.1:18862/api/onboarding/'+route,{method:'POST',headers:{Cookie:'kai_session='+cookie}});
 try{
  assert.equal((await post('example','')).status,403);assert.equal((await post('example',b.cookie)).status,403);assert.equal((await post('finish')).status,409);
  const replies=await Promise.all([post('example'),post('example')]);const ids=await Promise.all(replies.map(r=>r.json()));assert.equal(ids[0].id,ids[1].id);await app.locals.queue.kick();
  assert.equal(reads,1);assert.equal(listens,0);assert.equal((db.prepare('SELECT trial_seconds FROM workspaces WHERE id=?').get(a.id) as {trial_seconds:number}).trial_seconds,1800);
  assert.equal((db.prepare('SELECT count(*) n FROM people WHERE workspace_id=?').get(a.id) as {n:number}).n,0);assert.equal((db.prepare('SELECT count(*) n FROM conversations WHERE workspace_id=?').get(b.id) as {n:number}).n,0);
  assert.ok((db.prepare("SELECT count(*) n FROM suggestions WHERE workspace_id=? AND status='proposed'").get(a.id) as {n:number}).n>0);
  assert.equal((db.prepare('SELECT count(*) n FROM recording_emails WHERE workspace_id=?').get(a.id) as {n:number}).n,0);
  assert.equal((await post('finish')).status,200);assert.equal((await post('finish')).status,200);
 }finally{await app.locals.queue.stop();await new Promise<void>(r=>server.close(()=>r()));db.close()}
});
