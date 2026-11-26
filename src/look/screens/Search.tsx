import type {SearchResults} from '../../server/search'
import {Icon} from '../icons'
import {Button,Card,Field,FOCUS,Notice,PushedPage,Rows,SectionLabel,useHref} from '../ui'
export function Search({query,results,busy,error,readOnly,onQuery,onSearch}:{query:string;results:SearchResults|null;busy?:boolean;error?:string;readOnly:boolean;onQuery:(query:string)=>void;onSearch:()=>void}) {
 const to=useHref(),empty=results&&!results.library.length&&!results.people.length&&!results.tasks.length
 return <PushedPage back="/home" backLabel="Back to Home" readOnly={readOnly} dock={<Button variant="primary" icon="search" type="submit" form="notebook-search" disabled={busy||!query.trim()}>{busy?'Searching…':'Search'}</Button>}>
  <header className="px-1"><h1 className="text-[32px]/10 font-extrabold">Search</h1><p className="mt-2 text-base/7 text-zinc-600">Library, people and tasks, in one place.</p></header>
  <form id="notebook-search" onSubmit={event=>{event.preventDefault();onSearch()}}><Field label="Search your notebook" id="search-query" type="search" maxLength={200} value={query} onChange={event=>onQuery(event.target.value)} placeholder="A name, a phrase or a task"/></form>
  {busy?<Notice>Searching your notebook…</Notice>:error?<Notice tone="error">{error}</Notice>:empty?<Card className="p-5 text-base/7 text-zinc-600">No matches. Try a different name or a few words from the recording.</Card>:results?<div className="space-y-6">{(['library','people','tasks'] as const).map(kind=>results[kind].length>0&&<section key={kind} aria-label={kind==='library'?'Library':kind==='people'?'People':'Tasks'}>
   <SectionLabel count={results[kind].length}>{kind==='library'?'Library':kind==='people'?'People':'Tasks'}</SectionLabel>
   <Rows>{results[kind].map(item=><li key={item.id}><a href={to(item.href+'?search='+encodeURIComponent(query.trim()))} className={`${FOCUS} flex min-h-16 items-start gap-3 px-4 py-4`}><Icon name={kind==='people'?'people':kind==='tasks'?'todo':'doc'} className="mt-1 size-5 text-violet-700"/><span className="min-w-0 flex-1 break-words"><span className="block text-base font-bold">{item.title}</span>{item.detail&&<span className="mt-1 block text-base/6 text-zinc-600">{item.detail}</span>}</span><Icon name="right" className="mt-1 size-5 text-zinc-400"/></a></li>)}</Rows>
   {results.more[kind]&&<p className="mt-2 px-1 text-base/7 text-zinc-600">Showing the first 20 matches. Add more words to narrow your search.</p>}
  </section>)}</div>:<Card className="p-5 text-base/7 text-zinc-600">Find recordings by their title or words, people by their details or notes, and tasks that are open or done.</Card>}
 </PushedPage>
}
