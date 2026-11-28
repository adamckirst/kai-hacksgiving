import {useOnboardingExample} from './Onboarding';
import { useEffect,useState } from 'react';
import {SharedUploadReturn} from './look/screens/SharedUploadReturn';
import {ShareFirstRecording} from './look/screens/ShareFirstRecording';
import { Upload,type UploadSource } from './look/screens/Upload';
import type { LinkedPerson,PersonChoice } from './look/types';
import { useUpload } from './Upload';
export function UploadPage({readOnly,trialSeconds=null,xPostUrl=null}:{readOnly:boolean;trialSeconds?:number|null;xPostUrl?:string|null}) {
  const example=useOnboardingExample();
  const [setup,setSetup]=useState(false);
  const source=new URLSearchParams(location.search).get('source');
  const initialSource:UploadSource=source==='voice-memos' || source==='whatsapp' || source==='messages' || source==='telegram' ? source:'files';
  const [people,setPeople]=useState<LinkedPerson[]|null>(null),[incoming,setIncoming]=useState<{id:string;title:string}|null>(null);
  const [loadError,setLoadError]=useState(''),[error,setError]=useState(''),[starting,setStarting]=useState(false);
  const upload=useUpload();
  const [path,setPath]=useState(()=>location.pathname.split('/')[2]);
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
        if(next){
          navigating=true;
          // Keep the authenticated document: a full reload repeated access and asset work.
          history.replaceState(null,'','/upload/'+encodeURIComponent(next.id));
          setPeople(null);setIncoming(null);setLoadError('');setError('');setPath(next.id);return;
        }
        setReturnState('empty');
      }catch{if(alive)setReturnState('failed');}finally{busy=false;}
    }
    void check();const timer=setInterval(()=>void check(),1000);
    const resume=()=>void check();
    window.addEventListener('pageshow',resume);window.addEventListener('focus',resume);document.addEventListener('visibilitychange',resume);
    return()=>{alive=false;clearInterval(timer);window.removeEventListener('pageshow',resume);window.removeEventListener('focus',resume);document.removeEventListener('visibilitychange',resume);};
  },[path,readOnly,localFile,onboarding,checkAttempt]);
  useEffect(()=>{if(readOnly || !path)return;let alive=true;const controller=new AbortController();
    async function load(){try {
      const get=async(url:string)=>{const response=await fetch(url,{signal:controller.signal});if(!response.ok)throw new Error();return response.json();};
      // A received recording does not need either connection secrets or fresh quota.
      // Fetch its type-choice data in one network round instead of three.
      const [people,detail]=await Promise.all([get('/api/people'),get(path==='new'?'/api/connect':'/api/readings/'+encodeURIComponent(path))]);
      if(!alive)return;
      if(path!=='new') {
        const recording=detail;
        if(!recording.awaiting_person){location.replace('/recordings/'+encodeURIComponent(path));return;}
        sessionStorage.setItem('kai-upload-'+path,'seen');setIncoming({id:path,title:recording.title});
      }else setSetup(detail.shortcutReady);
      setPeople(people);
    }catch{if(alive)setLoadError('Your upload could not open. Try again.');}}
    void load();return()=>{alive=false;controller.abort();};
  },[path,readOnly]);
  async function start(person:PersonChoice) {
    if(!incoming || starting)return;setStarting(true);setError('');
    try {const r=await fetch('/api/uploads/'+encodeURIComponent(incoming.id)+'/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(person)});const data=await r.json();if(!r.ok)throw new Error(data.error);location.assign('/recordings/'+encodeURIComponent(incoming.id));}
    catch(e){setError(e instanceof Error ? e.message:'KAI could not start. Try again.');setStarting(false);}
  }
  if(!path && !readOnly)return <SharedUploadReturn state={returnState} onRetry={()=>{setReturnState('checking');setCheckAttempt(n=>n+1)}}/>;
  if(onboarding && path==='new' && !readOnly && people && !loadError && trialSeconds!==0) return <ShareFirstRecording onExample={example.start} exampleBusy={example.busy} exampleError={example.error} shortcutReady={setup} initialSource={initialSource==='whatsapp' || initialSource==='messages'?initialSource:'voice-memos'}/>;
  return <Upload key={path} onLocalFileChange={setLocalFile} shortcutReady={setup} remainingSeconds={trialSeconds} xPostUrl={xPostUrl} initialSource={initialSource} people={people} incoming={incoming} readOnly={readOnly} presetPerson={new URLSearchParams(location.search).get('person') ?? undefined} busy={starting || upload.adding} error={error || upload.addError} loadError={loadError} onFiles={upload.onFiles} onStart={person=>void start(person)} onRetry={()=>location.reload()}/>;
}
