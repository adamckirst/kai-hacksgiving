import type {RecordingItem} from '../types'
import {Icon} from '../icons'
import {AddRecordings,Card,FOCUS,Notice,PushedPage,Rows,TabPage,useHref,WhatIsKai} from '../ui'
export function RecordingRows({items,notifications=false}:{items:RecordingItem[];notifications?:boolean}) {
 const to=useHref()
 return <Rows>{items.map(item=><li key={item.id}><a href={to((item.awaiting_person ? '/upload/':'/recordings/')+item.id)} className={`${FOCUS} flex min-h-16 items-start gap-3 px-4 py-4`}>
  <span className={`mt-1 grid size-11 shrink-0 place-items-center rounded-2xl ${item.status==='failed' ? 'bg-rose-50 text-rose-700':'bg-violet-50 text-violet-700'}`}><Icon name={item.status==='failed' ? 'warning':notifications ? 'bell':'doc'}/></span>
  <span className="min-w-0 flex-1"><span className="block text-base font-bold">{item.title}</span><span className={`mt-1 block text-base/6 ${item.status==='failed' ? 'text-rose-700':'text-zinc-600'}`}>{item.awaiting_person ? 'Choose a person and start':item.status==='failed' ? 'Needs another try':item.status==='ready' ? item.suggestion_count ? `${item.suggestion_count} suggestions to review`:'Ready to read':item.status==='listening' ? 'KAI is listening…':item.status==='reading' ? 'KAI is reading…':'Waiting'}</span><span className="mt-1 block text-base text-zinc-500">{item.happened_on}</span></span>
  {notifications && !item.seen ? <span className="mt-2 size-2.5 shrink-0 rounded-full bg-violet-600" aria-label="Unread"/>:<Icon name="right" className="mt-2 size-5 text-zinc-400"/>}
 </a></li>)}</Rows>
}
export function Library({items,readOnly,error}:{items:RecordingItem[]|null;readOnly:boolean;error?:string}) {
 return <TabPage current="/library" title="Library" subtitle="Every recording, with its words and suggestions." readOnly={readOnly} dock={readOnly ? <WhatIsKai/>:<AddRecordings/>}>
  {error ? <Notice tone="error">{error}</Notice>:!items ? <Notice>Opening your library…</Notice>:items.length ? <RecordingRows items={items}/>:<Card className="p-5 text-base/7 text-zinc-600">Your recordings will appear here. Add one to get started.</Card>}
 </TabPage>
}
export function Notifications({items,readOnly,error}:{items:RecordingItem[]|null;readOnly:boolean;error?:string}) {
 return <PushedPage back="/home" backLabel="Back to Home" readOnly={readOnly} dock={readOnly ? <WhatIsKai/>:<AddRecordings hideNotifications/>}>
  <header className="px-1"><h1 className="text-[32px]/10 font-extrabold">Notifications</h1><p className="mt-2 text-base/7 text-zinc-600">Your recording updates, all in one place.</p></header>
  {error ? <Notice tone="error">{error}</Notice>:!items ? <Notice>Opening your updates…</Notice>:items.length ? <RecordingRows items={items} notifications/>:<Card className="p-5 text-base/7 text-zinc-600">You’re all caught up. KAI will let you know here when a recording is ready or needs another try.</Card>}
 </PushedPage>
}
