import {createHmac} from 'node:crypto';
import {rmSync} from 'node:fs';
import path from 'node:path';
import type {Express} from 'express';
import {z} from 'zod';
import type {KaiDatabase} from './db';
import {persistentJudgeSecret} from './config';
import {cookieName} from './access';

export function emailFingerprint(db:KaiDatabase,email:string) {
 return createHmac('sha256',persistentJudgeSecret(db)).update('email:'+email.trim().toLowerCase()).digest('hex');
}
export function trialGrantCount(db:KaiDatabase) {
 return (db.prepare('SELECT (SELECT count(*) FROM waitlist WHERE verified_at IS NOT NULL)+(SELECT count(*) FROM deleted_trial_grants) n').get() as {n:number}).n;
}
export function trialAlreadyClaimed(db:KaiDatabase,email:string,ip:string) {
 return Boolean(db.prepare('SELECT 1 FROM waitlist WHERE verified_at IS NOT NULL AND (email=? OR trial_ip=?)').get(email,ip) || db.prepare('SELECT 1 FROM deleted_trial_grants WHERE email_hash=? OR ip_hash=?').get(emailFingerprint(db,email),ip));
}
export function cleanDeletedAudio(db:KaiDatabase,directory:string) {
 for(const row of db.prepare('SELECT path FROM deleted_audio').all() as {path:string}[]) {
  // Only server-generated audio paths inside this instance's audio directory.
  if(path.dirname(row.path)!==path.resolve(directory) || !/^[a-f0-9-]{36}\.audio$/.test(path.basename(row.path)))continue;
  try {rmSync(row.path,{force:true});db.prepare('DELETE FROM deleted_audio WHERE path=?').run(row.path);}catch{/* Retry on the next request or restart. Never log paths or content. */}
 }
}
export function mountAccount(app:Express,db:KaiDatabase,options:{secureCookies?:boolean;audioDirectory:string;cancel:(workspace:string)=>void}) {
 const owner=(workspace:string)=>db.prepare("SELECT w.email,w.trial_ip FROM waitlist w JOIN workspaces n ON n.id=w.workspace_id WHERE w.workspace_id=? AND w.verified_at IS NOT NULL AND n.trial_verified=1 AND n.kind='judge'").get(workspace) as {email:string;trial_ip:string|null}|undefined;
 app.get('/api/account',(_req,res)=>{
  const workspace=res.locals.workspace as string,account=owner(workspace);
  res.set('Cache-Control','no-store').json({signedIn:workspace!=='public',email:account?.email??null});
 });
 app.post('/api/account/delete',(req,res)=>{
  if(!z.object({confirm:z.literal(true)}).strict().safeParse(req.body).success){res.status(400).json({error:'Confirm that you want to delete your account.'});return;}
  const workspace=res.locals.workspace as string;
  const removed=db.transaction(()=>{
   const account=owner(workspace);if(!account)return false;
   const usage=db.prepare('SELECT reading_day,readings_today,recording_day,recordings_today FROM workspaces WHERE id=?').get(workspace) as {reading_day:string|null;readings_today:number;recording_day:string|null;recordings_today:number};
   db.prepare('INSERT INTO deleted_trial_grants(email_hash,ip_hash) VALUES (?,?)').run(emailFingerprint(db,account.email),account.trial_ip);
   if(usage.reading_day)db.prepare('INSERT INTO deleted_usage(day,readings) VALUES (?,?) ON CONFLICT(day) DO UPDATE SET readings=readings+excluded.readings').run(usage.reading_day,usage.readings_today);
   if(usage.recording_day)db.prepare('INSERT INTO deleted_usage(day,recordings) VALUES (?,?) ON CONFLICT(day) DO UPDATE SET recordings=recordings+excluded.recordings').run(usage.recording_day,usage.recordings_today);
   db.prepare('INSERT OR IGNORE INTO deleted_audio(path) SELECT audio_path FROM conversations WHERE workspace_id=? AND audio_path IS NOT NULL').run(workspace);
   // Keep only anonymous send counts under the read-only workspace, so deletion
   // cannot refill either the notification or shared verification sending cap.
   db.prepare("UPDATE notification_sends SET workspace_id='public' WHERE workspace_id=?").run(workspace);
   db.prepare('DELETE FROM trial_challenges WHERE email=?').run(account.email);
   db.prepare('DELETE FROM entry_challenges WHERE email=? OR origin_workspace=?').run(account.email,workspace);
   for(const table of ['login_challenges','browser_sessions','recording_emails','quota_emails','suggestions','notes','todos','conversations','people','waitlist'])db.prepare(`DELETE FROM ${table} WHERE workspace_id=?`).run(workspace);
   db.prepare('DELETE FROM workspaces WHERE id=?').run(workspace);
   return true;
  })();
  if(!removed){res.status(403).json({error:'Sign in to your verified notebook to delete your account.'});return;}
  options.cancel(workspace);cleanDeletedAudio(db,options.audioDirectory);
  const cookies={httpOnly:true,secure:options.secureCookies??true,sameSite:'strict' as const,path:'/'};
  for(const name of [cookieName,'kai_login','kai_entry'])res.clearCookie(name,cookies);
  res.json({ok:true});
 });
}
