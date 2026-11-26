import {test} from 'node:test';
import assert from 'node:assert/strict';
import {openDatabase,seed} from '../src/server/db';
import {searchNotebook} from '../src/server/search';
import {getTodo} from '../src/server/todos';
import {createApp} from '../src/server/app';
import {createJudge} from '../src/server/access';

test('search covers recording words, accepted person notes and open or completed tasks without crossing notebooks',()=>{
 const db=openDatabase();seed(db,new Date(),'first');seed(db,new Date(),'second');
 try {
  db.prepare("UPDATE conversations SET text='Invented orchard phrase' WHERE id='first:dana-call'").run();
  db.prepare("UPDATE notes SET text='Discussed an invented orchard' WHERE id='first:dana-note'").run();
  db.prepare("UPDATE todos SET text='Plan the orchard',status='done' WHERE id='first:pricing'").run();
  const r=searchNotebook(db,'first','ORCHARD');
  assert.equal(r.library.length,1);assert.equal(r.people.length,1);assert.equal(r.tasks.length,1);
  assert.ok(r.library[0].href.startsWith('/recordings/'));assert.match(r.tasks[0].detail,/Done/);
  assert.equal(getTodo(db,'first','first:pricing')!==undefined,true);assert.equal(getTodo(db,'second','first:pricing'),undefined);
  assert.deepEqual(searchNotebook(db,'second','orchard'),{library:[],people:[],tasks:[],more:{library:false,people:false,tasks:false}});
  db.prepare("UPDATE people SET name='Inés Marlow' WHERE id='first:dana'").run();
  assert.equal(searchNotebook(db,'first','INES').people[0].title,'Inés Marlow');
  assert.equal(searchNotebook(db,'first','ines').tasks.length,1);
  assert.equal(searchNotebook(db,'first',"%_' OR 1=1 --").library.length,0);
  for(const q of ['', '  ', 'x'.repeat(201), ['orchard']])assert.throws(()=>searchNotebook(db,'first',q),/between 1 and 200/);
 }finally{db.close()}
});
test('search has bounded results and does not return hidden notebook or waitlist fields',()=>{
 const db=openDatabase();seed(db,new Date(),'first');
 try {
  for(let i=0;i<25;i++)db.prepare('INSERT INTO people(id,workspace_id,name,company,role) VALUES (?,?,?,?,?)').run('invented-'+i,'first','Orchard '+i,'Made-up clinic','Manager');
  db.prepare("INSERT INTO waitlist(email,created_at,workspace_id) VALUES ('orchard@example.invalid','2026-11-26','first')").run();
  const r=searchNotebook(db,'first','orchard');assert.equal(r.people.length,20);assert.equal(r.more.people,true);
  const text=JSON.stringify(r);for(const hidden of ['example.invalid','upload_token','mcp_token','session_secret'])assert.ok(!text.includes(hidden));
 }finally{db.close()}
});
test('search and task routes are read-only and scoped to the current browser',async()=>{
 const db=openDatabase();seed(db);const a=createJudge(db),b=createJudge(db);const app=createApp(db,{secureCookies:false}),server=app.listen(18587,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
 const base='http://127.0.0.1:18587';
 try {
  db.prepare("UPDATE todos SET text='Invented private orchard' WHERE id=?").run(a.id+':pricing');
  const get=(path:string,cookie?:string)=>fetch(base+path,{headers:cookie?{cookie:'kai_session='+cookie}:{}});
  const own=await(await get('/api/search?q=orchard',a.cookie)).json();assert.equal(own.tasks.length,1);
  const other=await(await get('/api/search?q=orchard',b.cookie)).json();assert.equal(other.tasks.length,0);
  assert.equal((await get('/api/todos/'+encodeURIComponent(a.id+':pricing'),b.cookie)).status,404);
  assert.equal((await get('/api/todos/'+encodeURIComponent(a.id+':pricing'))).status,404);
  assert.equal((await get('/api/search?q[]=orchard')).status,400);
  assert.equal((await get('/api/search?q=Dana')).status,200);
  assert.equal((await fetch(base+'/api/todos/pricing/done',{method:'POST'})).status,403);
 }finally{await app.locals.queue.stop();await new Promise<void>(r=>server.close(()=>r()));db.close()}
});
