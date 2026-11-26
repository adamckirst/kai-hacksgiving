import { useState } from 'react'
import type { LinkedPerson, PersonChoice } from '../types'
import { Button, Card, Field, FOCUS, Notice, PushedPage, RecordingPicker, WhatIsKai } from '../ui'
import {Icon,type IconName} from '../icons'
export type UploadSource='voice-memos'|'whatsapp'|'files'
const sources:{id:UploadSource;label:string;icon:IconName}[]=[{id:'voice-memos',label:'Voice Memos',icon:'mic'},{id:'whatsapp',label:'WhatsApp',icon:'chat'},{id:'files',label:'Files',icon:'folder'}]
const guides:Record<UploadSource,string[]>={
 'voice-memos':['Choose a recording in Voice Memos.','Tap More (…), then Share. If Options appears, choose Rendered audio.','Choose Send to KAI. Your browser opens so you can choose a person before KAI reads.'],
 whatsapp:['Hold the voice note in WhatsApp, then tap Forward.','Tap Share, then Send to KAI.','Your browser opens so you can choose who sent it before KAI reads.'],
 files:['Save a recording to Files from the app’s Share menu.','Choose the person below, then choose up to five audio files.','KAI checks their length against your remaining time before starting.']
}
const timeLeft=(seconds:number)=>`${Math.floor(seconds/60)} min ${seconds%60} sec`

export function Upload({ people, incoming, readOnly, presetPerson, busy, error, loadError, onFiles, onStart, onRetry, shortcutReady=false, remainingSeconds, xPostUrl, initialSource='files', initialGuide }: {
  shortcutReady?: boolean
  remainingSeconds?: number | null
  xPostUrl?: string | null
  initialSource?: UploadSource
  initialGuide?: UploadSource
  people: LinkedPerson[] | null
  incoming?: { id: string; title: string } | null
  readOnly: boolean
  presetPerson?: string
  busy?: boolean
  error?: string
  loadError?: string
  onFiles: (files: File[], person: PersonChoice) => void
  onStart: (person: PersonChoice) => void
  onRetry: () => void
}) {
  const [source,setSource]=useState<UploadSource>(initialSource),[guide,setGuide]=useState<UploadSource|null>(initialGuide ?? null)
  const exhausted=remainingSeconds===0 && !incoming
  const [selected,setSelected]=useState(presetPerson ?? '')
  const [id]=useState(()=>crypto.randomUUID())
  const [name,setName]=useState(''),[company,setCompany]=useState(''),[role,setRole]=useState('')
  const person:PersonChoice=selected==='new' ? {new_person:{id,name:name.trim(),company:company.trim(),role:role.trim()}} : {person_id:selected || null}
  const valid=selected!=='new' || Boolean(name.trim())
  const dock=readOnly ? <WhatIsKai/> : loadError ? <Button variant="primary" wide onClick={onRetry}>Try again</Button> : !people ? <Button variant="primary" wide disabled>Opening…</Button> : exhausted ? <Button variant="primary" wide href={xPostUrl || '/home'}>{xPostUrl ? 'Show KAI some love':'Back to Home'}</Button> : incoming ? <Button variant="primary" wide disabled={busy || !valid} onClick={()=>onStart(person)}>{busy ? 'Starting…' : 'Let KAI read'}</Button> : source!=='files' ? <Button variant="primary" wide href={!shortcutReady ? '/connect?next='+source : source==='whatsapp' ? 'whatsapp://app':'voicememos://'}>{!shortcutReady ? 'Set up shortcut':source==='whatsapp' ? 'Open WhatsApp':'Open Voice Memos'}</Button> : <RecordingPicker label="Choose audio files" busy={busy} disabled={!valid} onFiles={files=>onFiles(files,person)}/>
  return <PushedPage back="/home" backLabel="Back to Home" readOnly={readOnly} dock={dock}>
    <header className="px-1"><h1 className="text-[30px]/9 font-extrabold tracking-tight">Add recordings</h1><p className="mt-2 text-base/7 font-medium text-zinc-600">{incoming ? 'Choose a person before KAI reads the recording.':'Where is your recording?'}</p></header>
    {readOnly ? <Card className="p-5 text-base/7 font-medium text-zinc-600">Open your own copy to add recordings.</Card> : loadError ? <Notice tone="error">{loadError}</Notice> : !people ? <Notice>Opening your upload…</Notice> : exhausted ? <Card className="space-y-3 p-5"><h2 className="text-xl font-extrabold">Your hour is complete</h2><p className="text-base/7 text-zinc-600">You’ve used your recording time. Your people, tasks and past recordings are still here.</p></Card> : <>
      {!incoming && <Card className="p-3"><div role="group" aria-label="Recording source" className="space-y-2">{sources.map(item=><div key={item.id} className="flex items-center gap-2"><button type="button" aria-pressed={source===item.id} disabled={busy} onClick={()=>{setSource(item.id);setGuide(null)}} className={`${FOCUS} flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-2xl px-4 text-left text-base font-bold ${source===item.id ? 'bg-violet-50 text-violet-700 ring-1 ring-violet-200':'text-zinc-700 hover:bg-zinc-50'}`}><Icon name={item.icon}/><span className="flex-1">{item.label}</span>{source===item.id && <Icon name="check"/>}</button><button type="button" aria-label={'How to add from '+item.label} aria-expanded={guide===item.id} aria-controls="source-guide" onClick={()=>{setSource(item.id);setGuide(guide===item.id ? null:item.id)}} className={`${FOCUS} flex size-12 shrink-0 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100`}><Icon name="info"/></button></div>)}</div></Card>}
      {guide && !incoming && <Card id="source-guide" className="p-5"><h2 className="text-lg font-extrabold">From {sources.find(s=>s.id===guide)!.label}</h2><ol className="mt-3 list-decimal space-y-3 pl-5 text-base/7 text-zinc-600">{guide!=='files' && !shortcutReady && <li>Set up Send to KAI using the button below.</li>}{guides[guide].map(step=><li key={step}>{step}</li>)}</ol></Card>}
      {!incoming && source!=='files' && <Notice>{shortcutReady ? 'Open the app, share your recording to Send to KAI, then choose a person here. If the app does not open, open it from your Home Screen.' : 'First, add Send to KAI to your iPhone’s shortcuts. Then share a recording from the app.'}</Notice>}
      {incoming && <Card className="p-5"><p className="text-base font-bold text-violet-700">Shared from your phone</p><h2 className="mt-1 text-lg font-extrabold">{incoming.title}</h2><p className="mt-2 text-base/7 font-medium text-zinc-600">Your recording is attached and waiting for you.</p></Card>}
      {(incoming || source==='files') && <Card className="space-y-4 p-5">
        <label htmlFor="upload-person" className="block text-base font-bold text-zinc-700">Person for this recording</label>
        <select id="upload-person" disabled={busy} value={selected} onChange={e=>setSelected(e.target.value)} className="min-h-14 w-full rounded-2xl bg-zinc-50 px-4 py-3 text-base text-zinc-900 ring-1 ring-zinc-300 focus:ring-2 focus:ring-violet-500">
          <option value="">Continue without a person</option>
          {people.map(p=><option key={p.id} value={p.id}>{p.name}{p.company ? ' · '+p.company : ''}</option>)}
          <option value="new">Add a person</option>
        </select>
        {selected==='new' && <>
          <Field label="Name" id="person-name" required maxLength={120} disabled={busy} value={name} onChange={e=>setName(e.target.value)}/>
          <Field label="Company (optional)" id="person-company" maxLength={200} disabled={busy} value={company} onChange={e=>setCompany(e.target.value)}/>
          <Field label="Role (optional)" id="person-role" maxLength={120} disabled={busy} value={role} onChange={e=>setRole(e.target.value)}/>
        </>}
        <p className="text-base/7 font-medium text-zinc-600">The recording will appear on their page.</p>
      </Card>}
      {!incoming && remainingSeconds!=null && <p className="px-1 text-base/7 font-bold text-violet-700">{timeLeft(remainingSeconds)} of recording time left</p>}
      {!incoming && <p className="px-1 text-base/7 font-medium text-zinc-600">Up to five recordings at once, each up to 10 MB and five minutes. {source==='files' ? 'They will all be linked to the person you choose.':'Choose a person after sharing.'} {remainingSeconds!=null && 'Together, the files must fit your remaining time.'}</p>}
      {error && <Notice tone="error">{error}</Notice>}
    </>}
  </PushedPage>
}
