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
