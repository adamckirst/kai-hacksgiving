import {useState} from 'react';
import {EntryForm,entryTitle,type EntryFormProps} from './EmailEntry';
import {Button,Card,Notice,PushedPage} from '../ui';
export function Login({signedIn,recoverable,onSignOut,...entry}:EntryFormProps & {signedIn?:boolean;recoverable?:boolean;onSignOut:()=>void}) {
 const {busy,error,stage}=entry;
 const [leave,setLeave]=useState(false);
 return <PushedPage back="/" backLabel="Back to Welcome">
  <header className="px-1"><h1 className="text-[32px]/10 font-extrabold">{signedIn?'You’re already signed in':entryTitle(stage,entry.returning,'Welcome back')}</h1>{signedIn && <p className="mt-3 text-lg/8 font-medium text-zinc-600">Keep using this notebook, or sign out of this browser before opening another.</p>}</header>
  <Card className="space-y-4 p-5">
   {signedIn ? <>
    <Button variant="primary" wide href="/home">Keep using this notebook</Button>
    {recoverable===false && <><Notice>This invitation notebook has no verified email. Signing out will lose this browser’s access.</Notice><label className="flex items-center gap-3 text-base/7"><input type="checkbox" className="login-check size-11 shrink-0" checked={leave} onChange={e=>setLeave(e.target.checked)}/>I’m ready to leave this notebook</label></>}
    <Button variant="quiet" wide disabled={busy || recoverable===undefined || (!recoverable && !leave)} onClick={onSignOut}>{busy?'Signing out…':'Switch notebooks'}</Button>
   </> : <EntryForm key={stage} {...entry}/>}
   {signedIn && error && <Notice tone="error">{error}</Notice>}
  </Card>
  {!signedIn && <><p className="px-1 text-base/7 text-zinc-600">Only verified trial notebooks can be reopened by email. Your notebook is deleted on 8 December.</p><Button variant="quiet" href="/try">New to KAI? Try it yourself</Button></>}
 </PushedPage>
}
