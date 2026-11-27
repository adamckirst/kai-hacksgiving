import { createHmac, createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { seed, type KaiDatabase } from './db';
export const cookieName = 'kai_session';
export function equalSecret(a: string, b: string) {
  const left = Buffer.from(a), right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left,right);
}
function signature(id: string, secret: string) {
  return createHmac('sha256',secret).update(`browser:${id}`).digest('hex');
}
export function sessionValue(req:Request) {
  return req.headers.cookie?.split(';').map(s => s.trim()).find(s => s.startsWith(cookieName+'='))?.slice(cookieName.length+1);
}
export const sessionDigest=(value:string)=>createHash('sha256').update(value).digest('hex');
export function workspaceFor(db: KaiDatabase, req: Request): string {
  const value=sessionValue(req);
  if(value && /^s\.[a-f0-9]{64}$/.test(value)) {
    const session=db.prepare('SELECT workspace_id FROM browser_sessions WHERE digest=? AND expires_at>?').get(sessionDigest(value),Date.now()) as {workspace_id:string}|undefined;
    return session?.workspace_id??'public';
  }
  if (!value || !/^[a-f0-9-]{36}\.[a-f0-9]{64}$/.test(value)) return 'public';
  const [id,mac] = value.split('.');
  const row = db.prepare("SELECT session_secret FROM workspaces WHERE id = ? AND kind = 'judge'").get(id) as {session_secret:string|null}|undefined;
  return row?.session_secret && equalSecret(mac,signature(id,row.session_secret)) ? id : 'public';
}
export function createJudge(db: KaiDatabase, populated = true) {
  const id = randomUUID(); seed(db,new Date(),id,populated);
  const row = db.prepare('SELECT session_secret FROM workspaces WHERE id = ?').get(id) as {session_secret:string};
  return {id,cookie:`${id}.${signature(id,row.session_secret)}`};
}

export function createBrowserSession(db:KaiDatabase,workspace:string,now=Date.now()) {
 const value='s.'+randomBytes(32).toString('hex');
 db.prepare('DELETE FROM browser_sessions WHERE expires_at<=?').run(now);
 // Bound remembered devices; each successful login can evict the oldest.
 db.prepare('DELETE FROM browser_sessions WHERE workspace_id=? AND digest NOT IN (SELECT digest FROM browser_sessions WHERE workspace_id=? ORDER BY expires_at DESC LIMIT 9)').run(workspace,workspace);
 db.prepare('INSERT INTO browser_sessions VALUES (?,?,?)').run(sessionDigest(value),workspace,now+14*86400000);
 return value;
}
export function revokeBrowserSessions(db:KaiDatabase,req:Request,workspace:string,all:boolean) {
 const value=sessionValue(req);
 if(all) {
  db.prepare('DELETE FROM browser_sessions WHERE workspace_id=?').run(workspace);
  db.prepare('DELETE FROM login_challenges WHERE workspace_id=?').run(workspace);
  db.prepare('DELETE FROM entry_challenges WHERE email IN (SELECT email FROM waitlist WHERE workspace_id=?)').run(workspace);
 } else if(value?.startsWith('s.'))db.prepare('DELETE FROM browser_sessions WHERE workspace_id=? AND digest=?').run(workspace,sessionDigest(value));
 // Legacy cookies share one notebook signature. New sign-ins have individual sessions.
 if(all || !value?.startsWith('s.'))db.prepare('UPDATE workspaces SET session_secret=? WHERE id=?').run(randomBytes(32).toString('hex'),workspace);
}
