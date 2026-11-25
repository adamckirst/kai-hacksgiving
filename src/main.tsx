import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Button } from './catalyst/button';
import '@fontsource/manrope/latin-400.css';
import '@fontsource/manrope/latin-600.css';
import '@fontsource/manrope/latin-700.css';
import './style.css';
type Person = {id:string; name:string; company:string; role:string};
const tabs = [['Home','/home'],['People','/people'],['To-dos','/todos'],['Connect','/connect']];
function App() {
  const route = location.pathname === '/' ? '/people' : location.pathname;
  const title = tabs.find(([,url]) => url === route)?.[0] ?? 'People';
  const [people,setPeople] = useState<Person[]>([]);
  const [state,setState] = useState('loading');
  useEffect(() => {
    if (route !== '/people') return;
    fetch('/api/people').then(res => {if (!res.ok) throw new Error(); return res.json();}).then(data => {setPeople(data);setState('ready');}).catch(() => setState('failed'));
  },[route]);
  return <div className="shell"><header><span className="brand">KAI</span><span>Mara’s notebook</span></header>
    <main><h1>{title}</h1><p className="intro">{route === '/people' ? 'The people in Mara’s conversations.' : 'Your conversations, remembered.'}</p>
      <p className="notice">A read-only demo with made-up data.</p>
      {route === '/people' ? <>
        {state === 'loading' && <p role="status">Loading people…</p>}
        {state === 'failed' && <p role="alert">People could not load. Reload this page to try again.</p>}
        {state === 'ready' && <><h2>Everyone</h2><ul className="people">{people.map(p => <li key={p.id}><h3>{p.name}</h3><p>{p.company}</p><p className="muted">{p.role}</p></li>)}</ul></>}
        <Button color="violet" href="/home" className="primary">Go to Home</Button>
      </> : <><section className="empty"><h2>{title === 'Home' ? 'Start with the people' : title === 'To-dos' ? 'Promises in one place' : 'Bring KAI with you'}</h2><p>{title === 'Home' ? 'Mara’s people are ready to browse. Adding recordings comes next.' : title === 'To-dos' ? 'Mara’s to-dos will appear here in a later step.' : 'Phone sharing and assistant connections come in a later step.'}</p></section><Button color="violet" href="/people" className="primary">See people</Button></>}
    </main><nav aria-label="Main">{tabs.map(([label,url]) => <a key={url} href={url} aria-current={route === url ? 'page' : undefined}>{label}</a>)}</nav><footer>KAI, by Kopal</footer></div>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
