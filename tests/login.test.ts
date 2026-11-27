import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import type {Request} from 'express';
import {openDatabase,seed} from '../src/server/db';
import {createApp} from '../src/server/app';
import {createJudge,workspaceFor} from '../src/server/access';
import {TERMS_VERSION} from '../src/terms';

async function fixture(port:number,run:(f:Awaited<ReturnType<typeof setup>>)=>Promise<void>) {
 const f=await setup(port);try{await run(f)}finally{await f.app.locals.queue.stop();await new Promise<void>(r=>f.server.close(()=>r()));f.db.close()}
}
async function setup(port:number) {
 const db=openDatabase();seed(db);let now=Date.now(),fail=false;const loginCodes=new Map<string,string>(),trialCodes=new Map<string,string>();
 const app=createApp(db,{secureCookies:false,trustSpriteProxy:true,now:()=>now,sendLogin:async(email,code)=>{if(fail)throw Error();loginCodes.set(email,code)},sendCode:async(email,code)=>{trialCodes.set(email,code)}});
 const server=app.listen(port,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const base=`http://127.0.0.1:${port}`;
 const post=(path:string,body:object,cookie='',ip='192.0.2.150',origin?:string)=>fetch(base+'/api/'+path,{method:'POST',headers:{'Content-Type':'application/json','Sprite-Client-IP':ip,Cookie:cookie,...origin?{Origin:origin}:{}},body:JSON.stringify({termsVersion:TERMS_VERSION,...body})});
 function owner(verified=true){const judge=createJudge(db,false),email=randomUUID()+'@example.invalid';db.prepare('UPDATE workspaces SET trial_seconds=321,trial_verified=? WHERE id=?').run(Number(verified),judge.id);db.prepare('INSERT INTO waitlist(email,created_at,workspace_id,verified_at,trial_ip) VALUES (?,?,?,?,?)').run(email,new Date(now).toISOString(),judge.id,verified?new Date(now).toISOString():null,verified?randomUUID():null);return {...judge,email}}
 const cookie=(response:Response,name='kai_login')=>response.headers.getSetCookie().find(c=>c.startsWith(name+'='))?.split(';')[0]??'';
 const challenge=async(email:string,ip?:string)=>{const response=await post('login/code',{email},'',ip);assert.equal(response.status,200);return {proof:cookie(response),code:loginCodes.get(email)!}};
 const verify=(email:string,c:{proof:string;code:string},ip?:string)=>post('login/verify',{email,code:c.code},c.proof,ip);
 const get=(path:string,cookie='')=>fetch(base+'/api/'+path,{headers:{Cookie:cookie}});
 return {db,app,server,post,owner,cookie,challenge,verify,get,loginCodes,trialCodes,advance:(ms:number)=>{now+=ms},fail:(value:boolean)=>{fail=value}};
}
test('email recovery restores only its notebook across browsers, restarts and exhausted grants without refilling',()=>fixture(18630,async f=>{
 const a=f.owner(),b=f.owner();f.db.prepare('INSERT INTO people(id,workspace_id,name,company,role) VALUES (?,?,?,?,?)').run('owned-person',a.id,'Dana Whitfield','Loomwork','Founder');
 for(let n=0;n<98;n++)f.db.prepare('INSERT INTO waitlist(email,created_at,verified_at) VALUES (?,?,?)').run(randomUUID()+'@example.invalid','2026-11-27','2026-11-27');
 const snapshot=()=>({workspaces:f.db.prepare('SELECT count(*) n FROM workspaces').get(),waitlist:f.db.prepare('SELECT email,workspace_id,trial_ip FROM waitlist ORDER BY email').all(),quota:f.db.prepare('SELECT id,trial_seconds FROM workspaces ORDER BY id').all()});const before=snapshot();
 const c=await f.challenge(a.email.toUpperCase());c.code=f.loginCodes.get(a.email)!;
 const r=await f.verify(a.email,c,'198.51.100.24');assert.equal(r.status,200);const session=f.cookie(r,'kai_session');assert.ok(session.startsWith('kai_session=s.'));
 assert.deepEqual(snapshot(),before);assert.equal((await f.get('login/session',session)).status,200);
 assert.deepEqual(await(await f.get('login/session',session)).json(),{signedIn:true,recoverable:true});
 const own=await(await f.get('people',session)).text();assert.ok(own.includes('Dana Whitfield'));assert.ok(!own.includes(a.email));assert.ok(!(await(await f.get('people','kai_session='+b.cookie)).text()).includes('Dana Whitfield'));
 assert.equal((await f.verify(a.email,c)).status,409);assert.equal((await f.post('login/code',{email:b.email},session)).status,409);
 assert.equal((await f.post('login/verify',{email:b.email,code:'000000'},session)).status,409);
 const stored=f.db.prepare('SELECT digest FROM browser_sessions').get() as {digest:string};assert.ok(!session.includes(stored.digest));
 const restored=openDatabase(f.db.serialize());try{assert.equal(workspaceFor(restored,{headers:{cookie:session}} as Request),a.id);restored.prepare('UPDATE browser_sessions SET expires_at=0').run();assert.equal(workspaceFor(restored,{headers:{cookie:session}} as Request),'public')}finally{restored.close()}
 assert.equal((await f.post('trial/code',{email:randomUUID()+'@example.invalid'},'','203.0.113.2')).status,409);
}));
test('login rejects wrong, expired, replayed, different-browser and cross-flow codes with bounded guesses',()=>fixture(18631,async f=>{
 const a=f.owner();let c=await f.challenge(a.email);const row=f.db.prepare('SELECT code_hash,browser_hash FROM login_challenges').get() as {code_hash:string;browser_hash:string};assert.equal(row.code_hash.length,64);assert.notEqual(row.code_hash,c.code);assert.ok(!c.proof.includes(row.browser_hash));
 assert.equal((await f.verify(a.email,{...c,proof:''})).status,409);assert.equal((f.db.prepare('SELECT attempts FROM login_challenges').get() as {attempts:number}).attempts,0);
 const wrong=String((Number(c.code)+1)%1000000).padStart(6,'0');for(let n=0;n<5;n++)assert.equal((await f.verify(a.email,{...c,code:wrong})).status,409);assert.equal((await f.verify(a.email,c)).status,409);
 f.advance(61000);c=await f.challenge(a.email);f.advance(600001);assert.equal((await f.verify(a.email,c)).status,409);
 c=await f.challenge(a.email);assert.equal((await f.post('trial/verify',{email:a.email,code:c.code},c.proof)).status,409);
 const unverified=f.owner(false);await f.post('trial/code',{email:unverified.email},'','192.0.2.151');const trialCode=f.trialCodes.get(unverified.email)!;assert.ok(trialCode);assert.equal((await f.post('login/verify',{email:unverified.email,code:trialCode},c.proof)).status,409);
 assert.equal((await f.post('login/verify',{email:a.email,code:c.code,termsVersion:'old'},c.proof)).status,400);
 assert.equal((await f.verify(a.email,c)).status,200);
}));
test('login requests are generic and share signup and recording email limits without enabling unverified addresses',()=>fixture(18632,async f=>{
 const owner=f.owner(),unverified=f.owner(false),unknown=randomUUID()+'@example.invalid';
 const known=await f.post('login/code',{email:owner.email});const pending=await f.post('login/code',{email:unverified.email});const absent=await f.post('login/code',{email:unknown});
 assert.deepEqual(await known.json(),await pending.json());assert.deepEqual(await absent.json(),{ok:true});assert.equal(f.loginCodes.size,1);assert.equal((f.db.prepare('SELECT count(*) n FROM login_challenges').get() as {n:number}).n,1);
 assert.equal((await f.post('trial/code',{email:randomUUID()+'@example.invalid'})).status,429);
 assert.equal((await f.post('login/code',{email:owner.email},'','198.51.100.5')).status,429);
 f.advance(3600001);f.fail(true);assert.deepEqual(await(await f.post('login/code',{email:owner.email})).json(),{ok:true});assert.equal(f.db.prepare('SELECT 1 FROM login_challenges').get(),undefined);
 assert.equal((await f.post('login/code',{email:unknown},'','192.0.2.152','https://outside.invalid')).status,403);
 assert.equal((await f.post('login/code',{email:unknown,termsVersion:undefined})).status,400);
 const at=Date.now()+3600001;for(let n=0;n<96;n++)f.db.prepare('INSERT INTO notification_sends(id,workspace_id,sent_at) VALUES (?,?,?)').run(randomUUID(),owner.id,at);
 assert.equal((await f.post('login/code',{email:unknown},'','192.0.2.152')).status,429);
}));
test('sign out revokes one browser or all browsers without changing upload and MCP addresses',()=>fixture(18633,async f=>{
 const a=f.owner(),b=f.owner(),other='kai_session='+b.cookie,legacy='kai_session='+a.cookie;
 const connection=await(await f.get('connect',legacy)).json();
 let c=await f.challenge(a.email);const first=f.cookie(await f.verify(a.email,c),'kai_session');f.advance(61000);c=await f.challenge(a.email);const second=f.cookie(await f.verify(a.email,c),'kai_session');
 const out=async(cookie:string,everywhere:boolean)=>{const r=await fetch(`http://127.0.0.1:18633/api/login/sign-out`,{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify({everywhere})});assert.equal(r.status,200)};
 await out(first,false);assert.equal((await(await f.get('access',first)).json()).kind,'public');assert.equal((await(await f.get('access',second)).json()).kind,'judge');assert.equal((await(await f.get('access',legacy)).json()).kind,'judge');
 f.advance(61000);await f.challenge(a.email);await out(second,true);for(const cookie of [first,second,legacy])assert.equal((await(await f.get('access',cookie)).json()).kind,'public');assert.equal((await(await f.get('access',other)).json()).kind,'judge');assert.equal(f.db.prepare('SELECT 1 FROM login_challenges').get(),undefined);
 f.advance(3600001);c=await f.challenge(a.email);const fresh=f.cookie(await f.verify(a.email,c),'kai_session');assert.deepEqual(await(await f.get('connect',fresh)).json(),connection);
 const raw=f.db.prepare('SELECT upload_token,mcp_token FROM workspaces WHERE id=?').get(a.id) as {upload_token:string;mcp_token:string};assert.ok(connection.uploadPath.includes(raw.upload_token));assert.ok(connection.mcpPath.includes(raw.mcp_token));
 await out(other,false);assert.equal((await(await f.get('access',other)).json()).kind,'public');assert.equal((await(await f.get('access',fresh)).json()).kind,'judge');
}));
