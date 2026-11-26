import {useState} from 'react'
import type {LinkedPerson,SpeakerChoice,Utterance} from '../types'
import {Button,Card,Field,Notice,PushedPage} from '../ui'
export function Speakers({utterances,people,busy,error,onSubmit,initialChoices={}}:{utterances:Utterance[];people:LinkedPerson[]|null;busy?:boolean;error?:string;onSubmit:(choices:Record<string,SpeakerChoice>)=>void;initialChoices?:Record<string,SpeakerChoice>}) {
 const labels=[...new Set(utterances.map(u=>u.speaker))]
 const [choices,setChoices]=useState<Record<string,SpeakerChoice>>(initialChoices)
 const set=(label:string,value:SpeakerChoice)=>setChoices(current=>({...current,[label]:value}))
 const valid=labels.length>0 && labels.every(label=>choices[label] && (choices[label].kind!=='new' || choices[label].person.name.trim()))
 return <PushedPage back="/home" backLabel="Back to Home" dock={<Button variant="primary" wide disabled={!people || !valid || busy} onClick={()=>onSubmit(choices)}>{busy ? 'Starting…':'Create suggestions'}</Button>}>
  <header className="px-1"><h1 className="text-[30px]/9 font-extrabold">Who said what?</h1><p className="mt-3 text-base/7 text-zinc-600">The words are ready. Match each speaker to yourself or a person so KAI can suggest the right tasks and people updates.</p></header>
  {!people && <Notice>Loading your people…</Notice>}
  {labels.map(label=>{const choice=choices[label],passages=utterances.filter(u=>u.speaker===label);return <Card key={label} className="space-y-4 p-5">
   <h2 className="text-lg font-extrabold">Speaker {label}</h2>
   <blockquote className="rounded-2xl bg-violet-50 p-4 text-base/7 text-zinc-700">{passages[0].text}</blockquote>
   {passages.length>1 && <details><summary className="flex min-h-12 cursor-pointer items-center text-base font-bold text-violet-700">More from speaker {label}</summary><div className="space-y-3 text-base/7 text-zinc-600">{passages.slice(1).map((u,i)=><p key={i}>{u.text}</p>)}</div></details>}
   <label className="block text-base font-bold" htmlFor={'speaker-'+label}>Who is speaker {label}?</label>
   <select id={'speaker-'+label} disabled={!people || busy} className="min-h-14 w-full rounded-2xl bg-zinc-50 p-3 text-base ring-1 ring-zinc-300" value={!choice ? '':choice.kind==='person' ? choice.person_id:choice.kind} onChange={e=>{const v=e.target.value;if(v==='owner')set(label,{kind:'owner'});else if(v==='new')set(label,{kind:'new',person:{id:crypto.randomUUID(),name:'',company:'',role:''}});else if(v)set(label,{kind:'person',person_id:v})}}>
    <option value="" disabled>Choose who is speaking</option><option value="owner">Me</option>{people?.map(p=><option key={p.id} value={p.id}>{p.name}{p.company ? ' · '+p.company:''}</option>)}<option value="new">Add a person</option>
   </select>
   {choice?.kind==='new' && <><Field id={'speaker-name-'+label} label={'Name for speaker '+label} maxLength={120} required disabled={busy} value={choice.person.name} onChange={e=>set(label,{...choice,person:{...choice.person,name:e.target.value}})}/><Field id={'speaker-company-'+label} label="Company (optional)" maxLength={200} disabled={busy} value={choice.person.company} onChange={e=>set(label,{...choice,person:{...choice.person,company:e.target.value}})}/></>}
  </Card>})}
  {error && <Notice tone="error">{error}</Notice>}
 </PushedPage>
}
