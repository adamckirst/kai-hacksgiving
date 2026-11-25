import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase, seed } from '../src/server/db';
import { addReading, readConversation, retryReading } from '../src/server/reading';
import { fakeReader } from '../src/server/fake-reader';
import { samples } from '../src/samples';
function setup() {const db=openDatabase();seed(db);seed(db,new Date(),'judge-a');return db;}
for(const [index,kinds,texts] of [
  [0,['done','note','todo','todo'],['Send Dana the pricing','Her CFO wants to review security.','Send the security questionnaire','Introduce Mara to the CFO']],
  [1,['note','todo','todo'],['Wants a trial with two receptionists.','Send a trial checklist','Send the trial dates']],
  [2,['person','note','todo'],['Sora Bell','Needs room for urgent appointments.','Send Sora a short overview']],
] as const) test(`sample ${samples[index].id} gives its expected suggestions`,async()=> {
  const db=setup();
  try {
    const id=addReading(db,'judge-a',samples[index].text,'2026-11-24','sample');
    await readConversation(db,id,fakeReader);
    const rows=db.prepare('SELECT kind,payload,quote,status FROM suggestions WHERE conversation_id=? ORDER BY rowid').all(id) as {kind:string;payload:string;quote:string;status:string}[];
    assert.deepEqual(rows.map(r=>r.kind),kinds);assert.deepEqual(rows.map(r=>{const p=JSON.parse(r.payload);return p.text ?? p.name;}),texts);
    assert.ok(rows.every(r=>r.status==='proposed' && samples[index].text.includes(r.quote)));
    assert.equal(JSON.parse(rows[index===0 || index===2 ? 2:1].payload).due_on,index===0 ? '2026-11-26':'2026-11-25');
    assert.equal((db.prepare('SELECT status FROM conversations WHERE id=?').get(id) as {status:string}).status,'ready');
    assert.equal((db.prepare("SELECT count(*) AS n FROM people WHERE workspace_id='judge-a'").get() as {n:number}).n,3);
    if(index===2) assert.equal(JSON.parse(rows[1].payload).person_id,(db.prepare("SELECT id FROM suggestions WHERE conversation_id=? AND kind='person'").get(id) as {id:string}).id);
  } finally {db.close();}
});
test('made-up quote, impossible date and cross-workspace person never enter suggestions; errors return to KAI',async()=> {
  const db=setup();
  try {
    const text='I will send the overview tomorrow.',id=addReading(db,'judge-a',text,'2026-11-24','paste');
    await readConversation(db,id,async(_input,call)=> {
      const invalidSummary=call('describe_recording',{title:'Overview',summary:'Only one line.'});
      assert.equal(invalidSummary.ok,false);assert.match(invalidSummary.error!,/summary: Use two lines/);
      call('describe_recording',{title:'Overview',summary:'Mara promised an overview.\nIt is due tomorrow.'});
      assert.equal(call('propose_note',{person_id:'judge-a:dana',text:'A note',quote:'This did not happen.'}).ok,false);
      assert.equal(call('propose_note',{person_id:'dana',text:'A note',quote:text}).ok,false);
      assert.equal(call('propose_todo',{person_id:'judge-a:dana',owner_person_id:null,text:'Send overview',quote:text,due_on:'2026-02-30'}).ok,false);
      assert.equal((db.prepare('SELECT count(*) AS n FROM suggestions').get() as {n:number}).n,0);
      call('get_person',{person_id:'judge-a:dana'});
      assert.equal(call('propose_todo',{person_id:'judge-a:dana',owner_person_id:null,text:'Send overview',quote:text,due_on:'2026-11-25'}).ok,true);
      assert.equal((db.prepare('SELECT count(*) AS n FROM suggestions').get() as {n:number}).n,1);
      assert.equal((db.prepare('SELECT status FROM conversations WHERE id=?').get(id) as {status:string}).status,'reading');
    });
  } finally {db.close();}
});
test('31st reading refused, total 151st refused, daily reset and 20,000 character ceiling',()=> {
  const db=setup(),now=new Date('2026-11-24T12:00:00Z');
  try {
    assert.throws(()=>addReading(db,'public','Words','2026-11-24','paste',now),/read-only/);
    assert.throws(()=>addReading(db,'judge-a','x'.repeat(20001),'2026-11-24','paste',now));
    for(let i=0;i<30;i++) addReading(db,'judge-a','Words','2026-11-24','paste',now);
    assert.throws(()=>addReading(db,'judge-a','Words','2026-11-24','paste',now),/limit/);
    for(let w=0;w<4;w++) {seed(db,now,'extra-'+w);for(let i=0;i<30;i++) addReading(db,'extra-'+w,'Words','2026-11-24','paste',now);}
    seed(db,now,'extra-4');assert.throws(()=>addReading(db,'extra-4','Words','2026-11-24','paste',now),/limit/);
    assert.ok(addReading(db,'judge-a','x'.repeat(20000),'2026-11-25','paste',new Date('2026-11-25T12:00:00Z')));
  } finally {db.close();}
});
test('provider error becomes failed and retry is counted',async()=> {
  const db=setup();
  try {
    const id=addReading(db,'judge-a','Words','2026-11-24','paste');
    await readConversation(db,id,async()=>{throw new Error('Private provider error');});
    const result=db.prepare('SELECT status,error FROM conversations WHERE id=?').get(id) as {status:string;error:string};
    assert.equal(result.status,'failed');assert.ok(!result.error.includes('Private'));
    retryReading(db,'judge-a',id);
    assert.equal((db.prepare("SELECT readings_today FROM workspaces WHERE id='judge-a'").get() as {readings_today:number}).readings_today,2);
  } finally {db.close();}
});
