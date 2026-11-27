import {useState} from 'react';
import {TERMS_VERSION} from './terms';
import type {EntryStage} from './look/screens/EmailEntry';
export function useEmailEntry(next='/home') {
 const [stage,setStage]=useState<EntryStage>('email'),[returning,setReturning]=useState(false);
 const [email,setEmail]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function post(path:string,body:object){const r=await fetch('/api/entry/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const result=await r.json();if(!r.ok)throw Error(result.error);return result}
 function advance(result:{next:string;audience?:string}){if(result.next==='notebook')location.assign(next);else if(result.next==='terms'){setReturning(result.audience==='returning');setStage('terms')}else throw Error('Please request a new code.')}
 async function request(address:string){setEmail(address);setStage('code');setBusy(true);setError('');try{await post('code',{email:address})}catch(e){setError(e instanceof Error?e.message:'The code could not be requested. Try again.')}finally{setBusy(false)}}
 async function verify(code:string){setBusy(true);setError('');try{advance(await post('verify',{email,code}))}catch(e){setError(e instanceof Error?e.message:'The code could not be checked.')}finally{setBusy(false)}}
 async function agree(){setBusy(true);setError('');try{advance(await post('agree',{termsVersion:TERMS_VERSION}))}catch(e){setError(e instanceof Error?e.message:'Your notebook could not open.')}finally{setBusy(false)}}
 async function cancel(){if(busy)return;setBusy(true);try{await post('cancel',{})}catch{}finally{setStage('email');setReturning(false);setEmail('');setError('');setBusy(false)}}
 return {stage,returning,busy,error,onRequest:(address:string)=>void request(address),onVerify:(code:string)=>void verify(code),onAgree:()=>void agree(),onResend:()=>void request(email),cancel};
}
