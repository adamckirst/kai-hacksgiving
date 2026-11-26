import {useEffect,useState} from 'react';
import {Task,type TaskData} from './look/screens/Task';
export function TaskScreen({readOnly}:{readOnly:boolean}) {
 const api='/api'+location.pathname,search=new URLSearchParams(location.search).get('search');
 const [task,setTask]=useState<TaskData|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{let alive=true;fetch(api).then(r=>{if(!r.ok)throw new Error();return r.json()}).then(data=>{if(alive)setTask(data)}).catch(()=>{if(alive)setError('This task could not open. Go back and try again.')});return()=>{alive=false}},[api]);
 async function finish(){if(busy)return;setBusy(true);setError('');try{const r=await fetch(api+'/done',{method:'POST'});if(!r.ok)throw new Error();setTask(t=>t?{...t,status:'done'}:t);}catch{setError('This task could not be marked done. Try again.')}finally{setBusy(false)}}
 return <Task task={task} readOnly={readOnly} busy={busy} error={error} onDone={()=>void finish()} onRetry={()=>location.reload()} back={search?'/search?q='+encodeURIComponent(search):'/todos'}/>;
}
