import {Dialog,DialogTitle} from '../../catalyst/dialog'
import {Button} from '../ui'
import {EntryForm,entryTitle,type EntryFormProps} from './EmailEntry'
export function TrialPopup({open,onClose,...props}:EntryFormProps & {open:boolean;onClose:()=>void}) {
 return <Dialog open={open} onClose={onClose} className="!rounded-t-3xl sm:!rounded-3xl">
  <DialogTitle className="!text-2xl !font-extrabold">{entryTitle(props.stage,props.returning)}</DialogTitle>
  <div className="mt-4"><EntryForm key={props.stage} {...props}/></div>
  <div className="mt-4"><Button variant="quiet" wide disabled={props.busy} onClick={onClose}>Back to browsing</Button></div>
 </Dialog>
}
