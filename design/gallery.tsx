import { StrictMode, useEffect, useState, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import '../src/look/kai.css'
import * as data from './fixtures'
import { Opening } from '../src/look/screens/Opening'
import { Upload } from '../src/look/screens/Upload'
import { Connect } from '../src/look/screens/Connect'
import { Home } from '../src/look/screens/Home'
import { People, Person } from '../src/look/screens/People'
import { Recording } from '../src/look/screens/Recording'
import { Todos } from '../src/look/screens/Todos'
import { Operator, Waitlist } from '../src/look/screens/Waitlist'
import { Welcome } from '../src/look/screens/Welcome'
import type { Payload, Recording as RecordingData } from '../src/look/types'
import { HrefProvider } from '../src/look/ui'

/*
 * The gallery: every screen of KAI in every state worth drawing, on made-up
 * data. It is the reference the app's screens are built to, not the app:
 * nothing here calls the server. `#/` lists the states.
 */

const today = data.TODAY
const nothing = () => {}

/** A recording you can really decide, so the buttons can be tried. */
function LiveRecording({ first, readOnly = false, editing: firstEditing = null, error }: { first: RecordingData; readOnly?: boolean; editing?: string | null; error?: string }) {
  const [recording, setRecording] = useState(first)
  const [editing, setEditing] = useState<string | null>(firstEditing)
  const decide = (id: string, decision: 'accept' | 'reject', edits?: Payload) =>
    setRecording((current) => ({
      ...current,
      suggestions: current.suggestions.map((s) =>
        s.id === id ? { ...s, status: decision === 'accept' ? 'accepted' : 'rejected', payload: edits ? JSON.stringify(edits) : s.payload } : s
      ),
    }))
  const left = recording.suggestions.some((s) => s.status === 'proposed')
  return (
    <Recording
      recording={recording}
      readOnly={readOnly}
      today={today}
      editing={editing}
      waitlist={left ? undefined : <DemoWaitlist />}
      onDecide={decide}
      onAcceptAll={() => setRecording((current) => ({ ...current, suggestions: current.suggestions.map((s) => (s.status === 'proposed' ? { ...s, status: 'accepted' } : s)) }))}
      actionError={error}
      onEdit={setEditing}
      onSaveEdit={(id, edits) => {
        decide(id, 'accept', edits)
        setEditing(null)
      }}
      onCancelEdit={() => setEditing(null)}
      onRetry={() => setRecording(data.recordings.reading)}
    />
  )
}

function DemoWaitlist({ saved: first = false }: { saved?: boolean }) {
  const [saved, setSaved] = useState(first)
  return <Waitlist postUrl={null} saved={saved} onSubmit={() => setSaved(true)} />
}

function LiveTodos({ view, readOnly = false, empty = false }: { view?: 'mine' | 'waiting'; readOnly?: boolean; empty?: boolean }) {
  const [todos, setTodos] = useState(empty ? [] : data.todos)
  const [message, setMessage] = useState('')
  return (
    <Todos
      todos={todos}
      readOnly={readOnly}
      today={today}
      view={view}
      message={message}
      onFiles={nothing}
      onTick={(id) => {
        setTodos((current) => current.filter((todo) => todo.id !== id))
        setMessage('Marked done.')
      }}
    />
  )
}

function LiveConnect() {
  const [copied, setCopied] = useState<'upload' | 'home' | 'assistant' | null>(null)
  return <Connect connection={data.connection} readOnly={false} due="overdue" copied={copied} onCopy={(which) => setCopied(which)} />
}

const homeProps = { home: data.home, samples: data.samples, today, due: 'overdue' as const, onFiles: nothing, onRead: nothing, onSample: nothing }

/** Every state, by its address. The first word is the screen. */
const STATES: Record<string, { title: string; screen: () => ReactNode }> = {
  'opening/page': { title: 'Page · opening', screen: () => <Opening page="People" onRetry={nothing}/> },
  'opening/failed': { title: 'Page · could not open', screen: () => <Opening page="People" failed onRetry={nothing}/> },
  upload: { title: 'Upload · choose a person', screen: () => <Upload people={data.people} readOnly={false} onFiles={nothing} onStart={nothing} onRetry={nothing}/> },
  'upload/new-person': { title: 'Upload · add a person', screen: () => <Upload people={data.people} readOnly={false} presetPerson="new" onFiles={nothing} onStart={nothing} onRetry={nothing}/> },
  'upload/shared': { title: 'Upload · a WhatsApp voice note', screen: () => <Upload people={data.people} readOnly={false} incoming={{id:'shared',title:'New recording'}} onFiles={nothing} onStart={nothing} onRetry={nothing}/> },
  'upload/loading': { title: 'Upload · opening', screen: () => <Upload people={null} readOnly={false} onFiles={nothing} onStart={nothing} onRetry={nothing}/> },
  'upload/failed': { title: 'Upload · could not open', screen: () => <Upload people={null} readOnly={false} loadError="Your upload could not open. Try again." onFiles={nothing} onStart={nothing} onRetry={nothing}/> },
  'upload/save-failed': { title: 'Upload · could not start', screen: () => <Upload people={data.people} readOnly={false} incoming={{id:'shared',title:'New recording'}} error="KAI could not start. Try again." onFiles={nothing} onStart={nothing} onRetry={nothing}/> },
  'upload/public': { title: 'Upload · read-only', screen: () => <Upload people={null} readOnly onFiles={nothing} onStart={nothing} onRetry={nothing}/> },
  'home/after-upload': { title: 'Home · recording ready to review', screen: () => <Home {...homeProps} home={{...data.home,hasRecordings:true}} readOnly={false} onTick={nothing} queue={[{id:'fresh',title:'A new recording',status:'ready',error:null,suggestion_count:3}]}/> },
  'home/empty-todos': { title: 'Home · no open to-dos', screen: () => <Home {...homeProps} home={{...data.home,todos:[]}} readOnly={false}/> },
  'home/shared': { title: 'Home · recording ready to add', screen: () => <Home {...homeProps} readOnly={false} queue={[{id:'shared',title:'New recording',status:'waiting',error:null,awaiting_person:1}]}/> },
  'recording/linked': { title: 'Recording · linked to a person', screen: () => <LiveRecording first={{...data.recordings.ready,person:data.people[0]}}/> },
  welcome: { title: 'Welcome · with the judge link', screen: () => <Welcome access={{ kind: 'judge', videoUrl: null }} /> },
  'welcome/public': { title: 'Welcome · without the link', screen: () => <Welcome access={{ kind: 'public', videoUrl: null }} /> },
  'welcome/video': { title: 'Welcome · once the video exists', screen: () => <Welcome access={{ kind: 'judge', videoUrl: 'about:blank' }} /> },
  'welcome/opening': { title: 'Welcome · opening the link', screen: () => <Welcome access={null} /> },
  'welcome/failed': { title: 'Welcome · a link that does not open', screen: () => <Welcome access={{ kind: 'public', videoUrl: null }} failed /> },
  'home/loading': { title: 'Home · loading', screen: () => <Home {...homeProps} home={null} readOnly={false} /> },
  'home/failed': { title: 'Home · could not load', screen: () => <Home {...homeProps} home={null} readOnly={false} loadError="Your notebook could not load. Reload this page to try again." /> },
  'home/upload-failed': { title: 'Home · upload refused', screen: () => <Home {...homeProps} readOnly={false} addError="Choose one to five recordings, each up to 10 MB." /> },
  'home/paste-failed': { title: 'Home · reading refused', screen: () => <Home {...homeProps} readOnly={false} pasteOpen pasteError="KAI could not start. Try again." /> },
  'people/loading': { title: 'People · loading', screen: () => <People people={null} readOnly={false} onFiles={nothing} /> },
  'people/failed': { title: 'People · could not load', screen: () => <People people={null} readOnly={false} error="People could not load. Reload this page to try again." onFiles={nothing} /> },
  'person/failed': { title: 'Person · could not load', screen: () => <Person person={null} readOnly={false} today={today} error="This person could not load. Go to People and try again." onFiles={nothing} /> },
  'todos/failed': { title: 'To-dos · could not finish', screen: () => <Todos todos={data.todos} readOnly={false} today={today} error="This to-do could not be finished. Try ticking it again." onFiles={nothing} onTick={nothing} /> },
  'recording/edit-failed': { title: 'Recording · edit could not save', screen: () => <LiveRecording first={data.recordings.ready} editing="s3" error="Check the words and use a real date." /> },
  'connect/loading': { title: 'Connect · loading', screen: () => <Connect connection={null} readOnly={false} onCopy={nothing} /> },
  'connect/failed': { title: 'Connect · could not load', screen: () => <Connect connection={null} readOnly={false} error="Your address could not load. Reload this page to try again." onCopy={nothing} /> },
  'connect/copy-failed': { title: 'Connect · copy unavailable', screen: () => <Connect connection={data.connection} readOnly={false} copyError={{at:'assistant',text:'Touch and hold the address to copy it.'}} onCopy={nothing} /> },
  'waitlist/failed': { title: 'Waitlist · could not save', screen: () => <Home {...homeProps} readOnly waitlist={<Waitlist postUrl={null} error="Please wait an hour, then reload this page." onSubmit={nothing}/>} /> },
  'operator/failed': { title: 'Download · link needed', screen: () => <Operator count={null} error="Open your private download link to see the list." onDownload={nothing}/> },
  home: { title: 'Home', screen: () => <Home {...homeProps} readOnly={false} waitlist={<DemoWaitlist />} /> },
  'home/busy': { title: 'Home · KAI is working', screen: () => <Home {...homeProps} readOnly={false} queue={data.queue} waitlist={<DemoWaitlist />} /> },
  'home/paste': { title: 'Home · pasting a transcript', screen: () => <Home {...homeProps} readOnly={false} pasteOpen waitlist={<DemoWaitlist />} /> },
  'home/public': { title: 'Home · read-only', screen: () => <Home {...homeProps} readOnly waitlist={<DemoWaitlist />} /> },
  recording: { title: 'Recording · suggestions to decide', screen: () => <LiveRecording first={data.recordings.ready} /> },
  'recording/listening': { title: 'Recording · KAI is listening', screen: () => <LiveRecording first={data.recordings.listening} /> },
  'recording/reading': { title: 'Recording · KAI is reading', screen: () => <LiveRecording first={data.recordings.reading} /> },
  'recording/editing': { title: 'Recording · editing a suggestion', screen: () => <LiveRecording first={data.recordings.ready} editing="s3" /> },
  'recording/person': { title: 'Recording · a new person', screen: () => <LiveRecording first={data.recordings.person} /> },
  'recording/decided': { title: 'Recording · all decided', screen: () => <LiveRecording first={data.recordings.decided} /> },
  'recording/failed': { title: 'Recording · could not be read', screen: () => <LiveRecording first={data.recordings.failed} /> },
  'recording/public': { title: 'Recording · read-only', screen: () => <LiveRecording first={data.recordings.decided} readOnly /> },
  people: { title: 'People', screen: () => <People people={data.people} readOnly={false} due="overdue" onFiles={nothing} /> },
  'people/public': { title: 'People · read-only', screen: () => <People people={data.people} readOnly due="overdue" onFiles={nothing} /> },
  person: { title: 'Person', screen: () => <Person person={data.dana} readOnly={false} today={today} onTick={nothing} onFiles={nothing} /> },
  'person/pending': { title: 'Person · with suggestions waiting', screen: () => <Person person={data.danaPending} readOnly={false} today={today} onTick={nothing} onFiles={nothing} /> },
  'person/public': { title: 'Person · read-only', screen: () => <Person person={data.dana} readOnly today={today} onFiles={nothing} /> },
  todos: { title: 'To-dos · Mine', screen: () => <LiveTodos /> },
  'todos/waiting': { title: 'To-dos · Waiting on', screen: () => <LiveTodos view="waiting" /> },
  'todos/empty': { title: 'To-dos · nothing open', screen: () => <LiveTodos empty /> },
  'todos/public': { title: 'To-dos · read-only', screen: () => <LiveTodos readOnly /> },
  connect: { title: 'Connect', screen: () => <LiveConnect /> },
  'connect/public': { title: 'Connect · read-only', screen: () => <Connect connection={null} readOnly due="overdue" onCopy={nothing} /> },
  waitlist: { title: 'The waitlist card · signed up', screen: () => <Home {...homeProps} readOnly waitlist={<DemoWaitlist saved />} /> },
  operator: { title: 'Copal’s download page', screen: () => <Operator count={12} onDownload={nothing} /> },
}

/** The app's paths, as the gallery's addresses. A read-only state stays read-only. */
function galleryHref(path: string, readOnly: boolean) {
  const tail = readOnly ? '/public' : ''
  if (path.startsWith('/upload')) return '#/upload' + tail
  if (path === '/') return '#/welcome' + tail
  if (path.startsWith('/people/')) return '#/person' + tail
  if (path.startsWith('/recordings/')) return '#/recording' + tail
  return '#' + path + tail
}

function Index() {
  return (
    <main className="mx-auto max-w-[560px] px-5 py-8">
      <p className="text-xl font-extrabold tracking-tight text-violet-700">KAI</p>
      <h1 className="mt-1 text-[32px]/10 font-extrabold tracking-tight">The look</h1>
      <p className="mt-2 text-base font-medium text-zinc-600">Every screen, in every state worth drawing, on made-up data. Open one on a phone.</p>
      <ul className="mt-6 divide-y divide-zinc-100 overflow-hidden rounded-3xl bg-white shadow-card ring-1 ring-violet-950/[0.04]">
        {Object.entries(STATES).map(([key, state]) => (
          <li key={key}>
            <a href={'#/' + key} className="flex min-h-14 items-center px-4 text-base font-bold text-zinc-900">
              {state.title}
            </a>
          </li>
        ))}
      </ul>
    </main>
  )
}

function Gallery() {
  const [hash, setHash] = useState(location.hash)
  useEffect(() => {
    const onChange = () => {
      setHash(location.hash)
      scrollTo(0, 0)
    }
    addEventListener('hashchange', onChange)
    return () => removeEventListener('hashchange', onChange)
  }, [])
  const key = hash.replace(/^#\/?/, '')
  const state = STATES[key]
  if (!state) return <Index />
  return (
    <HrefProvider key={key} value={(path) => galleryHref(path, key.endsWith('/public'))}>
      {state.screen()}
    </HrefProvider>
  )
}

export const stateKeys = Object.keys(STATES)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Gallery />
  </StrictMode>
)
