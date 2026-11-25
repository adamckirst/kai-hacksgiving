import { useEffect,useState } from 'react';
import { Upload } from './look/screens/Upload';
import type { LinkedPerson,PersonChoice } from './look/types';
import { useUpload } from './Upload';
export function UploadPage({readOnly}:{readOnly:boolean}) {
  const [people,setPeople]=useState<LinkedPerson[]|null>(null),[incoming,setIncoming]=useState<{id:string;title:string}|null>(null);
  const [loadError,setLoadError]=useState(''),[error,setError]=useState(''),[starting,setStarting]=useState(false);
  const upload=useUpload(),path=location.pathname.split('/')[2];
  useEffect(()=>{if(readOnly)return;let alive=true;
    async function load(){try {
      const p=await fetch('/api/people');if(!p.ok)throw new Error();const people=await p.json();
      if(path && path!=='new') {
        const r=await fetch('/api/readings/'+encodeURIComponent(path));if(!r.ok)throw new Error();const recording=await r.json();
        if(!recording.awaiting_person){location.replace('/recordings/'+encodeURIComponent(path));return;}
        if(alive){sessionStorage.setItem('kai-upload-'+path,'seen');setIncoming({id:path,title:recording.title});}
      }else if(!path){
        const r=await fetch('/api/uploads');if(!r.ok)throw new Error();const waiting=await r.json();
        if(waiting.length){location.replace('/upload/'+encodeURIComponent(waiting[0].id));return;}
      }
      if(alive)setPeople(people);
    }catch{if(alive)setLoadError('Your upload could not open. Try again.');}}
    void load();return()=>{alive=false;};
  },[path,readOnly]);
  async function start(person:PersonChoice) {
    if(!incoming || starting)return;setStarting(true);setError('');
    try {const r=await fetch('/api/uploads/'+encodeURIComponent(incoming.id)+'/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(person)});const data=await r.json();if(!r.ok)throw new Error(data.error);location.assign('/recordings/'+encodeURIComponent(incoming.id));}
    catch(e){setError(e instanceof Error ? e.message:'KAI could not start. Try again.');setStarting(false);}
  }
  return <Upload people={people} incoming={incoming} readOnly={readOnly} presetPerson={new URLSearchParams(location.search).get('person') ?? undefined} busy={starting || upload.adding} error={error || upload.addError} loadError={loadError} onFiles={upload.onFiles} onStart={person=>void start(person)} onRetry={()=>location.reload()}/>;
}
