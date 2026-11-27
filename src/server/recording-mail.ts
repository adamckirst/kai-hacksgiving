import {randomUUID} from 'node:crypto';
import type {KaiDatabase} from './db';
export type ReadyCounts={person:number;note:number;todo:number;done:number};
export type RecordingMailKind='ready'|'failed';
export type SendReady=(email:string,id:string,counts:ReadyCounts,title:string,kind?:RecordingMailKind)=>Promise<void>;
const day=86400000;
/** One owner, like the recording queue. A crash leaves the same provider idempotency key. */
export function recordingMailWorker(db:KaiDatabase,send:SendReady|undefined,now:()=>number=Date.now) {
 let active:Promise<void>|undefined,stopped=false,again=false;
 function kick() {
  if(!send || stopped)return active??Promise.resolve();
  if(active){again=true;return active;}
  active=(async()=>{
   for(;;) {
    if(stopped)return;
   const ready=db.prepare(`SELECT c.id,c.workspace_id,c.title,c.status kind FROM conversations c JOIN notebook_owners w ON w.workspace_id=c.workspace_id
    JOIN workspaces n ON n.id=c.workspace_id
    WHERE c.notify_ready=1 AND (c.status='failed' OR (c.status='ready' AND c.transcribed=1)) AND c.source IN ('recording','shared')
     AND w.verified_at IS NOT NULL AND n.trial_verified=1 AND n.trial_ended=0
     AND NOT EXISTS (SELECT 1 FROM recording_emails e WHERE e.id=c.id AND e.kind=c.status)`).all() as {id:string;workspace_id:string;title:string;kind:RecordingMailKind}[];
   for(const row of ready) {
    const counts:ReadyCounts={person:0,note:0,todo:0,done:0};
    if(row.kind==='ready')for(const count of db.prepare("SELECT kind,count(*) n FROM suggestions WHERE conversation_id=? AND workspace_id=? AND status='proposed' GROUP BY kind").all(row.id,row.workspace_id) as {kind:keyof ReadyCounts;n:number}[])counts[count.kind]=count.n;
    db.prepare('INSERT OR IGNORE INTO recording_emails(id,kind,workspace_id,counts,queued_at,title) VALUES (?,?,?,?,?,?)').run(row.id,row.kind,row.workspace_id,JSON.stringify(counts),now(),row.kind==='ready'?row.title:'Your recording');
   }
    const at=now();
    const job=db.transaction(()=>{
     db.prepare('DELETE FROM notification_sends WHERE sent_at<=?').run(at-day);
     db.prepare('UPDATE recording_emails SET closed=1 WHERE sent_at IS NULL AND (attempts>=3 OR (first_attempt_at IS NOT NULL AND first_attempt_at<=?))').run(at-23*3600000);
     const total=db.prepare('SELECT (SELECT count(*) FROM notification_sends)+(SELECT count(*) FROM trial_sends WHERE sent_at>?) n').get(at-day) as {n:number};
     const notifications=db.prepare('SELECT count(*) n FROM notification_sends').get() as {n:number};
     if(total.n>=100 || notifications.n>=60)return;
     const row=db.prepare(`SELECT e.id,e.kind,e.workspace_id,e.counts,e.title,w.email FROM recording_emails e
      JOIN notebook_owners w ON w.workspace_id=e.workspace_id JOIN workspaces n ON n.id=e.workspace_id
      JOIN conversations c ON c.id=e.id AND c.workspace_id=e.workspace_id
      WHERE e.sent_at IS NULL AND e.closed=0 AND e.next_attempt_at<=? AND w.verified_at IS NOT NULL
       AND n.trial_verified=1 AND n.trial_ended=0 AND c.status=e.kind
       AND (SELECT count(*) FROM notification_sends s WHERE s.workspace_id=e.workspace_id)<10
      ORDER BY e.queued_at,e.rowid LIMIT 1`).get(at) as {id:string;kind:RecordingMailKind;workspace_id:string;counts:string;title:string;email:string}|undefined;
     if(!row)return;
     db.prepare('INSERT INTO notification_sends(id,workspace_id,sent_at) VALUES (?,?,?)').run(randomUUID(),row.workspace_id,at);
     db.prepare('UPDATE recording_emails SET first_attempt_at=coalesce(first_attempt_at,?),attempts=attempts+1,next_attempt_at=? WHERE id=? AND kind=?').run(at,at+60000,row.id,row.kind);
     return row;
    })();
    if(!job)return;
    try {await send(job.email,job.id,JSON.parse(job.counts),job.title,job.kind);db.prepare('UPDATE recording_emails SET sent_at=? WHERE id=? AND kind=?').run(now(),job.id,job.kind);}
    catch { /* Reserved attempts remain charged. No recipient, content or provider error is logged. */ }
   }
  })().finally(()=>{active=undefined;if(again && !stopped){again=false;return kick();}});
  return active;
 }
 return {kick,stop:async()=>{stopped=true;await active}};
}
