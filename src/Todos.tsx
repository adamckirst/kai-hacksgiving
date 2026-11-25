import { useEffect,useState } from 'react';
import { Button } from './catalyst/button';
import { todoGroups,type Todo } from './todos';

export function TodosScreen({readOnly}:{readOnly:boolean|undefined}) {
  const [todos,setTodos]=useState<Todo[]|null>(null),[waiting,setWaiting]=useState(false);
  const [error,setError]=useState(''),[pending,setPending]=useState<string[]>([]),[message,setMessage]=useState('');
  useEffect(()=>{fetch('/api/todos').then(r=>{if(!r.ok)throw new Error();return r.json();}).then(setTodos).catch(()=>setError('Your to-dos could not load. Reload this page to try again.'));},[]);
  async function finish(id:string) {
    setPending(ids=>[...ids,id]);setError('');setMessage('');
    try {
      const response=await fetch('/api/todos/'+encodeURIComponent(id)+'/done',{method:'POST'});
      if(!response.ok)throw new Error();
      setTodos(items=>items?.filter(t=>t.id!==id) ?? null);setMessage('Marked done.');
    }catch{setError('This to-do could not be finished. Try ticking it again.');}
    finally{setPending(ids=>ids.filter(value=>value!==id));}
  }
  const shown=todos?.filter(t=>Boolean(t.owner_person_id)===waiting);
  return <main><h1>To-dos</h1><p className="intro">Promises to keep, and promises to you.</p>
    {readOnly===true && <p className="notice">A read-only demo with made-up data.</p>}
    {readOnly===false && <p>Tick a promise to mark it done.</p>}
    <div className="todo-views" aria-label="Whose to-dos"><Button outline aria-pressed={!waiting} onClick={()=>setWaiting(false)}>Mine</Button><Button outline aria-pressed={waiting} onClick={()=>setWaiting(true)}>Waiting on</Button></div>
    {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    {!todos && !error && <p role="status">Loading to-dos…</p>}
    {shown?.length===0 && <p className="todo-empty">{waiting ? 'Nobody owes you anything right now.':'No open to-dos of yours.'}</p>}
    {todoGroups.map(group=>{const items=shown?.filter(t=>t.group===group);return items?.length ? <section key={group} aria-label={group}><h2 className={group==='Overdue' ? 'overdue':group==='Due soon' ? 'due-soon':undefined}>{group}</h2><ul className="people">{items.map(t=><li key={t.id} className="todo-row">
      {readOnly===false && <button type="button" role="checkbox" aria-checked="false" aria-label={'Mark '+t.text+' done'} disabled={pending.includes(t.id)} onClick={()=>void finish(t.id)} className="todo-tick"><span aria-hidden="true">{pending.includes(t.id) ? '…':''}</span></button>}
      <div><h3>{t.text}</h3>{(waiting ? t.owner_person_id:t.person_id) && <a className="recording-link" href={'/people/'+encodeURIComponent((waiting ? t.owner_person_id:t.person_id)!)}>{waiting ? t.owner_name:t.person_name}</a>}{t.due_on && <p className={group==='Overdue' ? 'overdue':group==='Due soon' ? 'due-soon':'muted'}>Due {t.due_on}</p>}</div>
    </li>)}</ul></section>:null;})}
    <Button color="violet" href="/people" className="primary">See people</Button>
  </main>;
}
