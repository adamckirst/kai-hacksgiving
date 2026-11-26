import { useState } from 'react'
import { Button, Card, Field, Notice, PushedPage } from '../ui'
export function Trial({busy,error,onSubmit}:{busy?:boolean;error?:string;onSubmit:(email:string)=>void}) {
  const [email,setEmail]=useState('')
  return <PushedPage back="/" backLabel="Back to Welcome">
    <header className="px-1"><h1 className="text-[32px]/10 font-extrabold tracking-tight">Try KAI with your recordings</h1>
      <p className="mt-3 text-lg/8 font-medium text-zinc-600">Join the waitlist and get one hour of recording time in your own private notebook.</p></header>
    <Card className="p-5"><form className="space-y-4" onSubmit={event=>{event.preventDefault();onSubmit(email)}}>
      <Field label="Email" id="trial-email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={event=>setEmail(event.target.value)}/>
      <p className="text-base/7 text-zinc-600">Your email reserves one trial. I’ll also write once if KAI becomes a product. Ask me and I delete it.</p>
      {error && <Notice tone="error">{error}</Notice>}
      <Button variant="primary" wide type="submit" disabled={busy}>{busy ? 'Opening your notebook…':'Join and try KAI'}</Button>
    </form></Card>
    <p className="px-1 text-base/7 text-zinc-600">One hour total, with up to 10 recordings a day, five minutes each. Daily demo limits may mean trying again tomorrow. No payment needed.</p>
    <p className="px-1 text-base/7 text-zinc-600">Keep using this browser to return to your notebook. There is no email login or recovery. Your notebook is deleted on 8 December.</p>
  </PushedPage>
}
