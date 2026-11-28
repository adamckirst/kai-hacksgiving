import {ExampleChoice} from './AssistantOffer'
import type {QueueItem} from '../types'
import {Button, Card, TextLink} from '../ui'

export function firstRecordingAction(shortcutReady:boolean, item?:QueueItem) {
  if(item) return {href:(item.awaiting_person?'/upload/':'/recordings/')+item.id,label:item.awaiting_person?'Choose the recording type':item.awaiting_speakers?'Identify the speakers':item.status==='failed'?'Open your recording':'See your recording'}
  return shortcutReady?{href:'/upload/new?onboarding=1',label:'Share my first recording'}:{href:'/connect?next=onboarding',label:'Set up the KAI shortcut'}
}

export function FirstRecording({shortcutReady,item,onShortcutReady,busy,onExample,exampleBusy,exampleError}:{shortcutReady:boolean;item?:QueueItem;onShortcutReady?:()=>void;busy?:boolean;onExample?:()=>void;exampleBusy?:boolean;exampleError?:string}) {
  const current=shortcutReady?1:0
  return <section className="space-y-3" aria-label="Your first recording">
    <Card className="p-5">
      <h2 className="mb-3 text-xl font-extrabold">Your first recording</h2>
      <ol className="divide-y divide-zinc-100">{[
        ['Set up the KAI shortcut','Add it once to your iPhone’s share menu.'],
        ['Share one recording','From Voice Memos, WhatsApp or Messages.'],
      ].map(([title,description],index)=>shortcutReady && index===0?null:<li key={title} aria-current={current===index?'step':undefined} className="flex gap-3 py-4">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-violet-100 text-base font-extrabold text-violet-700">{index<current?'✓':index+1}</span>
        <div><h3 className="text-base font-extrabold">{title}</h3><p className="mt-1 text-base/7 text-zinc-600">{description}</p></div>
      </li>)}</ol>
    </Card>
    {!shortcutReady && !item && <Button variant="quiet" wide disabled={busy || !onShortcutReady} onClick={onShortcutReady}>{busy?'Saving…':'I already have the shortcut'}</Button>}
    {!item && <ExampleChoice onExample={onExample} busy={exampleBusy} error={exampleError}/>}
    <div className="text-center"><TextLink href="/upload/new">Choose a file instead</TextLink></div>
  </section>
}
