import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync,mkdirSync,readdirSync,rmSync } from 'node:fs';
import { openDatabase,seed } from '../src/server/db';
import { createJudge } from '../src/server/access';
import { createApp } from '../src/server/app';
import { addAudio } from '../src/server/audio';
import { testTone } from '../src/server/gateway';
import { readConversation,addReading } from '../src/server/reading';
import { personPage } from '../src/server/people-data';

function form(person?:unknown) {
  const f=new FormData();f.append('recordings',new Blob([new Uint8Array(testTone())]),'invented.wav');f.append('dates',JSON.stringify([Date.now()-1000]));
  if(person!==undefined)f.append('person',JSON.stringify(person));return f;
}
test('a shared recording waits for its owner, survives reopening, and starts once with the chosen person',async()=> {
  mkdirSync('.data',{recursive:true});const dir=mkdtempSync('.data/person-share-');
  const db=openDatabase();seed(db);const a=createJudge(db),b=createJudge(db);let calls=0,linkedAtListening=false;
  const person={id:randomUUID(),name:'Avery Fern',company:'Juniper Dental',role:'Clinic manager'};
  const app=createApp(db,{secureCookies:false,audioDirectory:dir,transcriber:async()=>{calls++;linkedAtListening=Boolean(db.prepare('SELECT id FROM conversations WHERE workspace_id=? AND person_id=? AND awaiting_person=0').get(a.id,person.id));return 'An invented recording with no promises.';}});
  const server=app.listen(18621,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const base='http://127.0.0.1:18621';
  const headers={Cookie:'kai_session='+a.cookie},other={Cookie:'kai_session='+b.cookie};
  try {
    const {uploadPath}=await (await fetch(base+'/api/connect',{headers})).json();
    const shared=await fetch(base+uploadPath,{method:'POST',body:form()});assert.equal(shared.status,202);const {ids,openPath}=await shared.json();
    assert.equal(openPath,'/upload/'+ids[0]);await app.locals.queue.kick();assert.equal(calls,0);
    assert.equal((await (await fetch(base+'/api/uploads',{headers})).json()).length,1);
    assert.equal((await (await fetch(base+'/api/uploads',{headers:other})).json()).length,0);
    const reopened=openDatabase(db.serialize());assert.equal((reopened.prepare('SELECT awaiting_person FROM conversations WHERE id=?').get(ids[0]) as {awaiting_person:number}).awaiting_person,1);reopened.close();
    const start=(body:unknown,h=headers)=>fetch(base+'/api/uploads/'+ids[0]+'/start',{method:'POST',headers:{...h,'Content-Type':'application/json'},body:JSON.stringify(body)});
    assert.equal((await start({person_id:null},other)).status,404);
    assert.equal((await start({person_id:b.id+':dana'})).status,404);
    assert.equal((await start({new_person:{...person,name:'   '}})).status,400);assert.equal(calls,0);
    const today=new Date().toISOString().slice(0,10);
    db.prepare('UPDATE conversations SET reserved_on=? WHERE id=?').run('2026-01-01',ids[0]);
    db.prepare('UPDATE workspaces SET recording_day=?,recordings_today=10 WHERE id=?').run(today,a.id);
    assert.equal((await start({new_person:person})).status,429);assert.equal(calls,0);
    assert.equal(db.prepare('SELECT id FROM people WHERE id=?').get(person.id),undefined);
    db.prepare('UPDATE workspaces SET recordings_today=0 WHERE id=?').run(a.id);
    assert.equal((await start({new_person:person})).status,200);await app.locals.queue.kick();assert.equal(calls,1);assert.equal(linkedAtListening,true);
    assert.equal((await start({new_person:person})).status,200);await app.locals.queue.kick();assert.equal(calls,1);
    assert.equal((db.prepare('SELECT count(*) AS n FROM people WHERE id=?').get(person.id) as {n:number}).n,1);
    assert.ok((personPage(db,a.id,person.id)!.conversations as {id:string}[]).some(c=>c.id===ids[0]));
    assert.equal(personPage(db,b.id,person.id),null);
    const recording=await (await fetch(base+'/api/readings/'+ids[0],{headers})).json();assert.equal(recording.person.id,person.id);
    assert.equal(recording.awaiting_person,0);assert.equal(recording.status,'ready');
  }finally{await app.locals.queue.stop();await new Promise<void>(r=>server.close(()=>r()));db.close();rmSync(dir,{recursive:true,force:true});}
});

test('file uploads link the whole batch atomically; foreign people and invalid choices leave no files, rows or spent allowance',async()=> {
  mkdirSync('.data',{recursive:true});const dir=mkdtempSync('.data/person-batch-');const db=openDatabase();seed(db);const a=createJudge(db),b=createJudge(db);
  const files=[0,1,2].map(i=>({name:'invented.wav',buffer:testTone(),date:Date.now()-5000+i}));
  const before=db.prepare('SELECT recordings_today,readings_today FROM workspaces WHERE id=?').get(a.id);
  try {
    await assert.rejects(addAudio(db,a.id,files,dir,'recording',{person:{person_id:b.id+':dana'}}));
    assert.equal(readdirSync(dir).length,0);assert.deepEqual(db.prepare('SELECT recordings_today,readings_today FROM workspaces WHERE id=?').get(a.id),before);
    assert.equal((db.prepare("SELECT count(*) AS n FROM conversations WHERE source='recording'").get() as {n:number}).n,0);
    const person={id:randomUUID(),name:'Linden Ash',company:'',role:''};
    const ids=await addAudio(db,a.id,files,dir,'recording',{person:{new_person:person}});
    assert.equal(ids.length,3);assert.equal((db.prepare('SELECT count(*) AS n FROM people WHERE id=?').get(person.id) as {n:number}).n,1);
    for(const id of ids)assert.equal((db.prepare('SELECT person_id FROM conversations WHERE id=?').get(id) as {person_id:string}).person_id,person.id);
    assert.equal((personPage(db,a.id,person.id)!.conversations as unknown[]).length,3);
    assert.equal((db.prepare('SELECT count(*) AS n FROM suggestions WHERE workspace_id=?').get(a.id) as {n:number}).n,0);
  }finally{db.close();rmSync(dir,{recursive:true,force:true});}
});

test('the reader receives the selected sender, leaves unassigned audio unknown, and retains the sample narrator',async()=> {
  const db=openDatabase();seed(db);const a=createJudge(db);
  try {
    const id=addReading(db,a.id,'I will send the questionnaire tomorrow.','2026-11-25','paste');
    db.prepare("UPDATE conversations SET source='shared',person_id=? WHERE id=?").run(a.id+':dana',id);
    const seen:unknown[]=[];
    const reader:import('../src/server/reading').Reader=async(input,call)=>{seen.push(input.sender);call('describe_recording',{title:'An invented memo',summary:'The speaker discussed a questionnaire.\nThe promise needs review.'});};
    await readConversation(db,id,reader);assert.equal((seen[0] as {person:{name:string}}).person.name,'Dana Whitfield');
    db.prepare('UPDATE conversations SET person_id=NULL WHERE id=?').run(id);await readConversation(db,id,reader);assert.deepEqual(seen[1],{kind:'unknown'});
    db.prepare("UPDATE conversations SET source='sample' WHERE id=?").run(id);await readConversation(db,id,reader);assert.deepEqual(seen[2],{kind:'owner'});
  }finally{db.close();}
});
