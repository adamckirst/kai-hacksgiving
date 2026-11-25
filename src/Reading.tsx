import { useEffect,useState,useRef } from 'react';
import { Button } from './catalyst/button';
import { Textarea } from './catalyst/textarea';
import { samples } from './samples';
import { SuggestionEditor } from './SuggestionEditor';
import { Waitlist } from './Waitlist';
export function AddTranscript() {
  const [text,setText]=useState(''),[day,setDay]=useState(new Date().toISOString().slice(0,10)),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  async function submit(sample_id?:string) {
    setBusy(true);setError('');
    try {
      const response=await fetch('/api/readings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,happened_on:day,sample_id})});
      const result=await response.json();if(!response.ok) throw new Error(result.error);
      location.assign('/recordings/'+result.id);
    } catch(e) {setError(e instanceof Error ? e.message : 'KAI could not start. Try again.');setBusy(false);}
  }
  return <section><h2>Paste a transcript</h2><form onSubmit={e=>{e.preventDefault();void submit();}}>
    <label htmlFor="words">The words from your conversation</label><Textarea id="words" rows={5} maxLength={20000} value={text} onChange={e=>setText(e.target.value)} required/>
    <label htmlFor="day">Conversation date</label><input className="date-field" id="day" type="date" value={day} onChange={e=>setDay(e.target.value)} required/>
    <p>{text.length.toLocaleString()} of 20,000 characters</p>
    {error && <p role="alert">{error}</p>}<Button outline type="submit" className="primary" disabled={busy}>{busy ? 'Starting…':'Let KAI read'}</Button>
    </form><h2>Or try a sample</h2><div className="samples">{samples.map(s=><Button key={s.id} outline disabled={busy} onClick={()=>void submit(s.id)}>{s.title}</Button>)}</div></section>;
}
type Suggestion={id:string;kind:string;payload:string;quote:string;status:string};
type Recording={title:string;summary:string;text:string;status:string;error:string|null;progress:string|null;suggestions:Suggestion[]};
export function RecordingScreen({readOnly=false}:{readOnly?:boolean}) {
  const id=location.pathname.split('/').pop();
  const revision=useRef(0),deciding=useRef(false);
  const [recording,setRecording]=useState<Recording|null>(null),[error,setError]=useState(''),[actionError,setActionError]=useState(''),[quote,setQuote]=useState('');
  useEffect(()=> {
    let alive=true;
    async function refresh() {
      if(deciding.current)return;const started=revision.current;
      try {const response=await fetch('/api/readings/'+id);if(!response.ok) throw new Error();const data=await response.json();if(alive && !deciding.current && started===revision.current) {setRecording(data);setError('');}}
      catch {if(alive && !deciding.current && started===revision.current) setError('This recording could not load. Go to Home and try again.');}
    }
    void refresh();const timer=setInterval(()=>void refresh(),1000);return()=>{alive=false;clearInterval(timer);};
  },[id]);
  async function retry() {
    setActionError('');
    try {
      const response=await fetch('/api/readings/'+id+'/retry',{method:'POST'});
      if(!response.ok) {const data=await response.json();setActionError(data.error);}
    } catch {setActionError('KAI could not start again. Try once more.');}
  }
  const [editing,setEditing]=useState<string|null>(null),[busy,setBusy]=useState(false);
  async function decision(suggestion:string,choice:'accept'|'reject',edits?:Record<string,unknown>) {
    deciding.current=true;revision.current++;setBusy(true);setActionError('');
    try {
      const response=await fetch('/api/suggestions/'+suggestion+'/decision',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({decision:choice,edits})});
      const data=await response.json();if(!response.ok)throw new Error(data.error);
      const refreshed=await fetch('/api/readings/'+id);if(!refreshed.ok)throw new Error('The decision was saved. Reload to see it.');
      setRecording(await refreshed.json());setEditing(null);
    }catch(e){setActionError(e instanceof Error ? e.message:'The decision could not be saved.');}finally{revision.current++;deciding.current=false;setBusy(false);}
  }
  async function acceptAll() {
    deciding.current=true;revision.current++;setBusy(true);setActionError('');
    try {
      const response=await fetch('/api/readings/'+id+'/accept-all',{method:'POST'});const data=await response.json();if(!response.ok)throw new Error(data.error);
      const refreshed=await fetch('/api/readings/'+id);if(!refreshed.ok)throw new Error('The decisions were saved. Reload to see them.');setRecording(await refreshed.json());
    }catch(e){setActionError(e instanceof Error ? e.message:'The decisions could not be saved.');}finally{revision.current++;deciding.current=false;setBusy(false);}
  }
  const proposed=recording?.suggestions.filter(s=>s.status==='proposed') ?? [];
  const edit=recording?.suggestions.find(s=>s.id===editing);
  const start=quote ? recording?.text.indexOf(quote) ?? -1 : -1;
  return <main><h1>{recording?.title ?? 'Recording'}</h1>{readOnly && <p className="notice">A read-only demo with made-up data.</p>}{error && <p role="alert">{error}</p>}{actionError && <p role="alert">{actionError}</p>}
    {!recording && !error && <p role="status">Loading your recording…</p>}
    {recording && <><p className="intro">{recording.summary}</p><p role="status">{recording.status==='ready' ? 'KAI has finished reading.' : recording.status==='failed' ? recording.error : recording.status==='listening' ? 'KAI is listening…' : recording.status==='waiting' ? 'Waiting for KAI…' : recording.progress ?? 'KAI is reading…'}</p>
      <h2>KAI suggests</h2>{edit && <SuggestionEditor key={edit.id} kind={edit.kind} payload={edit.payload} busy={busy} onCancel={()=>setEditing(null)} onSave={edits=>void decision(edit.id,'accept',edits)}/>}<ul className="people">{recording.suggestions.map(s=>{const p=JSON.parse(s.payload);return <li key={s.id}><h3>{s.kind==='done' ? `Mark “${p.text}” done` : p.name ?? p.text}</h3><p>{s.kind==='done' ? 'Kept promise' : s.kind==='person' ? 'New person' : s.kind==='note' ? 'Note' : p.owner_person_id ? 'Waiting on' : 'Your to-do'}{p.due_on ? ` · ${p.due_on}`:''}</p><Button outline className="quote-button" onClick={()=>{setQuote(s.quote);document.getElementById('recording-words')?.scrollIntoView({block:'center'});}}>{s.quote}</Button>{s.status==='proposed' && !readOnly ? <div className="decision-actions"><Button outline disabled={busy || !!editing} onClick={()=>void decision(s.id,'accept')}>Accept</Button>{s.kind!=='done' && <Button outline disabled={busy || !!editing} onClick={()=>setEditing(s.id)}>Edit</Button>}<Button outline disabled={busy || !!editing} onClick={()=>void decision(s.id,'reject')}>Reject</Button></div> : <p className="decision-status">{s.status==='accepted' ? 'Accepted':s.status==='rejected' ? 'Rejected':'For review'}</p>}</li>;})}</ul>
      {recording.status==='ready' && !recording.suggestions.length && <p>KAI found no suggestions in these words.</p>}
      {recording.status==='ready' && proposed.length===0 && <Waitlist/>}
      <h2 id="recording-words">The words</h2><p className="transcript">{start>=0 ? <>{recording.text.slice(0,start)}<mark>{quote}</mark>{recording.text.slice(start+quote.length)}</> : recording.text}</p>
    </>}
    {!editing && (recording?.status==='failed' ? <Button color="violet" className="primary" onClick={()=>void retry()}>Try again</Button> : !readOnly && proposed.length>0 ? <Button color="violet" className="primary" disabled={busy || recording?.status!=='ready'} onClick={()=>void acceptAll()}>Accept all</Button> : <Button color="violet" className="primary" href={readOnly ? '/home':'/people'}>{readOnly ? 'Back to Home':'See people'}</Button>)}
  </main>;
}
