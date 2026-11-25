import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase,seed } from '../src/server/db';
import { addReading,readConversation } from '../src/server/reading';
import { fakeReader } from '../src/server/fake-reader';
import { acceptAll,decide,peopleList,personPage } from '../src/server/decisions';
import { samples } from '../src/samples';
async function setup(sample=2) {
  const db=openDatabase();seed(db);seed(db,new Date(),'judge-a');seed(db,new Date(),'judge-b');
  const conversation=addReading(db,'judge-a',samples[sample].text,'2026-11-24','sample');await readConversation(db,conversation,fakeReader);
  const proposals=db.prepare('SELECT id,kind,quote FROM suggestions WHERE conversation_id=? ORDER BY rowid').all(conversation) as {id:string;kind:string;quote:string}[];
  return {db,conversation,proposals};
}
function counts(db:ReturnType<typeof openDatabase>) {return ['people','notes','todos'].map(table=>(db.prepare(`SELECT count(*) AS n FROM ${table} WHERE workspace_id='judge-a'`).get() as {n:number}).n);}
test('accept all writes exactly the expected rows once and exposes the person page',async()=> {
  const {db,conversation,proposals}=await setup();try {
    assert.deepEqual(counts(db),[3,1,2]);acceptAll(db,'judge-a',conversation);acceptAll(db,'judge-a',conversation);
    assert.deepEqual(counts(db),[4,2,3]);
    assert.equal((db.prepare("SELECT count(*) AS n FROM suggestions WHERE conversation_id=? AND status='accepted'").get(conversation) as {n:number}).n,3);
    const page=personPage(db,'judge-a',proposals[0].id)!;
    assert.equal(page.notes.length,1);assert.equal(page.todos.length,1);assert.equal(page.conversations.length,1);
    assert.equal(personPage(db,'judge-b',proposals[0].id),null);
    const todo=db.prepare('SELECT text,person_id,owner_person_id,due_on,quote FROM todos WHERE id=?').get(proposals[2].id);
    assert.deepEqual(todo,{text:'Send Sora a short overview',person_id:proposals[0].id,owner_person_id:null,due_on:'2026-11-25',quote:proposals[2].quote});
  }finally{db.close();}
});
test('accepting a child accepts its person in the same transaction; edit keeps its original quote',async()=> {
  const {db,proposals}=await setup();try {
    decide(db,'judge-a',proposals[2].id,'accept',{text:'Send a two-page overview',due_on:'2026-11-27',quote:'Changed quote'});
    assert.deepEqual(counts(db),[4,1,3]);
    assert.equal((db.prepare('SELECT status FROM suggestions WHERE id=?').get(proposals[0].id) as {status:string}).status,'accepted');
    assert.deepEqual(db.prepare('SELECT text,due_on,quote FROM todos WHERE id=?').get(proposals[2].id),{text:'Send a two-page overview',due_on:'2026-11-27',quote:proposals[2].quote});
    assert.throws(()=>decide(db,'judge-b',proposals[1].id,'accept'),/not found/);
  }finally{db.close();}
});
test('rejecting a person rejects their pending suggestions and writes no accepted rows',async()=> {
  const {db,conversation,proposals}=await setup();try {
    decide(db,'judge-a',proposals[0].id,'reject');assert.deepEqual(counts(db),[3,1,2]);
    assert.equal((db.prepare("SELECT count(*) AS n FROM suggestions WHERE conversation_id=? AND status='rejected'").get(conversation) as {n:number}).n,3);
    assert.throws(()=>decide(db,'judge-a',proposals[2].id,'accept'),/already been decided/);
  }finally{db.close();}
});
test('invalid edit or dependency rolls back the complete acceptance',async()=> {
  const {db,conversation,proposals}=await setup();try {
    assert.throws(()=>decide(db,'judge-a',proposals[2].id,'accept',{due_on:'2026-02-30'}));assert.deepEqual(counts(db),[3,1,2]);
    db.prepare("UPDATE suggestions SET payload=json_set(payload,'$.person_id','foreign-person') WHERE id=?").run(proposals[1].id);
    assert.throws(()=>acceptAll(db,'judge-a',conversation),/no longer available/);assert.deepEqual(counts(db),[3,1,2]);
    assert.equal((db.prepare("SELECT count(*) AS n FROM suggestions WHERE conversation_id=? AND status='accepted'").get(conversation) as {n:number}).n,0);
  }finally{db.close();}
});
test('Needs you counts overdue promises and pending suggestions for accepted people',async()=> {
  const {db}=await setup(0);try {
    const dana=(peopleList(db,'judge-a') as {name:string;overdue:number;suggestions:number}[]).find(p=>p.name==='Dana Whitfield')!;
    assert.equal(dana.overdue,1);assert.equal(dana.suggestions,3);
  }finally{db.close();}
});
