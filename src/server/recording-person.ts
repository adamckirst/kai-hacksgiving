import { z } from 'zod';
import type { KaiDatabase } from './db';
import { ReadingError } from './reading';
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
