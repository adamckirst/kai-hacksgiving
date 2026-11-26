import type {KaiDatabase} from './db';
/** Display context comes from this notebook, never from a name guessed by the model. */
export function suggestionList(db:KaiDatabase,workspace:string,recording:string) {
 const rows=db.prepare('SELECT id,kind,payload,quote,status FROM suggestions WHERE conversation_id=? AND workspace_id=? ORDER BY rowid').all(recording,workspace) as {id:string;kind:string;payload:string;quote:string;status:string}[];
 const names=new Map((db.prepare('SELECT id,name FROM people WHERE workspace_id=?').all(workspace) as {id:string;name:string}[]).map(p=>[p.id,p.name]));
 for(const row of rows)if(row.kind==='person'&&!names.has(row.id)){const p=JSON.parse(row.payload);if(typeof p.name==='string')names.set(row.id,p.name);}
 return rows.map(row=>{
  const p=JSON.parse(row.payload);
  const todo=row.kind==='done'?db.prepare('SELECT text,owner_person_id FROM todos WHERE id=? AND workspace_id=?').get(p.todo_id,workspace) as {text:string;owner_person_id:string|null}|undefined:undefined;
  return {...row,person_name:names.get(p.person_id)??null,owner_name:names.get(todo?.owner_person_id??p.owner_person_id)??null,...(todo?{todo_text:todo.text}:{})};
 });
}
