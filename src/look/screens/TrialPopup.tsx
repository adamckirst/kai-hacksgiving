import {useState} from 'react'
import {Dialog,DialogTitle} from '../../catalyst/dialog'
import {Button,Field,FOCUS,Notice} from '../ui'
export function TrialPopup({open,onClose,busy,error,codeSent,onSubmit,onVerify,onResend}:{open:boolean;onClose:()=>void;busy?:boolean;error?:string;codeSent?:boolean;onSubmit:()=>void;onVerify:(code:string)=>void;onResend:()=>void}) {
 const [agreed,setAgreed]=useState(false),[code,setCode]=useState('')
 return <Dialog open={open} onClose={onClose} className="!rounded-t-3xl sm:!rounded-3xl">
  <DialogTitle className="!text-2xl !font-extrabold">{codeSent?'Check your email':'Try KAI with your recordings'}</DialogTitle>
  <form className="mt-4 space-y-4" onSubmit={e=>{e.preventDefault();if(codeSent)onVerify(code);else if(agreed)onSubmit()}}>
   {codeSent ? <><p className="text-base/7 text-zinc-600">If this email and network are eligible, a six-digit code is on its way. It lasts ten minutes.</p><Field id="card-code" label="Verification code" type="password" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required value={code} onChange={e=>setCode(e.target.value)}/></> : <>
    <p className="text-base/7 text-zinc-600">Verify the email you entered for 30 minutes of recording time. No payment needed. Available to the first 100 people, with one trial per email and public IP address.</p>
    <p className="text-base/7 text-zinc-600">KAI emails you when a recording is ready or needs another try. You’ll also join the waitlist for one note if KAI becomes a product. Ask us to delete your data at any time.</p>
    <p className="text-base/7 text-zinc-600">AssemblyAI transcribes your recording and Claude reads it. Your private demo notebook is deleted on 8 December. Sign in by email to return to it.</p>
    <p className="text-base/7 text-zinc-600">One audio file at a time, up to 10 MB and under 30 minutes, within your remaining time. Daily limits apply.</p>
    <label className="flex items-center gap-3 text-base/7"><input type="checkbox" required className="login-check size-11 shrink-0" checked={agreed} onChange={e=>setAgreed(e.target.checked)}/><span>I agree to the <a href="/terms" target="_blank" rel="noopener" className={`${FOCUS} inline-flex min-h-11 items-center font-bold text-violet-700 underline`}>demo terms and privacy</a></span></label>
   </>}
   {error && <Notice tone="error">{error}</Notice>}
   <Button variant="primary" wide type="submit" disabled={busy || (!codeSent && !agreed)}>{busy?'Please wait…':codeSent?'Verify and open notebook':'Send verification code'}</Button>
   {codeSent && <Button variant="quiet" wide disabled={busy} onClick={onResend}>Send another code</Button>}
   <Button variant="quiet" wide disabled={busy} onClick={onClose}>Back to browsing</Button>
  </form>
 </Dialog>
}
