import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdirSync,mkdtempSync,rmSync,readFileSync,existsSync,writeFileSync,chmodSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {openDatabase,seed} from '../src/server/db';
import {createApp} from '../src/server/app';
import {initializePersonal,personalInstance} from '../src/server/personal';
import {createJudge} from '../src/server/access';
import {TERMS_VERSION} from '../src/terms';
import {recordingMailWorker} from '../src/server/recording-mail';
import {reserveRecording} from '../src/server/reading';
import {configurePersonal} from '../scripts/init-personal';
const email=()=>randomUUID()+'@example.invalid';
test('personal setup requires its private capability and email, claims only one empty owner, and survives restart',async()=>{
 const db=openDatabase();seed(db,new Date(),'public',false);const capability=initializePersonal(db);const codes=new Map<string,string>();let now=Date.now();
 const app=createApp(db,{secureCookies:false,trustSpriteProxy:true,now:()=>now,sendLogin:async(email,code)=>{codes.set(email,code)}});const server=app.listen(18735,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const base='http://127.0.0.1:18735';
 const cookie=(r:Response,name:string)=>r.headers.getSetCookie().find(c=>c.startsWith(name+'='))?.split(';')[0]??'';
 const post=(path:string,body:object,cookie='',ip='192.0.2.210')=>fetch(base+'/api/'+path,{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie,'Sprite-Client-IP':ip},body:JSON.stringify(body)});
 const get=(path:string,cookie='')=>fetch(base+'/api/'+path,{headers:{Cookie:cookie}});
 try{
  assert.equal((await get('access')).status,200);assert.equal((await(await get('access')).json()).personal,true);
  for(const route of ['home','people','todos','connect','library'])assert.equal((await get(route)).status,401);
  for(const route of ['trial/code','waitlist','access/start'])assert.equal((await post(route,{})).status,404);
  const owner=email(),other=email();const request={email:owner,termsVersion:TERMS_VERSION};
  assert.equal((await post('setup/code',request)).status,403);assert.equal((await post('setup/start',{setup:'wrong'})).status,403);
  const opened=await post('setup/start',{setup:capability});assert.equal(opened.status,200);const setup=cookie(opened,'kai_setup');assert.ok(setup);assert.equal((await(await get('setup/session',setup)).json()).ready,true);
  const challenge=await post('setup/code',request,setup);assert.equal(challenge.status,200);assert.ok(codes.has(owner));const proof=cookie(challenge,'kai_login');
  const challengeOther=await post('setup/code',{...request,email:other},setup);const otherProof=cookie(challengeOther,'kai_login');
  assert.equal((await post('setup/verify',{...request,code:codes.get(owner)},proof)).status,403);
  assert.equal((await post('login/verify',{...request,code:codes.get(owner)},proof)).status,409);
  const wrong=String((Number(codes.get(owner))+1)%1000000).padStart(6,'0');assert.equal((await post('setup/verify',{...request,code:wrong},setup+'; '+proof)).status,409);assert.equal(personalInstance(db)?.verified_at,null);
  const results=await Promise.all([post('setup/verify',{...request,code:codes.get(owner)},setup+'; '+proof),post('setup/verify',{...request,email:other,code:codes.get(other)},setup+'; '+otherProof)]);assert.deepEqual(results.map(r=>r.status),[200,403]);
  const session=cookie(results[0],'kai_session'),state=personalInstance(db)!;assert.equal(state.email,owner);assert.equal(state.setup_hash,null);
  const home=await(await get('home',session)).json();assert.equal(home.peopleCount,0);assert.equal(home.trialSeconds,null);assert.equal(home.trialVerified,true);
  assert.equal((db.prepare('SELECT count(*) n FROM waitlist').get() as {n:number}).n,0);assert.equal((db.prepare('SELECT count(*) n FROM people').get() as {n:number}).n,0);
  for(const route of ['home','people','todos','connect','library','access','login/session'])assert.ok(!(await(await get(route,session)).text()).includes(owner));
  assert.equal((await post('setup/start',{setup:capability})).status,403);assert.equal((await post('setup/code',request,setup)).status,403);
  now+=3600001;const login=await post('login/code',request,'','198.51.100.9');assert.equal(login.status,200);assert.equal((await post('login/verify',{...request,code:codes.get(owner)},cookie(login,'kai_login'))).status,200);
  const before=codes.get(other);await post('login/code',{...request,email:other},'','198.51.100.10');assert.equal(codes.get(other),before);assert.equal((await post('login/verify',{...request,email:other,code:before},otherProof)).status,409);
  const restored=openDatabase(db.serialize());try{assert.equal(personalInstance(restored)?.email,owner);assert.equal(personalInstance(restored)?.setup_hash,null);assert.throws(()=>initializePersonal(restored),/fresh database/)}finally{restored.close()}
  for(let n=0;n<10;n++)reserveRecording(db,state.workspace_id);assert.throws(()=>reserveRecording(db,state.workspace_id));
  const id=randomUUID();db.prepare("INSERT INTO conversations(id,workspace_id,title,summary,source,text,happened_on,status,notify_ready,transcribed) VALUES (?,?,?,?,?,?,?,'ready',1,1)").run(id,state.workspace_id,'An invented meeting','Made-up summary.','recording','Invented words.','2026-11-27');
  const deliveries:string[]=[];const mail=recordingMailWorker(db,async(recipient)=>{deliveries.push(recipient)});try{await mail.kick();assert.deepEqual(deliveries,[owner]);await mail.kick();assert.equal(deliveries.length,1)}finally{await mail.stop()}
 }finally{await app.locals.queue.stop();await new Promise<void>(r=>server.close(()=>r()));db.close()}
});
test('operator configuration starts empty, preserves ownership and rejects existing demo state or changed origin',()=>{
 mkdirSync('.data',{recursive:true});const dir=mkdtempSync('.data/personal-config-');const state=resolve(dir,'state');
 try{
  const link=configurePersonal(state,'https://invented-owner.sprites.app','sender@example.invalid');assert.ok(link?.startsWith('https://invented-owner.sprites.app/setup#setup='));assert.equal(existsSync(state+'/personal-instance'),true);
  const db=openDatabase(state+'/kai.sqlite');try{assert.equal((db.prepare('SELECT count(*) n FROM people').get() as {n:number}).n,0);assert.ok(!readFileSync(state+'/kai.sqlite').includes(Buffer.from(link!.split('setup=')[1])))}finally{db.close()}
  assert.equal(configurePersonal(state,'https://invented-owner.sprites.app','sender@example.invalid'),null);
  assert.throws(()=>configurePersonal(state,'https://different.sprites.app','sender@example.invalid'),/differs/);
  assert.throws(()=>configurePersonal(state,'http://invented-owner.sprites.app','sender@example.invalid'));
  const demo=resolve(dir,'demo');mkdirSync(demo);const shared=openDatabase(demo+'/kai.sqlite');seed(shared);createJudge(shared);shared.close();const before=readFileSync(demo+'/kai.sqlite');assert.throws(()=>configurePersonal(demo,'https://invented-owner.sprites.app','sender@example.invalid'),/Refusing/);assert.deepEqual(readFileSync(demo+'/kai.sqlite'),before);
 }finally{rmSync(dir,{recursive:true,force:true})}
});
test('deployment selects explicit owner target and commit without creating resources or exposing setup output',()=>{
 mkdirSync('.data',{recursive:true});const dir=resolve(mkdtempSync('.data/personal-runner-')),log=dir+'/calls';
 try{
  writeFileSync(dir+'/sprite',`#!/usr/bin/env node\nimport fs from 'node:fs';fs.appendFileSync(process.env.KAI_TEST_CALLS,JSON.stringify(process.argv.slice(2))+'\\n');if(process.argv[2]==='exec'){fs.writeFileSync(process.env.KAI_TEST_INPUT,fs.readFileSync(0));}\n`);chmodSync(dir+'/sprite',0o700);
  const env={...process.env,PATH:dir+':'+process.env.PATH,KAI_TEST_CALLS:log,KAI_TEST_INPUT:dir+'/input'},args=['scripts/deploy-personal.sh','invented-org','my-kai','HEAD','https://invented-owner.sprites.app','sender@example.invalid'];
  const r=spawnSync('bash',args,{env,encoding:'utf8'});assert.equal(r.status,0,r.stderr);assert.equal(r.stdout,'');const calls=readFileSync(log,'utf8').trim().split('\n').map(s=>JSON.parse(s) as string[]);assert.equal(calls.length,2);assert.deepEqual(calls[0].slice(0,6),['checkpoint','create','-o','invented-org','-s','my-kai']);assert.deepEqual(calls[1].slice(0,7),['exec','-o','invented-org','-s','my-kai','--no-port-forward','--stdin']);assert.equal(calls[1].at(-2),'https://invented-owner.sprites.app');assert.equal(calls[1].at(-1),'sender@example.invalid');assert.ok(readFileSync(dir+'/input','utf8').includes('scripts/init-personal.ts'));
  const denied=spawnSync('bash',[args[0],args[1],'kai',...args.slice(3)],{env,encoding:'utf8'});assert.equal(denied.status,1);assert.equal(readFileSync(log,'utf8').trim().split('\n').length,2);
  assert.equal(spawnSync('bash',['-n','scripts/deploy-personal-on-sprite.sh'],{encoding:'utf8'}).status,0);
  const guide=readFileSync('SELF_HOST.md','utf8');assert.ok(guide.includes('scripts/deploy-personal.sh MY_ORG MY_SPRITE REVIEWED_COMMIT HTTPS_SPRITE_ORIGIN VERIFIED_FROM_ADDRESS'));assert.ok(guide.includes('set -o noclobber'));assert.ok(guide.includes('automatically moves to Pay As You Go'));assert.ok(guide.includes('private setup link'));assert.ok(guide.includes('You never create/delete'));
 }finally{rmSync(dir,{recursive:true,force:true})}
});
