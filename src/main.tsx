import {SettingsScreen} from './Settings';
import {LoginScreen} from './Login';
import {Terms} from './look/screens/Terms';
import {SearchScreen} from './Search';
import {TaskScreen} from './Task';
import React,{useEffect,useState} from 'react';
import { createRoot } from 'react-dom/client';
import {flushSync} from 'react-dom';
import './look/kai.css';
import { Opening } from './look/screens/Opening';
import { Welcome } from './look/screens/Welcome';
import { UploadPage } from './UploadPage';
import { HomeScreen } from './Home';
import { RecordingScreen } from './Reading';
import { PeopleScreen,PersonScreen } from './People';
import { TodosScreen } from './Todos';
import {LibraryScreen} from './Library';
import {NotebookStatusProvider} from './look/ui';
import { ConnectScreen } from './Connect';
import { Operator,Waitlist } from './Waitlist';
import {visiblePoll} from './visible-poll';
const downloadSecret=location.pathname==='/operator' ? new URLSearchParams(location.hash.slice(1)).get('download'):null;
type Access = {kind:'public'|'judge';videoUrl:string|null;trialSeconds?:number|null;xPostUrl?:string|null};
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
function App() {
  const [access,setAccess]=useState<Access|null>(null),[failed,setFailed]=useState(false);
  useEffect(()=>{accessRequest.then(setAccess).catch(()=>setFailed(true));},[]);
  const [route,setRoute]=useState(location.pathname);
  useEffect(()=>{
    if(!access)return;
    function openSearch(event:MouseEvent) {
      if(event.defaultPrevented || event.button!==0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)return;
      const link=event.target instanceof Element ? event.target.closest('a'):null;
      if(link?.getAttribute('href')!=='/search' || link.hasAttribute('download') || (link.target && link.target!=='_self'))return;
      event.preventDefault();
      history.pushState(null,'','/search');
      // Safari needs the real input focused inside the tap, before any async work.
      flushSync(()=>setRoute('/search'));
      document.getElementById('search-query')?.focus();
    }
    const restoreRoute=()=>setRoute(location.pathname);
    document.addEventListener('click',openSearch);
    window.addEventListener('popstate',restoreRoute);
    return()=>{document.removeEventListener('click',openSearch);window.removeEventListener('popstate',restoreRoute)};
  },[access]);
  if(route==='/terms')return <Terms fromHome={new URLSearchParams(location.search).get('from')==='home'}/>;
  if(route==='/operator')return <Operator secret={downloadSecret}/>;
  if(route==='/')return <Welcome access={access} failed={failed}/>;
  if(!access) {
    const page=route==='/login'?'Sign in':route.startsWith('/upload') ? 'Add recordings':route.startsWith('/recordings/') ? 'Recording':route.startsWith('/people/') ? 'Person':route==='/people' ? 'People':route.startsWith('/todos/') ? 'Task':route==='/search' ? 'Search':route==='/todos' ? 'Tasks':route==='/library' ? 'Library':route==='/notifications' ? 'Notifications':route==='/settings' ? 'Settings':route==='/connect' ? 'Connections':'Home';
    return <Opening page={page} failed={failed} onRetry={()=>location.reload()}/>;
  }
  if(route==='/login' || (access.kind==='public' && (route==='/upload' || /^\/(?:recordings|upload)\/[a-f0-9-]{36}$/.test(route))))return <LoginScreen signedIn={access.kind==='judge'}/>;
  return <Notebook access={access}/>;
}
function Notebook({access}:{access:Access}) {
  const readOnly=access.kind==='public',route=location.pathname;
  const [unread,setUnread]=useState(0);
  useEffect(()=>{if(readOnly)return;let alive=true;const poll=visiblePoll(async signal=>{try{const r=await fetch('/api/notifications/count',{signal});if(r.ok){const data=await r.json();if(alive)setUnread(data.unread)}}catch{}},5000);return()=>{alive=false;poll.stop()}},[readOnly]);
  function screen() {
    if(route==='/settings')return <SettingsScreen/>;
    if(route==='/search')return <SearchScreen readOnly={readOnly}/>;
    if(route.startsWith('/todos/'))return <TaskScreen readOnly={readOnly}/>;
    if(route==='/library')return <LibraryScreen readOnly={readOnly}/>;
    if(route==='/notifications')return <LibraryScreen readOnly={readOnly} notifications/>;
  if(route==='/try')return <Waitlist trial/>;
  if(route==='/upload' || route.startsWith('/upload/'))return <UploadPage readOnly={readOnly} trialSeconds={access.trialSeconds} xPostUrl={access.xPostUrl}/>;
  if(route==='/home')return <HomeScreen readOnly={readOnly}/>;
  if(route==='/people')return <PeopleScreen readOnly={readOnly}/>;
  if(route.startsWith('/people/'))return <PersonScreen readOnly={readOnly}/>;
  if(route.startsWith('/recordings/'))return <RecordingScreen readOnly={readOnly}/>;
  if(route==='/todos')return <TodosScreen readOnly={readOnly}/>;
  return <ConnectScreen readOnly={readOnly}/>;
  }
  return <NotebookStatusProvider value={{unread}}>{screen()}</NotebookStatusProvider>;
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
