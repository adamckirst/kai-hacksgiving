import {onboardingState} from './onboarding';
import {trialGrantCount,trialAlreadyClaimed} from './account';
import express,{type Express,type Request} from 'express';
import {createHmac,randomBytes,randomInt,randomUUID} from 'node:crypto';
import {z} from 'zod';
import {TERMS_VERSION} from '../terms';
import {cookieName,workspaceFor,equalSecret,createBrowserSession,createJudge} from './access';
import {persistentJudgeSecret} from './config';
import {normalizeIp,type TrialOptions} from './trial';
import type {KaiDatabase} from './db';
export const entryCookie='kai_entry';
const hour=3600000;
const emailSchema=z.string().trim().max(254).email().transform(s=>s.toLowerCase());
const requestSchema=z.object({email:emailSchema}).strict();
const verifySchema=requestSchema.extend({code:z.string().regex(/^\d{6}$/)});
type Challenge={email:string;id:string;ip_hash:string;browser_hash:string;origin_workspace:string;code_hash:string;expires_at:number;attempts:number;delivered:number;verified:number};
type Result={error:string}|{next:'terms';audience:'new'|'returning'}|{session:string;onboarding:boolean};
export function mountEmailEntry(app:Express,db:KaiDatabase,options:TrialOptions) {
 const now=options.now??Date.now,secret=persistentJudgeSecret(db);
 const digest=(kind:string,value:string)=>createHmac('sha256',secret).update(kind+':'+value).digest('hex');
 const cookies={httpOnly:true,secure:options.secureCookies??true,sameSite:'strict' as const,path:'/'};
 const proof=(req:Request)=>req.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith(entryCookie+'='))?.slice(entryCookie.length+1)??'';
 function network(req:Request){const value=normalizeIp((options.trustSpriteProxy?req.get('sprite-client-ip'):req.socket.remoteAddress)??'');return value?digest('ip',value):null}
 function allowed(workspace:string){if(workspace==='public')return true;return Boolean(db.prepare('SELECT 1 FROM workspaces WHERE id=? AND trial_seconds IS NOT NULL AND trial_verified=0').get(workspace))}
 function currentProof(req:Request,row:Challenge|undefined){return row && row.expires_at>now() && row.delivered && equalSecret(row.browser_hash,digest('entry-browser',proof(req))) && row.origin_workspace===workspaceFor(db,req)}
 function finish(row:Challenge,req:Request,agree:boolean):Result {
  const current=workspaceFor(db,req),at=now();
  const entry=db.prepare('SELECT workspace_id,verified_at,terms_version,terms_accepted_at FROM waitlist WHERE email=?').get(row.email) as {workspace_id:string|null;verified_at:string|null;terms_version:string|null;terms_accepted_at:string|null}|undefined;
  const owner=entry?.verified_at && entry.workspace_id && db.prepare("SELECT 1 FROM workspaces WHERE id=? AND kind='judge' AND trial_verified=1").get(entry.workspace_id);
  let workspace:string;
  if(owner){
   if(current!=='public')return {error:'Sign out of this browser before opening another notebook.'};
   const needsAgreement=entry!.terms_version!==TERMS_VERSION || !entry!.terms_accepted_at;
   if(needsAgreement && !agree)return {next:'terms',audience:'returning'};
   workspace=entry!.workspace_id!;
   // Current agreements are preserved, including their original acceptance time.
   if(needsAgreement)db.prepare('UPDATE waitlist SET terms_version=?,terms_accepted_at=? WHERE email=?').run(TERMS_VERSION,new Date(at).toISOString(),row.email);
  }else{
   if(entry?.workspace_id && entry.workspace_id!==current)return {error:'Return to the browser where you started this notebook to verify it.'};
   if(current!=='public' && (!allowed(current) || entry?.workspace_id!==current))return {error:'Sign out of this browser before opening another notebook.'};
   if(options.trialsPaused)return {error:'New trials are paused. You can still join the waitlist.'};
   if(network(req)!==row.ip_hash)return {error:'Return to the network where you requested this code, or request a new code.'};
   if(trialGrantCount(db)>=100)return {error:'All 100 trials have been claimed. You can still join the waitlist.'};
   if(trialAlreadyClaimed(db,row.email,row.ip_hash))return {error:'A trial has already been claimed for this email or network. Deleting a notebook does not start another trial. You can still look around.'};
   if(!entry && (db.prepare('SELECT count(*) n FROM waitlist').get() as {n:number}).n>=2000)return {error:'The waitlist is full.'};
   if(!agree)return {next:'terms',audience:'new'};
   workspace=current==='public'?createJudge(db,false).id:current;
   db.prepare('UPDATE workspaces SET trial_seconds=coalesce(trial_seconds,1800),trial_verified=1 WHERE id=?').run(workspace);
   db.prepare('INSERT INTO waitlist(email,created_at,workspace_id,verified_at,trial_ip,terms_version,terms_accepted_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET workspace_id=excluded.workspace_id,verified_at=excluded.verified_at,trial_ip=excluded.trial_ip,terms_version=excluded.terms_version,terms_accepted_at=excluded.terms_accepted_at').run(row.email,new Date(at).toISOString(),workspace,new Date(at).toISOString(),row.ip_hash,TERMS_VERSION,new Date(at).toISOString());
  }
  const session=createBrowserSession(db,workspace,at);
  db.prepare('DELETE FROM entry_challenges WHERE id=?').run(row.id);
  return {session,onboarding:!owner && onboardingState(db,workspace).needsShortcut};
 }
 app.use('/api/entry',express.json({limit:'1kb'}),(req,res,next)=>{
  const origin=req.get('origin');if(origin && origin!==`${options.secureCookies===false?req.protocol:'https'}://${req.get('host')}`){res.status(403).json({error:'This request is not allowed.'});return;}next();
 });
 app.post('/api/entry/code',async(req,res)=>{
  const parsed=requestSchema.safeParse(req.body);
  if(!parsed.success){res.status(400).json({error:'Enter a valid email.'});return;}
  const current=workspaceFor(db,req);
  if(!allowed(current)){res.status(409).json({error:'Sign out of this browser before opening another notebook.'});return;}
  if(!options.sendCode){res.status(503).json({error:'Verification emails are unavailable. Please try again later.'});return;}
  const ipHash=network(req);if(!ipHash){res.status(503).json({error:'We could not check this connection. Please try again later.'});return;}
  const {email}=parsed.data,at=now(),code=String(randomInt(0,1000000)).padStart(6,'0'),id=randomUUID(),browser=randomBytes(32).toString('hex');
  const accepted=db.transaction(()=>{
   db.prepare('DELETE FROM trial_sends WHERE sent_at<=?').run(at-24*hour);
   db.prepare('DELETE FROM entry_challenges WHERE expires_at<=?').run(at);
   const emailHash=digest('email',email);
   const recent=db.prepare('SELECT count(*) n FROM trial_sends WHERE ip_hash=? AND sent_at>?').get(ipHash,at-hour) as {n:number};
   const total=db.prepare('SELECT (SELECT count(*) FROM trial_sends)+(SELECT count(*) FROM notification_sends WHERE sent_at>?) n').get(at-24*hour) as {n:number};
   const latest=db.prepare('SELECT sent_at FROM trial_sends WHERE email_hash=? ORDER BY sent_at DESC LIMIT 1').get(emailHash) as {sent_at:number}|undefined;
   const count=db.prepare('SELECT count(*) n FROM entry_challenges WHERE email!=?').get(email) as {n:number};
   if(recent.n>=3 || total.n>=100 || count.n>=100 || (latest && latest.sent_at>at-60000))return false;
   db.prepare('INSERT INTO trial_sends VALUES (?,?,?,?)').run(id,ipHash,emailHash,at);
   db.prepare('INSERT INTO entry_challenges(email,id,ip_hash,browser_hash,origin_workspace,code_hash,expires_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET id=excluded.id,ip_hash=excluded.ip_hash,browser_hash=excluded.browser_hash,origin_workspace=excluded.origin_workspace,code_hash=excluded.code_hash,expires_at=excluded.expires_at,attempts=0,delivered=0,verified=0').run(email,id,ipHash,digest('entry-browser',browser),current,digest('entry-code',id+':'+code),at+600000);
   return true;
  })();
  if(!accepted){res.status(429).json({error:'Please wait before asking for another code.'});return;}
  res.cookie(entryCookie,browser,{...cookies,maxAge:600000});
  // Every address uses the same sender and reply. Ownership is resolved only after proof.
  try{await options.sendCode(email,code,'entry-'+id);db.prepare('UPDATE entry_challenges SET delivered=1 WHERE email=? AND id=?').run(email,id);}
  catch{db.prepare('DELETE FROM entry_challenges WHERE email=? AND id=?').run(email,id);}
  res.json({ok:true});
 });
 app.post('/api/entry/verify',(req,res)=>{
  const parsed=verifySchema.safeParse(req.body);if(!parsed.success){res.status(400).json({error:'Check the email and six-digit code.'});return;}
  const result=db.transaction(()=>{
   const row=db.prepare('SELECT * FROM entry_challenges WHERE email=?').get(parsed.data.email) as Challenge|undefined;
   if(!currentProof(req,row) || row!.verified || row!.attempts>=5)return {error:'This code expired or could not be checked. Ask for a new code.'};
   db.prepare('UPDATE entry_challenges SET attempts=attempts+1 WHERE email=?').run(row!.email);
   if(!equalSecret(row!.code_hash,digest('entry-code',row!.id+':'+parsed.data.code)))return {error:'This code expired or could not be checked. Ask for a new code.'};
   db.prepare("UPDATE entry_challenges SET verified=1,code_hash='' WHERE id=?").run(row!.id);
   return finish(row!,req,false);
  })();
  if('error' in result){res.status(409).json(result);return;}
  if('session' in result){res.cookie(cookieName,result.session,{...cookies,maxAge:14*24*hour});res.clearCookie(entryCookie,cookies);res.json({next:'notebook',onboarding:result.onboarding});return;}
  res.json(result);
 });
 app.post('/api/entry/agree',(req,res)=>{
  if(!z.object({termsVersion:z.literal(TERMS_VERSION)}).strict().safeParse(req.body).success){res.status(400).json({error:'Agree to the current demo terms to continue.'});return;}
  const result=db.transaction(()=>{
   const row=db.prepare('SELECT * FROM entry_challenges WHERE browser_hash=?').get(digest('entry-browser',proof(req))) as Challenge|undefined;
   if(!currentProof(req,row) || !row!.verified)return {error:'Your verification expired. Ask for a new code.'};
   return finish(row!,req,true);
  })();
  if('error' in result){res.status(409).json(result);return;}
  if('session' in result){res.cookie(cookieName,result.session,{...cookies,maxAge:14*24*hour});res.clearCookie(entryCookie,cookies);res.json({next:'notebook',onboarding:result.onboarding});return;}
  res.status(409).json({error:'Verify your email again to continue.'});
 });
 app.post('/api/entry/cancel',(req,res)=>{db.prepare('DELETE FROM entry_challenges WHERE browser_hash=?').run(digest('entry-browser',proof(req)));res.clearCookie(entryCookie,cookies);res.json({ok:true});});
}
