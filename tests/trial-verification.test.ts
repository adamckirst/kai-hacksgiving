import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {openDatabase,seed} from '../src/server/db';
import {createApp} from '../src/server/app';
import {createJudge} from '../src/server/access';
import {normalizeIp} from '../src/server/trial';
import {reserveReading} from '../src/server/reading';
const address=()=>randomUUID()+'@example.invalid';
test('verification gates grants, protects codes, bounds attempts and prevents email/IP reuse',async()=>{
 const db=openDatabase();seed(db);let now=Date.now(),fail=false,sends=0;const codes=new Map<string,string>();
 const app=createApp(db,{secureCookies:false,trustFlyProxy:true,now:()=>now,sendCode:async(email,code)=>{sends++;if(fail)throw new Error();codes.set(email,code)}});
 const server=app.listen(18574,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const base='http://127.0.0.1:18574';
 const post=(route:string,body:unknown,ip='192.0.2.1',cookie='')=>fetch(base+'/api/trial/'+route,{method:'POST',headers:{'Content-Type':'application/json','Fly-Client-IP':ip,Cookie:cookie},body:JSON.stringify(body)});
 const count=()=>(db.prepare('SELECT count(*) n FROM waitlist WHERE verified_at IS NOT NULL').get() as {n:number}).n;
 try {
  const email=address();assert.equal((await post('code',{email})).status,200);assert.equal(count(),0);
  const wrong=String((Number(codes.get(email))+1)%1000000).padStart(6,'0');
  assert.equal((await post('verify',{email,code:wrong})).status,409);assert.equal(count(),0);
  const good=await post('verify',{email,code:codes.get(email)});assert.equal(good.status,200);assert.equal(count(),1);
  const cookie=good.headers.get('set-cookie')!.split(';')[0];
  assert.equal((await post('verify',{email,code:codes.get(email)})).status,409);
  const home=await(await fetch(base+'/api/home',{headers:{Cookie:cookie}})).json();assert.equal(home.trialSeconds,3600);assert.equal(home.peopleCount,0);assert.equal(home.trialVerified,true);
  const another=address();assert.equal((await post('code',{email:another})).status,200);assert.ok(!codes.has(another));assert.equal(count(),1);
  assert.equal((await post('code',{email},'192.0.2.2')).status,429);now+=61000;
  assert.equal((await post('code',{email},'192.0.2.2')).status,200);assert.equal(sends,1);
  const expired=address();await post('code',{email:expired},'192.0.2.3');now+=600001;
  assert.equal((await post('verify',{email:expired,code:codes.get(expired)},'192.0.2.3')).status,409);
  const guessed=address();await post('code',{email:guessed},'192.0.2.4');
  const bad=String((Number(codes.get(guessed))+1)%1000000).padStart(6,'0');
  for(let n=0;n<5;n++)assert.equal((await post('verify',{email:guessed,code:bad},'192.0.2.4')).status,409);
  assert.equal((await post('verify',{email:guessed,code:codes.get(guessed)},'192.0.2.4')).status,409);
  fail=true;const failed=address();assert.equal((await post('code',{email:failed},'192.0.2.5')).status,503);assert.ok(!db.prepare('SELECT 1 FROM trial_challenges WHERE email=?').get(failed));fail=false;
  const challenged=db.prepare('SELECT code_hash FROM trial_challenges WHERE email=?').get(guessed) as {code_hash:string};assert.ok(challenged.code_hash.length===64 && challenged.code_hash!==codes.get(guessed));
  assert.equal(normalizeIp('::ffff:192.0.2.1'),normalizeIp('192.0.2.1'));assert.equal(normalizeIp('2001:0db8:0:0::1'),normalizeIp('2001:db8::1'));
  assert.equal(count(),1);
 }finally{await app.locals.queue.stop();await new Promise<void>(r=>server.close(()=>r()));db.close()}
});

test('100th grant is atomic, existing unverified notebooks keep their remaining quota',async()=>{
 const db=openDatabase();seed(db);const legacy=createJudge(db,false);const legacyEmail=address();
 db.prepare('UPDATE workspaces SET trial_seconds=123 WHERE id=?').run(legacy.id);
 db.prepare('INSERT INTO waitlist(email,created_at,workspace_id) VALUES (?,?,?)').run(legacyEmail,new Date().toISOString(),legacy.id);
 assert.throws(()=>reserveReading(db,legacy.id),/Verify your email/);
 const codes=new Map<string,string>();const app=createApp(db,{secureCookies:false,trustFlyProxy:true,sendCode:async(email,code)=>{codes.set(email,code)}});
 const server=app.listen(18575,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const base='http://127.0.0.1:18575';
 const post=(route:string,body:unknown,ip:string,cookie='')=>fetch(base+'/api/trial/'+route,{method:'POST',headers:{'Content-Type':'application/json','Fly-Client-IP':ip,Cookie:cookie},body:JSON.stringify(body)});
 try {
  await post('code',{email:legacyEmail},'192.0.2.10');
  assert.equal((await post('verify',{email:legacyEmail,code:codes.get(legacyEmail)},'192.0.2.10','kai_session='+legacy.cookie)).status,200);
  assert.equal((db.prepare('SELECT trial_seconds FROM workspaces WHERE id=?').get(legacy.id) as {trial_seconds:number}).trial_seconds,123);
  reserveReading(db,legacy.id);
  const insert=db.prepare('INSERT INTO waitlist(email,created_at,verified_at) VALUES (?,?,?)');for(let i=0;i<98;i++)insert.run(address(),new Date().toISOString(),new Date().toISOString());
  const first=address(),second=address();await post('code',{email:first},'192.0.2.11');await post('code',{email:second},'192.0.2.12');
  const results=await Promise.all([post('verify',{email:first,code:codes.get(first)},'192.0.2.11'),post('verify',{email:second,code:codes.get(second)},'192.0.2.12')]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
  assert.equal((db.prepare('SELECT count(*) n FROM waitlist WHERE verified_at IS NOT NULL').get() as {n:number}).n,100);
  const reopened=openDatabase(db.serialize());assert.equal((reopened.prepare('SELECT count(*) n FROM waitlist WHERE verified_at IS NOT NULL').get() as {n:number}).n,100);reopened.close();
 }finally{await app.locals.queue.stop();await new Promise<void>(r=>server.close(()=>r()));db.close()}
});
