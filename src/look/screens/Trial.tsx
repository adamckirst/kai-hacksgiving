import {Button,Card,PushedPage} from '../ui'
import {EntryForm,entryTitle,type EntryFormProps} from './EmailEntry'
export function Trial(props:EntryFormProps) {
 return <PushedPage back="/" backLabel="Back to Welcome">
  <h1 className="px-1 text-[32px]/10 font-extrabold tracking-tight">{entryTitle(props.stage,props.returning)}</h1>
  <Card className="p-5"><EntryForm key={props.stage} {...props}/></Card>
  <Button variant="quiet" href="/home">Back to browsing</Button>
 </PushedPage>
}
