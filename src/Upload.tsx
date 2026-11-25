import { useEffect,useState } from 'react';
import { Button } from './catalyst/button';
export function Upload() {
  const [files,setFiles]=useState<File[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  async function send() {
    if(files.length<1 || files.length>5 || files.some(f=>f.size>10000000)) {setError('Choose one to five recordings, each up to 10 MB.');return;}
    setBusy(true);setError('');const body=new FormData();
    files.forEach(f=>body.append('recordings',f));body.append('dates',JSON.stringify(files.map(f=>f.lastModified)));
    try {const response=await fetch('/api/recordings',{method:'POST',body});const result=await response.json();if(!response.ok) throw new Error(result.error);location.assign('/recordings/'+result.ids[0]);}
    catch(e) {setError(e instanceof Error ? e.message : 'The recordings could not be added.');setBusy(false);}
  }
  return <section><h2>Add recordings</h2><p>Your recording is transcribed by AssemblyAI and read by Claude. It stays in your own copy of this demo, which is deleted on 8 December.</p><label htmlFor="recordings">Choose up to five audio files</label><input className="audio-picker" id="recordings" type="file" accept=".m4a,.opus,.ogg,.mp3,.wav" multiple onChange={e=>setFiles(Array.from(e.target.files ?? []))}/><p>Up to 10 MB and five minutes each.</p>{error && <p role="alert">{error}</p>}<Button className="primary" color="violet" disabled={busy} onClick={()=>void send()}>{busy ? 'Adding…':'Add recordings'}</Button></section>;
}
type Item={id:string;title:string;status:string;error:string|null};
export function Queue() {
  const [items,setItems]=useState<Item[]>([]);
  useEffect(()=> {let alive=true;async function refresh(){try{const response=await fetch('/api/queue');if(response.ok && alive)setItems(await response.json());}catch{}}
    void refresh();const timer=setInterval(()=>void refresh(),1000);return()=>{alive=false;clearInterval(timer);};},[]);
  if(!items.length)return null;
  const active=items.findIndex(i=>['listening','reading'].includes(i.status));
  return <section><h2>{active>=0 ? `${items[active].status==='listening' ? 'Listening to':'Reading'} ${active+1} of ${items.length}`:'Your recordings'}</h2><ul className="people">{items.map(item=><li key={item.id}><a className="recording-link" href={'/recordings/'+item.id}>{item.title}</a><p>{item.status==='failed' ? item.error : item.status==='ready' ? 'Ready' : item.status==='waiting' ? 'Waiting' : item.status==='listening' ? 'KAI is listening…':'KAI is reading…'}</p></li>)}</ul></section>;
}
