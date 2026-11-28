import {Button,Card,PushedPage,TextLink} from '../ui';

export function SharedUploadReturn({state,onRetry}:{state:'checking'|'empty'|'failed';onRetry:()=>void}) {
 return <PushedPage back="/home" backLabel="Back to Home" dock={<Button variant="primary" wide disabled={state==='checking'} onClick={onRetry}>{state==='checking'?'Checking…':'Check again'}</Button>}>
  <header className="px-1"><h1 className="text-[30px]/9 font-extrabold tracking-tight">Your shared recording</h1></header>
  <Card className="space-y-4 p-5">
   {state==='checking'?<p role="status" className="text-base/7 text-zinc-600">Looking for your recording…</p>:state==='failed'?<p role="alert" className="text-base/7 text-zinc-600">KAI could not check for your recording. Try again.</p>:<>
    <h2 className="text-xl font-extrabold">No recording waiting here</h2>
    <p className="text-base/7 text-zinc-600">Your shortcut may use an address from another notebook. In sharing setup, copy this notebook’s address and paste it into Send to KAI’s URL field. Then share your recording again.</p>
    <p className="text-base/7 text-zinc-600">If the shortcut showed an error, resolve it before sharing again. KAI will open the recording-type choice when your recording arrives here.</p>
    <TextLink href="/connect?next=voice-memos">Check sharing setup</TextLink>
   </>}
  </Card>
 </PushedPage>;
}
