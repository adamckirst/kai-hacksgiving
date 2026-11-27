import {createHash,randomUUID} from 'node:crypto';
import type {KaiDatabase} from './db';
export type SendQuota=(email:string,id:string,requested:number,remaining:number)=>Promise<void>;
const day=86400000;
export function queueQuotaEmail(db:KaiDatabase,workspace:string,audio:Buffer[],requested:number,remaining:number,at=Date.now()) {
 if(!db.prepare('SELECT 1 FROM waitlist w JOIN workspaces n ON n.id=w.workspace_id WHERE w.workspace_id=? AND w.verified_at IS NOT NULL AND n.trial_verified=1 AND n.trial_ended=0').get(workspace))return;
 const hash=createHash('sha256').update(workspace);for(const file of audio)hash.update(String(file.length)+':').update(file);
 db.transaction(()=>{
  if((db.prepare('SELECT count(*) n FROM quota_emails').get() as {n:number}).n>=1000)return;
  if((db.prepare('SELECT count(*) n FROM quota_emails WHERE workspace_id=? AND queued_at>?').get(workspace,at-day) as {n:number}).n>=10)return;
  db.prepare('INSERT OR IGNORE INTO quota_emails(id,workspace_id,fingerprint,requested_seconds,remaining_seconds,queued_at) VALUES (?,?,?,?,?,?)').run(randomUUID(),workspace,hash.digest('hex'),requested,remaining,at);
 })();
}
export function quotaMailWorker(db:KaiDatabase,send:SendQuota|undefined,now:()=>number=Date.now) {
 let active:Promise<void>|undefined,stopped=false,again=false;
 function kick():Promise<void> {
  if(!send || stopped)return active??Promise.resolve();if(active){again=true;return active;}
  active=(async()=>{for(;;){if(stopped)return;const at=now();
   const job=db.transaction(()=>{
    db.prepare('DELETE FROM notification_sends WHERE sent_at<=?').run(at-day);
    db.prepare('UPDATE quota_emails SET closed=1 WHERE sent_at IS NULL AND (attempts>=3 OR (first_attempt_at IS NOT NULL AND first_attempt_at<=?))').run(at-23*3600000);
    const count=db.prepare('SELECT (SELECT count(*) FROM notification_sends) notices,(SELECT count(*) FROM trial_sends WHERE sent_at>?) codes').get(at-day) as {notices:number;codes:number};
    if(count.notices>=60 || count.notices+count.codes>=100)return;
    const row=db.prepare(`SELECT e.id,e.workspace_id,e.requested_seconds,e.remaining_seconds,w.email FROM quota_emails e JOIN waitlist w ON w.workspace_id=e.workspace_id JOIN workspaces n ON n.id=e.workspace_id WHERE e.sent_at IS NULL AND e.closed=0 AND e.next_attempt_at<=? AND w.verified_at IS NOT NULL AND n.trial_verified=1 AND n.trial_ended=0 AND (SELECT count(*) FROM notification_sends s WHERE s.workspace_id=e.workspace_id)<10 ORDER BY e.queued_at,e.rowid LIMIT 1`).get(at) as {id:string;workspace_id:string;requested_seconds:number;remaining_seconds:number;email:string}|undefined;
    if(!row)return;
    db.prepare('INSERT INTO notification_sends(id,workspace_id,sent_at) VALUES (?,?,?)').run(randomUUID(),row.workspace_id,at);
    db.prepare('UPDATE quota_emails SET first_attempt_at=coalesce(first_attempt_at,?),attempts=attempts+1,next_attempt_at=? WHERE id=?').run(at,at+60000,row.id);
    return row;
   })();if(!job)return;
   try{await send(job.email,job.id,job.requested_seconds,job.remaining_seconds);db.prepare('UPDATE quota_emails SET sent_at=? WHERE id=?').run(now(),job.id);}catch{/* No recipient, recording or provider message is logged. */}
  }})().finally(()=>{active=undefined;if(again&&!stopped){again=false;return kick();}});return active;
 }
 return {kick,stop:async()=>{stopped=true;await active}};
}
