import React,{useEffect,useState} from 'react';
import { createRoot } from 'react-dom/client';
import './look/kai.css';
import { Opening } from './look/screens/Opening';
import { Welcome } from './look/screens/Welcome';
import { UploadPage } from './UploadPage';
import { HomeScreen } from './Home';
import { RecordingScreen } from './Reading';
import { PeopleScreen,PersonScreen } from './People';
import { TodosScreen } from './Todos';
import { ConnectScreen } from './Connect';
import { Operator } from './Waitlist';
const downloadSecret=location.pathname==='/operator' ? new URLSearchParams(location.hash.slice(1)).get('download'):null;
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
function App() {
  const [access,setAccess]=useState<Access|null>(null),[failed,setFailed]=useState(false);
  useEffect(()=>{accessRequest.then(setAccess).catch(()=>setFailed(true));},[]);
  const route=location.pathname;
  if(route==='/operator')return <Operator secret={downloadSecret}/>;
  if(route==='/')return <Welcome access={access} failed={failed}/>;
  if(!access) {
    const page=route.startsWith('/upload') ? 'Add recordings':route.startsWith('/recordings/') ? 'Recording':route.startsWith('/people/') ? 'Person':route==='/people' ? 'People':route==='/todos' ? 'To-dos':route==='/connect' ? 'Connect':'Home';
    return <Opening page={page} failed={failed} onRetry={()=>location.reload()}/>;
  }
  const readOnly=access.kind==='public';
  if(route==='/upload' || route.startsWith('/upload/'))return <UploadPage readOnly={readOnly}/>;
  if(route==='/home')return <HomeScreen readOnly={readOnly}/>;
  if(route==='/people')return <PeopleScreen readOnly={readOnly}/>;
  if(route.startsWith('/people/'))return <PersonScreen readOnly={readOnly}/>;
  if(route.startsWith('/recordings/'))return <RecordingScreen readOnly={readOnly}/>;
  if(route==='/todos')return <TodosScreen readOnly={readOnly}/>;
  return <ConnectScreen readOnly={readOnly}/>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
