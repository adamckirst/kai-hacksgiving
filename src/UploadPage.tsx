import {useOnboardingExample} from './Onboarding';
import { useEffect,useState } from 'react';
import {SharedUploadReturn} from './look/screens/SharedUploadReturn';
import {ShareFirstRecording} from './look/screens/ShareFirstRecording';
import { Upload,type UploadSource } from './look/screens/Upload';
import type { LinkedPerson,PersonChoice } from './look/types';
import { useUpload } from './Upload';
export function UploadPage({readOnly}:{readOnly:boolean}) {
  const example=useOnboardingExample();
  const [setup,setSetup]=useState(false),[remaining,setRemaining]=useState<number|null>(null),[post,setPost]=useState<string|null>(null);
  const source=new URLSearchParams(location.search).get('source');
  const initialSource:UploadSource=source==='voice-memos' || source==='whatsapp' || source==='messages' || source==='telegram' ? source:'files';
  const [people,setPeople]=useState<LinkedPerson[]|null>(null),[incoming,setIncoming]=useState<{id:string;title:string}|null>(null);
  const [loadError,setLoadError]=useState(''),[error,setError]=useState(''),[starting,setStarting]=useState(false);
  const upload=useUpload(),path=location.pathname.split('/')[2];
  const onboarding=new URLSearchParams(location.search).get('onboarding')==='1';
  const [localFile,setLocalFile]=useState(false),[checkAttempt,setCheckAttempt]=useState(0);
  const [returnState,setReturnState]=useState<'checking'|'empty'|'failed'>('checking');
  useEffect(()=>{
    if(readOnly || localFile || (path && path!=='new'))return;
    let alive=true,busy=false,navigating=false,known:Set<string>|undefined;
    async function check(){
      if(!alive || busy || navigating || document.visibilityState==='hidden')return;
      busy=true;
      try {
        const r=await fetch('/api/uploads',{cache:'no-store'});if(!r.ok)throw new Error();
        const waiting:{id:string}[]=await r.json();if(!alive)return;
        // The shortcut's return and onboarding resume any pending recording.
        // A deliberate Files visit only follows shares received after it opened.
        const next=waiting.find(item=>!path || onboarding || (known && !known.has(item.id)));
        known??=new Set(waiting.map(item=>item.id));
        if(next){navigating=true;location.replace('/upload/'+encodeURIComponent(next.id));return;}
        setReturnState('empty');
      }catch{if(alive)setReturnState('failed');}finally{busy=false;}
    }
    void check();const timer=setInterval(()=>void check(),1000);
    const resume=()=>void check();
    window.addEventListener('pageshow',resume);window.addEventListener('focus',resume);document.addEventListener('visibilitychange',resume);
    return()=>{alive=false;clearInterval(timer);window.removeEventListener('pageshow',resume);window.removeEventListener('focus',resume);document.removeEventListener('visibilitychange',resume);};
  },[path,readOnly,localFile,onboarding,checkAttempt]);
  useEffect(()=>{if(readOnly)return;let alive=true;
    async function load(){try {
      const [a,c]=await Promise.all([fetch('/api/access'),fetch('/api/connect')]);if(!a.ok || !c.ok)throw new Error();
      const access=await a.json(),connection=await c.json();if(alive){setRemaining(access.trialSeconds);setPost(access.xPostUrl);setSetup(connection.shortcutReady);}
      const p=await fetch('/api/people');if(!p.ok)throw new Error();const people=await p.json();
      if(path && path!=='new') {
        const r=await fetch('/api/readings/'+encodeURIComponent(path));if(!r.ok)throw new Error();const recording=await r.json();
        if(!recording.awaiting_person){location.replace('/recordings/'+encodeURIComponent(path));return;}
        if(alive){sessionStorage.setItem('kai-upload-'+path,'seen');setIncoming({id:path,title:recording.title});}
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
  if(!path && !readOnly)return <SharedUploadReturn state={returnState} onRetry={()=>{setReturnState('checking');setCheckAttempt(n=>n+1)}}/>;
  if(onboarding && path==='new' && !readOnly && people && !loadError && remaining!==0) return <ShareFirstRecording onExample={example.start} exampleBusy={example.busy} exampleError={example.error} shortcutReady={setup} initialSource={initialSource==='whatsapp' || initialSource==='messages'?initialSource:'voice-memos'}/>;
  return <Upload onLocalFileChange={setLocalFile} shortcutReady={setup} remainingSeconds={remaining} xPostUrl={post} initialSource={initialSource} people={people} incoming={incoming} readOnly={readOnly} presetPerson={new URLSearchParams(location.search).get('person') ?? undefined} busy={starting || upload.adding} error={error || upload.addError} loadError={loadError} onFiles={upload.onFiles} onStart={person=>void start(person)} onRetry={()=>location.reload()}/>;
}
