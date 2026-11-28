import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {openDatabase,seed} from '../src/server/db';
import {createApp} from '../src/server/app';
import {createJudge} from '../src/server/access';
import {TERMS_VERSION} from '../src/terms';
const email=()=>randomUUID()+'@example.invalid';
async function fixture(run:(f:Awaited<ReturnType<typeof setup>>)=>Promise<void>){const f=await setup();try{await run(f)}finally{await f.close()}}
async function setup(){
 let db=openDatabase();seed(db);let now=Date.now(),fail=false;const codes=new Map<string,string>();
 const options={secureCookies:false,trustSpriteProxy:true,trialsPaused:false,now:()=>now,sendLogin:async()=>{},sendCode:async(address:string,code:string)=>{if(fail)throw Error('Fake delivery failure');codes.set(address,code)}};
 let app=createApp(db,options),server=app.listen(18740,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
 const post=(path:string,body:object={},cookie='',ip='192.0.2.170',origin?:string)=>fetch('http://127.0.0.1:18740/api/'+path,{method:'POST',headers:{Connection:'close','Content-Type':'application/json',Cookie:cookie,'Sprite-Client-IP':ip,...origin?{Origin:origin}:{}},body:JSON.stringify(body)});
 const cookie=(r:Response,name='kai_entry')=>r.headers.getSetCookie().find(c=>c.startsWith(name+'='))?.split(';')[0]??'';
 function owner(terms:string|null=TERMS_VERSION,verified=true){const judge=createJudge(db,false),address=email();db.prepare('UPDATE workspaces SET trial_seconds=123,trial_verified=? WHERE id=?').run(Number(verified),judge.id);db.prepare('INSERT INTO waitlist(email,created_at,workspace_id,verified_at,trial_ip,terms_version,terms_accepted_at) VALUES (?,?,?,?,?,?,?)').run(address,'2026-11-27',judge.id,verified?'2026-11-27':null,verified?randomUUID():null,terms,'2026-11-26T12:00:00Z');return {...judge,email:address}}
 const request=async(address:string,ip='192.0.2.170',session='')=>{const r=await post('entry/code',{email:address},session,ip);assert.equal(r.status,200);assert.deepEqual(await r.json(),{ok:true});return {email:address.trim().toLowerCase(),code:codes.get(address.trim().toLowerCase())!,cookie:[session,cookie(r)].filter(Boolean).join('; '),ip}};
 const verify=(c:Awaited<ReturnType<typeof request>>,ip=c.ip)=>post('entry/verify',{email:c.email,code:c.code},c.cookie,ip);
 const agree=(c:Awaited<ReturnType<typeof request>>,ip=c.ip)=>post('entry/agree',{termsVersion:TERMS_VERSION},c.cookie,ip);
 const close=async()=>{await app.locals.queue.stop();await new Promise<void>(r=>server.close(()=>r()));db.close()};
 return {get db(){return db},post,cookie,owner,request,verify,agree,codes,options,advance:(ms:number)=>{now+=ms},fail:()=>{fail=true},close,
  restart:async()=>{const data=db.serialize();await close();db=openDatabase(data);app=createApp(db,options);server=app.listen(18740,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r))}};
}
test('one entry is generic before proof; returning owners keep notebook, quota and agreement even at the grant cap',()=>fixture(async f=>{
 const a=f.owner(),b=f.owner();f.db.prepare('INSERT INTO people VALUES (?,?,?,?,?)').run('entry-dana',a.id,'Dana Whitfield','Loomwork','Founder');
 for(let i=0;i<98;i++)f.db.prepare('INSERT INTO waitlist(email,created_at,verified_at) VALUES (?,?,?)').run(email(),'2026-11-27','2026-11-27');
 const snapshot=()=>({workspaces:f.db.prepare('SELECT id,trial_seconds,trial_verified FROM workspaces ORDER BY id').all(),waitlist:f.db.prepare('SELECT * FROM waitlist ORDER BY email').all(),people:f.db.prepare('SELECT * FROM people').all()});const before=snapshot();
 const known=await f.request(' '+a.email.toUpperCase()+' '),unknown=await f.request(email(),'198.51.100.21');
 assert.equal(f.codes.size,2);assert.equal((await f.post('entry/agree',{termsVersion:TERMS_VERSION},known.cookie)).status,409);
 const r=await f.verify(known,'203.0.113.55');assert.equal(r.status,200);assert.deepEqual(await r.json(),{next:'notebook',onboarding:false});assert.deepEqual(snapshot(),before);
 const session=f.cookie(r,'kai_session');assert.ok(session.startsWith('kai_session=s.'));
 const people=await(await fetch('http://127.0.0.1:18740/api/people',{headers:{Connection:'close',Cookie:session}})).text();assert.ok(people.includes('Dana Whitfield'));assert.ok(!people.includes(a.email));
 assert.equal((await f.verify(known)).status,409);assert.equal((await f.verify(unknown)).status,409);
 assert.equal((await f.post('entry/code',{email:b.email},session)).status,409);
 assert.equal((await f.post('entry/code',{email:a.email},'','192.0.2.172','https://wrong.invalid')).status,403);
}));
test('new users verify first, consent is browser-bound and single-use, and pending proof survives restart',()=>fixture(async f=>{
 const count=()=>({w:f.db.prepare('SELECT count(*) n FROM workspaces').get(),s:f.db.prepare('SELECT count(*) n FROM waitlist').get()});const before=count();
 const c=await f.request(email());assert.equal((await f.agree(c)).status,409);
 assert.deepEqual(await(await f.verify(c)).json(),{next:'terms',audience:'new'});assert.deepEqual(count(),before);
 assert.equal((f.db.prepare('SELECT code_hash FROM entry_challenges').get() as {code_hash:string}).code_hash,'');
 assert.equal((await f.verify(c)).status,409);assert.equal((await f.post('entry/agree',{termsVersion:TERMS_VERSION})).status,409);
 assert.equal((await f.post('entry/agree',{termsVersion:'old'},c.cookie)).status,400);
 await f.restart();assert.deepEqual(count(),before);
 const results=await Promise.all([f.agree(c),f.agree(c)]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
 const row=f.db.prepare('SELECT workspace_id,terms_version,terms_accepted_at FROM waitlist WHERE email=?').get(c.email) as {workspace_id:string;terms_version:string;terms_accepted_at:string};assert.equal(row.terms_version,TERMS_VERSION);assert.ok(row.terms_accepted_at);
 assert.deepEqual(f.db.prepare('SELECT trial_seconds,trial_verified FROM workspaces WHERE id=?').get(row.workspace_id),{trial_seconds:1800,trial_verified:1});
 assert.equal((f.db.prepare('SELECT count(*) n FROM entry_challenges').get() as {n:number}).n,0);
 const second=await f.request(email(),'192.0.2.171');await f.verify(second);await f.post('entry/cancel',{},second.cookie);assert.equal((await f.agree(second)).status,409);assert.equal((f.db.prepare('SELECT count(*) n FROM waitlist').get() as {n:number}).n,1);
}));
test('outdated terms require explicit post-proof agreement without refilling, and a current agreement is never rewritten',()=>fixture(async f=>{
 const a=f.owner('older-version'),c=await f.request(a.email);const before=f.db.prepare('SELECT terms_version,terms_accepted_at FROM waitlist WHERE email=?').get(a.email);
 const r=await f.verify(c);assert.deepEqual(await r.json(),{next:'terms',audience:'returning'});assert.equal(f.cookie(r,'kai_session'),'');assert.deepEqual(f.db.prepare('SELECT terms_version,terms_accepted_at FROM waitlist WHERE email=?').get(a.email),before);
 assert.equal((await f.agree(c)).status,200);const accepted=f.db.prepare('SELECT terms_version,terms_accepted_at FROM waitlist WHERE email=?').get(a.email);assert.equal((accepted as {terms_version:string}).terms_version,TERMS_VERSION);
 f.advance(61000);const again=await f.request(a.email);assert.deepEqual(await(await f.verify(again)).json(),{next:'notebook',onboarding:false});assert.deepEqual(f.db.prepare('SELECT terms_version,terms_accepted_at FROM waitlist WHERE email=?').get(a.email),accepted);assert.equal((f.db.prepare('SELECT trial_seconds FROM workspaces WHERE id=?').get(a.id) as {trial_seconds:number}).trial_seconds,123);
}));
test('a missing acceptance timestamp requires consent, and paused trials still allow existing recovery',()=>fixture(async f=>{
 const owner=f.owner();f.db.prepare('UPDATE waitlist SET terms_accepted_at=NULL WHERE email=?').run(owner.email);f.options.trialsPaused=true;
 const known=await f.request(owner.email),unknown=await f.request(email(),'192.0.2.171');
 assert.deepEqual(await(await f.verify(known)).json(),{next:'terms',audience:'returning'});assert.equal((await f.verify(unknown)).status,409);assert.equal((await f.agree(known)).status,200);
 assert.equal((f.db.prepare('SELECT trial_seconds FROM workspaces WHERE id=?').get(owner.id) as {trial_seconds:number}).trial_seconds,123);
}));
test('wrong, expired, cross-flow and other-browser codes fail; cancellation and revocation remove proof',()=>fixture(async f=>{
 const a=f.owner();let c=await f.request(a.email);const stored=f.db.prepare('SELECT code_hash,browser_hash FROM entry_challenges').get() as {code_hash:string;browser_hash:string};assert.equal(stored.code_hash.length,64);assert.equal(stored.browser_hash.length,64);assert.ok(!c.cookie.includes(stored.browser_hash));
 assert.equal((await f.post('entry/verify',{email:c.email,code:c.code})).status,409);assert.equal((f.db.prepare('SELECT attempts FROM entry_challenges').get() as {attempts:number}).attempts,0);
 const wrong=String((Number(c.code)+1)%1000000).padStart(6,'0');for(let n=0;n<5;n++)assert.equal((await f.post('entry/verify',{email:c.email,code:wrong},c.cookie)).status,409);assert.equal((await f.verify(c)).status,409);
 f.advance(61000);c=await f.request(a.email);assert.equal((await f.post('login/verify',{email:c.email,code:c.code,termsVersion:TERMS_VERSION},c.cookie)).status,409);assert.equal((await f.post('trial/verify',{email:c.email,code:c.code,termsVersion:TERMS_VERSION},c.cookie)).status,409);
 f.advance(600001);assert.equal((await f.verify(c)).status,409);
 c=await f.request(a.email);await f.post('login/sign-out',{everywhere:true},'kai_session='+a.cookie);assert.equal((await f.verify(c)).status,409);
 f.advance(61000);const fresh=await f.request(email(),'192.0.2.199');await f.verify(fresh);f.advance(600001);assert.equal((await f.agree(fresh)).status,409);
}));
test('grant caps and shared-network claims are checked atomically after proof, while requests stay generic',()=>fixture(async f=>{
 for(let i=0;i<99;i++)f.db.prepare('INSERT INTO waitlist(email,created_at,verified_at,trial_ip) VALUES (?,?,?,?)').run(email(),'2026-11-27','2026-11-27',randomUUID());
 const a=await f.request(email(),'192.0.2.180'),b=await f.request(email(),'192.0.2.181');assert.equal((await f.verify(a)).status,200);assert.equal((await f.verify(b)).status,200);
 const results=await Promise.all([f.agree(a),f.agree(b)]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);assert.equal((f.db.prepare('SELECT count(*) n FROM waitlist WHERE verified_at IS NOT NULL').get() as {n:number}).n,100);
 const c=await f.request(email(),'192.0.2.182');assert.equal((await f.verify(c)).status,409);
}));
test('one IP cannot gain two grants; changed networks and legacy notebooks cannot be silently reassigned',()=>fixture(async f=>{
 const a=await f.request(email()),b=await f.request(email());await f.verify(a);await f.verify(b);assert.equal((await f.agree(a)).status,200);assert.equal((await f.agree(b)).status,409);
 const moved=await f.request(email(),'192.0.2.183');assert.equal((await f.verify(moved,'192.0.2.184')).status,409);
 const old=f.owner(null,false);const outside=await f.request(old.email,'192.0.2.185');assert.equal((await f.verify(outside)).status,409);
 f.advance(61000);const original=await f.request(old.email,'192.0.2.185','kai_session='+old.cookie);assert.deepEqual(await(await f.verify(original)).json(),{next:'terms',audience:'new'});assert.equal((await f.agree(original)).status,200);assert.equal((f.db.prepare('SELECT trial_seconds FROM workspaces WHERE id=?').get(old.id) as {trial_seconds:number}).trial_seconds,123);
}));
test('entry shares resend, IP and overall send caps; delivery failure does not disclose membership or grant access',()=>fixture(async f=>{
 const address=email();const c=await f.request(address);assert.equal((await f.post('entry/code',{email:address})).status,429);assert.equal((await f.post('trial/code',{email:address,termsVersion:TERMS_VERSION})).status,429);
 await f.request(email());await f.request(email());assert.equal((await f.post('entry/code',{email:email()})).status,429);
 f.fail();const known=f.owner(),failed=await f.request(known.email,'198.51.100.1');assert.equal((await f.verify({...failed,code:'000000'})).status,409);
 const missing=await f.request(email(),'198.51.100.2');assert.equal((await f.verify({...missing,code:'000000'})).status,409);
 const sent=(f.db.prepare('SELECT count(*) n FROM trial_sends').get() as {n:number}).n;
 for(let i=sent;i<100;i++)f.db.prepare('INSERT INTO trial_sends VALUES (?,?,?,?)').run(randomUUID(),randomUUID(),randomUUID(),Date.now());
 assert.equal((await f.post('entry/code',{email:email()},'','198.51.100.3')).status,429);assert.equal((await f.post('login/code',{email:known.email,termsVersion:TERMS_VERSION},'','198.51.100.3')).status,429);
 assert.equal((await f.agree(c)).status,409);
}));
