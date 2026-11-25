import type { KaiDatabase } from './db';
import { ReadingError, toolSchemas } from './reading';
type Suggestion={id:string;conversation_id:string;kind:'person'|'note'|'todo';payload:string;quote:string;status:string};
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
  const parsed=schema.safeParse({...JSON.parse(s.payload),...edits,quote:s.quote});
  if(!parsed.success) throw new ReadingError('Check the words and use a real date.');
  const {quote,...p}=parsed.data;
  function ensurePerson(person:string) {
    if(db.prepare('SELECT id FROM people WHERE workspace_id=? AND id=?').get(workspace,person))return;
    const proposed=db.prepare("SELECT id FROM suggestions WHERE workspace_id=? AND conversation_id=? AND kind='person' AND status='proposed' AND id=?").get(workspace,s!.conversation_id,person);
    if(!proposed)throw new ReadingError('That person is no longer available.');
    decideOne(db,workspace,person,'accept');
  }
  if('name' in p) db.prepare('INSERT INTO people (id,workspace_id,name,company,role) VALUES (?,?,?,?,?)').run(id,workspace,p.name,p.company,p.role);
  else {
    ensurePerson(p.person_id);
    if(s.kind==='todo') {
      const todo=toolSchemas.propose_todo.parse({...p,quote});
      if(todo.owner_person_id)ensurePerson(todo.owner_person_id);
      db.prepare("INSERT INTO todos (id,workspace_id,text,owner_person_id,due_on,status,quote,conversation_id,person_id) VALUES (?,?,?,?,?,'open',?,?,?)").run(id,workspace,todo.text,todo.owner_person_id,todo.due_on,quote,s.conversation_id,todo.person_id);
    } else db.prepare('INSERT INTO notes (id,workspace_id,person_id,conversation_id,text,quote) VALUES (?,?,?,?,?,?)').run(id,workspace,p.person_id,s.conversation_id,p.text,quote);
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
export function peopleList(db:KaiDatabase,workspace:string,now=new Date()) {
  const today=now.toISOString().slice(0,10),soon=new Date(now.getTime()+86400000).toISOString().slice(0,10);
  return db.prepare(`SELECT p.id,p.name,p.company,p.role,
    (SELECT count(*) FROM todos t WHERE t.workspace_id=p.workspace_id AND t.person_id=p.id AND t.status='open' AND t.due_on < ?) AS overdue,
    (SELECT count(*) FROM todos t WHERE t.workspace_id=p.workspace_id AND t.person_id=p.id AND t.status='open' AND t.due_on BETWEEN ? AND ?) AS soon,
    (SELECT count(*) FROM suggestions s WHERE s.workspace_id=p.workspace_id AND s.status='proposed' AND json_extract(s.payload,'$.person_id')=p.id) AS suggestions
    FROM people p WHERE p.workspace_id=? ORDER BY p.name COLLATE NOCASE`).all(today,today,soon,workspace);
}
export function personPage(db:KaiDatabase,workspace:string,id:string) {
  const person=db.prepare('SELECT id,name,company,role FROM people WHERE workspace_id=? AND id=?').get(workspace,id);
  if(!person)return null;
  const todos=db.prepare("SELECT id,text,due_on,owner_person_id,quote,conversation_id FROM todos WHERE workspace_id=? AND (person_id=? OR owner_person_id=?) AND status='open' ORDER BY due_on IS NULL,due_on").all(workspace,id,id);
  const notes=db.prepare('SELECT id,text,quote,conversation_id FROM notes WHERE workspace_id=? AND person_id=? ORDER BY rowid DESC').all(workspace,id);
  const conversations=db.prepare(`SELECT id,title,happened_on FROM conversations WHERE workspace_id=? AND id IN (
    SELECT conversation_id FROM notes WHERE workspace_id=? AND person_id=? UNION SELECT conversation_id FROM todos WHERE workspace_id=? AND (person_id=? OR owner_person_id=?)
  ) ORDER BY happened_on DESC,rowid DESC`).all(workspace,workspace,id,workspace,id,id);
  const pending=db.prepare("SELECT conversation_id FROM suggestions WHERE workspace_id=? AND status='proposed' AND json_extract(payload,'$.person_id')=? ORDER BY rowid LIMIT 1").get(workspace,id) as {conversation_id:string}|undefined;
  return {...person,todos,notes,conversations,pending:pending?.conversation_id ?? null};
}
