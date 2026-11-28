import {useOnboardingExample} from './Onboarding';
import { useEffect,useState } from 'react';
import { Connect } from './look/screens/Connect';
import type { Connection } from './look/types';
export function ConnectScreen({readOnly}:{readOnly:boolean}) {
  const example=useOnboardingExample();
  const [assistantId,setAssistantId]=useState<string|null>(null);
  const [setupBusy,setSetupBusy]=useState(false);
  const next=new URLSearchParams(location.search).get('next');
  const onboarding=next==='onboarding';
  const assistantOnly=next==='assistant-onboarding';
  const requestedSource=new URLSearchParams(location.search).get('source');
  const onboardingSource=requestedSource==='voice-memos' || requestedSource==='whatsapp' || requestedSource==='messages' ? requestedSource:undefined;
  const shareHref='/upload/new?onboarding=1'+(onboardingSource?'&source='+onboardingSource:'');
  const back=assistantOnly && assistantId?'/recordings/'+encodeURIComponent(assistantId):onboarding?(onboardingSource?'/upload/new?onboarding=1&source='+onboardingSource:'/home'):next==='voice-memos' || next==='whatsapp' || next==='messages' || next==='telegram' ? '/upload/new?source='+next:'/settings';
  const [connection,setConnection]=useState<Connection|null>(null),[error,setError]=useState('');
  const [copied,setCopied]=useState<'upload'|'home'|'assistant'|null>(null),[copyError,setCopyError]=useState<{at:'upload'|'home'|'assistant';text:string}|null>(null);
  useEffect(()=>{if(readOnly)return;let alive=true;
    fetch('/api/connect').then(r=>{if(!r.ok)throw new Error();return r.json();}).then(data=>{if(alive){setAssistantId(data.assistantRecordingId ?? null);setConnection({uploadAddress:location.origin+data.uploadPath,assistantAddress:location.origin+data.mcpPath,homeAddress:location.origin+'/upload',shortcutReady:data.shortcutReady});}}).catch(()=>{if(alive)setError('Your address could not load. Reload this page to try again.');});return()=>{alive=false;};
  },[readOnly]);
  async function copy(which:'upload'|'home'|'assistant',value:string) {
    setCopied(null);setCopyError(null);
    try{await navigator.clipboard.writeText(value);setCopied(which);}catch{setCopyError({at:which,text:'Touch and hold the address to copy it.'});}
  }
  async function setupDone(ready:boolean){setSetupBusy(true);setError('');try{const r=await fetch('/api/connect/shortcut',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ready})});if(!r.ok)throw new Error();setConnection(c=>c ? {...c,shortcutReady:ready}:c);if(onboarding && ready)location.replace(shareHref);}catch{setError('Your setup could not be saved. Try again.')}finally{setSetupBusy(false)}}
  async function finish(){setSetupBusy(true);setError('');try{const r=await fetch('/api/onboarding/finish',{method:'POST'});if(!r.ok)throw Error();location.assign(assistantId?'/recordings/'+encodeURIComponent(assistantId):'/home')}catch{setError('Setup could not be saved. Try again.');setSetupBusy(false)}}
  return <Connect assistantOnly={assistantOnly} canFinish={Boolean(assistantId)} onFinish={()=>void finish()} onExample={example.start} exampleBusy={example.busy} exampleError={example.error} onboarding={onboarding} shareHref={'/upload/new?onboarding=1'+(onboardingSource?'&source='+onboardingSource:'')} back={back} setupBusy={setupBusy} onSetupDone={ready=>void setupDone(ready)} connection={connection} readOnly={readOnly} copied={copied} error={error} copyError={copyError} onCopy={(which,value)=>void copy(which,value)}/>;
}
