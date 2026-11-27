import {useEffect,useState} from 'react';
import {Login} from './look/screens/Login';
import {TERMS_VERSION} from './terms';
export function loginDestination(value:string|null) {
 return value && /^(?:\/home|\/upload\/new|\/recordings\/[a-f0-9-]{36})$/.test(value)?value:'/home';
}
export function LoginScreen({signedIn}:{signedIn:boolean}) {
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[email,setEmail]=useState(''),[recoverable,setRecoverable]=useState<boolean>();
 const next=loginDestination(new URLSearchParams(location.search).get('next')??location.pathname);
 useEffect(()=>{if(signedIn)fetch('/api/login/session').then(r=>{if(!r.ok)throw Error();return r.json()}).then(s=>setRecoverable(s.recoverable)).catch(()=>setError('Your sign-in details could not load. Reload this page.'))},[signedIn]);
 async function post(path:string,body:unknown){const r=await fetch('/api/login/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await r.json();if(!r.ok)throw Error(data.error);return data}
 async function send(address:string){setBusy(true);setError('');try{await post('code',{email:address,termsVersion:TERMS_VERSION});setEmail(address)}catch(e){setError(e instanceof Error?e.message:'The code could not be requested. Try again.')}finally{setBusy(false)}}
 async function verify(code:string){setBusy(true);setError('');try{await post('verify',{email,code,termsVersion:TERMS_VERSION});location.assign(next)}catch(e){setError(e instanceof Error?e.message:'The code could not be checked.')}finally{setBusy(false)}}
 async function signOut(){setBusy(true);setError('');try{await post('sign-out',{everywhere:false});location.reload()}catch{setError('Could not sign out. Try again.')}finally{setBusy(false)}}
 return <Login signedIn={signedIn} recoverable={recoverable} busy={busy} error={error} codeSent={Boolean(email)} onSubmit={address=>void send(address)} onVerify={code=>void verify(code)} onResend={()=>void send(email)} onSignOut={()=>void signOut()}/>;
}
