import {useState} from 'react';
import {Button,Card,Notice} from '../ui';
export function Account({readOnly,recoverable,busy,error,onSignOut,initialChoice=null}:{readOnly:boolean;initialChoice?:'here'|'everywhere'|null;recoverable?:boolean;busy?:boolean;error?:string;onSignOut:(all:boolean)=>void}) {
 const [choice,setChoice]=useState<'here'|'everywhere'|null>(initialChoice);
 return <Card className="space-y-3 p-5"><h2 className="text-xl font-extrabold">Sign-in</h2>
  {readOnly?<><p className="text-base/7 text-zinc-600">Return to your notebook with a fresh email code.</p><Button variant="quiet" href="/login">Sign in</Button></>:<>
   <p className="text-base/7 text-zinc-600">{recoverable===undefined?'Checking how to reopen this notebook…':recoverable?'Use a fresh email code to open this same notebook on another device.':'This invitation notebook has no verified email. Signing out will lose this browser’s access.'}</p>
   {choice ? <><Notice>{choice==='everywhere'?'Sign out on every browser? Your phone shortcut and assistant connection will keep working.':'Sign out of this browser?'}</Notice><Button variant="quiet" disabled={busy} onClick={()=>onSignOut(choice==='everywhere')}>{busy?'Signing out…':'Confirm sign out'}</Button><Button variant="quiet" disabled={busy} onClick={()=>setChoice(null)}>Keep me signed in</Button></>:<><Button variant="quiet" disabled={recoverable===undefined} onClick={()=>setChoice('here')}>Sign out</Button><Button variant="quiet" disabled={recoverable===undefined} onClick={()=>setChoice('everywhere')}>Sign out everywhere</Button></>}
  </>}{error && <Notice tone="error">{error}</Notice>}
 </Card>;
}
