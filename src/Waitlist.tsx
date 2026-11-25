import { useEffect,useState } from 'react';
import { Button } from './catalyst/button';
export function Waitlist() {
  const [email,setEmail]=useState(''),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[saved,setSaved]=useState(false),[error,setError]=useState(''),[post,setPost]=useState<string|null>(null);
  useEffect(()=> {fetch('/api/waitlist').then(r=>{if(!r.ok)throw new Error();return r.json();}).then(data=>{setPost(data.xPostUrl);setReady(true);}).catch(()=>setError('The list could not load. Reload this page to try again.'));},[]);
  async function submit() {
    setBusy(true);setError('');
    try {
      const response=await fetch('/api/waitlist',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email})});const data=await response.json();
      if(!response.ok)throw new Error(data.error);setEmail('');setSaved(true);
    }catch(e){setError(e instanceof Error ? e.message:'Please try again.');}finally{setBusy(false);}
  }
  return <section className="waitlist" aria-label="Keep me posted"><h2>Would you use something like this?</h2><p>Leave your email and I’ll write once if it becomes a product.</p><p>Only for that one note; ask me and I delete it.</p>
    {saved ? <p role="status">You’re on the list. Thank you.</p> : <form onSubmit={e=>{e.preventDefault();void submit();}}><label htmlFor="waitlist-email">Email</label><input id="waitlist-email" className="date-field" type="email" autoComplete="email" maxLength={254} required value={email} onChange={e=>setEmail(e.target.value)}/><Button outline className="connect-copy" type="submit" disabled={!ready || busy}>{busy ? 'Saving…':'Keep me posted'}</Button></form>}
    {error && <p role="alert">{error}</p>}{post ? <a className="recording-link" href={post} target="_blank" rel="noreferrer">See the X post</a>:<p className="muted">The X post will be linked here when it is published.</p>}
  </section>;
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
  return <main><h1>Your waitlist</h1>{count!==null ? <><p>{count} {count===1 ? 'address':'addresses'}</p><p>Use these only for the one note promised on the card. Download before deleting the demo on 8 December.</p><Button color="violet" className="primary" disabled={busy} onClick={()=>void download()}>{busy ? 'Downloading…':'Download addresses'}</Button></>:<><p>{error || 'Opening the list…'}</p><Button color="violet" className="primary" href="/home">Go to Home</Button></>}{count!==null && error && <p role="alert">{error}</p>}</main>;
}
