import { useState } from 'react';
import { Button } from './catalyst/button';
import { Input } from './catalyst/input';
import { Textarea } from './catalyst/textarea';
export function SuggestionEditor({kind,payload,onSave,onCancel,busy}:{kind:string;payload:string;onSave:(edits:Record<string,unknown>)=>void;onCancel:()=>void;busy:boolean}) {
  const [value,setValue]=useState<Record<string,string|null>>(JSON.parse(payload));
  const update=(key:string,text:string|null)=>setValue({...value,[key]:text});
  return <form onSubmit={e=>{e.preventDefault();onSave(value);}}><h2>Edit suggestion</h2>{kind==='person' ? <>{['name','company','role'].map(key=><div key={key}><label htmlFor={'edit-'+key}>{key==='name' ? 'Name':key==='company' ? 'Company':'Role'}</label><Input id={'edit-'+key} required value={value[key] ?? ''} onChange={e=>update(key,e.target.value)}/></div>)}</> : <><label htmlFor="edit-words">Words to keep</label><Textarea id="edit-words" required value={value.text ?? ''} onChange={e=>update('text',e.target.value)}/></>}
    {kind==='todo' && <><label htmlFor="edit-due">Due date</label><Input id="edit-due" type="date" value={value.due_on ?? ''} onChange={e=>update('due_on',e.target.value || null)}/><label htmlFor="edit-owner">Who owes this?</label><select className="date-field" id="edit-owner" value={value.owner_person_id ? 'them':'mine'} onChange={e=>update('owner_person_id',e.target.value==='mine' ? null:(value.person_id ?? null))}><option value="mine">Mine</option><option value="them">Waiting on</option></select></>}
    <div className="decision-actions"><Button outline type="button" disabled={busy} onClick={onCancel}>Cancel</Button><Button color="violet" type="submit" disabled={busy}>Save and accept</Button></div>
  </form>;
}
