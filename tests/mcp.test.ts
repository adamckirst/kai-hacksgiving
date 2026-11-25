import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash,randomBytes } from 'node:crypto';
import { Client,StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { openDatabase,seed } from '../src/server/db';
import { createApp } from '../src/server/app';
import { createJudge } from '../src/server/access';
import { persistentJudgeSecret } from '../src/server/config';

test('official MCP client lists four read tools, reads Dana’s open promises, searches words and writes nothing',async()=> {
  const db=openDatabase();seed(db);const a=createJudge(db),b=createJudge(db);
  const addresses=db.prepare('SELECT id,mcp_token,upload_token FROM workspaces WHERE kind=\'judge\'').all() as {id:string;mcp_token:string;upload_token:string}[];
  const address=addresses.find(row=>row.id===a.id)!;
  let providerCalls=0;
  const app=createApp(db,{reader:async()=>{providerCalls++;},transcriber:async()=>{providerCalls++;return '';}});await app.locals.queue.stop();
  // A pending job proves MCP reads do not kick the provider queue.
  db.prepare("INSERT INTO conversations (id,workspace_id,title,summary,source,text,happened_on,status) VALUES (?,?,?,'','paste',?,'2026-11-24','waiting')").run(a.id+':pending',a.id,'Unreviewed original words','The invented amber courtyard marker is only in these words.');
  db.prepare("UPDATE notes SET text='Only the other notebook knows the silver orchard' WHERE workspace_id=?").run(b.id);
  db.prepare("INSERT INTO suggestions (id,workspace_id,conversation_id,kind,payload,quote,status) VALUES (?,?,?,'note',?,'pricing','proposed')").run(a.id+':unaccepted',a.id,a.id+':dana-call',JSON.stringify({person_id:a.id+':dana',text:'Unaccepted copper harbour claim'}));
  const invitation=persistentJudgeSecret(db);
  const before=createHash('sha256').update(db.serialize()).digest('hex');
  const server=app.listen(18527,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
  const base='http://127.0.0.1:18527',url=base+'/mcp/'+address.mcp_token;
  const client=new Client({name:'KAI invented-data check',version:'1.0.0'});
  const statuses:number[]=[];const types:string[]=[];let sessions=0;
  const transport=new StreamableHTTPClientTransport(new URL(url),{fetch:async(input,init)=> {
    const response=await fetch(input,init);statuses.push(response.status);if(response.status===200)types.push(response.headers.get('content-type') ?? '');
    if(response.headers.has('mcp-session-id'))sessions++;return response;
  }});
  async function call(name:string,args:Record<string,unknown>={}) {
    const answer=await client.callTool({name,arguments:args});
    assert.ok(Array.isArray(answer.content));const first=answer.content[0] as {type:string;text:string};assert.equal(first.type,'text');
    return {error:Boolean(answer.isError),text:first.text};
  }
  try {
    const connection=await (await fetch(base+'/api/connect',{headers:{Cookie:'kai_session='+a.cookie}})).json();
    assert.ok(connection.mcpPath==='/mcp/'+address.mcp_token);
    await client.connect(transport);
    const tools=(await client.listTools()).tools;
    assert.deepEqual(tools.map(t=>t.name).sort(),['get_person','list_people','list_todos','search']);assert.ok(tools.every(t=>t.annotations?.readOnlyHint===true && t.annotations?.destructiveHint===false));
    const people=JSON.parse((await call('list_people')).text);assert.equal(people.length,3);
    const dana=people.find((p:{name:string})=>p.name==='Dana Whitfield');assert.ok(dana.id.startsWith(a.id));
    const page=JSON.parse((await call('get_person',{person_id:dana.id})).text);
    assert.ok(!('pending' in page));assert.equal(page.todos.length,1);assert.equal(page.todos[0].text,'Send Dana the pricing');assert.equal(page.todos[0].quote,'I promised to send Dana the pricing.');
    const mine=JSON.parse((await call('list_todos',{person_id:dana.id,owner:'mine'})).text);assert.equal(mine.length,1);assert.equal(mine[0].text,'Send Dana the pricing');
    assert.equal(JSON.parse((await call('list_todos',{owner:'waiting'})).text).length,1);
    const words=JSON.parse((await call('search',{query:'amber courtyard'})).text);assert.equal(words.recordings.length,1);assert.ok(words.recordings[0].text.includes('amber courtyard'));
    const privateSearch=JSON.parse((await call('search',{query:'silver orchard'})).text);assert.ok(Object.values(privateSearch).every(rows=>Array.isArray(rows) && rows.length===0));
    const proposedSearch=JSON.parse((await call('search',{query:'copper harbour'})).text);assert.ok(Object.values(proposedSearch).every(rows=>Array.isArray(rows) && rows.length===0));
    assert.equal((await call('get_person',{person_id:b.id+':dana'})).error,true);
    await assert.rejects(()=>call('mark_done',{id:mine[0].id}),/not found/);
    assert.equal((await call('search',{query:''})).error,true);
    for(const invalid of [randomBytes(32).toString('hex'),invitation,address.upload_token,'invalid']) {
      assert.equal((await fetch(base+'/mcp/'+invalid,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,404);
    }
    assert.equal((await fetch(url,{method:'POST',headers:{Origin:'https://example.invalid'}})).status,403);
    assert.equal((await fetch(url,{method:'DELETE'})).status,405);
    // No initialization state is needed for a fresh HTTP request.
    const direct=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/list'})});
    assert.equal(direct.status,200);assert.equal((await direct.json()).result.tools.length,4);
    assert.equal(sessions,0);assert.ok(types.length>4 && types.every(t=>t.startsWith('application/json')));assert.ok(statuses.includes(200));
    assert.equal(providerCalls,0);assert.equal(createHash('sha256').update(db.serialize()).digest('hex'),before);
  }finally{await client.close();await new Promise<void>(resolve=>server.close(()=>resolve()));db.close();}
});
