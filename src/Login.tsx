import {useEffect,useState} from 'react';
import {Login} from './look/screens/Login';
import {useEmailEntry} from './EmailEntry';
export function loginDestination(value:string|null) {
 return value && /^(?:\/home|\/upload\/new|\/recordings\/[a-f0-9-]{36})$/.test(value)?value:'/home';
}
export function LoginScreen({signedIn}:{signedIn:boolean}) {
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[recoverable,setRecoverable]=useState<boolean>();
 const next=loginDestination(new URLSearchParams(location.search).get('next')??location.pathname);
 const entry=useEmailEntry(next);
 useEffect(()=>{if(signedIn)fetch('/api/login/session').then(r=>{if(!r.ok)throw Error();return r.json()}).then(s=>setRecoverable(s.recoverable)).catch(()=>setError('Your sign-in details could not load. Reload this page.'))},[signedIn]);
 async function post(path:string,body:unknown){const r=await fetch('/api/login/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await r.json();if(!r.ok)throw Error(data.error);return data}
 async function signOut(){setBusy(true);setError('');try{await post('sign-out',{everywhere:false});location.reload()}catch{setError('Could not sign out. Try again.')}finally{setBusy(false)}}
 return <Login {...entry} signedIn={signedIn} recoverable={recoverable} busy={entry.busy||busy} error={error||entry.error} onSignOut={()=>void signOut()}/>;
}
