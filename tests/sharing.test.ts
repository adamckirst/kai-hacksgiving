import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac,randomBytes } from 'node:crypto';
import { mkdirSync,mkdtempSync,rmSync } from 'node:fs';
import type { Request } from 'express';
import { openDatabase,seed } from '../src/server/db';
import { createApp } from '../src/server/app';
import { createJudge,workspaceFor } from '../src/server/access';
import { persistentJudgeSecret } from '../src/server/config';
import { testTone } from '../src/server/gateway';

let nextPort=18528;
async function setup() {
  mkdirSync('.data',{recursive:true});const directory=mkdtempSync('.data/share-check-');
  const db=openDatabase();seed(db);const secret=randomBytes(32).toString('hex');
  const app=createApp(db,{judgeSecret:secret,secureCookies:false,audioDirectory:directory});await app.locals.queue.stop();
  const port=nextPort++;const server=app.listen(port,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
  const base='http://127.0.0.1:'+port;
  async function judge() {
    const login=await fetch(base+'/api/access/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret})});
    const cookie=login.headers.get('set-cookie')!.split(';')[0];const id=cookie.slice('kai_session='.length).split('.')[0];
    const response=await fetch(base+'/api/connect',{headers:{Cookie:cookie}});assert.equal(response.status,200);
    const {uploadPath}=await response.json();return {cookie,id,uploadPath};
  }
  async function close(){await new Promise<void>(resolve=>server.close(()=>resolve()));db.close();rmSync(directory,{recursive:true,force:true});}
  return {db,base,judge,close};
}
function audioForm(buffers=[testTone()],date='2026-11-23T14:30:00-03:00') {
  const form=new FormData();buffers.forEach(b=>form.append('recordings',new Blob([new Uint8Array(b)]),'memo.wav'));
  if(buffers.length===1)form.append('date',date);else form.append('dates',JSON.stringify(buffers.map(()=>Date.parse(date))));return form;
}

test('sharing enters only its address owner’s queue; wrong addresses are 404 and cannot grant browser access',async()=> {
  const {db,base,judge,close}=await setup();try {
    const a=await judge(),b=await judge();
    assert.ok(a.uploadPath!==b.uploadPath);
    assert.equal((await fetch(base+'/api/connect')).status,403);
    const publicSecret=persistentJudgeSecret(db);
    for(const address of ['/in/not-an-address','/in/'+randomBytes(32).toString('hex'),'/in/'+publicSecret]) {
      for(const method of ['POST','GET','PUT'])assert.equal((await fetch(base+address,{method})).status,404);
    }
    assert.equal((await fetch(base+a.uploadPath,{method:'POST',headers:{Origin:'https://example.invalid'},body:audioForm()})).status,403);
    const response=await fetch(base+a.uploadPath,{method:'POST',headers:{Cookie:b.cookie},body:audioForm()});assert.equal(response.status,202);
    assert.equal(response.headers.get('set-cookie'),null);assert.equal(response.headers.get('cache-control'),'no-store');
    const {ids}=await response.json();assert.equal(ids.length,1);
    assert.deepEqual(db.prepare('SELECT workspace_id,source,status,happened_on,happened_at FROM conversations WHERE id=?').get(ids[0]),{workspace_id:a.id,source:'shared',status:'waiting',happened_on:'2026-11-23',happened_at:Date.parse('2026-11-23T14:30:00-03:00')});
    assert.equal((await fetch(base+'/api/readings/'+ids[0],{headers:{Cookie:b.cookie}})).status,404);
    const addressSecret=a.uploadPath.split('/').pop();
    const forged='kai_session='+a.id+'.'+createHmac('sha256',addressSecret).update('browser:'+a.id).digest('hex');
    assert.equal((await (await fetch(base+'/api/access',{headers:{Cookie:forged}})).json()).kind,'public');
    assert.equal((await fetch(base+'/api/todos/'+a.id+':pricing/done',{method:'POST',headers:{Cookie:forged}})).status,403);
    assert.equal((await (await fetch(base+'/api/queue',{headers:{Cookie:a.cookie}})).json()).length,1);
    assert.equal((await (await fetch(base+'/api/queue',{headers:{Cookie:b.cookie}})).json()).length,0);
  }finally{await close();}
});

test('shared uploads retain file, duration, batch and daily limits without queuing rejected input',async()=> {
  const {db,base,judge,close}=await setup();try {
    const a=await judge();const post=(form:FormData)=>fetch(base+a.uploadPath,{method:'POST',body:form});
    const long=Buffer.alloc(44+301*16000*2);testTone().copy(long);long.writeUInt32LE(long.length-8,4);long.writeUInt32LE(long.length-44,40);
    for(const form of [audioForm([Buffer.alloc(11_000_000)]),audioForm(Array.from({length:6},()=>testTone())),audioForm([long]),audioForm([testTone()],'2026-02-30T12:00:00Z'),new FormData()])assert.equal((await post(form)).status,400);
    assert.equal((db.prepare("SELECT count(*) AS n FROM conversations WHERE source='shared'").get() as {n:number}).n,0);
    for(let i=0;i<2;i++)assert.equal((await post(audioForm(Array.from({length:5},()=>testTone())))).status,202);
    assert.equal((await post(audioForm())).status,429);
    const b=await judge(),today=new Date().toISOString().slice(0,10);
    db.prepare('UPDATE workspaces SET recording_day=?,recordings_today=50 WHERE id=?').run(today,b.id);
    const c=await judge();assert.equal((await fetch(base+c.uploadPath,{method:'POST',body:audioForm()})).status,429);
    db.prepare('UPDATE workspaces SET recordings_today=0').run();
    db.prepare('UPDATE workspaces SET reading_day=?,readings_today=30 WHERE id=?').run(today,a.id);
    assert.equal((await post(audioForm())).status,429);
    assert.equal((db.prepare("SELECT count(*) AS n FROM conversations WHERE source='shared'").get() as {n:number}).n,10);
  }finally{await close();}
});

test('upgrade preserves old browser cookies while separating the newly exposed sharing address',()=> {
  const old=openDatabase();seed(old);const judge=createJudge(old);
  const prior=old.prepare('SELECT session_secret FROM workspaces WHERE id=?').get(judge.id) as {session_secret:string};
  old.prepare('UPDATE workspaces SET upload_token=? WHERE id=?').run(prior.session_secret,judge.id);
  old.exec('ALTER TABLE workspaces DROP COLUMN session_secret');
  // Serialize into memory only: no session or address is written to a test file.
  const upgraded=openDatabase(old.serialize());old.close();
  try {
    const row=upgraded.prepare('SELECT session_secret,upload_token FROM workspaces WHERE id=?').get(judge.id) as {session_secret:string;upload_token:string};
    assert.ok(row.session_secret===prior.session_secret);assert.ok(row.upload_token!==row.session_secret);
    const req={headers:{cookie:'kai_session='+judge.cookie}} as Request;
    assert.equal(workspaceFor(upgraded,req),judge.id);
    const again=openDatabase(upgraded.serialize());try {
      const current=again.prepare('SELECT upload_token FROM workspaces WHERE id=?').get(judge.id) as {upload_token:string};
      assert.ok(current.upload_token===row.upload_token);assert.equal(workspaceFor(again,req),judge.id);
    }finally{again.close();}
  }finally{upgraded.close();}
});
