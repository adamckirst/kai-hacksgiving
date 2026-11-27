import { useEffect,useRef,useState } from 'react';
import type { QueueItem,PersonChoice } from './look/types';
export function useUpload() {
  const [error,setError]=useState(''),[busy,setBusy]=useState(false);
  const sending=useRef(false);
  async function send(files:File[],person?:PersonChoice) {
    if(!files.length || sending.current)return;
    if(files.length!==1 || files.some(f=>f.size>10000000)){setError('Choose one recording, up to 10 MB.');return;}
    if(files.some(f=>!f.size || !/\.(m4a|opus|ogg|mp3|wav)$/i.test(f.name))){setError('Choose an audio file: M4A, OPUS, OGG, MP3 or WAV.');return;}
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
    async function refresh(){try{const response=await fetch('/api/queue');const data=await response.json();if(response.ok && alive)setItems(data);}catch{}}
    void refresh();const timer=setInterval(()=>void refresh(),1000);return()=>{alive=false;clearInterval(timer);};
  },[enabled]);return items;
}
