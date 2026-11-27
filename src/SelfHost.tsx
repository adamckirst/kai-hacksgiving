import {useState} from 'react';
import {SelfHost} from './look/screens/SelfHost';
export function SelfHostScreen(){const [busy,setBusy]=useState(false),[copied,setCopied]=useState(false),[error,setError]=useState('');async function copy(){setBusy(true);setError('');try{const r=await fetch('/self-host.md');if(!r.ok)throw Error();await navigator.clipboard.writeText(await r.text());setCopied(true)}catch{setError('Copying is unavailable here. Download the Markdown instructions below.')}finally{setBusy(false)}}return <SelfHost busy={busy} copied={copied} error={error} onCopy={()=>void copy()}/>}
