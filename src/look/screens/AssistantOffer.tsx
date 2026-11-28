import {Button,Card,Notice,TextLink} from '../ui'
export function AssistantOffer({id,onLater,busy,error}:{id:string;onLater:()=>void;busy?:boolean;error?:string}){
 return <Card className="space-y-3 p-5" aria-label="Connect your assistant"><h2 className="text-xl font-extrabold">Take your notebook into your assistant</h2><p className="text-base/7 text-zinc-600">Connect your assistant to read the people, notes and tasks you keep, and search your recordings.</p><Button variant="outline" wide href={'/connect?next=assistant-onboarding&recording='+encodeURIComponent(id)}>Connect my assistant</Button><Button variant="quiet" wide disabled={busy} onClick={onLater}>{busy?'Saving…':'Later'}</Button>{error && <Notice tone="error">{error}</Notice>}</Card>
}
export function ExampleChoice({onExample,busy,error}:{onExample?:()=>void;busy?:boolean;error?:string}){
 return <div className="space-y-2 text-center"><Button variant="quiet" wide disabled={busy || !onExample} onClick={onExample}>{busy?'Starting the example…':'Try an example instead'}</Button><p className="text-base/7 text-zinc-500">Made-up people, notes and tasks. No audio upload or recording time needed. You choose which suggestions to keep.</p>{error && <Notice tone="error">{error}</Notice>}</div>
}
