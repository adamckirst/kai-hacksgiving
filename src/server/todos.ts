import type { KaiDatabase } from './db';
import { ReadingError } from './reading';
import type { Todo } from '../todos';

export function listTodos(db:KaiDatabase,workspace:string,now=new Date()):Todo[] {
  const today=now.toISOString().slice(0,10),tomorrow=new Date(now.getTime()+86400000).toISOString().slice(0,10);
  const rows=db.prepare(`SELECT t.id,t.text,t.due_on,t.owner_person_id,t.person_id,t.quote,t.conversation_id,
    p.name AS person_name,o.name AS owner_name FROM todos t
    LEFT JOIN people p ON p.workspace_id=t.workspace_id AND p.id=t.person_id
    LEFT JOIN people o ON o.workspace_id=t.workspace_id AND o.id=t.owner_person_id
    WHERE t.workspace_id=? AND t.status='open' ORDER BY t.due_on IS NULL,t.due_on,t.text COLLATE NOCASE,t.id`).all(workspace) as Omit<Todo,'group'>[];
  return rows.map(t=>({...t,group:!t.due_on ? 'No date':t.due_on<today ? 'Overdue':t.due_on<=tomorrow ? 'Due soon':'Later'}));
}
export function finishTodo(db:KaiDatabase,workspace:string,id:string) {
  const result=db.prepare("UPDATE todos SET status='done' WHERE workspace_id=? AND id=?").run(workspace,id);
  if(!result.changes)throw new ReadingError('To-do not found.',404);
}
