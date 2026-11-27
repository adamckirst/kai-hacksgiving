import { useEffect,useState } from 'react';
import { Connect } from './look/screens/Connect';
import type { Connection } from './look/types';
export function ConnectScreen({readOnly}:{readOnly:boolean}) {
  const [accountRecoverable,setAccountRecoverable]=useState<boolean>(),[accountBusy,setAccountBusy]=useState(false),[accountError,setAccountError]=useState('');
  useEffect(()=>{if(readOnly)return;fetch('/api/login/session').then(r=>{if(!r.ok)throw Error();return r.json()}).then(s=>setAccountRecoverable(s.recoverable)).catch(()=>setAccountError('Your sign-in details could not load. Reload this page.'))},[readOnly]);
  async function signOut(everywhere:boolean){setAccountBusy(true);setAccountError('');try{const r=await fetch('/api/login/sign-out',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({everywhere})});if(!r.ok)throw Error();location.assign('/login')}catch{setAccountError('Could not sign out. Try again.')}finally{setAccountBusy(false)}}
  const [setupBusy,setSetupBusy]=useState(false);
  const next=new URLSearchParams(location.search).get('next');
  const back=next==='voice-memos' || next==='whatsapp' ? '/upload/new?source='+next:'/home';
  const [connection,setConnection]=useState<Connection|null>(null),[error,setError]=useState('');
  const [copied,setCopied]=useState<'upload'|'home'|'assistant'|null>(null),[copyError,setCopyError]=useState<{at:'upload'|'home'|'assistant';text:string}|null>(null);
  useEffect(()=>{if(readOnly)return;let alive=true;
    fetch('/api/connect').then(r=>{if(!r.ok)throw new Error();return r.json();}).then(data=>{if(alive)setConnection({uploadAddress:location.origin+data.uploadPath,assistantAddress:location.origin+data.mcpPath,homeAddress:location.origin+'/upload',shortcutReady:data.shortcutReady});}).catch(()=>{if(alive)setError('Your address could not load. Reload this page to try again.');});return()=>{alive=false;};
  },[readOnly]);
  async function copy(which:'upload'|'home'|'assistant',value:string) {
    setCopied(null);setCopyError(null);
    try{await navigator.clipboard.writeText(value);setCopied(which);}catch{setCopyError({at:which,text:'Touch and hold the address to copy it.'});}
  }
  async function setupDone(){setSetupBusy(true);setError('');try{const r=await fetch('/api/connect/shortcut',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ready:true})});if(!r.ok)throw new Error();setConnection(c=>c ? {...c,shortcutReady:true}:c);if(next)location.assign(back);}catch{setError('Your setup could not be saved. Try again.')}finally{setSetupBusy(false)}}
  return <Connect accountRecoverable={accountRecoverable} accountBusy={accountBusy} accountError={accountError} onSignOut={all=>void signOut(all)} back={back} setupBusy={setupBusy} onSetupDone={()=>void setupDone()} connection={connection} readOnly={readOnly} copied={copied} error={error} copyError={copyError} onCopy={(which,value)=>void copy(which,value)}/>;
}
