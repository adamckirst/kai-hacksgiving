import { useEffect,useState } from 'react';
import { People,Person as PersonView } from './look/screens/People';
import type { Person,PersonPage } from './look/types';
export function PeopleScreen({readOnly}:{readOnly:boolean}) {
  const [people,setPeople]=useState<Person[]|null>(null),[error,setError]=useState('');
  useEffect(()=>{let alive=true;fetch('/api/people').then(r=>{if(!r.ok)throw new Error();return r.json();}).then(data=>{if(alive)setPeople(data);}).catch(()=>{if(alive)setError('People could not load. Reload this page to try again.');});return()=>{alive=false;};},[]);
  const due=people?.some(p=>p.overdue) ? 'overdue':people?.some(p=>p.soon) ? 'soon':undefined;
  return <People people={people} readOnly={readOnly} due={due} error={error}/>;
}
export function PersonScreen({readOnly}:{readOnly:boolean}) {
  const [person,setPerson]=useState<PersonPage|null>(null),[error,setError]=useState(''),[pending,setPending]=useState<string[]>([]);
  useEffect(()=>{let alive=true;fetch('/api/people/'+location.pathname.split('/').pop()).then(r=>{if(!r.ok)throw new Error();return r.json();}).then(data=>{if(alive)setPerson(data);}).catch(()=>{if(alive)setError('This person could not load. Go to People and try again.');});return()=>{alive=false;};},[]);
  async function finish(id:string) {
    setPending(ids=>[...ids,id]);setError('');
    try{const response=await fetch('/api/todos/'+encodeURIComponent(id)+'/done',{method:'POST'});if(!response.ok)throw new Error();setPerson(value=>value ? {...value,todos:value.todos.filter(t=>t.id!==id)}:value);}
    catch{setError('This to-do could not be finished. Try ticking it again.');}finally{setPending(ids=>ids.filter(value=>value!==id));}
  }
  return <PersonView person={person} readOnly={readOnly} today={new Date().toISOString().slice(0,10)} error={error} pendingTodo={pending} onTick={id=>void finish(id)}/>;
}
