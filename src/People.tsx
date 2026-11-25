import { useEffect,useState } from 'react';
import { Button } from './catalyst/button';
export type Person={id:string;name:string;company:string;role:string;overdue:number;soon:number;suggestions:number};
export function PeopleList({people}:{people:Person[]}) {
  const rank=(p:Person)=>p.overdue ? 0:p.soon ? 1:2;
  const needs=people.filter(p=>p.overdue || p.soon || p.suggestions).sort((a,b)=>rank(a)-rank(b) || b.overdue-a.overdue || a.name.localeCompare(b.name));
  const card=(p:Person)=><li key={p.id}><a className="person-link" href={'/people/'+p.id}><h3>{p.name}</h3><p>{p.company}</p><p className="muted">{p.role}</p>{p.overdue>0 ? <p className="overdue">{p.overdue} overdue</p> : p.soon>0 ? <p className="due-soon">{p.soon} due soon</p> : p.suggestions>0 ? <p>{p.suggestions} to review</p>:null}</a></li>;
  return <>{needs.length>0 && <><h2>Needs you</h2><ul className="people needs-you">{needs.map(card)}</ul></>}<h2>Everyone</h2><ul className="people everyone">{people.map(card)}</ul></>;
}
type PersonData={name:string;company:string;role:string;pending:string|null;todos:{id:string;text:string;due_on:string|null;quote:string;owner_person_id:string|null}[];notes:{id:string;text:string;quote:string}[];conversations:{id:string;title:string;happened_on:string}[]};
export function PersonScreen({readOnly}:{readOnly:boolean}) {
  const [person,setPerson]=useState<PersonData|null>(null),[error,setError]=useState('');
  useEffect(()=>{fetch('/api/people/'+location.pathname.split('/').pop()).then(r=>{if(!r.ok)throw new Error();return r.json();}).then(setPerson).catch(()=>setError('This person could not load. Go to People and try again.'));},[]);
  return <main><h1>{person?.name ?? 'Person'}</h1>{readOnly && <p className="notice">A read-only demo with made-up data.</p>}{error && <p role="alert">{error}</p>}{!person && !error && <p role="status">Loading this person…</p>}
    {person && <><p>{person.company}</p><p className="muted">{person.role}</p><h2>Open to-dos</h2>{!person.todos.length && <p>No open to-dos.</p>}<ul className="people">{person.todos.map(t=><li key={t.id}><h3>{t.text}</h3><p>{t.owner_person_id ? 'Waiting on':'Mine'}{t.due_on ? ` · ${t.due_on}`:''}</p><blockquote>{t.quote}</blockquote></li>)}</ul>
    <h2>Notes</h2>{!person.notes.length && <p>No notes yet.</p>}<ul className="people">{person.notes.map(n=><li key={n.id}><h3>{n.text}</h3><blockquote>{n.quote}</blockquote></li>)}</ul>
    <h2>Recordings</h2>{!person.conversations.length && <p>No recordings yet.</p>}<ul className="people">{person.conversations.map(c=><li key={c.id}><a className="recording-link" href={'/recordings/'+c.id}>{c.title}</a><p>{c.happened_on}</p></li>)}</ul></>}
    {person?.pending && !readOnly ? <Button color="violet" href={'/recordings/'+person.pending} className="primary">Review suggestions</Button> : <Button color="violet" href="/people" className="primary">Back to People</Button>}
  </main>;
}
