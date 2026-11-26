import { useState } from 'react'
import { Button, Card, Field, Notice, PushedPage } from '../ui'
export function Trial({busy,error,codeSent,onSubmit,onVerify,onResend}:{busy?:boolean;error?:string;codeSent?:boolean;onSubmit:(email:string)=>void;onVerify?:(code:string)=>void;onResend?:()=>void}) {
 const [email,setEmail]=useState(''),[code,setCode]=useState('')
 return <PushedPage back="/" backLabel="Back to Welcome">
  <header className="px-1"><h1 className="text-[32px]/10 font-extrabold tracking-tight">{codeSent ? 'Check your email':'Try KAI with your recordings'}</h1>
   <p className="mt-3 text-lg/8 font-medium text-zinc-600">{codeSent ? 'If this email and network are eligible, a six-digit code is on its way. It lasts ten minutes.':'Join the waitlist and verify your email for an hour of recording time. Available to the first 100 people.'}</p></header>
  <Card className="p-5"><form className="space-y-4" onSubmit={event=>{event.preventDefault();if(codeSent)onVerify?.(code);else onSubmit(email)}}>
   {codeSent ? <Field label="Verification code" id="trial-code" type="password" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required value={code} onChange={e=>setCode(e.target.value)}/> : <>
    <Field label="Email" id="trial-email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={event=>setEmail(event.target.value)}/>
    <p className="text-base/7 text-zinc-600">We’ll send a verification code through Resend. Your email reserves one trial. KAI will email you when a recording is ready, with suggestion counts and a link to review. I’ll also write once if KAI becomes a product. Ask me and I delete it.</p>
   </>}
   {error && <Notice tone="error">{error}</Notice>}
   <Button variant="primary" wide type="submit" disabled={busy}>{busy ? 'Please wait…':codeSent ? 'Verify and open notebook':'Send verification code'}</Button>
   {codeSent && <Button variant="quiet" wide disabled={busy} onClick={onResend}>Send another code</Button>}
  </form></Card>
  <p className="px-1 text-base/7 text-zinc-600">One trial per email and public IP address. People sharing a network share one allowance. We keep a protected fingerprint of the address to enforce this.</p>
  <p className="px-1 text-base/7 text-zinc-600">One hour total, with up to 10 recordings a day, five minutes each. Daily demo limits may mean trying again tomorrow. No payment needed.</p>
  <p className="px-1 text-base/7 text-zinc-600">Keep using this browser to return to your notebook. Verifying again won’t refill your time. Your notebook is deleted on 8 December.</p>
  <Button variant="quiet" href="/home">Look around or join the waitlist</Button>
 </PushedPage>
}
