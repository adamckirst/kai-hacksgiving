import {Button,Card,Chip,DueChip,Notice,PushedPage,Quote,TextLink} from '../ui'
export type TaskData={id:string;text:string;status:'open'|'done';due_on:string|null;owner_name:string|null;person_name:string|null;person_id:string|null;quote:string;conversation_id:string}
export function Task({task,readOnly,busy,error,onDone,onRetry,back='/todos'}:{task:TaskData|null;readOnly:boolean;busy?:boolean;error?:string;onDone:()=>void;onRetry:()=>void;back?:string}) {
 const dock=!task?(error?<Button variant="primary" onClick={onRetry}>Try again</Button>:<Button variant="primary" disabled>Opening…</Button>):readOnly||task.status==='done'?<Button variant="primary" href="/todos">Back to Tasks</Button>:<Button variant="primary" icon="check" disabled={busy} onClick={onDone}>{busy?'Saving…':'Mark done'}</Button>
 return <PushedPage back={back} backLabel={back.startsWith('/search')?'Back to Search':'Back to Tasks'} readOnly={readOnly} dock={dock}>
  <header className="px-1"><h1 className="text-[30px]/9 font-extrabold break-words">{task?.text??'Task'}</h1></header>
  {error&&<Notice tone="error">{error}</Notice>}{!task&&!error&&<Notice>Opening your task…</Notice>}
  {task&&<><Card className="space-y-3 p-5"><Chip tone={task.status==='done'?'good':'kai'} icon={task.status==='done'?'check':'todo'}>{task.status==='done'?'Done':task.owner_name?`Waiting on ${task.owner_name}`:'Your to-do'}</Chip>{task.person_id&&task.person_name&&<p className="text-base/7">About <TextLink href={'/people/'+encodeURIComponent(task.person_id)}>{task.person_name}</TextLink></p>}<DueChip day={task.due_on} today={new Date().toISOString().slice(0,10)}/></Card><Card className="p-5"><Quote>{task.quote}</Quote><div className="mt-3"><TextLink href={'/recordings/'+encodeURIComponent(task.conversation_id)}>Open source recording</TextLink></div></Card></>}
 </PushedPage>
}
