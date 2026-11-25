import { useEffect,useState } from 'react';
import { Waitlist as WaitlistView,Operator as OperatorView } from './look/screens/Waitlist';
export function Waitlist() {
  const [ready,setReady]=useState(false),[busy,setBusy]=useState(false),[saved,setSaved]=useState(false),[error,setError]=useState(''),[post,setPost]=useState<string|null>(null);
  useEffect(()=> {fetch('/api/waitlist').then(r=>{if(!r.ok)throw new Error();return r.json();}).then(data=>{setPost(data.xPostUrl);setReady(true);}).catch(()=>setError('The list could not load. Reload this page to try again.'));},[]);
  async function submit(email:string) {
    setBusy(true);setError('');
    try {
      const visitor=await fetch('/api/waitlist');if(!visitor.ok)throw new Error('The list is busy. Please try again later.');
      const response=await fetch('/api/waitlist',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email})});const data=await response.json();
      if(!response.ok)throw new Error(data.error);setSaved(true);
    }catch(e){setError(e instanceof Error ? e.message:'Please try again.');}finally{setBusy(false);}
  }
  return <WaitlistView postUrl={post} saved={saved} busy={!ready || busy} error={error} onSubmit={email=>void submit(email)}/>;
}

export function Operator({secret}:{secret:string|null}) {
  const [count,setCount]=useState<number|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  useEffect(()=> {
    if(!secret){setError('Open your private download link to see the list.');return;}
    fetch('/api/operator/count',{headers:{'x-kai-download':secret}}).then(r=>{if(!r.ok)throw new Error();return r.json();}).then(data=>setCount(data.count)).catch(()=>setError('Open your private download link to see the list.'));
  },[secret]);
  async function download() {
    if(!secret)return;setBusy(true);setError('');
    try {
      const response=await fetch('/api/operator/download',{headers:{'x-kai-download':secret}});if(!response.ok)throw new Error();
      const url=URL.createObjectURL(await response.blob()),link=document.createElement('a');link.href=url;link.download='kai-waitlist.txt';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch{setError('The download could not finish. Try again.');}finally{setBusy(false);}
  }
  return <OperatorView count={count} error={error} busy={busy} onDownload={()=>void download()}/>;
}
