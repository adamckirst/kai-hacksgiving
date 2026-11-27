import {useEffect,useState} from 'react';
import {Settings,type AccountInfo} from './look/screens/Settings';
export function SettingsScreen(){
 const [account,setAccount]=useState<AccountInfo|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
 useEffect(()=>{let alive=true;fetch('/api/account').then(r=>{if(!r.ok)throw Error();return r.json()}).then(data=>{if(alive){setAccount(data);setError('')}}).catch(()=>{if(alive)setError('Your account could not load. Try again.')});return()=>{alive=false}},[attempt]);
 async function action(deleting:boolean,everywhere=false){if(busy)return;setBusy(true);setError('');try{const r=await fetch(deleting?'/api/account/delete':'/api/login/sign-out',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(deleting?{confirm:true}:{everywhere})});if(!r.ok)throw Error();location.assign(deleting?'/':'/login')}catch{setError(deleting?'Your account could not be deleted. Try again.':'Could not sign out. Try again.');setBusy(false)}}
 return <Settings account={account} busy={busy} error={error} onRetry={()=>setAttempt(n=>n+1)} onSignOut={all=>void action(false,all)} onDelete={()=>void action(true)}/>;
}
