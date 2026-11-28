import {useState} from 'react'
import {Dialog,DialogTitle,DialogBody,DialogActions} from '../../catalyst/dialog'
import {Icon} from '../icons'
import {Button,Card,FOCUS,PushedPage,TextLink} from '../ui'
import {apps,appImages,guides} from './Upload'
import {RECORDING_NOTICE} from './DemoInfo'

export function ShareFirstRecording({shortcutReady,initialSource='voice-memos',initialGuide=false}:{shortcutReady:boolean;initialSource?:keyof typeof appImages;initialGuide?:boolean}) {
  const [source,setSource]=useState(initialSource),[showGuide,setShowGuide]=useState(initialGuide)
  const setupHref='/connect?next=onboarding&source='+source
  const app=apps.find(a=>a.id===source)!
  return <PushedPage back="/home" backLabel="Back to Home">
    <header className="px-1"><p className="mb-3 text-base font-bold text-violet-700">Step 2 of 3</p><h1 className="text-[30px]/9 font-extrabold">Share your first recording</h1><p className="mt-3 text-base/7 text-zinc-600">Choose an app to see how to send a recording to KAI.</p></header>
    <Card className="divide-y divide-zinc-100 overflow-hidden" aria-label="Share from an app">{apps.map(a=><button key={a.id} type="button" aria-pressed={source===a.id} onClick={()=>setSource(a.id)} className={`${FOCUS} flex min-h-[68px] w-full items-center gap-3 px-5 text-left text-base font-bold`}><img src={appImages[a.id]} width={30} height={30} alt="" className="size-[30px] rounded-md object-contain"/><span className="flex-1">{a.label}</span><Icon name={source===a.id?'check':'right'} className="size-5 text-violet-700"/></button>)}</Card>
    <Card className="space-y-3 p-5"><h2 className="text-xl font-extrabold">From {app.label}</h2><p className="text-base/7 text-zinc-600">{guides[source][0]}</p><p className="text-base/7">Choose <strong>Send to KAI</strong> from the share menu. You’ll return to choose the recording type before KAI starts.</p><TextLink href={setupHref}>Set up the KAI shortcut for iOS</TextLink></Card>
    {shortcutReady ? app.href ? <Button variant="primary" wide href={app.href}>Open {app.label}</Button> : <Button variant="primary" wide onClick={()=>setShowGuide(true)}>Show Voice Memos steps</Button> : <Button variant="primary" wide href={setupHref}>Set up the KAI shortcut</Button>}
    {app.href && <Button variant="quiet" wide onClick={()=>setShowGuide(true)}>Show sharing steps</Button>}
    <div className="text-center"><TextLink href="/upload/new">Choose a file instead</TextLink></div>
    <p className="px-1 text-base/7 text-zinc-500">One audio file · up to 10 MB · under 30 minutes</p>
    <p className="px-1 text-base/7 text-zinc-500">{RECORDING_NOTICE}</p>
    <Dialog open={showGuide} onClose={()=>setShowGuide(false)} className="!rounded-[28px]">
      <DialogTitle className="!text-xl !font-extrabold">From {app.label}</DialogTitle>
      <DialogBody className="space-y-4 !text-base/7"><ol className="list-decimal space-y-3 pl-5">{guides[source].map((step,index)=><li key={index}>{step}</li>)}</ol><TextLink href={setupHref}>Set up the KAI shortcut for iOS</TextLink></DialogBody>
      <DialogActions><Button variant="quiet" onClick={()=>setShowGuide(false)}>Dismiss instructions</Button></DialogActions>
    </Dialog>
  </PushedPage>
}
