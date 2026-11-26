import { useEffect,useState,useRef } from 'react';
import { Recording as RecordingView } from './look/screens/Recording';
import type { Recording,Payload } from './look/types';
import { Waitlist } from './Waitlist';
export function RecordingScreen({readOnly=false}:{readOnly?:boolean}) {
  const id=location.pathname.split('/').pop();
  const revision=useRef(0),deciding=useRef(false);
  const [recording,setRecording]=useState<Recording|null>(null),[error,setError]=useState(''),[actionError,setActionError]=useState('');
  useEffect(()=> {
    let alive=true;
    async function refresh() {
      if(deciding.current)return;const started=revision.current;
      try {const response=await fetch('/api/readings/'+id);if(!response.ok) throw new Error();const data=await response.json();if(alive && !deciding.current && started===revision.current) {setRecording(data);setError('');}}
      catch {if(alive && !deciding.current && started===revision.current) setError('This recording could not load. Go to Home and try again.');}
    }
    void refresh();const timer=setInterval(()=>void refresh(),1000);return()=>{alive=false;clearInterval(timer);};
  },[id]);
  useEffect(()=>{if(readOnly || !recording || !['ready','failed'].includes(recording.status))return;void fetch('/api/notifications/'+id+'/seen',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:recording.status})}).catch(()=>{});},[id,readOnly,recording?.status]);
  async function retry() {
    setActionError('');
    try {
      const response=await fetch('/api/readings/'+id+'/retry',{method:'POST'});
      if(!response.ok) {const data=await response.json();setActionError(data.error);}
    } catch {setActionError('KAI could not start again. Try once more.');}
  }
  const [editing,setEditing]=useState<string|null>(null),[busy,setBusy]=useState(false);
  async function decision(suggestion:string,choice:'accept'|'reject',edits?:Payload) {
    deciding.current=true;revision.current++;setBusy(true);setActionError('');
    try {
      const response=await fetch('/api/suggestions/'+suggestion+'/decision',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({decision:choice,edits})});
      const data=await response.json();if(!response.ok)throw new Error(data.error);
      const refreshed=await fetch('/api/readings/'+id);if(!refreshed.ok)throw new Error('The decision was saved. Reload to see it.');
      setRecording(await refreshed.json());setEditing(null);
    }catch(e){setActionError(e instanceof Error ? e.message:'The decision could not be saved.');}finally{revision.current++;deciding.current=false;setBusy(false);}
  }
  async function acceptAll() {
    deciding.current=true;revision.current++;setBusy(true);setActionError('');
    try {
      const response=await fetch('/api/readings/'+id+'/accept-all',{method:'POST'});const data=await response.json();if(!response.ok)throw new Error(data.error);
      const refreshed=await fetch('/api/readings/'+id);if(!refreshed.ok)throw new Error('The decisions were saved. Reload to see them.');setRecording(await refreshed.json());
    }catch(e){setActionError(e instanceof Error ? e.message:'The decisions could not be saved.');}finally{revision.current++;deciding.current=false;setBusy(false);}
  }
  return <RecordingView recording={recording} readOnly={readOnly} today={new Date().toISOString().slice(0,10)} busy={busy} editing={editing} error={error} actionError={actionError} waitlist={<Waitlist/>} onDecide={(id,choice)=>void decision(id,choice)} onAcceptAll={()=>void acceptAll()} onEdit={setEditing} onSaveEdit={(id,edits)=>void decision(id,'accept',edits)} onCancelEdit={()=>setEditing(null)} onRetry={()=>void retry()}/>;
}
