import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { openDatabase,seed } from '../src/server/db';
import { listTodos,finishTodo } from '../src/server/todos';
import { peopleList,personPage } from '../src/server/people-data';
import { createApp } from '../src/server/app';

test('open to-dos cover overdue, today, tomorrow, later and no date across the year boundary',()=> {
  const db=openDatabase();const now=new Date('2026-12-31T23:30:00Z');seed(db,now,'judge-a');seed(db,now,'judge-b');
  try {
    const dates=['2026-12-30','2026-12-31','2027-01-01','2027-01-02',null];
    db.prepare("DELETE FROM todos WHERE workspace_id='judge-a'").run();
    const insert=db.prepare("INSERT INTO todos(id,workspace_id,text,owner_person_id,due_on,status,quote,conversation_id,person_id) VALUES (?,'judge-a',?,NULL,?,'open','I promised to send Dana the pricing.','judge-a:dana-call','judge-a:dana')");
    dates.forEach((date,i)=>insert.run('promise-'+i,'Promise '+i,date));
    const rows=listTodos(db,'judge-a',now);
    assert.deepEqual(rows.map(t=>t.group),['Overdue','Due soon','Due soon','Later','No date']);
    assert.ok(rows.every(t=>t.person_name==='Dana Whitfield' && t.owner_person_id===null));
    finishTodo(db,'judge-a','promise-0');finishTodo(db,'judge-a','promise-0');
    assert.equal(listTodos(db,'judge-a',now).length,4);
    assert.equal((peopleList(db,'judge-a',now) as {name:string;overdue:number}[]).find(p=>p.name==='Dana Whitfield')!.overdue,0);
    assert.equal(personPage(db,'judge-a','judge-a:dana')!.todos.length,4);
    assert.equal(listTodos(db,'judge-b',now).length,2);
    assert.throws(()=>finishTodo(db,'judge-b','promise-1'),/not found/);
  }finally{db.close();}
});

test('completion route is private and idempotent and preserves the original promise and quote',async()=> {
  const db=openDatabase();seed(db);
  const secret=randomBytes(32).toString('hex');const app=createApp(db,{judgeSecret:secret,secureCookies:false});
  const server=app.listen(18525,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
  const base='http://127.0.0.1:18525';
  async function login() {const response=await fetch(base+'/api/access/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret})});return response.headers.get('set-cookie')!.split(';')[0];}
  try {
    const a=await login(),b=await login();
    const rows=await (await fetch(base+'/api/todos',{headers:{Cookie:a}})).json();const pricing=rows.find((t:{text:string})=>t.text==='Send Dana the pricing');
    const url=base+'/api/todos/'+encodeURIComponent(pricing.id)+'/done';
    const before=db.prepare('SELECT * FROM todos WHERE id=?').get(pricing.id) as Record<string,unknown>;
    assert.equal((await fetch(url,{method:'POST'})).status,403);
    assert.equal((await fetch(url,{method:'POST',headers:{Cookie:b}})).status,404);
    assert.equal((await fetch(url,{method:'POST',headers:{Cookie:a,Origin:'https://example.invalid'}})).status,403);
    assert.equal((await fetch(url,{method:'POST',headers:{Cookie:a}})).status,200);
    assert.equal((await fetch(url,{method:'POST',headers:{Cookie:a}})).status,200);
    assert.deepEqual(db.prepare('SELECT * FROM todos WHERE id=?').get(pricing.id),{...before,status:'done'});
    assert.equal((await (await fetch(base+'/api/todos',{headers:{Cookie:a}})).json()).length,1);
    assert.equal((await (await fetch(base+'/api/todos',{headers:{Cookie:b}})).json()).length,2);
  }finally{await app.locals.queue.stop();await new Promise<void>(resolve=>server.close(()=>resolve()));db.close();}
});
