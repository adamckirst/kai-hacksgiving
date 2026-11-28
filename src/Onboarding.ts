import {useState} from 'react';
export function useOnboardingExample(){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function start(){if(busy)return;setBusy(true);setError('');try{const r=await fetch('/api/onboarding/example',{method:'POST'});const data=await r.json();if(!r.ok)throw Error(data.error);location.assign('/recordings/'+encodeURIComponent(data.id));}catch(e){setError(e instanceof Error?e.message:'The example could not start. Try again.');setBusy(false)}}
 return {busy,error,start:()=>void start()};
}
