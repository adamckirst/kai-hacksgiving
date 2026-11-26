import {ReaderFailure} from './reader-failure';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { KaiDatabase } from './db';
import { personPage } from './people-data';
export const realDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {const d=new Date(value+'T12:00:00Z');return !isNaN(d.getTime()) && d.toISOString().slice(0,10)===value;},'Use a real date.');
const words=z.string().trim().min(1).max(500);
export const toolSchemas={
  get_person:z.object({person_id:words}),
  propose_done:z.object({person_id:words,todo_id:words,quote:words,text:words.optional()}),
  describe_recording:z.object({title:words.max(100),summary:words.max(500).refine(s=>s.split('\n').length===2 && s.split('\n').every(line=>line.trim()),'Use two lines.')}),
  propose_person:z.object({name:words.max(100),company:words.max(100),role:words.max(100),quote:words}),
  propose_note:z.object({person_id:words,text:words,quote:words}),
  propose_todo:z.object({person_id:words,owner_person_id:words.nullable(),text:words,due_on:realDate.nullable(),quote:words}),
};
export type ToolName=keyof typeof toolSchemas;
export type ToolResult={ok:boolean;id?:string;error?:string;person?:NonNullable<ReturnType<typeof personPage>>};
export type ReadInput={sender?:{kind:'person'|'owner'|'unknown';person?:{id:string;name:string;company:string;role:string}};text:string;happened_on:string;people:{id:string;name:string;company:string;role:string}[]};
export type Reader=(input:ReadInput,call:(name:string,input:unknown)=>ToolResult,signal?:AbortSignal)=>Promise<void>;
export class ReadingError extends Error {constructor(message:string,public status=400){super(message);}}
export function reserveReading(db:KaiDatabase,workspace:string,now=new Date()) {
  const verification=db.prepare('SELECT trial_seconds,trial_verified,trial_ended FROM workspaces WHERE id=?').get(workspace) as {trial_seconds:number|null;trial_verified:number;trial_ended:number}|undefined;
  if(verification?.trial_ended)throw new ReadingError('This trial has ended because a recording exceeded its reserved time.',403);
  if(verification?.trial_seconds!=null && !verification.trial_verified)throw new ReadingError('Verify your email before adding more recordings or transcripts.',403);
  const day=now.toISOString().slice(0,10);
  const row=db.prepare('SELECT kind,reading_day,readings_today FROM workspaces WHERE id=?').get(workspace) as {kind:string;reading_day:string;readings_today:number}|undefined;
  if (!row || row.kind!=='judge') throw new ReadingError('This demo is read-only.',403);
  const count=row.reading_day===day ? row.readings_today : 0;
  const total=(db.prepare('SELECT coalesce(sum(readings_today),0) AS n FROM workspaces WHERE reading_day=?').get(day) as {n:number}).n;
  if(count>=30 || total>=150) throw new ReadingError('KAI has reached today’s reading limit. Try tomorrow.',429);
  db.prepare('UPDATE workspaces SET reading_day=?,readings_today=? WHERE id=?').run(day,count+1,workspace);
}
export function reserveRecording(db:KaiDatabase,workspace:string,now=new Date()) {
  const verification=db.prepare('SELECT trial_seconds,trial_verified,trial_ended FROM workspaces WHERE id=?').get(workspace) as {trial_seconds:number|null;trial_verified:number;trial_ended:number}|undefined;
  if(verification?.trial_ended)throw new ReadingError('This trial has ended because a recording exceeded its reserved time.',403);
  if(verification?.trial_seconds!=null && !verification.trial_verified)throw new ReadingError('Verify your email before adding more recordings or transcripts.',403);
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
    db.prepare("UPDATE conversations SET status='waiting',error=NULL,progress=NULL,attempts=0 WHERE id=? AND workspace_id=?").run(id,workspace);
  })();
}
export async function readConversation(db:KaiDatabase,id:string,reader:Reader,signal?:AbortSignal) {
  const row=db.prepare('SELECT workspace_id,text,happened_on,source,person_id FROM conversations WHERE id=?').get(id) as {workspace_id:string;text:string;happened_on:string;source:string;person_id:string|null};
  db.prepare("UPDATE conversations SET status='reading',error=NULL,progress=NULL,failure_code=NULL,tool_error_counts='{}' WHERE id=?").run(id);
  let described=false, calls=0;const readPeople=new Set<string>();
  const personExists=(person:string) => !!db.prepare('SELECT id FROM people WHERE workspace_id=? AND id=?').get(row.workspace_id,person) || !!db.prepare("SELECT id FROM suggestions WHERE workspace_id=? AND conversation_id=? AND kind='person' AND status='proposed' AND id=?").get(row.workspace_id,id,person);
  try {
    const people=db.prepare('SELECT id,name,company,role FROM people WHERE workspace_id=?').all(row.workspace_id) as ReadInput['people'];
    const person=people.find(p=>p.id===row.person_id);
    const sender:ReadInput['sender']=person ? {kind:'person',person}:row.source==='sample' ? {kind:'owner'}:{kind:'unknown'};
    const handleTool=(name:string,input:unknown):ToolResult=> {
      signal?.throwIfAborted();
      if(++calls>50) throw new Error('Too many calls.');
      if(!(name in toolSchemas)) return {ok:false,error:'Unknown tool.'};
      const parsed=toolSchemas[name as ToolName].safeParse(input);
      if(!parsed.success) return {ok:false,error:parsed.error.issues.map(issue=>`${issue.path.join('.')}: ${issue.message}`).join('; ')};
      const value=parsed.data;
      if(name==='describe_recording' && 'title' in value) {
        db.prepare('UPDATE conversations SET title=?,summary=? WHERE id=?').run(value.title,value.summary,id);described=true;return {ok:true};
      }
      if(name==='get_person' && 'person_id' in value) {
        const person=personPage(db,row.workspace_id,value.person_id);
        if(!person)return {ok:false,error:'Person not found in this copy.'};
        readPeople.add(value.person_id);
        db.prepare('UPDATE conversations SET progress=? WHERE id=?').run(`Reading ${person.name.split(' ')[0]}’s page`,id);
        return {ok:true,person};
      }
      if(!('quote' in value) || !row.text.includes(value.quote)) return {ok:false,error:'The quote must appear in the words exactly.'};
      if('person_id' in value && typeof value.person_id==='string' && !personExists(value.person_id)) return {ok:false,error:'Choose a known person or propose the new person first.'};
      if('owner_person_id' in value && typeof value.owner_person_id==='string' && !personExists(value.owner_person_id)) return {ok:false,error:'The owner must be a known or proposed person.'};
      if('person_id' in value && typeof value.person_id==='string' && people.some(p=>p.id===value.person_id) && !readPeople.has(value.person_id)) return {ok:false,error:'Call get_person before proposing something about a known person.'};
      if(name==='propose_person' && 'name' in value) {
        const normalize=(text:string)=>text.normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('en');
        const known=people.find(p=>normalize(p.name)===normalize(value.name) && normalize(p.company)===normalize(value.company));
        if(known)return {ok:true,id:known.id};
      }
      let doneText:string|undefined;
      if(name==='propose_done') {
        const done=toolSchemas.propose_done.parse(value);
        const todo=db.prepare("SELECT text FROM todos WHERE id=? AND workspace_id=? AND status='open' AND (person_id=? OR owner_person_id=?)").get(done.todo_id,row.workspace_id,done.person_id,done.person_id) as {text:string}|undefined;
        if(!todo)return {ok:false,error:'Choose an open promise from this person’s page.'};
        doneText=todo.text;
      }
      const {quote,...payload}=value;
      if(doneText)Object.assign(payload,{text:doneText});
      const existing=db.prepare('SELECT id FROM suggestions WHERE workspace_id=? AND conversation_id=? AND kind=? AND payload=? AND quote=?').get(row.workspace_id,id,name.slice('propose_'.length),JSON.stringify(payload),quote) as {id:string}|undefined;
      if(existing) return {ok:true,id:existing.id};
      const suggestion=randomUUID();
      db.prepare("INSERT INTO suggestions VALUES (?,?,?,?,?,?,'proposed')").run(suggestion,row.workspace_id,id,name.slice('propose_'.length),JSON.stringify(payload),quote);
      return {ok:true,id:suggestion};
    };
    const errors:Record<string,number>={};
    await reader({...row,people,sender},(name,input)=>{
      const result=handleTool(name,input);
      if(!result.ok) {
        const category=result.error==='The quote must appear in the words exactly.' ? 'quote':result.error?.startsWith('Call get_person') ? 'person_context':result.error?.includes('known') ? 'person_reference':name==='describe_recording' ? 'summary_shape':'tool_validation';
        errors[category]=(errors[category]??0)+1;
        db.prepare('UPDATE conversations SET tool_error_counts=? WHERE id=?').run(JSON.stringify(errors),id);
      }
      return result;
    },signal);
    signal?.throwIfAborted();
    if(!described) throw new ReaderFailure('missing_summary');
    db.prepare("UPDATE conversations SET status='ready' WHERE id=?").run(id);
  } catch(error) {
    const code=signal?.aborted ? 'reading_timeout':error instanceof ReaderFailure ? error.code:error instanceof SyntaxError ? 'invalid_response':'reading_failed';
    db.prepare('UPDATE conversations SET failure_code=? WHERE id=?').run(code,id);
    if(signal?.aborted) return;
    db.prepare("UPDATE conversations SET status='failed',error='KAI could not finish reading. Try again.' WHERE id=?").run(id);
  }
}
