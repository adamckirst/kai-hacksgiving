import {useEffect,useRef,useState} from 'react';
import {Search} from './look/screens/Search';
import type {SearchResults} from './server/search';
export function SearchScreen({readOnly}:{readOnly:boolean}) {
 const initial=(new URLSearchParams(location.search).get('q')??'').slice(0,200);
 const [query,setQuery]=useState(initial),[results,setResults]=useState<SearchResults|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const active=useRef<AbortController|null>(null),version=useRef(0);
 async function run(value:string) {
  active.current?.abort();const current=++version.current,controller=new AbortController();active.current=controller;
  const q=value.trim();setResults(null);setError('');if(!q){setBusy(false);return;}
  setBusy(true);history.replaceState(null,'','/search?q='+encodeURIComponent(q));
  try {const r=await fetch('/api/search?q='+encodeURIComponent(q),{signal:controller.signal});if(!r.ok)throw new Error();const data=await r.json();if(current===version.current)setResults(data);}
  catch{if(!controller.signal.aborted&&current===version.current)setError('Search could not finish. Try again.');}
  finally{if(current===version.current)setBusy(false);}
 }
 useEffect(()=>{if(initial)void run(initial);return()=>{version.current++;active.current?.abort();}},[]);
 function change(value:string){version.current++;active.current?.abort();setQuery(value);setResults(null);setBusy(false);setError('');}
 return <Search query={query} results={results} busy={busy} error={error} readOnly={readOnly} onQuery={change} onSearch={()=>void run(query)}/>;
}
