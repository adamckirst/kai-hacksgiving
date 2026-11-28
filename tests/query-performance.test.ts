import {test} from 'node:test';
import assert from 'node:assert/strict';
import {openDatabase,seed,type KaiDatabase} from '../src/server/db';
import {peopleList,personPage} from '../src/server/people-data';

const indexes=['conversations_ready_to_process','conversations_waiting_choice','suggestions_by_recording','suggestions_pending_person','todos_by_subject','todos_by_owner','notes_by_person'];
const queue="SELECT * FROM conversations WHERE status='waiting' AND awaiting_person=0 AND awaiting_speakers=0 AND workspace_id IN (SELECT id FROM workspaces WHERE trial_ended=0 AND (trial_seconds IS NULL OR trial_verified=1)) ORDER BY happened_at,rowid LIMIT 1";
const uploads='SELECT id,title,happened_on FROM conversations WHERE workspace_id=? AND awaiting_person=1 ORDER BY rowid DESC';
const recordingCounts="SELECT c.id,(SELECT count(*) FROM suggestions s WHERE s.workspace_id=c.workspace_id AND s.conversation_id=c.id AND s.status='proposed') suggestion_count FROM conversations c WHERE workspace_id=? ORDER BY c.rowid";

function fixture(db:KaiDatabase) {
 const person=db.prepare("INSERT INTO people(id,workspace_id,name,company,role) VALUES (?,?,?,'Invented company','Invented role')");
 const recording=db.prepare("INSERT INTO conversations(id,workspace_id,title,summary,source,text,happened_on,status,happened_at) VALUES (?,?,'Invented recording','','sample','Invented words.','2026-11-24','ready',?)");
 const todo=db.prepare("INSERT INTO todos(id,workspace_id,text,owner_person_id,person_id,due_on,status,quote,conversation_id) VALUES (?,?,'Invented promise',?,?,?,?,'Invented words.',?)");
 const note=db.prepare("INSERT INTO notes(id,workspace_id,person_id,conversation_id,text,quote) VALUES (?,?,?,?,'Invented note','Invented words.')");
 const suggestion=db.prepare("INSERT INTO suggestions(id,workspace_id,conversation_id,kind,payload,quote,status) VALUES (?,?,?,'note',?,'Invented words.',?)");
 db.transaction(()=>{
  for(let w=0;w<20;w++){
   const workspace='bench-'+w;seed(db,new Date('2026-11-28T12:00:00Z'),workspace,false);
   for(let p=0;p<30;p++)person.run(workspace+'-p'+p,workspace,'Invented person '+p);
   for(let c=0;c<50;c++){
    const id=workspace+'-c'+c;recording.run(id,workspace,c);
    for(let s=0;s<6;s++)suggestion.run(id+'-s'+s,workspace,id,JSON.stringify({person_id:workspace+'-p'+((c+s)%30),text:'Invented note'}),s%2?'accepted':'proposed');
   }
   for(let p=0;p<30;p++){
    const id=workspace+'-p'+p;
    for(let n=0;n<6;n++)note.run(id+'-n'+n,workspace,id,workspace+'-c'+p);
    for(let t=0;t<12;t++)todo.run(id+'-t'+t,workspace,t%3?id:null,id,t%2?'2026-11-24':'2026-12-04',t%3?'open':'done',workspace+'-c'+p);
   }
  }
  // All ties and paused jobs must preserve the queue's existing selection order.
  db.prepare("UPDATE conversations SET status='waiting',awaiting_person=CASE WHEN rowid%3=0 THEN 1 ELSE 0 END WHERE rowid%7=0").run();
 })();
}
function querySnapshot(db:KaiDatabase) {
 return {people:peopleList(db,'bench-0',new Date('2026-11-28T12:00:00Z')),person:personPage(db,'bench-0','bench-0-p0'),queue:db.prepare(queue).get(),uploads:db.prepare(uploads).all('bench-0'),counts:db.prepare(recordingCounts).all('bench-0')};
}
function plans(db:KaiDatabase) {
 const queried:{sql:string;parameters:unknown[]}[]=[];
 const capture={prepare(sql:string){const statement=db.prepare(sql);return {all(...parameters:unknown[]){queried.push({sql,parameters});return statement.all(...parameters)},get(...parameters:unknown[]){queried.push({sql,parameters});return statement.get(...parameters)}}}} as KaiDatabase;
 peopleList(capture,'bench-0',new Date('2026-11-28T12:00:00Z'));personPage(capture,'bench-0','bench-0-p0');
 queried.push({sql:queue,parameters:[]},{sql:uploads,parameters:['bench-0']},{sql:recordingCounts,parameters:['bench-0']});
 return queried.map(({sql,parameters})=>(db.prepare('EXPLAIN QUERY PLAN '+sql).all(...parameters) as {detail:string}[]).map(row=>row.detail).join('; ')).join('\n');
}
function median(db:KaiDatabase) {
 querySnapshot(db);const times=[];
 for(let run=0;run<7;run++){const start=performance.now();querySnapshot(db);times.push(performance.now()-start)}
 return times.sort((a,b)=>a-b)[3];
}
test('hot-query indexes preserve queue order and notebook results while replacing repeated full scans',()=>{
 const baseline=openDatabase();fixture(baseline);for(const name of indexes)baseline.exec('DROP INDEX '+name);
 const before=querySnapshot(baseline),beforePlan=plans(baseline),beforeMs=median(baseline);
 const indexed=openDatabase(baseline.serialize());
 try{
  assert.deepEqual(querySnapshot(indexed),before);
  const afterPlan=plans(indexed),afterMs=median(indexed);
  for(const name of indexes)assert.ok(afterPlan.includes(name),'hot queries use '+name);
  assert.match(beforePlan,/SCAN (?:t|s|notes|conversations)/);
  const queuePlan=(indexed.prepare('EXPLAIN QUERY PLAN '+queue).all() as {detail:string}[]).map(row=>row.detail).join('; ');
  assert.match(queuePlan,/conversations_ready_to_process/);assert.doesNotMatch(queuePlan,/TEMP B-TREE/);
  const restarted=openDatabase(indexed.serialize());try{assert.deepEqual(querySnapshot(restarted),before);assert.equal((restarted.prepare("SELECT count(*) n FROM sqlite_master WHERE type='index' AND name IN ("+indexes.map(()=>'?').join(',')+")").get(...indexes) as {n:number}).n,indexes.length)}finally{restarted.close()}
  console.log(`Invented 20-notebook query benchmark: median combined People/person/queue/uploads/counts ${beforeMs.toFixed(2)} → ${afterMs.toFixed(2)} ms; identical results; ${indexes.length} indexes selected by EXPLAIN. Not live timing.`);
 }finally{indexed.close();baseline.close()}
});
