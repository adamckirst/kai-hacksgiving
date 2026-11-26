import {test} from 'node:test';
import assert from 'node:assert/strict';
import {openDatabase,seed} from '../src/server/db';
import {createJudge} from '../src/server/access';
import {createApp} from '../src/server/app';
test('library, notifications and shortcut setup are isolated, durable and fenced from public writes',async()=>{
 const db=openDatabase();seed(db);const first=createJudge(db,false),second=createJudge(db,false);
 const app=createApp(db,{secureCookies:false}),server=app.listen(18577,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const base='http://127.0.0.1:18577';
 const insert=db.prepare("INSERT INTO conversations(id,workspace_id,title,summary,source,text,happened_on,status) VALUES (?,?,'Invented memo','','paste','Invented words','2026-11-26','ready')");insert.run('first-memo',first.id);insert.run('second-memo',second.id);
 const request=(path:string,body?:unknown,cookie=first.cookie)=>fetch(base+path,{method:body ? 'POST':'GET',headers:{Cookie:cookie ? 'kai_session='+cookie:'','Content-Type':'application/json'},body:body ? JSON.stringify(body):undefined});
 try {
  const library=await(await request('/api/library')).json();assert.deepEqual(library.map((r:any)=>r.id),['first-memo']);
  const notifications=await(await request('/api/notifications')).json();assert.equal(notifications.unread,1);assert.deepEqual(notifications.items.map((r:any)=>r.id),['first-memo']);
  assert.equal((await request('/api/notifications/second-memo/seen',{status:'ready'})).status,404);
  assert.equal((await request('/api/notifications/first-memo/seen',{status:'ready'})).status,200);
  assert.equal((await(await request('/api/notifications')).json()).unread,0);
  db.prepare("UPDATE conversations SET status='failed' WHERE id='first-memo'").run();
  assert.equal((await request('/api/notifications/first-memo/seen',{status:'ready'})).status,404);
  assert.equal((await(await request('/api/notifications')).json()).unread,1);
  assert.equal((await request('/api/connect/shortcut',{ready:true})).status,200);
  assert.equal((await(await request('/api/connect')).json()).shortcutReady,true);
  assert.equal((await(await request('/api/connect',undefined,second.cookie)).json()).shortcutReady,false);
  assert.equal((await request('/api/connect/shortcut',{ready:true},'')).status,403);
  assert.equal((await request('/api/notifications/first-memo/seen',{status:'failed'},'')).status,403);
  const restored=openDatabase(db.serialize());assert.equal((restored.prepare('SELECT shortcut_ready FROM workspaces WHERE id=?').get(first.id) as {shortcut_ready:number}).shortcut_ready,1);assert.equal((restored.prepare("SELECT notification_seen_status FROM conversations WHERE id='first-memo'").get() as {notification_seen_status:string}).notification_seen_status,'ready');restored.close();
 }finally{await app.locals.queue.stop();await new Promise<void>(r=>server.close(()=>r()));db.close()}
});
