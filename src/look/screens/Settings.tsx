import {Icon} from '../icons';
import {useState} from 'react';
import {Dialog,DialogTitle,DialogBody,DialogActions} from '../../catalyst/dialog';
import {Button,Card,Notice,PushedPage,FOCUS,useHref} from '../ui';
export type AccountInfo={signedIn:boolean;email:string|null};
export function Settings({account,busy=false,error='',onSignOut,onDelete,onRetry,initialChoice=null}:{account:AccountInfo|null;busy?:boolean;error?:string;onSignOut:(all:boolean)=>void;onDelete:()=>void;onRetry:()=>void;initialChoice?:'here'|'everywhere'|'delete'|null}) {
 const to=useHref();
 const [choice,setChoice]=useState(initialChoice);
 return <PushedPage back="/home" backLabel="Back to Home" readOnly={account?.signedIn===false}>
  <span data-main-actions="0" hidden/>
  <header className="px-1"><h1 className="text-[32px]/10 font-extrabold">Settings</h1><p className="mt-2 text-base/7 text-zinc-600">Your account and connections.</p></header>
  <Card className="space-y-4 p-5"><h2 className="text-xl font-extrabold">Your account</h2>
   {!account ? <><p className="text-base/7 text-zinc-600">{error?'Your account could not load.':'Opening your account…'}</p>{error && <Button variant="outline" wide onClick={onRetry}>Try again</Button>}</>:!account.signedIn ? <><p className="text-base/7 text-zinc-600">Return to your notebook with a fresh email code.</p><Button variant="outline" wide href="/login">Sign in</Button></>:<>
    {account.email ? <div className="text-base/7"><p className="text-zinc-500">Signed in as</p><p className="break-all font-bold">{account.email}</p></div>:<p className="text-base/7 text-zinc-600">This invitation notebook has no verified email. Signing out will lose this browser’s access.</p>}
    <div className="space-y-2"><Button variant="outline" wide onClick={()=>setChoice('here')}>Sign out</Button><Button variant="quiet" wide onClick={()=>setChoice('everywhere')}>Sign out everywhere</Button></div>
   </>}
  </Card>
  <Card><a href={to("/connect")} aria-label="Connections" className={`${FOCUS} flex min-h-24 items-center gap-3 rounded-[28px] p-5`}><Icon name="link"/><span className="min-w-0 flex-1"><span className="block text-base font-bold">Connections</span><span className="block text-base/7 text-zinc-500">Phone sharing and assistant access</span></span><Icon name="right"/></a></Card>
  {account?.email && <div className="pt-3 text-center"><Button variant="dangerQuiet" icon="trash" onClick={()=>setChoice('delete')}>Delete my account</Button></div>}
  {error && !choice && account && <Notice tone="error">{error}</Notice>}
  <Dialog open={Boolean(choice)} onClose={()=>{if(!busy)setChoice(null)}} className="!rounded-[28px]">
   <DialogTitle className="!text-xl !font-extrabold">{choice==='delete'?'Delete your account?':choice==='everywhere'?'Sign out everywhere?':'Sign out of this browser?'}</DialogTitle>
   <DialogBody className="space-y-3 !text-base/7">
    {choice==='delete'?<><p>Your recordings, people, notes and tasks will be permanently deleted from this notebook, and you’ll leave the waitlist.</p><p>You’ll be signed out everywhere. Your phone shortcut and assistant connection will stop working.</p><p>Protected trial fingerprints and usage counts remain until the demo ends to prevent another free trial. Existing backups are removed when the demo is taken down on 8 December.</p><p className="font-bold">This can’t be undone.</p></>:<p>{choice==='everywhere'?'Your phone shortcut and assistant connection will keep working.':account?.email?'You can return with a fresh email code.':'This invitation notebook has no verified email. You will need your invitation to return.'}</p>}
    {error && <Notice tone="error">{error}</Notice>}
   </DialogBody>
   <DialogActions><Button variant="quiet" disabled={busy} onClick={()=>setChoice(null)}>{choice==='delete'?'Keep my account':'Keep me signed in'}</Button><Button variant={choice==='delete'?'danger':'outline'} disabled={busy} onClick={()=>choice==='delete'?onDelete():onSignOut(choice==='everywhere')}>{busy?'Please wait…':choice==='delete'?'Delete my account':'Confirm sign out'}</Button></DialogActions>
  </Dialog>
 </PushedPage>;
}
