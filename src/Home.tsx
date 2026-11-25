import { useEffect,useState,useRef } from 'react';
import { Home } from './look/screens/Home';
import type { HomeData } from './look/types';
import { samples } from './samples';
import { Waitlist } from './Waitlist';
import { useQueue } from './Upload';
export function HomeScreen({readOnly}:{readOnly:boolean}) {
  const [home,setHome]=useState<HomeData|null>(null),[error,setError]=useState('');
  const revision=useRef(0);
  const [pending,setPending]=useState<string[]>([]);
  const [pasteBusy,setPasteBusy]=useState(false),[pasteError,setPasteError]=useState('');
  const queue=useQueue(!readOnly),today=new Date().toISOString().slice(0,10);
  const activity=queue.map(item=>item.id+item.status+item.awaiting_person).join('|');
  useEffect(()=>{let alive=true;const started=revision.current;fetch('/api/home').then(r=>{if(!r.ok)throw new Error();return r.json();}).then(data=>{if(alive && started===revision.current)setHome(data);}).catch(()=>{if(alive)setError('Your notebook could not load. Reload this page to try again.');});return()=>{alive=false;};},[activity]);
  useEffect(()=>{const incoming=queue.find(q=>q.awaiting_person && !sessionStorage.getItem('kai-upload-'+q.id));if(incoming){location.assign('/upload/'+encodeURIComponent(incoming.id));}},[queue]);
  async function finish(id:string) {
    revision.current++;setPending(ids=>[...ids,id]);setError('');
    try {const r=await fetch('/api/todos/'+encodeURIComponent(id)+'/done',{method:'POST'});if(!r.ok)throw new Error();setHome(h=>h ? {...h,todos:h.todos.filter(t=>t.id!==id)}:h);}
    catch{setError('This to-do could not be finished. Try ticking it again.');}finally{revision.current++;setPending(ids=>ids.filter(x=>x!==id));}
  }
  async function read(text:string,day:string,sample_id?:string) {
    setPasteBusy(true);setPasteError('');
    try{const response=await fetch('/api/readings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,happened_on:day,sample_id})});const result=await response.json();if(!response.ok)throw new Error(result.error);location.assign('/recordings/'+result.id);}
    catch(e){setPasteError(e instanceof Error ? e.message:'KAI could not start. Try again.');setPasteBusy(false);}
  }
  const dates=home?.todos.map(t=>t.due_on).filter((d):d is string=>Boolean(d)) ?? [];
  const tomorrow=new Date(Date.now()+86400000).toISOString().slice(0,10);
  const due=dates.some(d=>d<today) ? 'overdue':dates.some(d=>d<=tomorrow) ? 'soon':undefined;
  return <Home onTick={id=>void finish(id)} pending={pending} home={home} queue={queue} samples={samples} readOnly={readOnly} today={today} due={due} loadError={error} pasteBusy={pasteBusy} pasteError={pasteError} onRead={(text,day)=>void read(text,day)} onSample={id=>void read('',today,id)} waitlist={<Waitlist/>}/>;
}
