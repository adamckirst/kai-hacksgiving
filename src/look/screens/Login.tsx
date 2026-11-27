import {useState} from 'react';
import {Button,Card,Field,Notice,PushedPage,FOCUS,usePersonalInstance} from '../ui';
export function Login({busy,error,codeSent,signedIn,recoverable,setup,blocked,onSubmit,onVerify,onResend,onSignOut}:{setup?:boolean;blocked?:boolean;busy?:boolean;error?:string;codeSent?:boolean;signedIn?:boolean;recoverable?:boolean;onSubmit:(email:string)=>void;onVerify:(code:string)=>void;onResend:()=>void;onSignOut:()=>void}) {
 const personal=usePersonalInstance();
 const [email,setEmail]=useState(''),[code,setCode]=useState(''),[agreed,setAgreed]=useState(false),[leave,setLeave]=useState(false);
 return <PushedPage back="/" backLabel="Back to Welcome">
  <header className="px-1"><h1 className="text-[32px]/10 font-extrabold">{signedIn?'You’re already signed in':codeSent?'Check your email':setup?'Make this KAI yours':'Welcome back'}</h1><p className="mt-3 text-lg/8 font-medium text-zinc-600">{signedIn?'Keep using this notebook, or sign out of this browser before opening another.':codeSent?(setup?'Check your inbox for a six-digit code. It lasts ten minutes.':'If this address belongs to a verified notebook, a six-digit sign-in code is on its way. It lasts ten minutes.'):setup?'Verify your email to become the sole owner of this new, empty notebook.':personal?'Sign in with the owner’s verified email to open this private notebook.':'Sign in with the email you used to try KAI. Your recordings, people and tasks will be here.'}</p></header>
  <Card className="space-y-4 p-5">
   {signedIn ? <>
    <Button variant="primary" wide href="/home">Keep using this notebook</Button>
    {recoverable===false && <><Notice>This invitation notebook has no verified email. Signing out will lose this browser’s access.</Notice><label className="flex items-center gap-3 text-base/7"><input type="checkbox" className="login-check size-11 shrink-0" checked={leave} onChange={e=>setLeave(e.target.checked)}/>I’m ready to leave this notebook</label></>}
    <Button variant="quiet" wide disabled={busy || recoverable===undefined || (!recoverable && !leave)} onClick={onSignOut}>{busy?'Signing out…':'Switch notebooks'}</Button>
   </> : <form className="space-y-4" onSubmit={e=>{e.preventDefault();if(codeSent)onVerify(code);else if(agreed)onSubmit(email)}}>
    {codeSent ? <Field label="Sign-in code" id="login-code" type="password" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required value={code} onChange={e=>setCode(e.target.value)}/> : <>
     <Field label="Email" id="login-email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)}/>
     <p className="text-base/7 text-zinc-600">We’ll send you a sign-in code.</p>
     <label className="flex items-center gap-3 text-base/7"><input type="checkbox" required className="login-check size-11 shrink-0" checked={agreed} onChange={e=>setAgreed(e.target.checked)}/><span>I agree to the <a href="/terms" target="_blank" rel="noopener" className={`${FOCUS} inline-flex min-h-11 items-center font-bold text-violet-700 underline`}>{personal?'instance terms and privacy':'demo terms and privacy'}</a></span></label>
    </>}
    <Button variant="primary" wide type="submit" disabled={blocked || busy || (!codeSent && !agreed)}>{busy?'Please wait…':codeSent?'Sign in and open notebook':'Send sign-in code'}</Button>
    {codeSent && <Button variant="quiet" wide disabled={busy} onClick={onResend}>Send another code</Button>}
   </form>}
   {error && <Notice tone="error">{error}</Notice>}
  </Card>
  {!signedIn && <><p className="px-1 text-base/7 text-zinc-600">{personal?'Only the verified owner can open this notebook. The owner controls its costs, backups and deletion.':'Only verified trial notebooks can be reopened by email. Your notebook is deleted on 8 December.'}</p>{!personal && <Button variant="quiet" href="/try">New to KAI? Try it yourself</Button>}{setup && <Button variant="quiet" href="/login">Already set up? Sign in</Button>}</>}
 </PushedPage>
}
