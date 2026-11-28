import {test} from 'node:test';
import assert from 'node:assert/strict';
import {claudeReader} from '../src/server/claude-reader';
import {openDatabase,seed} from '../src/server/db';
import {addReading,readConversation,toolSchemas} from '../src/server/reading';
import {samples} from '../src/samples';

const gateways={connections:[{gateway_base_url:'https://api.sprites.dev/v1/gateway/anthropic/invented-connection'},{gateway_base_url:'https://api.sprites.dev/v1/gateway/assemblyai/invented-connection'}]};
const frame=(event:unknown)=>'data: '+JSON.stringify(event)+'\n\n';
const describe={name:'describe_recording',input:{title:'Dana’s update',summary:'Dana received the pricing.\nThe security review is next.'}};
const finish={name:'finish_reading',input:{}};
function chunks(calls:{name:string;input:unknown}[],stop='tool_use',complete=true) {
 return calls.map((call,index)=>frame({type:'content_block_start',index,content_block:{type:'tool_use',id:'invented-'+index,...call}})+(call.name==='finish_reading'?frame({type:'content_block_delta',index,delta:{type:'input_json_delta',partial_json:''}}):'')+frame({type:'content_block_stop',index})).join('')+frame({type:'message_delta',delta:{stop_reason:stop}})+(complete?frame({type:'message_stop'}):'');
}

test('empty no-argument tool deltas finish a sample, while malformed nonempty JSON still fails',async(t)=>{
 for(const partial of ['', '{']) {
  const db=openDatabase();seed(db);seed(db,new Date(),'judge-empty-delta');let requests=0;
  const mock=t.mock.method(globalThis,'fetch',async(url:unknown)=>{
   if(String(url).endsWith('/list'))return Response.json(gateways);
   requests++;
   return new Response(chunks([describe,finish]).replace('"partial_json":""','"partial_json":'+JSON.stringify(partial)));
  });
  try {
   const id=addReading(db,'judge-empty-delta',samples[0].text,'2026-11-28','sample');
   await readConversation(db,id,claudeReader);
   const row=db.prepare('SELECT status FROM conversations WHERE id=?').get(id) as {status:string};
   assert.equal(row.status,partial===''?'ready':'failed');
   assert.equal(requests,1);
  } finally {db.close();mock.mock.restore()}
 }
});

test('the advertised summary schema states the exact two-line shape enforced before saving',async(t)=>{
 let requests=0;
 t.mock.method(globalThis,'fetch',async(url:unknown,init?:RequestInit)=>{
  if(String(url).endsWith('/list'))return Response.json(gateways);
  requests++;const body=JSON.parse(String(init?.body));
  const summary=body.tools.find((tool:any)=>tool.name==='describe_recording').input_schema.properties.summary;
  assert.match(summary.description,/Exactly two/);const pattern=new RegExp(summary.pattern);
  for(const value of ['Only one line','First\n\nThird','First\nSecond\nThird','First\n   ']){
   assert.equal(pattern.test(value),false);assert.equal(toolSchemas.describe_recording.safeParse({title:'Invented',summary:value}).success,false);
  }
  assert.equal(pattern.test(describe.input.summary),true);
  assert.equal(pattern.test('First line.\r\nSecond line.'),true);
  assert.equal(toolSchemas.describe_recording.safeParse({title:'Invented',summary:'First line.\r\nSecond line.'}).success,true);
  return new Response(chunks([describe,finish]));
 });
 await claudeReader({text:'Invented words.',happened_on:'2026-11-28',people:[]},()=>({ok:true}));
 assert.equal(requests,1,'a valid metadata-only recording needs no acknowledgement request');
});

test('finish removes the acknowledgement request only after the complete valid stream, retaining incremental proposals',async(t)=>{
 let requests=0,resolveProposal!:()=>void,release!:()=>void,settled=false;
 const proposalSeen=new Promise<void>(r=>{resolveProposal=r});const released=new Promise<void>(r=>{release=r});
 t.mock.method(globalThis,'fetch',async(url:unknown)=>{
  if(String(url).endsWith('/list'))return Response.json(gateways);requests++;
  return new Response(new ReadableStream({async start(c){
   c.enqueue(new TextEncoder().encode(chunks([describe,{name:'propose_note',input:{quote:'Invented words.'}},finish],'tool_use',false)));
   await released;c.enqueue(new TextEncoder().encode(frame({type:'message_stop'})));c.close();
  }}));
 });
 const durations:number[]=[];
 const reading=claudeReader({text:'Invented words.',happened_on:'2026-11-28',people:[]},name=>{if(name==='propose_note')resolveProposal();return {ok:true}},undefined,(_metric,value)=>durations.push(value)).then(()=>{settled=true});
 await proposalSeen;assert.equal(settled,false);release();await reading;
 assert.equal(requests,1);assert.equal(durations.length,1);assert.ok(durations[0]>=0);
});

test('finish cannot hide invalid quotes, missing metadata, later tool failures or truncated streams',async(t)=>{
 for(const broken of ['quote','missing-summary','later-tool','truncated','max_tokens']) {
  let requests=0,called=0;
  const mock=t.mock.method(globalThis,'fetch',async(url:unknown,init?:RequestInit)=>{
   if(String(url).endsWith('/list'))return Response.json(gateways);requests++;
   if(requests===2){
    const results=JSON.parse(String(init?.body)).messages.at(-1).content;
    assert.ok(results.some((result:any)=>result.is_error));
    return new Response(chunks([describe,finish]));
   }
   const invalid={name:'propose_note',input:{quote:'Not in the recording'}};
   const calls=broken==='quote'?[describe,invalid,finish]:broken==='missing-summary'?[finish]:broken==='later-tool'?[describe,finish,invalid]:[describe,finish];
   return new Response(chunks(calls,broken==='max_tokens'?'max_tokens':'tool_use',broken!=='truncated'));
  });
  try{
   const run=claudeReader({text:'Invented words.',happened_on:'2026-11-28',people:[]},name=>{called++;return name==='propose_note'?{ok:false,error:'The quote must appear in the words exactly.'}:{ok:true}});
   if(broken==='truncated'||broken==='max_tokens'){await assert.rejects(run);assert.equal(requests,1);}
   else {await run;assert.equal(requests,2);assert.ok(called>0);}
  }finally{mock.mock.restore()}
 }
});

test('completion benchmark compares legacy acknowledgement with finish while retaining Dana memory',async(t)=>{
 const counts:number[]=[];let measuredFullBytes=0,measuredCompactBytes=0;
 for(const optimized of [false,true]) {
 const db=openDatabase();seed(db);seed(db,new Date(),'judge-performance');let requests=0,fullContextBytes=0,compactContextBytes=0;
 const mock=t.mock.method(globalThis,'fetch',async(url:unknown,init?:RequestInit)=>{
  if(String(url).endsWith('/list'))return Response.json(gateways);requests++;
  if(!optimized && requests===3)return new Response(chunks([],'end_turn'));
  if(requests===1)return new Response(chunks([describe,{name:'get_person',input:{person_id:'judge-performance:dana'}}]));
  assert.equal(requests,2,'finish must avoid a third acknowledgement response');
  const results=JSON.parse(String(init?.body)).messages.at(-1).content;
  const context=JSON.parse(results[1].content);compactContextBytes=Buffer.byteLength(results[1].content);
  assert.equal(context.person.name,'Dana Whitfield');assert.ok(context.person.notes.length>0);assert.ok(context.person.conversations.length>0);
  const pricing=context.person.todos.find((todo:any)=>todo.id==='judge-performance:pricing');
  assert.equal(pricing.text,'Send Dana the pricing');assert.ok('owner_person_id' in pricing);assert.ok('quote' in pricing);assert.ok(!('conversation_id' in pricing));assert.ok(!('pending' in context.person));
  return new Response(chunks([
   {name:'propose_done',input:{person_id:'judge-performance:dana',todo_id:pricing.id,quote:'She thanked me for the pricing I sent Monday.'}},
   {name:'propose_note',input:{person_id:'judge-performance:dana',text:'Her CFO wants to review security.',quote:'Her CFO wants to review security.'}},...(optimized?[finish]:[])
  ]));
 });
 try{
  const id=addReading(db,'judge-performance',samples[0].text,'2026-11-28','sample');
  await readConversation(db,id,async(input,call,signal,observe)=>claudeReader(input,(name,value)=>{const result=call(name,value);if(name==='get_person')fullContextBytes=Buffer.byteLength(JSON.stringify(result));return result},signal,observe));
  assert.equal((db.prepare('SELECT status FROM conversations WHERE id=?').get(id) as {status:string}).status,'ready');
  assert.equal((db.prepare("SELECT count(*) n FROM suggestions WHERE conversation_id=? AND kind='done'").get(id) as {n:number}).n,1);
  assert.equal((db.prepare("SELECT count(*) n FROM people WHERE workspace_id=? AND name='Dana Whitfield'").get('judge-performance') as {n:number}).n,1);
  assert.equal((db.prepare("SELECT status FROM todos WHERE id='judge-performance:pricing'").get() as {status:string}).status,'open');
  assert.equal(requests,optimized?2:3);assert.ok(compactContextBytes<fullContextBytes);counts.push(requests);measuredFullBytes=fullContextBytes;measuredCompactBytes=compactContextBytes;
 }finally{db.close();mock.mock.restore()}
 }
 assert.deepEqual(counts,[3,2]);
 console.log(`Invented Dana benchmark: legacy acknowledgement ${counts[0]} → finish ${counts[1]} model requests; full → compact context ${measuredFullBytes} → ${measuredCompactBytes} bytes. Fake responses only, not live latency.`);
});
