import {trialGrantCount,trialAlreadyClaimed} from './account';
import {TERMS_VERSION} from '../terms';
import express,{type Express,type Request} from 'express';
import {createHmac,randomInt,randomUUID} from 'node:crypto';
import {isIP} from 'node:net';
import {z} from 'zod';
import type {KaiDatabase} from './db';
import {createJudge,cookieName,workspaceFor,equalSecret} from './access';
import {persistentJudgeSecret} from './config';
export type SendCode=(email:string,code:string,id:string)=>Promise<void>;
export type TrialOptions={secureCookies?:boolean;now?:()=>number;sendCode?:SendCode;trustSpriteProxy?:boolean;trialsPaused?:boolean};
const emailSchema=z.string().trim().max(254).email().transform(s=>s.toLowerCase());
const requestSchema=z.object({email:emailSchema,termsVersion:z.literal(TERMS_VERSION)}).strict();
const verifySchema=z.object({email:emailSchema,code:z.string().regex(/^\d{6}$/),termsVersion:z.literal(TERMS_VERSION)}).strict();
const hour=3600000;
export function normalizeIp(value:string) {
 if(value.startsWith('::ffff:') && isIP(value.slice(7))===4)return value.slice(7);
 if(isIP(value)===4)return value;
 if(isIP(value)===6)return new URL('http://['+value+']/').hostname.slice(1,-1);
 return null;
}
export function mountTrial(app:Express,db:KaiDatabase,options:TrialOptions) {
 const now=options.now??Date.now,secret=persistentJudgeSecret(db);
 const digest=(kind:string,value:string)=>createHmac('sha256',secret).update(kind+':'+value).digest('hex');
 function ip(req:Request) {
  const value=options.trustSpriteProxy ? req.get('sprite-client-ip') : req.socket.remoteAddress;
  const normalized=value ? normalizeIp(value):null;
  return normalized ? digest('ip',normalized):null;
 }
 const grants=()=>trialGrantCount(db);
 app.get('/api/trial',(_req,res)=>res.json({available:!options.trialsPaused && Boolean(options.sendCode) && grants()<100}));
 app.use('/api/trial',express.json({limit:'1kb'}),(req,res,next)=>{
  const origin=req.get('origin');
  if(origin && origin!==`${options.secureCookies===false ? req.protocol:'https'}://${req.get('host')}`){res.status(403).json({error:'This request is not allowed.'});return;}
  if(options.trialsPaused || !options.sendCode){res.status(503).json({error:'Email verification is not ready. Please look around for now.'});return;}
  next();
 });
 app.post('/api/trial/code',async(req,res)=>{
  const parsed=requestSchema.safeParse(req.body),network=ip(req);
  if(!parsed.success){res.status(400).json({error:'Enter a valid email and agree to the current demo terms.'});return;}
  if(!network){res.status(503).json({error:'We could not check this connection. Please try again later.'});return;}
  const email=parsed.data.email,at=now(),code=String(randomInt(0,1000000)).padStart(6,'0'),id=randomUUID();
  const result=db.transaction(()=>{
   db.prepare('DELETE FROM trial_sends WHERE sent_at<?').run(at-24*hour);
   db.prepare('DELETE FROM trial_challenges WHERE expires_at<?').run(at);
   const recent=db.prepare('SELECT count(*) n FROM trial_sends WHERE ip_hash=? AND sent_at>?').get(network,at-hour) as {n:number};
   const total=db.prepare('SELECT (SELECT count(*) FROM trial_sends) + (SELECT count(*) FROM notification_sends WHERE sent_at>?) n').get(at-24*hour) as {n:number};
   const latest=db.prepare('SELECT sent_at FROM trial_sends WHERE email_hash=? ORDER BY sent_at DESC LIMIT 1').get(digest('email',email)) as {sent_at:number}|undefined;
   if(recent.n>=3 || total.n>=100 || (latest && latest.sent_at>at-60000))return 'limited';
   if(grants()>=100)return 'full';
   // Do not disclose whether this address or network has claimed a trial.
   db.prepare('INSERT INTO trial_sends(id,ip_hash,email_hash,sent_at) VALUES (?,?,?,?)').run(id,network,digest('email',email),at);
   const taken=trialAlreadyClaimed(db,email,network);
   if(taken)return 'existing';
   const pending=db.prepare('SELECT count(*) n FROM trial_challenges').get() as {n:number};
   if(pending.n>=100)return 'limited';
   db.prepare('INSERT INTO trial_challenges(email,id,ip_hash,code_hash,expires_at,attempts,delivered) VALUES (?,?,?,?,?,0,0) ON CONFLICT(email) DO UPDATE SET id=excluded.id,ip_hash=excluded.ip_hash,code_hash=excluded.code_hash,expires_at=excluded.expires_at,attempts=0,delivered=0').run(email,id,network,digest('code',id+':'+code),at+600000);
   return 'send';
  })();
  if(result==='limited'){res.status(429).json({error:'Please wait before asking for another code.'});return;}
  if(result==='full'){res.status(409).json({error:'All 100 trials have been claimed. You can still join the waitlist.'});return;}
  if(result==='send') {
   try {await options.sendCode!(email,code,id);db.prepare('UPDATE trial_challenges SET delivered=1 WHERE email=? AND id=?').run(email,id);}
   catch {db.prepare('DELETE FROM trial_challenges WHERE email=? AND id=?').run(email,id);res.status(503).json({error:'The code could not be sent. Please try again later.'});return;}
  }
  res.json({ok:true});
 });
 app.post('/api/trial/verify',(req,res)=>{
  const parsed=verifySchema.safeParse(req.body),network=ip(req);
  if(!parsed.success || !network){res.status(400).json({error:'Check the code and agree to the current demo terms.'});return;}
  const {email,code}=parsed.data,at=now();
  const result=db.transaction(()=>{
   const row=db.prepare('SELECT * FROM trial_challenges WHERE email=?').get(email) as {id:string;ip_hash:string;code_hash:string;expires_at:number;attempts:number;delivered:number}|undefined;
   if(!row || row.expires_at<=at || row.attempts>=5 || !row.delivered)return {error:'This code expired or could not be checked. Ask for a new code.'};
   db.prepare('UPDATE trial_challenges SET attempts=attempts+1 WHERE email=?').run(email);
   if(row.ip_hash!==network || !equalSecret(row.code_hash,digest('code',row.id+':'+code)))return {error:'Check the code and try again.'};
   if(grants()>=100)return {error:'All 100 trials have been claimed. You can still join the waitlist.'};
   if(trialAlreadyClaimed(db,email,network))return {error:'A trial has already been claimed for this email or network. Deleting a notebook does not start another trial. You can still look around.'};
   const existing=db.prepare('SELECT workspace_id FROM waitlist WHERE email=?').get(email) as {workspace_id:string|null}|undefined;
   const current=workspaceFor(db,req);
   // Do not silently attach to another existing notebook; no recovery in this flow.
   if(existing?.workspace_id && existing.workspace_id!==current)return {error:'Return to the browser where you started this notebook to verify it.'};
   if(!existing && (db.prepare('SELECT count(*) n FROM waitlist').get() as {n:number}).n>=2000)return {error:'The waitlist is full.'};
   if(current!=='public' && db.prepare('SELECT 1 FROM waitlist WHERE workspace_id=? AND verified_at IS NOT NULL').get(current))return {error:'This notebook already has its trial.'};
   const currentTrial=db.prepare('SELECT trial_seconds FROM workspaces WHERE id=?').get(current) as {trial_seconds:number|null}|undefined;
   const judge=current==='public' || currentTrial?.trial_seconds==null ? createJudge(db,false):null;
   const workspace=judge?.id??current;
   db.prepare('UPDATE workspaces SET trial_seconds=coalesce(trial_seconds,1800),trial_verified=1 WHERE id=?').run(workspace);
   db.prepare('INSERT INTO waitlist(email,created_at,workspace_id,verified_at,trial_ip) VALUES (?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET workspace_id=excluded.workspace_id,verified_at=excluded.verified_at,trial_ip=excluded.trial_ip').run(email,new Date(at).toISOString(),workspace,new Date(at).toISOString(),network);
   db.prepare('UPDATE waitlist SET terms_version=?,terms_accepted_at=? WHERE email=?').run(TERMS_VERSION,new Date(at).toISOString(),email);
   db.prepare('DELETE FROM trial_challenges WHERE email=?').run(email);
   return {cookie:judge?.cookie};
  })();
  if('error' in result){res.status(409).json({error:result.error});return;}
  if(result.cookie)res.cookie(cookieName,result.cookie,{httpOnly:true,secure:options.secureCookies??true,sameSite:'strict',path:'/',maxAge:14*24*hour});
  res.json({ok:true});
 });
}
