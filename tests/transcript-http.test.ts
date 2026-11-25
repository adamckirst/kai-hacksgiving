import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createApp } from '../src/server/app';
import { openDatabase,seed } from '../src/server/db';

test('HTTP accepts 20,000 Unicode characters even when JSON escapes them, and refuses one more',async()=> {
  const db=openDatabase();seed(db);
  const secret=randomBytes(32).toString('hex');
  const app=createApp(db,{judgeSecret:secret,secureCookies:false});
  const server=app.listen(18611,'127.0.0.1');
  await new Promise<void>(resolve=>server.once('listening',resolve));
  const base='http://127.0.0.1:18611';
  try {
    const login=await fetch(base+'/api/access/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret})});
    assert.equal(login.status,200);
    const cookie=login.headers.get('set-cookie')!.split(';')[0];
    const text='“'.repeat(20000);
    const post=(value:string)=>fetch(base+'/api/readings',{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify({text:value,happened_on:'2026-11-25'}).replaceAll('“','\\u201c')});
    const accepted=await post(text);assert.equal(accepted.status,202);
    const {id}=await accepted.json();
    assert.equal((db.prepare('SELECT text FROM conversations WHERE id=?').get(id) as {text:string}).text,text);
    const count=(db.prepare('SELECT count(*) AS n FROM conversations').get() as {n:number}).n;
    assert.equal((await post(text+'“')).status,400);
    assert.equal((db.prepare('SELECT count(*) AS n FROM conversations').get() as {n:number}).n,count);
  } finally {
    await app.locals.queue.stop();
    await new Promise<void>(resolve=>server.close(()=>resolve()));db.close();
  }
});
