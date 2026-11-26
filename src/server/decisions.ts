import type { KaiDatabase } from './db';
import { ReadingError, toolSchemas } from './reading';
type Suggestion={id:string;conversation_id:string;kind:'person'|'note'|'todo'|'done';payload:string;quote:string;status:string};
function decideOne(db:KaiDatabase,workspace:string,id:string,decision:'accept'|'reject',edits?:Record<string,unknown>):void {
  const s=db.prepare('SELECT * FROM suggestions WHERE id=? AND workspace_id=?').get(id,workspace) as Suggestion|undefined;
  if(!s) throw new ReadingError('Suggestion not found.',404);
  if(s.status!=='proposed') {if(s.status===(decision==='accept' ? 'accepted':'rejected'))return;throw new ReadingError('This suggestion has already been decided.',409);}
  if(decision==='reject') {
    db.prepare("UPDATE suggestions SET status='rejected' WHERE id=?").run(id);
    if(s.kind==='person') db.prepare("UPDATE suggestions SET status='rejected' WHERE workspace_id=? AND status='proposed' AND (json_extract(payload,'$.person_id')=? OR json_extract(payload,'$.owner_person_id')=?)").run(workspace,id,id);
    return;
  }
  const schema=toolSchemas[`propose_${s.kind}`];
  if(!schema) throw new ReadingError('This suggestion cannot be accepted yet.');
  const parsed=schema.safeParse({...JSON.parse(s.payload),...(s.kind==='done' ? {}:edits),quote:s.quote});
  if(!parsed.success) throw new ReadingError('Check the words and use a real date.');
  const {quote,...p}=parsed.data;
  function ensurePerson(person:string) {
    if(db.prepare('SELECT id FROM people WHERE workspace_id=? AND id=?').get(workspace,person))return;
    const proposed=db.prepare("SELECT id FROM suggestions WHERE workspace_id=? AND conversation_id=? AND kind='person' AND status='proposed' AND id=?").get(workspace,s!.conversation_id,person);
    if(!proposed)throw new ReadingError('That person is no longer available.');
    decideOne(db,workspace,person,'accept');
  }
  if(s.kind==='done') {
    const done=toolSchemas.propose_done.parse({...p,quote});
    const updated=db.prepare("UPDATE todos SET status='done' WHERE workspace_id=? AND id=? AND (person_id=? OR owner_person_id=?)").run(workspace,done.todo_id,done.person_id,done.person_id);
    if(updated.changes!==1)throw new ReadingError('That promise is no longer available.');
  } else if('name' in p) db.prepare('INSERT INTO people (id,workspace_id,name,company,role) VALUES (?,?,?,?,?)').run(id,workspace,p.name,p.company,p.role);
  else {
    if(p.person_id)ensurePerson(p.person_id);
    if(s.kind==='todo') {
      const todo=toolSchemas.propose_todo.parse({...p,quote});
      if(todo.owner_person_id)ensurePerson(todo.owner_person_id);
      db.prepare("INSERT INTO todos (id,workspace_id,text,owner_person_id,due_on,status,quote,conversation_id,person_id) VALUES (?,?,?,?,?,'open',?,?,?)").run(id,workspace,todo.text,todo.owner_person_id,todo.due_on,quote,s.conversation_id,todo.person_id);
    } else {const note=toolSchemas.propose_note.parse({...p,quote});db.prepare('INSERT INTO notes (id,workspace_id,person_id,conversation_id,text,quote) VALUES (?,?,?,?,?,?)').run(id,workspace,note.person_id,s.conversation_id,note.text,quote);}
  }
  db.prepare("UPDATE suggestions SET payload=?,status='accepted' WHERE id=?").run(JSON.stringify(p),id);
}
export function decide(db:KaiDatabase,workspace:string,id:string,decision:'accept'|'reject',edits?:Record<string,unknown>) {
  db.transaction(()=>decideOne(db,workspace,id,decision,edits))();
}
export function acceptAll(db:KaiDatabase,workspace:string,conversation:string) {
  db.transaction(()=> {
    if(!db.prepare('SELECT id FROM conversations WHERE id=? AND workspace_id=?').get(conversation,workspace))throw new ReadingError('Recording not found.',404);
    const rows=db.prepare("SELECT id FROM suggestions WHERE workspace_id=? AND conversation_id=? AND status='proposed' ORDER BY CASE kind WHEN 'person' THEN 0 ELSE 1 END,rowid").all(workspace,conversation) as {id:string}[];
    for(const row of rows)decideOne(db,workspace,row.id,'accept');
  })();
}
export { peopleList,personPage } from './people-data';
