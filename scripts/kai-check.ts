import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import Database from 'better-sqlite3';
import { createApp } from '../src/server/app';
import { openDatabase,seed } from '../src/server/db';
import { samples } from '../src/samples';
async function main() {
  const fake=process.env.KAI_MODEL==='fake';
  let secret:string,base='http://127.0.0.1:8080',close=async()=>{};
  if(fake) {
    const db=openDatabase();seed(db);secret=randomBytes(32).toString('hex');
    const app=createApp(db,{judgeSecret:secret,secureCookies:false});const server=app.listen(18524,'127.0.0.1');
    await new Promise<void>(resolve=>server.once('listening',resolve));base='http://127.0.0.1:18524';
    close=async()=>{await app.locals.queue.stop();await new Promise<void>(resolve=>server.close(()=>resolve()));db.close();};
  } else {
    if(!existsSync('/.sprite'))throw new Error('Run on kai, or set KAI_MODEL=fake for the local check.');
    const db=new Database(process.env.KAI_DB ?? '/home/sprite/kai-state/kai.sqlite',{readonly:true,fileMustExist:true});
    try {secret=(db.prepare("SELECT mcp_token FROM workspaces WHERE id='public'").get() as {mcp_token:string}).mcp_token;}finally{db.close();}
    if(!secret)throw new Error('Start the deployed app before this check.');
  }
  try {
    const health=await (await fetch(base+'/healthz')).json();
    if(health.reading!==(fake ? 'fake':'connector'))throw new Error('The running app has the wrong reader for this check.');
    if(!fake && health.commit!==execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim())throw new Error('Deploy this checkout’s head before running the check.');
    for(const sample of samples) {
      const times:{first:number;all:number}[]=[];
      for(let run=1;run<=3;run++) {
        const login=await fetch(base+'/api/access/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret})});
        if(!login.ok)throw new Error('Check workspace could not open.');
        const cookie=login.headers.get('set-cookie')?.split(';')[0];if(!cookie)throw new Error('Check session missing.');
        const request=async(route:string,body?:unknown)=> {
          const response=await fetch(base+route,{method:body ? 'POST':'GET',headers:{Cookie:cookie,'Content-Type':'application/json'},body:body ? JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});
          if(!response.ok)throw new Error('A check request failed.');return response.json();
        };
        const people=await request('/api/people');const dana=people.find((p:{name:string})=>p.name==='Dana Whitfield');
        const prior=await request('/api/people/'+dana.id);const pricing=prior.todos.find((t:{text:string})=>t.text==='Send Dana the pricing');
        const start=performance.now();const added=await request('/api/readings',{sample_id:sample.id,happened_on:new Date().toISOString().slice(0,10)});
        let first=0,recording;
        for(let attempt=0;attempt<120;attempt++) {
          recording=await request('/api/readings/'+added.id);
          if(recording.suggestions.length && !first)first=performance.now()-start;
          if(recording.status==='ready')break;if(recording.status==='failed')throw new Error('A sample reading failed.');
          await new Promise(resolve=>setTimeout(resolve,1000));
        }
        if(recording?.status!=='ready' || !first)throw new Error('A sample produced no suggestions or timed out.');
        const proposals=recording.suggestions.map((s:{kind:string;payload:string;quote:string})=>({...s,payload:JSON.parse(s.payload)}));
        if(proposals.some((s:{quote:string})=>!recording.text.includes(s.quote)))throw new Error('A quote did not match.');
        if(sample.id==='dana' && (!proposals.some((s:any)=>s.kind==='done' && s.payload.todo_id===pricing.id) || proposals.some((s:any)=>s.kind==='person' && s.payload.name.trim().toLowerCase()==='dana whitfield')))throw new Error('Dana memory check failed.');
        if(sample.id==='ellis' && !proposals.some((s:any)=>s.kind==='todo' && s.payload.person_id===people.find((p:any)=>p.name==='Ellis Rowan').id))throw new Error('Ellis promise check failed.');
        if(sample.id==='sora' && !proposals.some((s:any)=>s.kind==='person' && s.payload.name==='Sora Bell'))throw new Error('Sora person check failed.');
        const all=performance.now()-start;await request('/api/readings/'+added.id+'/accept-all',{});
        const after=await request('/api/people');if(after.filter((p:any)=>p.name==='Dana Whitfield').length!==1)throw new Error('A second Dana was created.');
        if(sample.id==='dana' && (await request('/api/people/'+dana.id)).todos.some((t:any)=>t.id===pricing.id))throw new Error('The pricing promise did not finish.');
        times.push({first,all});console.log(`${sample.id} run ${run}: passed (${proposals.length} suggestions)`);
      }
      const median=(key:'first'|'all')=>times.map(t=>t[key]).sort((a,b)=>a-b)[1];
      console.log(`${sample.id}: median first ${Math.round(median('first'))} ms; all ${Math.round(median('all'))} ms (${fake ? 'fake, not a Sprite measurement':'Sprite HTTP polling'})`);
    }
    console.log('9/9 sample runs passed; Dana pricing done and no second Dana in all three runs.');
  }finally{await close();}
}
main().catch(error=>{console.error(error instanceof Error ? error.message:'KAI check failed.');process.exitCode=1;});
