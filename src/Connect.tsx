import { useEffect,useState } from 'react';
import { Connect } from './look/screens/Connect';
import type { Connection } from './look/types';
export function ConnectScreen({readOnly}:{readOnly:boolean}) {
  const [connection,setConnection]=useState<Connection|null>(null),[error,setError]=useState('');
  const [copied,setCopied]=useState<'upload'|'home'|'assistant'|null>(null),[copyError,setCopyError]=useState<{at:'upload'|'home'|'assistant';text:string}|null>(null);
  useEffect(()=>{if(readOnly)return;let alive=true;
    fetch('/api/connect').then(r=>{if(!r.ok)throw new Error();return r.json();}).then(data=>{if(alive)setConnection({uploadAddress:location.origin+data.uploadPath,assistantAddress:location.origin+data.mcpPath,homeAddress:location.origin+'/home'});}).catch(()=>{if(alive)setError('Your address could not load. Reload this page to try again.');});return()=>{alive=false;};
  },[readOnly]);
  async function copy(which:'upload'|'home'|'assistant',value:string) {
    setCopied(null);setCopyError(null);
    try{await navigator.clipboard.writeText(value);setCopied(which);}catch{setCopyError({at:which,text:'Touch and hold the address to copy it.'});}
  }
  return <Connect connection={connection} readOnly={readOnly} copied={copied} error={error} copyError={copyError} onCopy={(which,value)=>void copy(which,value)}/>;
}
