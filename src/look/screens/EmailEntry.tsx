import {useState} from 'react'
import {Button,Field,FOCUS,Notice} from '../ui'
export type EntryStage='email'|'code'|'terms'
export type EntryFormProps={stage:EntryStage;returning?:boolean;busy?:boolean;error?:string;onRequest?:(email:string)=>void;onVerify?:(code:string)=>void;onAgree?:()=>void;onResend?:()=>void}
export function entryTitle(stage:EntryStage,returning=false,initial='Try KAI with your recordings') {
 return stage==='code'?'Check your email':stage==='terms'?(returning?'Review updated terms':'Try KAI with your recordings'):initial
}
export function EntryForm({stage,returning,busy,error,onRequest,onVerify,onAgree,onResend}:EntryFormProps) {
 const [email,setEmail]=useState(''),[code,setCode]=useState(''),[agreed,setAgreed]=useState(false)
 return <form className="space-y-4" onSubmit={e=>{e.preventDefault();if(busy)return;if(stage==='email')onRequest?.(email);else if(stage==='code')onVerify?.(code);else if(agreed)onAgree?.()}}>
  {stage==='email' && <><Field label="Email" id="entry-email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)}/><p className="text-base/7 text-zinc-600">We’ll send a code to open your notebook or start your trial.</p></>}
  {stage==='code' && <><p className="text-base/7 text-zinc-600">Enter the six-digit code from your email. It lasts ten minutes. Use this browser to finish.</p><Field label="Verification code" id="entry-code" type="password" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required value={code} onChange={e=>setCode(e.target.value)}/></>}
  {stage==='terms' && <>
   {returning ? <p className="text-base/7 text-zinc-600">Review the current terms to reopen your existing notebook. Your recordings and remaining time stay the same.</p> : <p className="text-base/7 text-zinc-600">Your email is verified. Try KAI with 30 minutes of recording time, with no payment needed. Available to the first 100 people, with one trial per email and public IP address. People on the same network share one allowance.</p>}
   <p className="text-base/7 text-zinc-600">KAI emails you when a recording is ready or needs another try. You’ll also join the waitlist for one note if KAI becomes a product. Ask us to delete your data at any time.</p>
   <p className="text-base/7 text-zinc-600">AssemblyAI transcribes your recording and Claude reads it. Your private demo notebook is deleted on 8 December. Sign in by email to return to it.</p>
   <p className="text-base/7 text-zinc-600">One audio file at a time, up to 10 MB and under 30 minutes, within your remaining time. Daily limits apply.</p>
   <label className="flex items-center gap-3 text-base/7"><input type="checkbox" required className="login-check size-11 shrink-0" checked={agreed} onChange={e=>setAgreed(e.target.checked)}/><span>I agree to the <a href="/terms" target="_blank" rel="noopener" className={`${FOCUS} inline-flex min-h-11 items-center font-bold text-violet-700 underline`}>demo terms and privacy</a></span></label>
  </>}
  {error && <Notice tone="error">{error}</Notice>}
  <Button variant="primary" wide type="submit" disabled={busy || (stage==='terms' && !agreed)}>{busy?'Please wait…':stage==='email'?'Send verification code':stage==='code'?'Verify email':'Agree and open notebook'}</Button>
  {stage==='code' && <Button variant="quiet" wide disabled={busy} onClick={onResend}>Send another code</Button>}
 </form>
}
