import {audioFileError} from './audio-file';
import { useEffect,useRef,useState } from 'react';
import type { QueueItem,PersonChoice } from './look/types';
import {visiblePoll} from './visible-poll';
export function useUpload() {
  const [error,setError]=useState(''),[busy,setBusy]=useState(false);
  const sending=useRef(false);
  async function send(files:File[],person?:PersonChoice) {
    if(!files.length || sending.current)return;
    const invalid=audioFileError(files);if(invalid){setError(invalid);return;}
    sending.current=true;setBusy(true);setError('');const body=new FormData();
    if(person)body.append('person',JSON.stringify(person));
    files.forEach(f=>body.append('recordings',f));body.append('dates',JSON.stringify(files.map(f=>f.lastModified)));
    try {const response=await fetch('/api/recordings',{method:'POST',body});const result=await response.json();if(!response.ok)throw new Error(result.error);location.assign('/recordings/'+result.ids[0]);}
    catch(e){setError(e instanceof Error ? e.message:'The recordings could not be added.');sending.current=false;setBusy(false);}
  }
  return {adding:busy,addError:error,onFiles:(files:File[],person?:PersonChoice)=>void send(files,person)};
}
export function useQueue(enabled:boolean) {
  const [items,setItems]=useState<QueueItem[]>([]);
  useEffect(()=>{if(!enabled)return;let alive=true;
    const poll=visiblePoll(async signal=>{try{const response=await fetch('/api/queue',{signal});const data=await response.json();if(response.ok && alive)setItems(data);}catch{}},1000);
    return()=>{alive=false;poll.stop();};
  },[enabled]);return items;
}
