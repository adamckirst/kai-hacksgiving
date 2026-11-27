import {useId,useState} from 'react'
import {Icon} from '../icons'
import {Card,FOCUS,TextLink} from '../ui'
export const RECORDING_NOTICE='Your recording is transcribed by AssemblyAI and read by Claude. It stays in your own copy of this demo, which is deleted on 8 December.'
export function ProcessingInfo({initialOpen=false}:{initialOpen?:boolean}) {
 const [open,setOpen]=useState(initialOpen),id=useId()
 return <div className="relative shrink-0" onMouseEnter={()=>setOpen(true)} onMouseLeave={()=>setOpen(false)} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setOpen(false)}} onKeyDown={event=>{if(event.key==='Escape')setOpen(false)}}>
  <button type="button" aria-label="About recording updates" aria-expanded={open} aria-controls={id} aria-describedby={open?id:undefined} onFocus={()=>setOpen(true)} onClick={()=>setOpen(true)} className={`${FOCUS} flex size-11 items-center justify-center rounded-full text-violet-700 hover:bg-violet-100`}><Icon name="info"/></button>
  {open&&<div id={id} role="tooltip" className="absolute right-0 top-12 z-30 w-[min(300px,80vw)] rounded-2xl bg-white p-4 text-base/7 font-medium text-zinc-600 shadow-lg ring-1 ring-violet-200">KAI will email you when a recording is ready or needs another try, with a link to open it.</div>}
 </div>
}
export function DemoInfo({seconds}:{seconds:number}) {
 const remaining=Math.max(0,Math.min(1800,seconds))
 return <Card className="space-y-3 bg-violet-50/60 p-5"><div className="flex items-center justify-between gap-3"><p className="flex items-center gap-2 text-base font-bold text-violet-700"><Icon name="clock"/>Your demo</p><TextLink href="/terms?from=home">Terms</TextLink></div><p className="text-2xl font-extrabold text-zinc-900">{Math.floor(remaining/60)} min {remaining%60} sec <span className="text-base font-medium text-zinc-600">left</span></p><div role="progressbar" aria-label="Recording time remaining" aria-valuemin={0} aria-valuemax={1800} aria-valuenow={remaining} className="h-2 overflow-hidden rounded-full bg-violet-100"><div className="h-full rounded-full bg-violet-600" style={{width:`${remaining/18}%`}}/></div><p className="text-base/7 text-zinc-600">{remaining?'From your free 30 minutes of recording time.':'You’ve used your 30 minutes. Your people, tasks and recordings are still here.'}</p></Card>
}
