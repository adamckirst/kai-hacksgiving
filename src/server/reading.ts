import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { KaiDatabase } from './db';
export const realDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {const d=new Date(value+'T12:00:00Z');return !isNaN(d.getTime()) && d.toISOString().slice(0,10)===value;},'Use a real date.');
const words=z.string().trim().min(1).max(500);
export const toolSchemas={
  describe_recording:z.object({title:words.max(100),summary:words.max(500).refine(s=>s.split('\n').length===2 && s.split('\n').every(line=>line.trim()),'Use two lines.')}),
  propose_person:z.object({name:words.max(100),company:words.max(100),role:words.max(100),quote:words}),
  propose_note:z.object({person_id:words,text:words,quote:words}),
  propose_todo:z.object({person_id:words,owner_person_id:words.nullable(),text:words,due_on:realDate.nullable(),quote:words}),
};
export type ToolName=keyof typeof toolSchemas;
export type ToolResult={ok:boolean;id?:string;error?:string};
export type ReadInput={text:string;happened_on:string;people:{id:string;name:string;company:string;role:string}[]};
export type Reader=(input:ReadInput,call:(name:string,input:unknown)=>ToolResult,signal?:AbortSignal)=>Promise<void>;
export class ReadingError extends Error {constructor(message:string,public status=400){super(message);}}
export function reserveReading(db:KaiDatabase,workspace:string,now=new Date()) {
  const day=now.toISOString().slice(0,10);
  const row=db.prepare('SELECT kind,reading_day,readings_today FROM workspaces WHERE id=?').get(workspace) as {kind:string;reading_day:string;readings_today:number}|undefined;
  if (!row || row.kind!=='judge') throw new ReadingError('This demo is read-only.',403);
  const count=row.reading_day===day ? row.readings_today : 0;
  const total=(db.prepare('SELECT coalesce(sum(readings_today),0) AS n FROM workspaces WHERE reading_day=?').get(day) as {n:number}).n;
  if(count>=30 || total>=150) throw new ReadingError('KAI has reached today’s reading limit. Try tomorrow.',429);
  db.prepare('UPDATE workspaces SET reading_day=?,readings_today=? WHERE id=?').run(day,count+1,workspace);
}
export function reserveRecording(db:KaiDatabase,workspace:string,now=new Date()) {
  const day=now.toISOString().slice(0,10);
  const row=db.prepare('SELECT kind,recording_day,recordings_today FROM workspaces WHERE id=?').get(workspace) as {kind:string;recording_day:string;recordings_today:number}|undefined;
  if(!row || row.kind!=='judge') throw new ReadingError('This demo is read-only.',403);
  const count=row.recording_day===day ? row.recordings_today : 0;
  const total=(db.prepare('SELECT coalesce(sum(recordings_today),0) AS n FROM workspaces WHERE recording_day=?').get(day) as {n:number}).n;
  if(count>=10 || total>=60) throw new ReadingError('KAI has reached today’s recording limit. Try tomorrow.',429);
  db.prepare('UPDATE workspaces SET recording_day=?,recordings_today=? WHERE id=?').run(day,count+1,workspace);
}
export function addReading(db:KaiDatabase,workspace:string,text:string,day:string,source:'paste'|'sample',now=new Date()) {
  if(!text.trim() || text.length>20000 || !realDate.safeParse(day).success) throw new ReadingError('Add words up to 20,000 characters and a real date.');
  return db.transaction(()=> {
    reserveReading(db,workspace,now);
    const id=randomUUID();
    db.prepare('INSERT INTO conversations (id,workspace_id,title,summary,source,text,happened_on,status) VALUES (?,?,?,?,?,?,?,?)').run(id,workspace,'New conversation','',source,text,day,'waiting');
    db.prepare('UPDATE conversations SET happened_at=? WHERE id=?').run(Date.parse(day),id);
    return id;
  })();
}
export function retryReading(db:KaiDatabase,workspace:string,id:string) {
  db.transaction(()=> {
    const row=db.prepare('SELECT status,audio_path,transcribed FROM conversations WHERE id=? AND workspace_id=?').get(id,workspace) as {status:string;audio_path:string|null;transcribed:number}|undefined;
    if(!row) throw new ReadingError('Recording not found.',404);
    if(row.status!=='failed') throw new ReadingError('This recording is not ready to retry.',409);
    reserveReading(db,workspace);if(row.audio_path && !row.transcribed) reserveRecording(db,workspace);
    db.prepare("DELETE FROM suggestions WHERE conversation_id=? AND workspace_id=? AND status='proposed'").run(id,workspace);
    db.prepare("UPDATE conversations SET status='waiting',error=NULL,attempts=0 WHERE id=? AND workspace_id=?").run(id,workspace);
  })();
}
export async function readConversation(db:KaiDatabase,id:string,reader:Reader,signal?:AbortSignal) {
  const row=db.prepare('SELECT workspace_id,text,happened_on FROM conversations WHERE id=?').get(id) as {workspace_id:string;text:string;happened_on:string};
  db.prepare("UPDATE conversations SET status='reading',error=NULL WHERE id=?").run(id);
  let described=false, calls=0;
  const personExists=(person:string) => !!db.prepare('SELECT id FROM people WHERE workspace_id=? AND id=?').get(row.workspace_id,person) || !!db.prepare("SELECT id FROM suggestions WHERE workspace_id=? AND conversation_id=? AND kind='person' AND status='proposed' AND id=?").get(row.workspace_id,id,person);
  try {
    const people=db.prepare('SELECT id,name,company,role FROM people WHERE workspace_id=?').all(row.workspace_id) as ReadInput['people'];
    await reader({...row,people},(name,input)=> {
      signal?.throwIfAborted();
      if(++calls>50) throw new Error('Too many calls.');
      if(!(name in toolSchemas)) return {ok:false,error:'Unknown tool.'};
      const parsed=toolSchemas[name as ToolName].safeParse(input);
      if(!parsed.success) return {ok:false,error:parsed.error.issues.map(issue=>`${issue.path.join('.')}: ${issue.message}`).join('; ')};
      const value=parsed.data;
      if(name==='describe_recording' && 'title' in value) {
        db.prepare('UPDATE conversations SET title=?,summary=? WHERE id=?').run(value.title,value.summary,id);described=true;return {ok:true};
      }
      if(!('quote' in value) || !row.text.includes(value.quote)) return {ok:false,error:'The quote must appear in the words exactly.'};
      if('person_id' in value && !personExists(value.person_id)) return {ok:false,error:'Choose a known person or propose the new person first.'};
      if('owner_person_id' in value && typeof value.owner_person_id==='string' && !personExists(value.owner_person_id)) return {ok:false,error:'The owner must be a known or proposed person.'};
      const {quote,...payload}=value;
      const existing=db.prepare('SELECT id FROM suggestions WHERE workspace_id=? AND conversation_id=? AND kind=? AND payload=? AND quote=?').get(row.workspace_id,id,name.slice('propose_'.length),JSON.stringify(payload),quote) as {id:string}|undefined;
      if(existing) return {ok:true,id:existing.id};
      const suggestion=randomUUID();
      db.prepare("INSERT INTO suggestions VALUES (?,?,?,?,?,?,'proposed')").run(suggestion,row.workspace_id,id,name.slice('propose_'.length),JSON.stringify(payload),quote);
      return {ok:true,id:suggestion};
    },signal);
    signal?.throwIfAborted();
    if(!described) throw new Error('Missing summary.');
    db.prepare("UPDATE conversations SET status='ready' WHERE id=?").run(id);
  } catch {
    if(signal?.aborted) return;
    db.prepare("UPDATE conversations SET status='failed',error='KAI could not finish reading. Try again.' WHERE id=?").run(id);
  }
}
