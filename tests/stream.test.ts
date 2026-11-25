import { test } from 'node:test';
import assert from 'node:assert/strict';
import { claudeReader, events } from '../src/server/claude-reader';
const encode=new TextEncoder();
const frame=(value:unknown)=>encode.encode('data: '+JSON.stringify(value)+'\n\n');
test('SSE parser handles frames split in the middle of a character and several frames per chunk',async()=> {
  const bytes=encode.encode('data: {"text":"Mara’s words"}\n\ndata: {"done":true}\n\n');
  const stream=new ReadableStream<Uint8Array>({start(c){for(const byte of bytes)c.enqueue(new Uint8Array([byte]));c.close();}});
  const result=[];for await(const event of events(stream)) result.push(event);
  assert.deepEqual(result,[{text:'Mara’s words'},{done:true}]);
});
test('Claude tool calls are handled before the stream finishes and tool errors are sent back',async(t)=> {
  let requests=0,handled=false;
  const mock=t.mock.method(globalThis,'fetch',async(_url:unknown,init?:RequestInit)=> {
    requests++;
    if(requests===1) return Response.json({connections:[{gateway_base_url:'https://api.sprites.dev/v1/gateway/anthropic/invented-connection'},{gateway_base_url:'https://api.sprites.dev/v1/gateway/assemblyai/invented-connection'}]});
    assert.ok(!new Headers(init?.headers).has('Authorization'));
    assert.ok(!new Headers(init?.headers).has('x-api-key'));
    if(requests===2) return new Response(new ReadableStream({start(c) {
      c.enqueue(frame({type:'content_block_start',index:0,content_block:{type:'tool_use',id:'invented-call',name:'propose_note',input:{}}}));
      c.enqueue(frame({type:'content_block_delta',index:0,delta:{type:'input_json_delta',partial_json:JSON.stringify({quote:'Unsupported words'})}}));
      c.enqueue(frame({type:'content_block_stop',index:0}));
      // The callback must fire while the response is still open.
      setTimeout(()=> {assert.ok(handled);c.enqueue(frame({type:'message_delta',delta:{stop_reason:'tool_use'}}));c.enqueue(frame({type:'message_stop'}));c.close();},20);
    }}));
    const body=JSON.parse(String(init?.body));
    if(requests===3) {
      assert.equal(body.messages.at(-1).content[0].is_error,true);
      return new Response(new ReadableStream({start(c){
        c.enqueue(frame({type:'content_block_start',index:0,content_block:{type:'tool_use',id:'invented-description',name:'describe_recording',input:{}}}));
        c.enqueue(frame({type:'content_block_delta',index:0,delta:{type:'input_json_delta',partial_json:JSON.stringify({title:'A conversation',summary:'Mara spoke.\nThere are notes.'})}}));
        c.enqueue(frame({type:'content_block_stop',index:0}));
        c.enqueue(frame({type:'message_delta',delta:{stop_reason:'tool_use'}}));c.enqueue(frame({type:'message_stop'}));c.close();
      }}));
    }
    assert.equal(body.messages.at(-1).content[0].is_error,false);
    return new Response(new ReadableStream({start(c){c.enqueue(frame({type:'message_delta',delta:{stop_reason:'end_turn'}}));c.enqueue(frame({type:'message_stop'}));c.close();}}));
  });
  try {await claudeReader({text:'Invented words.',happened_on:'2026-11-24',people:[]},name=>{handled=true;return name==='describe_recording' ? {ok:true}:{ok:false,error:'Quote not in words.'};});assert.equal(requests,4);} finally {mock.mock.restore();}
});
test('Claude is asked for missing required metadata before a run can finish',async(t)=> {
  let requests=0,described=false;
  const mock=t.mock.method(globalThis,'fetch',async(_url:unknown,init?:RequestInit)=> {
    requests++;
    if(requests===1)return Response.json({connections:[{gateway_base_url:'https://api.sprites.dev/v1/gateway/anthropic/invented-connection'},{gateway_base_url:'https://api.sprites.dev/v1/gateway/assemblyai/invented-connection'}]});
    if(requests===3)assert.match(JSON.parse(String(init?.body)).messages.at(-1).content,/required title and summary have not been saved/);
    return new Response(new ReadableStream({start(c){
      if(requests===3) {
        c.enqueue(frame({type:'content_block_start',index:0,content_block:{type:'tool_use',id:'invented-description',name:'describe_recording',input:{}}}));
        c.enqueue(frame({type:'content_block_delta',index:0,delta:{type:'input_json_delta',partial_json:JSON.stringify({title:'A conversation',summary:'Mara spoke.\nThere are notes.'})}}));
        c.enqueue(frame({type:'content_block_stop',index:0}));
      }
      c.enqueue(frame({type:'message_delta',delta:{stop_reason:requests===3 ? 'tool_use':'end_turn'}}));c.enqueue(frame({type:'message_stop'}));c.close();
    }}));
  });
  try {
    await claudeReader({text:'Invented words.',happened_on:'2026-11-24',people:[]},name=>{assert.equal(name,'describe_recording');described=true;return {ok:true};});
    assert.equal(described,true);assert.equal(requests,4);
  }finally{mock.mock.restore();}
});
