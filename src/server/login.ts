import express,{type Express,type Request} from 'express';
import {createHmac,randomBytes,randomInt,randomUUID} from 'node:crypto';
import {z} from 'zod';
import {TERMS_VERSION} from '../terms';
import {cookieName,workspaceFor,equalSecret,createBrowserSession,revokeBrowserSessions} from './access';
import {persistentJudgeSecret} from './config';
import type {KaiDatabase} from './db';
import {normalizeIp,type TrialOptions,type SendCode} from './trial';
export type LoginOptions=TrialOptions & {sendLogin?:SendCode};
const hour=3600000,challengeCookie='kai_login';
const requestSchema=z.object({email:z.string().trim().max(254).email().transform(s=>s.toLowerCase()),termsVersion:z.literal(TERMS_VERSION)}).strict();
const verifySchema=requestSchema.extend({code:z.string().regex(/^\d{6}$/)});
export function mountLogin(app:Express,db:KaiDatabase,options:LoginOptions) {
 const now=options.now??Date.now,secret=persistentJudgeSecret(db);
 const digest=(kind:string,value:string)=>createHmac('sha256',secret).update(kind+':'+value).digest('hex');
 const cookies={httpOnly:true,secure:options.secureCookies??true,sameSite:'strict' as const,path:'/'};
 const owner=(email:string)=>db.prepare(`SELECT w.workspace_id FROM waitlist w JOIN workspaces n ON n.id=w.workspace_id WHERE w.email=? AND w.verified_at IS NOT NULL AND n.trial_verified=1 AND n.kind='judge'`).get(email) as {workspace_id:string}|undefined;
 const browser=(req:Request)=>req.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith(challengeCookie+'='))?.slice(challengeCookie.length+1)??'';
 app.use('/api/login',express.json({limit:'1kb'}),(req,res,next)=>{
  const origin=req.get('origin');if(origin && origin!==`${options.secureCookies===false?req.protocol:'https'}://${req.get('host')}`){res.status(403).json({error:'This request is not allowed.'});return;}next();
 });
 app.get('/api/login/session',(req,res)=>{
  const workspace=workspaceFor(db,req);
  res.json({signedIn:workspace!=='public',recoverable:Boolean(db.prepare('SELECT 1 FROM waitlist WHERE workspace_id=? AND verified_at IS NOT NULL').get(workspace))});
 });
 app.post('/api/login/sign-out',(req,res)=>{
  const parsed=z.object({everywhere:z.boolean()}).strict().safeParse(req.body),workspace=workspaceFor(db,req);
  if(!parsed.success){res.status(400).json({error:'Choose where to sign out.'});return;}
  if(workspace!=='public')db.transaction(()=>revokeBrowserSessions(db,req,workspace,parsed.data.everywhere))();
  res.clearCookie(cookieName,cookies);res.clearCookie(challengeCookie,cookies);res.clearCookie('kai_entry',cookies);res.json({ok:true});
 });
 app.post('/api/login/code',async(req,res)=>{
  const parsed=requestSchema.safeParse(req.body);
  if(!parsed.success){res.status(400).json({error:'Enter a valid email and agree to the current demo terms.'});return;}
  if(workspaceFor(db,req)!=='public'){res.status(409).json({error:'Sign out of this browser before opening another notebook.'});return;}
  if(!options.sendLogin){res.status(503).json({error:'Sign-in emails are unavailable. Please try again later.'});return;}
  const network=normalizeIp((options.trustSpriteProxy?req.get('sprite-client-ip'):req.socket.remoteAddress)??'');
  if(!network){res.status(503).json({error:'We could not check this connection. Please try again later.'});return;}
  const {email}=parsed.data,at=now(),code=String(randomInt(0,1000000)).padStart(6,'0'),id=randomUUID(),proof=randomBytes(32).toString('hex');
  const result=db.transaction(()=>{
   db.prepare('DELETE FROM trial_sends WHERE sent_at<=?').run(at-24*hour);
   db.prepare('DELETE FROM login_challenges WHERE expires_at<=?').run(at);
   const ipHash=digest('ip',network),emailHash=digest('email',email);
   const recent=db.prepare('SELECT count(*) n FROM trial_sends WHERE ip_hash=? AND sent_at>?').get(ipHash,at-hour) as {n:number};
   const total=db.prepare('SELECT (SELECT count(*) FROM trial_sends)+(SELECT count(*) FROM notification_sends WHERE sent_at>?) n').get(at-24*hour) as {n:number};
   const latest=db.prepare('SELECT sent_at FROM trial_sends WHERE email_hash=? ORDER BY sent_at DESC LIMIT 1').get(emailHash) as {sent_at:number}|undefined;
   if(recent.n>=3 || total.n>=100 || (latest && latest.sent_at>at-60000))return 'limited';
   db.prepare('INSERT INTO trial_sends VALUES (?,?,?,?)').run(id,ipHash,emailHash,at);
   const notebook=owner(email);if(!notebook)return 'unknown';
   // Only verified notebook owners occupy the challenge table; at most one per address.
   db.prepare(`INSERT INTO login_challenges(email,workspace_id,id,code_hash,browser_hash,expires_at) VALUES (?,?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET workspace_id=excluded.workspace_id,id=excluded.id,code_hash=excluded.code_hash,browser_hash=excluded.browser_hash,expires_at=excluded.expires_at,attempts=0,delivered=0`).run(email,notebook.workspace_id,id,digest('login-code',id+':'+code),digest('login-browser',proof),at+600000);
   return 'send';
  })();
  if(result==='limited'){res.status(429).json({error:'Please wait before asking for another code.'});return;}
  res.cookie(challengeCookie,proof,{...cookies,maxAge:600000});
  if(result==='send'){
   try{await options.sendLogin(email,code,id);db.prepare('UPDATE login_challenges SET delivered=1 WHERE email=? AND id=?').run(email,id);}
   catch{db.prepare('DELETE FROM login_challenges WHERE email=? AND id=?').run(email,id);}
  }
  // Same response for unknown addresses, unverified subscriptions and delivery failure.
  res.json({ok:true});
 });
 app.post('/api/login/verify',(req,res)=>{
  const parsed=verifySchema.safeParse(req.body);
  if(!parsed.success){res.status(400).json({error:'Check the code and agree to the current demo terms.'});return;}
  if(workspaceFor(db,req)!=='public'){res.status(409).json({error:'Sign out of this browser before opening another notebook.'});return;}
  const {email,code}=parsed.data,at=now(),proof=browser(req);
  const session=db.transaction(()=>{
   const row=db.prepare('SELECT id,workspace_id,code_hash,browser_hash,expires_at,attempts,delivered FROM login_challenges WHERE email=?').get(email) as {id:string;workspace_id:string;code_hash:string;browser_hash:string;expires_at:number;attempts:number;delivered:number}|undefined;
   if(!row || row.expires_at<=at || row.attempts>=5 || !row.delivered || !equalSecret(row.browser_hash,digest('login-browser',proof)))return;
   db.prepare('UPDATE login_challenges SET attempts=attempts+1 WHERE email=?').run(email);
   if(!equalSecret(row.code_hash,digest('login-code',row.id+':'+code)) || owner(email)?.workspace_id!==row.workspace_id)return;
   const value=createBrowserSession(db,row.workspace_id,at);
   db.prepare('DELETE FROM login_challenges WHERE email=?').run(email);
   db.prepare('UPDATE waitlist SET terms_version=?,terms_accepted_at=? WHERE email=?').run(TERMS_VERSION,new Date(at).toISOString(),email);
   return value;
  })();
  if(!session){res.status(409).json({error:'This code expired or could not be checked. Ask for a new code.'});return;}
  res.cookie(cookieName,session,{...cookies,maxAge:14*24*hour});res.clearCookie(challengeCookie,cookies);res.json({ok:true});
 });
}
