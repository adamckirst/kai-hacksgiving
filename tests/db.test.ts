import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase, seed } from '../src/server/db';
import { createApp } from '../src/server/app';
test('reopening restores old seed links even after the person column already exists',()=> {
  const db=openDatabase();let reopened:ReturnType<typeof openDatabase>|undefined;
  try {
    seed(db);seed(db,new Date(),'invented-judge');
    db.exec("UPDATE todos SET person_id=NULL; UPDATE todos SET status='done' WHERE id='invented-judge:pricing'");
    const before=db.prepare('SELECT id,text,quote,due_on,status FROM todos ORDER BY id').all();
    reopened=openDatabase(db.serialize());
    assert.deepEqual(reopened.prepare('SELECT id,text,quote,due_on,status FROM todos ORDER BY id').all(),before);
    assert.deepEqual(reopened.prepare('SELECT person_id FROM todos ORDER BY id').all(),[{person_id:'invented-judge:dana'},{person_id:'invented-judge:ellis'},{person_id:'dana'},{person_id:'ellis'}]);
    assert.equal((reopened.pragma('foreign_key_check') as unknown[]).length,0);
  }finally{reopened?.close();db.close();}
});
test('fresh judge seeding tolerates optional columns added by a later step',()=> {
  const db=openDatabase();
  try {
    seed(db);db.exec('ALTER TABLE todos ADD COLUMN future_optional TEXT');
    seed(db,new Date(),'invented-judge');
    assert.equal((db.prepare("SELECT count(*) AS n FROM todos WHERE workspace_id='invented-judge'").get() as {n:number}).n,2);
    assert.equal((db.prepare("SELECT count(*) AS n FROM todos WHERE workspace_id='public'").get() as {n:number}).n,2);
    assert.equal((db.pragma('foreign_key_check') as unknown[]).length,0);
  }finally{db.close();}
});
test('fourteen tables, Mara’s accepted data, relative dates, and safe reseeding', () => {
  const db = openDatabase();
  try {
    seed(db,new Date('2026-12-01T12:00:00Z'));
    assert.equal((db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='table'").get() as {n:number}).n,14);
    assert.deepEqual(db.prepare('SELECT name FROM people ORDER BY name').all(),[{name:'Dana Whitfield'},{name:'Ellis Rowan'},{name:'Nia Calder'}]);
    assert.deepEqual(db.prepare("SELECT due_on FROM todos WHERE id='pricing'").get(),{due_on:'2026-11-29'});
    assert.deepEqual(db.prepare("SELECT happened_on FROM conversations WHERE id='dana-call'").get(),{happened_on:'2026-11-27'});
    db.prepare("UPDATE todos SET status='done' WHERE id='pricing'").run();
    seed(db,new Date('2026-12-08T12:00:00Z'));
    assert.deepEqual(db.prepare("SELECT status,due_on FROM todos WHERE id='pricing'").get(),{status:'done',due_on:'2026-11-29'});
    assert.equal((db.pragma('foreign_key_check') as unknown[]).length,0);
    assert.equal((db.prepare('SELECT count(*) AS n FROM waitlist').get() as {n:number}).n,0);
  } finally { db.close(); }
});
test('People API reads persisted data and exposes no write route', async () => {
  const db = openDatabase(); seed(db);
  const server = createApp(db).listen(18519,'127.0.0.1');
  await new Promise<void>(resolve => server.once('listening',resolve));
  try {
    const response = await fetch('http://127.0.0.1:18519/api/people');
    const people = await response.json();
    assert.equal(people.length,3);
    assert.equal(people[0].name,'Dana Whitfield');
    assert.deepEqual(Object.keys(people[0]).sort(),['company','id','name','overdue','role','soon','suggestions']);
    assert.equal((await fetch('http://127.0.0.1:18519/api/people',{method:'POST'})).status,403);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); db.close(); }
});
