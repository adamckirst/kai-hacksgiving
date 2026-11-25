import type { KaiDatabase } from './db';
export function peopleList(db:KaiDatabase,workspace:string,now=new Date()) {
  const today=now.toISOString().slice(0,10),soon=new Date(now.getTime()+86400000).toISOString().slice(0,10);
  return db.prepare(`SELECT p.id,p.name,p.company,p.role,
    (SELECT count(*) FROM todos t WHERE t.workspace_id=p.workspace_id AND t.person_id=p.id AND t.status='open' AND t.due_on < ?) AS overdue,
    (SELECT count(*) FROM todos t WHERE t.workspace_id=p.workspace_id AND t.person_id=p.id AND t.status='open' AND t.due_on BETWEEN ? AND ?) AS soon,
    (SELECT count(*) FROM suggestions s WHERE s.workspace_id=p.workspace_id AND s.status='proposed' AND json_extract(s.payload,'$.person_id')=p.id) AS suggestions
    FROM people p WHERE p.workspace_id=? ORDER BY p.name COLLATE NOCASE`).all(today,today,soon,workspace);
}
export function personPage(db:KaiDatabase,workspace:string,id:string) {
  const person=db.prepare('SELECT id,name,company,role FROM people WHERE workspace_id=? AND id=?').get(workspace,id) as {id:string;name:string;company:string;role:string}|undefined;
  if(!person)return null;
  const todos=db.prepare("SELECT id,text,due_on,owner_person_id,quote,conversation_id FROM todos WHERE workspace_id=? AND (person_id=? OR owner_person_id=?) AND status='open' ORDER BY due_on IS NULL,due_on").all(workspace,id,id);
  const notes=db.prepare('SELECT id,text,quote,conversation_id FROM notes WHERE workspace_id=? AND person_id=? ORDER BY rowid DESC').all(workspace,id);
  const conversations=db.prepare(`SELECT id,title,happened_on FROM conversations WHERE workspace_id=? AND (person_id=? OR id IN (
    SELECT conversation_id FROM notes WHERE workspace_id=? AND person_id=? UNION SELECT conversation_id FROM todos WHERE workspace_id=? AND (person_id=? OR owner_person_id=?)
  )) ORDER BY happened_on DESC,rowid DESC`).all(workspace,id,workspace,id,workspace,id,id);
  const pending=db.prepare("SELECT conversation_id FROM suggestions WHERE workspace_id=? AND status='proposed' AND json_extract(payload,'$.person_id')=? ORDER BY rowid LIMIT 1").get(workspace,id) as {conversation_id:string}|undefined;
  return {...person,todos,notes,conversations,pending:pending?.conversation_id ?? null};
}
