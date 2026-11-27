import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes,randomUUID } from 'node:crypto';
import { Client,StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { openDatabase,seed } from '../src/server/db';
import { createJudge } from '../src/server/access';
import { createApp } from '../src/server/app';
import { persistentDownloadSecret,persistentJudgeSecret } from '../src/server/config';
const inventedAddress=()=>randomUUID()+'@example.invalid';

test('waitlist fences public writes, attempts, capacity, privacy and operator download across a restart',async()=> {
  let db=openDatabase();seed(db);const judge=createJudge(db);
  const judgeSecret=persistentJudgeSecret(db),downloadSecret=persistentDownloadSecret(db);
  assert.ok(judgeSecret!==downloadSecret);assert.ok(downloadSecret===persistentDownloadSecret(db));
  let now=Date.now(),providerCalls=0;
  const options={judgeSecret,downloadSecret,secureCookies:false,now:()=>now,reader:async()=>{providerCalls++;},transcriber:async()=>{providerCalls++;return '';}};
  let app=createApp(db,options);await app.locals.queue.stop();
  db.prepare("INSERT INTO conversations(id,workspace_id,title,summary,source,text,happened_on,status) VALUES ('pending',?,'Invented pending recording','','paste','Invented words.','2026-11-25','waiting')").run(judge.id);
  let server=app.listen(18530,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));let base='http://127.0.0.1:18530';
  const logs:string[]=[];const previous={log:console.log,error:console.error,warn:console.warn};
  console.log=console.error=console.warn=(...args:unknown[])=>{logs.push(args.map(String).join(' '));};
  const client=new Client({name:'Waitlist isolation check',version:'1.0.0'});
  async function visitor() {const response=await fetch(base+'/api/waitlist');assert.equal(response.status,200);return response.headers.get('set-cookie')!.split(';')[0];}
  const post=(cookie:string,email:unknown)=>fetch(base+'/api/waitlist',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({email})});
  const count=()=> (db.prepare('SELECT count(*) AS n FROM waitlist').get() as {n:number}).n;
  try {
    const workspaceCount=()=> (db.prepare('SELECT count(*) AS n FROM workspaces').get() as {n:number}).n;
    const beforeWorkspaces=workspaceCount();
    const first=await visitor(),email=inventedAddress();
    assert.equal((await post(first,email)).status,200);assert.equal(count(),1);
    assert.equal(workspaceCount(),beforeWorkspaces);
    assert.equal((db.prepare('SELECT workspace_id FROM waitlist WHERE email=?').get(email) as {workspace_id:string|null}).workspace_id,null);
    assert.equal((await post(first,' '+email.toUpperCase()+' ')).status,200);assert.equal(count(),1);
    assert.equal((await post(first,'not an address')).status,400);
    assert.equal((await post(first,'a'.repeat(250)+'@example.invalid')).status,400);
    assert.equal((await post(first,email)).status,200);assert.equal((await post(first,inventedAddress())).status,429);assert.equal(count(),1);
    for(const method of ['POST','PUT','DELETE'])assert.equal((await fetch(base+'/api/people',{method,headers:{Cookie:first,'Content-Type':'application/json'},body:'{}'})).status,403);
    assert.deepEqual((db.prepare('PRAGMA table_info(waitlist)').all() as {name:string}[]).map(c=>c.name).sort(),['email','created_at','workspace_id','verified_at','trial_ip','terms_version','terms_accepted_at'].sort());
    for(const table of ['workspaces','people','notes','todos','conversations','suggestions'])assert.ok(!JSON.stringify(db.prepare('SELECT * FROM '+table).all()).includes(email));
    const mcp=db.prepare('SELECT mcp_token FROM workspaces WHERE id=?').get(judge.id) as {mcp_token:string};
    await client.connect(new StreamableHTTPClientTransport(new URL(base+'/mcp/'+mcp.mcp_token)));
    const responses=[await client.listTools(),await client.callTool({name:'list_people',arguments:{}}),await client.callTool({name:'get_person',arguments:{person_id:judge.id+':dana'}}),await client.callTool({name:'list_todos',arguments:{}}),await client.callTool({name:'search',arguments:{query:email}})];
    assert.ok(!JSON.stringify(responses).includes(email));await client.close();
    for(const secret of [undefined,judgeSecret,randomBytes(32).toString('hex')])for(const route of ['count','download','network']) {
      assert.equal((await fetch(base+'/api/operator/'+route,{headers:secret ? {'x-kai-download':secret}:{}})).status,404);
    }
    assert.equal((await (await fetch(base+'/api/operator/count',{headers:{'x-kai-download':downloadSecret}})).json()).count,1);
    const download=await fetch(base+'/api/operator/download',{headers:{'x-kai-download':downloadSecret}});
    assert.equal(download.status,200);assert.ok(download.headers.get('content-disposition')?.startsWith('attachment;'));
    assert.ok((await download.text()).trim()===email);
    // Only a memory image crosses this restart. No address or secret is put in a file.
    db.prepare("UPDATE conversations SET status='ready' WHERE id='pending'").run();
    const image=db.serialize();await new Promise<void>(resolve=>server.close(()=>resolve()));db.close();
    db=openDatabase(image);app=createApp(db,options);await app.locals.queue.stop();
    server=app.listen(18531,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));base='http://127.0.0.1:18531';
    assert.equal((await post(first,inventedAddress())).status,429);assert.equal(count(),1);
    now+=3600001;const second=await visitor();assert.equal((await post(second,inventedAddress())).status,200);assert.equal(count(),2);
    const insert=db.prepare('INSERT INTO waitlist(email,created_at) VALUES (?,?)');db.transaction(()=>{for(let i=2;i<2000;i++)insert.run(inventedAddress(),new Date(now).toISOString());})();
    assert.equal((await post(second,inventedAddress())).status,409);assert.equal(count(),2000);
    assert.equal((await post(second,email)).status,200);assert.equal(count(),2000);
    const state=JSON.parse((db.prepare("SELECT waitlist_visitors FROM workspaces WHERE id='public'").get() as {waitlist_visitors:string}).waitlist_visitors);
    while(Object.keys(state).length<2000)state[randomBytes(32).toString('hex')]={seen:now,attempts:[]};
    db.prepare("UPDATE workspaces SET waitlist_visitors=? WHERE id='public'").run(JSON.stringify(state));
    assert.equal((await fetch(base+'/api/waitlist')).status,429);
    assert.equal((await fetch(base+'/api/waitlist',{headers:{Cookie:second}})).status,200);
    assert.equal(providerCalls,0);assert.equal(logs.length,0);
  }finally{console.log=previous.log;console.error=previous.error;console.warn=previous.warn;await client.close();await app.locals.queue.stop();await new Promise<void>(resolve=>server.close(()=>resolve()));db.close();}
});
