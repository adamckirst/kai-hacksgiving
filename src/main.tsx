import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Button } from './catalyst/button';
import '@fontsource/manrope/latin-400.css';
import '@fontsource/manrope/latin-600.css';
import '@fontsource/manrope/latin-700.css';
import './style.css';
type Person = {id:string; name:string; company:string; role:string};
type Access = {kind:'public'|'judge';videoUrl:string|null};
async function openAccess(): Promise<Access> {
  const secret = new URLSearchParams(location.hash.slice(1)).get('judge');
  if (location.hash) history.replaceState(null,'',location.pathname);
  if (secret) {
    const response = await fetch('/api/access/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret})});
    if (!response.ok) throw new Error('This link could not be opened.');
  }
  const response = await fetch('/api/access');
  if (!response.ok) throw new Error();
  return response.json();
}
const accessRequest = openAccess();
type Home = {peopleCount:number;todos:{id:string;text:string}[];conversations:{id:string;title:string;summary:string}[]};
const tabs = [['Home','/home'],['People','/people'],['To-dos','/todos'],['Connect','/connect']];
function App() {
  const route = location.pathname;
  const [access,setAccess] = useState<Access|null>(null);
  const [home,setHome] = useState<Home|null>(null);
  const [accessFailed,setAccessFailed] = useState(false);
  useEffect(() => {accessRequest.then(setAccess).catch(() => setAccessFailed(true));},[]);
  const title = tabs.find(([,url]) => url === route)?.[0] ?? 'People';
  const [people,setPeople] = useState<Person[]>([]);
  const [state,setState] = useState('loading');
  useEffect(() => {
    if (!access) return;
    if (route === '/home') {fetch('/api/home').then(r => {if (!r.ok) throw new Error(); return r.json();}).then(setHome).catch(() => setState('failed'));return;}
    if (route !== '/people') return;
    fetch('/api/people').then(res => {if (!res.ok) throw new Error(); return res.json();}).then(data => {setPeople(data);setState('ready');}).catch(() => setState('failed'));
  },[route,access]);
  if (route === '/') return <div className="shell"><header><span className="brand">KAI</span></header><main><h1>Your recordings,<br/>remembered.</h1><p className="intro">KAI turns your recordings into people, notes and to-dos.<br/>You decide what to keep.</p>
    {access?.videoUrl && <section><h2>See the demo</h2><video controls preload="metadata" src={access.videoUrl} aria-label="See the demo" /></section>}
    {accessFailed && <p role="alert">This link could not be opened. Ask for a new link, or look around the demo.</p>}
    {!access && !accessFailed && <p role="status">Opening your notebook…</p>}
    {!access && !accessFailed ? <Button color="violet" className="primary welcome-action" disabled>Opening…</Button> : <Button color="violet" className="primary welcome-action" href="/home">{access?.kind === 'judge' ? 'Try it yourself' : 'Look around'}</Button>}
    </main><footer>KAI, by Kopal</footer></div>;
  return <div className="shell"><header><span className="brand">KAI</span><span>Mara’s notebook</span></header>
    <main><h1>{title}</h1><p className="intro">{route === '/people' ? 'The people in Mara’s conversations.' : 'Your conversations, remembered.'}</p>
      {access?.kind === 'public' && <p className="notice">A read-only demo with made-up data.</p>}
      {route === '/home' ? <>
        {state === 'failed' && <p role="alert">Your notebook could not load. Reload this page to try again.</p>}
        {!home && state !== 'failed' && <p role="status">Loading your notebook…</p>}
        {home && <><h2>Already in your notebook</h2><p>{home.peopleCount} people from Mara’s conversations</p><h2>Open to-dos</h2><ul className="people">{home.todos.map(t => <li key={t.id}>{t.text}</li>)}</ul><h2>Past recordings</h2><ul className="people">{home.conversations.map(c => <li key={c.id}><h3>{c.title}</h3><p>{c.summary}</p></li>)}</ul></>}
        <Button color="violet" href="/people" className="primary">See people</Button>
      </> : route === '/people' ? <>
        {state === 'loading' && <p role="status">Loading people…</p>}
        {state === 'failed' && <p role="alert">People could not load. Reload this page to try again.</p>}
        {state === 'ready' && <><h2>Everyone</h2><ul className="people">{people.map(p => <li key={p.id}><h3>{p.name}</h3><p>{p.company}</p><p className="muted">{p.role}</p></li>)}</ul></>}
        <Button color="violet" href="/home" className="primary">Go to Home</Button>
      </> : <><section className="empty"><h2>{title === 'Home' ? 'Start with the people' : title === 'To-dos' ? 'Promises in one place' : 'Bring KAI with you'}</h2><p>{title === 'Home' ? 'Mara’s people are ready to browse. Adding recordings comes next.' : title === 'To-dos' ? 'Mara’s to-dos will appear here in a later step.' : 'Phone sharing and assistant connections come in a later step.'}</p></section><Button color="violet" href="/people" className="primary">See people</Button></>}
    </main><nav aria-label="Main">{tabs.map(([label,url]) => <a key={url} href={url} aria-current={route === url ? 'page' : undefined}>{label}</a>)}</nav><footer>KAI, by Kopal</footer></div>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
