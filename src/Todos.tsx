import { useEffect,useState } from 'react';
import { Todos } from './look/screens/Todos';
import type { Todo } from './look/types';

export function TodosScreen({readOnly}:{readOnly:boolean}) {
  const [todos,setTodos]=useState<Todo[]|null>(null);
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
  return <Todos todos={todos} readOnly={readOnly} today={new Date().toISOString().slice(0,10)} error={error} message={message} pending={pending} onTick={id=>void finish(id)}/>;
}
