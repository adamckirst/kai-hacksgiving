import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase,seed } from '../src/server/db';
import { addReading,readConversation } from '../src/server/reading';
import { fakeReader } from '../src/server/fake-reader';
import { acceptAll,decide } from '../src/server/decisions';
import { samples } from '../src/samples';
test('Dana memory reads her page, proposes pricing done, and only acceptance completes it',async()=> {
  const db=openDatabase();seed(db);seed(db,new Date(),'judge-a');
  try {
    const id=addReading(db,'judge-a',samples[0].text,'2026-11-24','sample');let read=false;
    await readConversation(db,id,async(input,call,signal)=>fakeReader(input,(name,value)=>{if(name==='get_person')read=true;return call(name,value);},signal));
    assert.equal(read,true);
    const done=db.prepare("SELECT id,payload,quote FROM suggestions WHERE conversation_id=? AND kind='done'").get(id) as {id:string;payload:string;quote:string};
    assert.equal(JSON.parse(done.payload).todo_id,'judge-a:pricing');assert.ok(samples[0].text.includes(done.quote));
    assert.equal((db.prepare("SELECT status FROM todos WHERE id='judge-a:pricing'").get() as {status:string}).status,'open');
    decide(db,'judge-a',done.id,'accept');
    assert.equal((db.prepare("SELECT status FROM todos WHERE id='judge-a:pricing'").get() as {status:string}).status,'done');
    assert.equal((db.prepare("SELECT count(*) AS n FROM people WHERE workspace_id='judge-a' AND name='Dana Whitfield'").get() as {n:number}).n,1);
  }finally{db.close();}
});
test('get_person cannot read another copy, and completion must target this person’s open promise',async()=> {
  const db=openDatabase();seed(db);seed(db,new Date(),'judge-a');
  try {
    const id=addReading(db,'judge-a',samples[0].text,'2026-11-24','sample');
    await readConversation(db,id,async(_input,call)=> {
      call('describe_recording',{title:'Dana follow-up',summary:'Mara spoke with Dana.\nA promise was kept.'});
      assert.equal(call('get_person',{person_id:'dana'}).ok,false);
      assert.equal(call('propose_done',{person_id:'judge-a:dana',todo_id:'judge-a:pricing',quote:'She thanked me for the pricing I sent Monday.'}).ok,false);
      call('get_person',{person_id:'judge-a:dana'});
      assert.equal(call('propose_done',{person_id:'judge-a:dana',todo_id:'pricing',quote:'She thanked me for the pricing I sent Monday.'}).ok,false);
      assert.equal(call('propose_done',{person_id:'judge-a:dana',todo_id:'judge-a:trial',quote:'She thanked me for the pricing I sent Monday.'}).ok,false);
      const matched=call('propose_person',{name:'Dana Whitfield',company:'Willow Dental',role:'Operations lead',quote:'I spoke with Dana Whitfield at Willow Dental.'});
      assert.equal(matched.id,'judge-a:dana');
    });
    assert.equal((db.prepare('SELECT count(*) AS n FROM suggestions WHERE conversation_id=?').get(id) as {n:number}).n,0);
  }finally{db.close();}
});
test('a previously accepted new person is remembered in later samples',async()=> {
  const db=openDatabase();seed(db);seed(db,new Date(),'judge-a');try {
    const first=addReading(db,'judge-a',samples[2].text,'2026-11-24','sample');await readConversation(db,first,fakeReader);acceptAll(db,'judge-a',first);
    const second=addReading(db,'judge-a',samples[2].text,'2026-11-25','sample');await readConversation(db,second,fakeReader);
    assert.equal((db.prepare("SELECT count(*) AS n FROM suggestions WHERE conversation_id=? AND kind='person'").get(second) as {n:number}).n,0);
    assert.equal((db.prepare("SELECT status FROM conversations WHERE id=?").get(second) as {status:string}).status,'ready');
  }finally{db.close();}
});
