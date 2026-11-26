import type {KaiDatabase} from './db';
import {ReadingError} from './reading';
export type SearchHit={id:string;title:string;detail:string;href:string};
export type SearchResults={library:SearchHit[];people:SearchHit[];tasks:SearchHit[];more:{library:boolean;people:boolean;tasks:boolean}};
const normalize=(value:string)=>value.normalize('NFKD').replace(/\p{M}/gu,'').toLocaleLowerCase('en');
export function registerSearch(db:KaiDatabase) {
 db.function('kai_contains',{deterministic:true},(text,query)=>typeof text==='string'&&typeof query==='string'&&normalize(text).includes(normalize(query))?1:0);
}
function excerpt(text:string,query:string) {
 const at=text.toLocaleLowerCase().indexOf(query.toLocaleLowerCase()),start=Math.max(0,at-50);
 const part=text.slice(start,start+180).replace(/\s+/g,' ').trim();return (start?'…':'')+part+(text.length>start+180?'…':'');
}
export function searchNotebook(db:KaiDatabase,workspace:string,input:unknown):SearchResults {
 if(typeof input!=='string'||!input.trim()||input.trim().length>200)throw new ReadingError('Enter between 1 and 200 characters to search.');
 const q=input.trim();
 const library=db.prepare(`SELECT id,title,summary,text,awaiting_person FROM conversations WHERE workspace_id=? AND kai_contains(title||' '||summary||' '||text,?) ORDER BY happened_at DESC,rowid DESC LIMIT 21`).all(workspace,q) as {id:string;title:string;summary:string;text:string;awaiting_person:number}[];
 const people=db.prepare(`SELECT p.id,p.name,p.company,p.role FROM people p WHERE p.workspace_id=? AND
  (kai_contains(p.name||' '||p.company||' '||p.role,?) OR EXISTS (SELECT 1 FROM notes n WHERE n.workspace_id=p.workspace_id AND n.person_id=p.id AND kai_contains(n.text||' '||n.quote,?))) ORDER BY p.name COLLATE NOCASE,p.id LIMIT 21`).all(workspace,q,q) as {id:string;name:string;company:string;role:string}[];
 const tasks=db.prepare(`SELECT t.id,t.text,t.status,p.name person_name,o.name owner_name FROM todos t
  LEFT JOIN people p ON p.id=t.person_id AND p.workspace_id=t.workspace_id
  LEFT JOIN people o ON o.id=t.owner_person_id AND o.workspace_id=t.workspace_id
  WHERE t.workspace_id=? AND kai_contains(t.text||' '||t.quote||' '||coalesce(p.name,'')||' '||coalesce(o.name,''),?)
  ORDER BY t.status='done',t.due_on IS NULL,t.due_on,t.rowid DESC LIMIT 21`).all(workspace,q) as {id:string;text:string;status:string;person_name:string|null;owner_name:string|null}[];
 return {
  library:library.slice(0,20).map(r=>({id:r.id,title:r.title,detail:excerpt(normalize(r.text).includes(normalize(q))?r.text:r.summary,q),href:(r.awaiting_person?'/upload/':'/recordings/')+encodeURIComponent(r.id)})),
  people:people.slice(0,20).map(p=>({id:p.id,title:p.name,detail:[p.role,p.company].filter(Boolean).join(' · '),href:'/people/'+encodeURIComponent(p.id)})),
  tasks:tasks.slice(0,20).map(t=>({id:t.id,title:t.text,detail:[t.status==='done'?'Done':t.owner_name?`Waiting on ${t.owner_name}`:'Your to-do',t.person_name].filter(Boolean).join(' · '),href:'/todos/'+encodeURIComponent(t.id)})),
  more:{library:library.length>20,people:people.length>20,tasks:tasks.length>20}
 };
}
