import { useState } from 'react'
import type { LinkedPerson, PersonChoice } from '../types'
import { Button, Card, Field, Notice, PushedPage, RecordingPicker, WhatIsKai } from '../ui'

export function Upload({ people, incoming, readOnly, presetPerson, busy, error, loadError, onFiles, onStart, onRetry }: {
  people: LinkedPerson[] | null
  incoming?: { id: string; title: string } | null
  readOnly: boolean
  presetPerson?: string
  busy?: boolean
  error?: string
  loadError?: string
  onFiles: (files: File[], person: PersonChoice) => void
  onStart: (person: PersonChoice) => void
  onRetry: () => void
}) {
  const [selected,setSelected]=useState(presetPerson ?? '')
  const [id]=useState(()=>crypto.randomUUID())
  const [name,setName]=useState(''),[company,setCompany]=useState(''),[role,setRole]=useState('')
  const person:PersonChoice=selected==='new' ? {new_person:{id,name:name.trim(),company:company.trim(),role:role.trim()}} : {person_id:selected || null}
  const valid=selected!=='new' || Boolean(name.trim())
  const dock=readOnly ? <WhatIsKai/> : loadError ? <Button variant="primary" wide onClick={onRetry}>Try again</Button> : !people ? <Button variant="primary" wide disabled>Opening…</Button> : incoming ? <Button variant="primary" wide disabled={busy || !valid} onClick={()=>onStart(person)}>{busy ? 'Starting…' : 'Let KAI read'}</Button> : <RecordingPicker busy={busy} disabled={!valid} onFiles={files=>onFiles(files,person)}/>
  return <PushedPage back="/home" backLabel="Back to Home" readOnly={readOnly} dock={dock}>
    <header className="px-1"><h1 className="text-[30px]/9 font-extrabold tracking-tight">Add recordings</h1><p className="mt-2 text-base/7 font-medium text-zinc-600">Choose a person before KAI reads the recording.</p></header>
    {readOnly ? <Card className="p-5 text-base/7 font-medium text-zinc-600">Open your own copy to add recordings.</Card> : loadError ? <Notice tone="error">{loadError}</Notice> : !people ? <Notice>Opening your upload…</Notice> : <>
      {incoming && <Card className="p-5"><p className="text-base font-bold text-violet-700">Shared from your phone</p><h2 className="mt-1 text-lg font-extrabold">{incoming.title}</h2><p className="mt-2 text-base/7 font-medium text-zinc-600">Your recording is attached and waiting for you.</p></Card>}
      <Card className="space-y-4 p-5">
        <label htmlFor="upload-person" className="block text-base font-bold text-zinc-700">Person for this recording</label>
        <select id="upload-person" disabled={busy} value={selected} onChange={e=>setSelected(e.target.value)} className="min-h-14 w-full rounded-2xl bg-zinc-50 px-4 py-3 text-base text-zinc-900 ring-1 ring-zinc-300 focus:ring-2 focus:ring-violet-500">
          <option value="">Continue without a person</option>
          {people.map(p=><option key={p.id} value={p.id}>{p.name}{p.company ? ' · '+p.company : ''}</option>)}
          <option value="new">Add a person</option>
        </select>
        {selected==='new' && <>
          <Field label="Name" id="person-name" required maxLength={120} disabled={busy} value={name} onChange={e=>setName(e.target.value)}/>
          <Field label="Company (optional)" id="person-company" maxLength={200} disabled={busy} value={company} onChange={e=>setCompany(e.target.value)}/>
          <Field label="Role (optional)" id="person-role" maxLength={120} disabled={busy} value={role} onChange={e=>setRole(e.target.value)}/>
        </>}
        <p className="text-base/7 font-medium text-zinc-600">The recording will appear on their page.</p>
      </Card>
      {!incoming && <p className="px-1 text-base/7 font-medium text-zinc-600">Up to five recordings at once, each up to 10 MB and five minutes. They will all be linked to the person you choose.</p>}
      {error && <Notice tone="error">{error}</Notice>}
    </>}
  </PushedPage>
}
