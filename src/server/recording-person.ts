import { z } from 'zod';
import {getProcessingMetrics,markProcessing} from './processing-metrics';
import type { KaiDatabase } from './db';
import { ReadingError,reserveReading } from './reading';
const personFields={name:z.string().trim().min(1).max(120),company:z.string().trim().max(200),role:z.string().trim().max(120)};
const choice=z.union([
  z.object({person_id:z.string().min(1).max(200).nullable()}).strict(),
  z.object({new_person:z.object({id:z.uuid(),...personFields}).strict()}).strict(),
]);
/** Linking is an explicit choice; it does not decide any of KAI's suggestions. */
export function linkRecordingPerson(db:KaiDatabase,workspace:string,recording:string,input:unknown) {
  const parsed=choice.safeParse(input);
  if(!parsed.success)throw new ReadingError('Choose a person, or add their name.');
  return db.transaction(()=> {
    if(!db.prepare('SELECT id FROM conversations WHERE id=? AND workspace_id=?').get(recording,workspace))throw new ReadingError('Recording not found.',404);
    const value=parsed.data;
    let id:string;
    if('new_person' in value) {
      const p=value.new_person;id=p.id;
      const previous=db.prepare('SELECT workspace_id,name,company,role FROM people WHERE id=?').get(id) as {workspace_id:string;name:string;company:string;role:string}|undefined;
      // A retry of the same form is safe even if the first response was lost.
      if(previous) {
        if(previous.workspace_id!==workspace || previous.name!==p.name || previous.company!==p.company || previous.role!==p.role)throw new ReadingError('Reopen the person form and try again.',409);
      } else db.prepare('INSERT INTO people (id,workspace_id,name,company,role) VALUES (?,?,?,?,?)').run(id,workspace,p.name,p.company,p.role);
    } else {
      if(value.person_id===null) {db.prepare('UPDATE conversations SET person_id=NULL WHERE id=? AND workspace_id=?').run(recording,workspace);return null;}
      id=value.person_id;
    }
    const person=db.prepare('SELECT id,name,company,role FROM people WHERE id=? AND workspace_id=?').get(id,workspace);
    if(!person)throw new ReadingError('Person not found.',404);
    db.prepare('UPDATE conversations SET person_id=? WHERE id=? AND workspace_id=?').run(id,recording,workspace);
    return person;
  })();
}

/** New recording intent is separate from the people mentioned in its words. */
export function configureRecording(db:KaiDatabase,workspace:string,recording:string,input:unknown) {
  const typed=z.object({recording_type:z.enum(['memo','voice','multiple']),person_id:z.string().nullable().optional(),new_person:z.object({id:z.uuid(),...personFields}).optional()}).strict().safeParse(input);
  if(!input || typeof input!=='object' || !('recording_type' in input))return linkRecordingPerson(db,workspace,recording,input);
  if(!typed.success)throw new ReadingError('Choose the kind of recording and who is speaking.');
  const value=typed.data;
  return db.transaction(()=>{
    if(value.recording_type==='voice') {
      if(!value.person_id && !value.new_person)throw new ReadingError('Choose who sent this voice note.');
      if(value.person_id && value.new_person)throw new ReadingError('Choose one speaker.');
      linkRecordingPerson(db,workspace,recording,value.new_person ? {new_person:value.new_person}:{person_id:value.person_id});
    }else {
      if(value.person_id || value.new_person)throw new ReadingError('Choose speakers after transcription for a meeting; a memo is from you.');
      linkRecordingPerson(db,workspace,recording,{person_id:null});
    }
    db.prepare('UPDATE conversations SET recording_type=? WHERE id=? AND workspace_id=?').run(value.recording_type,recording,workspace);
  })();
}
export function identifySpeakers(db:KaiDatabase,workspace:string,recording:string,input:unknown) {
  const selection=z.record(z.string(),z.union([z.object({kind:z.literal('owner')}).strict(),z.object({kind:z.literal('person'),person_id:z.string().min(1)}).strict(),z.object({kind:z.literal('new'),person:z.object({id:z.uuid(),...personFields})}).strict()])).safeParse(input);
  if(!selection.success)throw new ReadingError('Identify each speaker before KAI reads.');
  return db.transaction(()=>{
    const row=db.prepare('SELECT awaiting_speakers,utterances,reserved_on FROM conversations WHERE id=? AND workspace_id=?').get(recording,workspace) as {awaiting_speakers:number;utterances:string;reserved_on:string|null}|undefined;
    if(!row)throw new ReadingError('Recording not found.',404);
    if(!row.awaiting_speakers)throw new ReadingError('This recording is not waiting for speakers.',409);
    const labels=[...new Set((JSON.parse(row.utterances) as {speaker:string}[]).map(u=>u.speaker))];
    if(Object.keys(selection.data).length!==labels.length || labels.some(label=>!Object.hasOwn(selection.data,label)))throw new ReadingError('Identify each speaker before KAI reads.');
    const mapping:Record<string,{kind:'owner'}|{kind:'person';person_id:string}>={};
    for(const label of labels){const selected=selection.data[label];
      if(selected.kind==='owner'){mapping[label]={kind:'owner'};continue;}
      const person=linkRecordingPerson(db,workspace,recording,selected.kind==='new' ? {new_person:selected.person}:{person_id:selected.person_id}) as {id:string};
      mapping[label]={kind:'person',person_id:person.id};
    }
    const day=new Date().toISOString().slice(0,10);
    if(row.reserved_on && row.reserved_on!==day)reserveReading(db,workspace);
    db.prepare('UPDATE conversations SET reserved_on=? WHERE id=?').run(day,recording);
    // A meeting has several speakers, not one recording-level sender.
    db.prepare("UPDATE conversations SET person_id=NULL,speaker_map=?,awaiting_speakers=0,status='waiting',progress=NULL,attempts=0 WHERE id=? AND workspace_id=?").run(JSON.stringify(mapping),recording,workspace);
    const timing=getProcessingMetrics(db,recording);
    if(timing?.speakerWaitStartedAt)markProcessing(db,recording,{speakerWaitMs:(timing.speakerWaitMs??0)+Math.max(0,Date.now()-timing.speakerWaitStartedAt)});
  })();
}
