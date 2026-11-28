import {audioFileError} from '../../audio-file'
import {RECORDING_NOTICE} from './DemoInfo'
import { useState } from 'react'
import type { LinkedPerson, PersonChoice,RecordingType } from '../types'
import { Button, Card, Field, FOCUS, Notice, PushedPage, RecordingPicker, Segmented, WhatIsKai, TextLink, useHref } from '../ui'
import {Icon} from '../icons'
import {Dialog,DialogTitle,DialogBody,DialogActions} from '../../catalyst/dialog'
export type UploadSource='voice-memos'|'whatsapp'|'messages'|'telegram'|'files'
export const appImages={whatsapp:new URL('../brands/whatsapp.svg',import.meta.url).href,messages:new URL('../brands/messages.png',import.meta.url).href,'voice-memos':new URL('../brands/voice-memos.png',import.meta.url).href}
export const apps:{id:keyof typeof appImages;label:string;href:string}[]=[
 {id:'voice-memos',label:'Voice Memos',href:''},
 {id:'whatsapp',label:'WhatsApp',href:'whatsapp://app'},
 {id:'messages',label:'Messages',href:'sms:'}
]
export const guides:Record<UploadSource,string[]>={
 'voice-memos':['Open Voice Memos from your Home Screen and choose a recording.','Tap More (…), then Share. If Options appears, choose Rendered audio.','Choose Send to KAI. Your browser opens so you can choose the recording type.','Or choose Save to Files, then use Choose audio file here.'],
 whatsapp:['Open the conversation and hold the voice note, then tap Forward.','Tap Share, then Send to KAI.','Return to KAI and choose who sent it before transcription.'],
 messages:['Open Messages and the conversation with your recording. If a new message opens, close it first.','Touch and hold the audio. Choose Save to Voice Memos if offered, then share it from Voice Memos through Send to KAI.','If sharing is unavailable, save the audio to Files and choose it here.'],
 telegram:['Open Telegram, then tap Chats and choose the conversation.','Hold the recording, then use its Share menu and choose Send to KAI.','If sharing is unavailable, save the audio to Files and choose it here.'],
 files:['Save a recording to Files from the app’s Share menu.','Choose one audio file, then tell KAI what kind of recording it is.','KAI checks its length against your remaining time before starting.']
}
const timeLeft=(seconds:number)=>`${Math.floor(seconds/60)} min ${seconds%60} sec`

export function Upload({ people, incoming, readOnly, presetPerson, busy, error, loadError, onFiles, onStart, onRetry, onLocalFileChange, shortcutReady=false, remainingSeconds, xPostUrl, initialSource='files', initialGuide, initialType, initialFile }: {
  onLocalFileChange?: (chosen:boolean)=>void
  initialFile?:File
  initialType?:RecordingType
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
  const to=useHref()
  const [guide,setGuide]=useState<UploadSource|null>(initialGuide ?? (initialSource==='files'?null:initialSource))
  const [file,setFile]=useState<File|null>(initialFile??null),[fileError,setFileError]=useState('')
  const attached=Boolean(incoming || file)
  function chooseFiles(files:File[]){const invalid=audioFileError(files);setFileError(invalid);if(!invalid){setFile(files[0]);setGuide(null);onLocalFileChange?.(true)}}
  const exhausted=remainingSeconds===0 && !incoming
  const [recordingType,setRecordingType]=useState<RecordingType|undefined>(initialType)
  const [selected,setSelected]=useState(presetPerson ?? '')
  const [id]=useState(()=>crypto.randomUUID())
  const [name,setName]=useState(''),[company,setCompany]=useState(''),[role,setRole]=useState('')
  const person:PersonChoice=recordingType!=='voice' ? {recording_type:recordingType,person_id:null}:selected==='new' ? {recording_type:recordingType,new_person:{id,name:name.trim(),company:company.trim(),role:role.trim()}} : {recording_type:recordingType,person_id:selected || null}
  const valid=Boolean(recordingType) && (recordingType!=='voice' || (selected==='new' ? Boolean(name.trim()):Boolean(selected)))
  const dock=readOnly ? <WhatIsKai/> : loadError ? <Button variant="primary" wide onClick={onRetry}>Try again</Button> : !people ? <Button variant="primary" wide disabled>Opening…</Button> : exhausted ? <Button variant="primary" wide href={xPostUrl || '/home'}>{xPostUrl ? 'Show KAI some love':'Back to Home'}</Button> : attached ? <Button variant="primary" wide disabled={busy || !valid} onClick={()=>incoming?onStart(person):file&&onFiles([file],person)}>{busy ? 'Starting…' : recordingType==='multiple' ? 'Transcribe recording':'Let KAI read'}</Button> : undefined
  return <PushedPage back="/home" backLabel="Back to Home" readOnly={readOnly} dock={dock}>
    <header className="px-1"><h1 className="text-[30px]/9 font-extrabold tracking-tight">Add recordings</h1>{attached && <p className="mt-2 text-base/7 font-medium text-zinc-600">Tell KAI whose words these are.</p>}</header>
    {readOnly ? <Card className="p-5 text-base/7 font-medium text-zinc-600">Open your own copy to add recordings.</Card> : loadError ? <Notice tone="error">{loadError}</Notice> : !people ? <Notice>Opening your upload…</Notice> : exhausted ? <Card className="space-y-3 p-5"><h2 className="text-xl font-extrabold">Your trial time is complete</h2><p className="text-base/7 text-zinc-600">You’ve used your recording time. Your people, tasks and past recordings are still here.</p></Card> : <>
      {!attached && <>
       <section className="rounded-[28px] border border-dashed border-violet-400 bg-violet-50/30 p-5 text-center">
        <span className="mx-auto mb-3 grid size-12 place-items-center rounded-2xl bg-violet-100 text-violet-700"><Icon name="folder"/></span>
        <h2 className="text-xl font-extrabold">Choose a recording from Files</h2>
        <p className="mt-2 mb-5 text-base/7 text-zinc-500">One audio file · up to 10 MB · under 30 minutes</p>
        <RecordingPicker label="Choose audio file" busy={busy} onFiles={chooseFiles}/>
       </section>
       <section className="space-y-3">
        <h2 className="px-1 text-lg/7 font-bold">or share from any of your apps, for example:</h2>
        <Card className="divide-y divide-zinc-100 overflow-hidden" aria-label="Share from an app">{apps.map(app=><div key={app.id} className="flex items-center gap-2 pr-2 pl-4">
         {app.id==='voice-memos' ? <button className={`${FOCUS} flex min-h-[68px] min-w-0 flex-1 items-center gap-3 rounded-xl text-left text-base font-bold`} onClick={()=>setGuide(app.id)}><img src={appImages[app.id]} alt="" width={30} height={30} className="size-[30px] rounded-md object-contain"/>{app.label}</button> : <a className={`${FOCUS} flex min-h-[68px] min-w-0 flex-1 items-center gap-3 rounded-xl text-base font-bold`} href={shortcutReady?app.href:to('/connect?next='+app.id)} onClick={()=>setGuide(app.id)}><img src={appImages[app.id]} alt="" width={30} height={30} className="size-[30px] rounded-md object-contain"/>{app.label}</a>}
         <button className={`${FOCUS} grid size-11 shrink-0 place-items-center rounded-full text-zinc-500`} aria-label={'How to add from '+app.label} aria-haspopup="dialog" aria-expanded={guide===app.id} onClick={()=>setGuide(app.id)}><Icon name="info"/></button>
        </div>)}</Card>
        <div className="flex items-center justify-between gap-2 px-1 text-base/7 text-zinc-500"><span>Uses Send to KAI</span><TextLink href={'/connect?next='+(guide&&guide!=='files'?guide:'voice-memos')}>Sharing setup</TextLink></div>
       </section>
       <Dialog open={Boolean(guide)} onClose={()=>setGuide(null)} className="!rounded-[28px]">
        <DialogTitle className="!text-xl !font-extrabold">From {guide==='voice-memos'?'Voice Memos':guide==='files'?'Files':guide==='telegram'?'Telegram':apps.find(a=>a.id===guide)?.label}</DialogTitle>
        <DialogBody className="space-y-4 !text-base/7">
         <ol className="list-decimal space-y-3 pl-5">{guide && guides[guide].map((step,index)=><li key={index}>{step.split('Send to KAI').map((part,i)=><span key={i}>{i>0 && <a href={to('/connect?next='+guide)} className={`${FOCUS} inline-flex min-h-11 items-center rounded-lg font-bold text-violet-700 underline`}>Send to KAI</a>}{part}</span>)}</li>)}</ol>
         <TextLink href={'/connect?next='+(guide==='files'?'voice-memos':guide)}>Set up the KAI shortcut for iOS</TextLink>
        </DialogBody>
        <DialogActions><Button variant="quiet" onClick={()=>setGuide(null)}>Dismiss instructions</Button></DialogActions>
       </Dialog>
      </>}
      {file && !incoming && <Card className="space-y-2 p-5"><p className="text-base font-bold text-violet-700">Chosen from Files</p><h2 className="break-words text-lg font-extrabold">{file.name}</h2><p className="text-base/7 text-zinc-600">Ready to upload after you choose the recording type.</p><Button variant="quiet" disabled={busy} onClick={()=>{setFile(null);setFileError('');onLocalFileChange?.(false)}}>Choose a different file</Button></Card>}
      {incoming && <Card className="p-5"><p className="text-base font-bold text-violet-700">Shared from your phone</p><h2 className="mt-1 text-lg font-extrabold">{incoming.title}</h2><p className="mt-2 text-base/7 font-medium text-zinc-600">Your recording is attached and waiting for you.</p></Card>}
      {attached && <Card className="space-y-4 p-4"><h2 className="px-1 text-lg font-extrabold">What kind of recording?</h2>
        <fieldset disabled={busy}><Segmented<RecordingType|''> label="Recording type" value={recordingType ?? ''} onChange={value=>setRecordingType(value || undefined)} items={[{key:'memo',label:'My memo'},{key:'voice',label:'Someone else'},{key:'multiple',label:'Multiple speakers'}]}/></fieldset>
        <p className="px-1 text-base/7 text-zinc-600">{recordingType==='memo' ? 'Your own thoughts or a recap. No speaker to choose; it stays in your library.' : recordingType==='voice' ? 'A voice note from one person. Choose who sent it before KAI reads.' : recordingType==='multiple' ? 'Transcribe first, then identify who said what before KAI creates suggestions.' : 'Choose one to tell KAI whose words these are.'}</p>
      </Card>}
      {attached && recordingType==='voice' && <Card className="space-y-4 p-5">
        <label htmlFor="upload-person" className="block text-base font-bold text-zinc-700">Who is speaking?</label>
        <select id="upload-person" disabled={busy} value={selected} onChange={e=>setSelected(e.target.value)} className="min-h-14 w-full rounded-2xl bg-zinc-50 px-4 py-3 text-base text-zinc-900 ring-1 ring-zinc-300 focus:ring-2 focus:ring-violet-500">
          <option value="">Choose the person who sent it</option>
          {people.map(p=><option key={p.id} value={p.id}>{p.name}{p.company ? ' · '+p.company : ''}</option>)}
          <option value="new">Add a person</option>
        </select>
        {selected==='new' && <>
          <Field label="Name" id="person-name" required maxLength={120} disabled={busy} value={name} onChange={e=>setName(e.target.value)}/>
          <Field label="Company (optional)" id="person-company" maxLength={200} disabled={busy} value={company} onChange={e=>setCompany(e.target.value)}/>
          <Field label="Role (optional)" id="person-role" maxLength={120} disabled={busy} value={role} onChange={e=>setRole(e.target.value)}/>
        </>}
        <p className="text-base/7 font-medium text-zinc-600">This person is the speaker, not just someone mentioned. KAI will distinguish their tasks from yours.</p>
      </Card>}
      {!incoming && remainingSeconds!=null && <p className="px-1 text-base/7 font-bold text-violet-700">{timeLeft(remainingSeconds)} of recording time left</p>}
      {!incoming && remainingSeconds!=null && <p className="px-1 text-base/7 text-zinc-600">The recording must fit your remaining time.</p>}
      {fileError && <Notice tone="error">{fileError}</Notice>}
      {error && <Notice tone="error">{error}</Notice>}
    </>}
    {!readOnly && <p className="px-1 text-base/7 text-zinc-500">{RECORDING_NOTICE}</p>}
  </PushedPage>
}
