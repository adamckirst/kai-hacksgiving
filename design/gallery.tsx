import {Settings} from '../src/look/screens/Settings'
import {TrialPopup} from '../src/look/screens/TrialPopup'
import {Login} from '../src/look/screens/Login'
import {Terms} from '../src/look/screens/Terms'
import {Search} from '../src/look/screens/Search'
import {Task} from '../src/look/screens/Task'
import { StrictMode, useEffect, useState, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import '../src/look/kai.css'
import * as data from './fixtures'
import { Opening } from '../src/look/screens/Opening'
import {Library,Notifications} from '../src/look/screens/Library'
import {Speakers} from '../src/look/screens/Speakers'
import { Upload } from '../src/look/screens/Upload'
import { Connect } from '../src/look/screens/Connect'
import { Home } from '../src/look/screens/Home'
import { People, Person } from '../src/look/screens/People'
import { Recording } from '../src/look/screens/Recording'
import { Todos } from '../src/look/screens/Todos'
import { Operator, Waitlist } from '../src/look/screens/Waitlist'
import { Trial } from '../src/look/screens/Trial'
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
function LiveRecording({ first, readOnly = false, editing: firstEditing = null, error, confirmation }: { first: RecordingData; readOnly?: boolean; editing?: string | null; error?: string; confirmation?: string }) {
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
      confirmation={confirmation}
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
  const [shortcutReady,setReady]=useState(false)
  return <Connect connection={{...data.connection,shortcutReady}} readOnly={false} due="overdue" copied={copied} onCopy={(which) => setCopied(which)} onSetupDone={setReady} />
}

const homeProps = { home: data.home, samples: data.samples, today, due: 'overdue' as const, onFiles: nothing, onRead: nothing, onSample: nothing }

const libraryItems=data.home.conversations.map((c,i)=>({...c,happened_on:today,status:'ready' as const,error:null,awaiting_person:0,seen:i ? 1:0,suggestion_count:i ? 0:3}))

/** Every state, by its address. The first word is the screen. */
const speakerPassages=[{speaker:'A',text:'I will send the notes tomorrow.',start:0,end:1000},{speaker:'B',text:'I will review them on Friday.',start:1000,end:2000}]
const searchResults={library:[{id:'dana-call',title:'First call with Dana',detail:'Dana wants pricing for three clinics.',href:'/recordings/dana-call'}],people:[{id:'dana',title:'Dana Whitfield',detail:'Operations lead · Willow Dental',href:'/people/dana'}],tasks:[{id:'pricing',title:'Send Dana the pricing',detail:'Your to-do · Dana Whitfield',href:'/todos/pricing'}],more:{library:false,people:false,tasks:false}}
const searchProps={query:'Dana',results:searchResults,readOnly:false,onQuery:nothing,onSearch:nothing}
const taskExample={id:'pricing',text:'Send Dana the pricing',status:'open' as const,due_on:today,owner_name:null,person_name:'Dana Whitfield',person_id:'dana',quote:'I promised to send Dana the pricing.',conversation_id:'dana-call'}
const taskProps={task:taskExample,readOnly:false,onDone:nothing,onRetry:nothing,back:'/search'}
const STATES: Record<string, { title: string; screen: () => ReactNode }> = {
  search:{title:'Search · start',screen:()=> <Search {...searchProps} query="" results={null}/>},
  'search/results':{title:'Search · matches',screen:()=> <Search {...searchProps}/>},
  'search/empty':{title:'Search · no matches',screen:()=> <Search {...searchProps} results={{library:[],people:[],tasks:[],more:{library:false,people:false,tasks:false}}}/>},
  'search/loading':{title:'Search · searching',screen:()=> <Search {...searchProps} results={null} busy/>},
  'search/error':{title:'Search · failed',screen:()=> <Search {...searchProps} results={null} error="Search could not finish. Try again."/>},
  'search/public':{title:'Search · public',screen:()=> <Search {...searchProps} readOnly/>},
  'search/more':{title:'Search · refine',screen:()=> <Search {...searchProps} results={{...searchResults,more:{library:true,people:false,tasks:false}}}/>},
  task:{title:'Task · open',screen:()=> <Task {...taskProps}/>},
  'task/done':{title:'Task · done',screen:()=> <Task {...taskProps} task={{...taskExample,status:'done'}}/>},
  'task/public':{title:'Task · public',screen:()=> <Task {...taskProps} readOnly/>},
  'task/loading':{title:'Task · loading',screen:()=> <Task {...taskProps} task={null}/>},
  'task/error':{title:'Task · failed',screen:()=> <Task {...taskProps} task={null} error="This task could not open. Go back and try again."/>},
  'recording/speakers':{title:'Recording · identify speakers',screen:()=> <Speakers people={data.people} utterances={speakerPassages} onSubmit={nothing}/>},
  'recording/speakers-loading':{title:'Recording · loading people',screen:()=> <Speakers people={null} utterances={speakerPassages} onSubmit={nothing}/>},
  'recording/people-context': {title:'Recording · who each suggestion updates',screen:()=> <LiveRecording first={{...data.recordings.ready,text:'I need to write a call checklist. Ellis will send Dana the clinic schedule. '+data.recordings.ready.text,suggestions:[
    {id:'personal',kind:'todo',payload:JSON.stringify({person_id:null,owner_person_id:null,text:'Write a call checklist',due_on:null}),quote:'I need to write a call checklist.',status:'proposed'},
    {id:'different-owner',kind:'todo',person_name:'Dana Whitfield',owner_name:'Ellis Rowan',payload:JSON.stringify({person_id:'dana',owner_person_id:'ellis',text:'Send the clinic schedule',due_on:null}),quote:'Ellis will send Dana the clinic schedule.',status:'proposed'},
    ...data.recordings.ready.suggestions
  ]}}/>},
  'recording/speakers-ready':{title:'Recording · speakers selected',screen:()=> <Speakers people={data.people} utterances={speakerPassages} initialChoices={{A:{kind:'owner'},B:{kind:'person',person_id:data.people[0].id}}} onSubmit={nothing}/>},
  'recording/speakers-new':{title:'Recording · new speaker',screen:()=> <Speakers people={data.people} utterances={speakerPassages} initialChoices={{A:{kind:'owner'},B:{kind:'new',person:{id:'invented',name:'Avery Fern',company:'',role:''}}}} onSubmit={nothing}/>},
  'recording/speakers-error':{title:'Recording · speakers not saved',screen:()=> <Speakers people={data.people} utterances={speakerPassages} error="The speakers could not be saved. Try again." onSubmit={nothing}/>},
  'upload/memo':{title:'Upload · memo from me',screen:()=> <Upload people={data.people} initialFile={new File(["Invented audio"],"Project update.m4a")} initialType="memo" readOnly={false} onFiles={nothing} onStart={nothing} onRetry={nothing}/>},
  'upload/voice':{title:'Upload · voice note',screen:()=> <Upload people={data.people} initialFile={new File(["Invented audio"],"Project update.m4a")} initialType="voice" readOnly={false} onFiles={nothing} onStart={nothing} onRetry={nothing}/>},
  'upload/multiple':{title:'Upload · multiple speakers',screen:()=> <Upload people={data.people} initialFile={new File(["Invented audio"],"Project update.m4a")} initialType="multiple" readOnly={false} onFiles={nothing} onStart={nothing} onRetry={nothing}/>},
  library:{title:'Library',screen:()=> <Library items={libraryItems} readOnly={false}/>},
  'library/empty':{title:'Library · empty',screen:()=> <Library items={[]} readOnly={false}/>},
  'library/loading':{title:'Library · loading',screen:()=> <Library items={null} readOnly={false}/>},
  'library/failed':{title:'Library · could not load',screen:()=> <Library items={null} readOnly={false} error="Your recordings could not load. Reload this page to try again."/>},
  'library/public':{title:'Library · read-only',screen:()=> <Library items={libraryItems} readOnly/>},
  notifications:{title:'Notifications',screen:()=> <Notifications items={[{...libraryItems[0],status:'failed',seen:0},...libraryItems.slice(1)]} readOnly={false}/>},
  'notifications/empty':{title:'Notifications · empty',screen:()=> <Notifications items={[]} readOnly={false}/>},
  'notifications/loading':{title:'Notifications · loading',screen:()=> <Notifications items={null} readOnly={false}/>},
  'notifications/failed':{title:'Notifications · could not load',screen:()=> <Notifications items={null} readOnly={false} error="Your recordings could not load. Reload this page to try again."/>},
  'connect/chatgpt':{title:'Connections · ChatGPT',screen:()=> <Connect connection={{...data.connection,shortcutReady:true}} initialAssistant="ChatGPT" readOnly={false} onCopy={nothing} onSetupDone={nothing}/>},
  'connect/grok':{title:'Connections · Grok',screen:()=> <Connect connection={{...data.connection,shortcutReady:true}} initialAssistant="Grok" readOnly={false} onCopy={nothing} onSetupDone={nothing}/>},
  'connect/muse':{title:'Connections · Muse',screen:()=> <Connect connection={{...data.connection,shortcutReady:true}} initialAssistant="Muse" readOnly={false} onCopy={nothing} onSetupDone={nothing}/>},
  'connect/setup-saving':{title:'Connections · saving setup',screen:()=> <Connect connection={data.connection} setupBusy readOnly={false} onCopy={nothing} onSetupDone={nothing}/>},
  'connect/setup-failed':{title:'Connections · setup failed',screen:()=> <Connect connection={data.connection} error="Your setup could not be saved. Try again." readOnly={false} onCopy={nothing} onSetupDone={nothing}/>},
  'connect/ready':{title:'Connections · phone set up',screen:()=> <Connect connection={{...data.connection,shortcutReady:true}} readOnly={false} onCopy={nothing}/>},
  'home/connected':{title:'Home · phone set up',screen:()=> <Home {...homeProps} home={{...data.home,shortcutReady:true}} readOnly={false}/>},

  'try/code': {title:'Trial · verification code',screen:()=> <Trial stage="code" onRequest={nothing} onAgree={nothing} onVerify={nothing} onResend={nothing}/>},
  'try/code-error': {title:'Trial · wrong code',screen:()=> <Trial stage="code" error='Check the code and try again.' onRequest={nothing} onAgree={nothing} onVerify={nothing} onResend={nothing}/>},
  try: {title:'Trial · join',screen:()=> <Trial stage="email" onRequest={nothing} onAgree={nothing}/>},
  'try/busy': {title:'Trial · opening',screen:()=> <Trial stage="email" busy onRequest={nothing} onAgree={nothing}/>},
  'try/popup':{title:'Trial · agreement popup',screen:()=> <TrialPopup stage="terms" open onClose={nothing} onRequest={nothing} onAgree={nothing} onVerify={nothing} onResend={nothing}/>},
  'try/popup-code':{title:'Trial · code popup',screen:()=> <TrialPopup stage="code" open onClose={nothing} onRequest={nothing} onAgree={nothing} onVerify={nothing} onResend={nothing}/>},
  'try/popup-error':{title:'Trial · popup error',screen:()=> <TrialPopup stage="code" open error='This code expired or could not be checked. Ask for a new code.' onClose={nothing} onRequest={nothing} onAgree={nothing} onVerify={nothing} onResend={nothing}/>},
  'login':{title:'Sign in',screen:()=> <Login stage="email" onRequest={nothing} onAgree={nothing} onVerify={nothing} onResend={nothing} onSignOut={nothing}/>},
  'login/code':{title:'Sign in · code',screen:()=> <Login stage="code" onRequest={nothing} onAgree={nothing} onVerify={nothing} onResend={nothing} onSignOut={nothing}/>},
  'login/busy':{title:'Sign in · busy',screen:()=> <Login stage="email" busy onRequest={nothing} onAgree={nothing} onVerify={nothing} onResend={nothing} onSignOut={nothing}/>},
  'login/error':{title:'Sign in · wrong code',screen:()=> <Login stage="code" error="This code expired or could not be checked. Ask for a new code." onRequest={nothing} onAgree={nothing} onVerify={nothing} onResend={nothing} onSignOut={nothing}/>},
  'login/signed-in':{title:'Sign in · switch notebook',screen:()=> <Login stage="email" signedIn recoverable onRequest={nothing} onAgree={nothing} onVerify={nothing} onResend={nothing} onSignOut={nothing}/>},
  'login/invitation':{title:'Sign in · invitation notebook',screen:()=> <Login stage="email" signedIn recoverable={false} onRequest={nothing} onAgree={nothing} onVerify={nothing} onResend={nothing} onSignOut={nothing}/>},
  'try/error': {title:'Trial · could not open',screen:()=> <Trial stage="email" error='This trial cannot be opened here. Use the browser where you started it.' onRequest={nothing} onAgree={nothing}/>},
  'try/terms':{title:'Trial · verified, agree to terms',screen:()=> <Trial stage="terms" onAgree={nothing}/>},
  'login/terms':{title:'Sign in · updated terms',screen:()=> <Login stage="terms" returning onAgree={nothing} onSignOut={nothing}/>},
  'try/popup-updated-terms':{title:'Trial · updated terms popup',screen:()=> <TrialPopup open stage="terms" returning onClose={nothing} onAgree={nothing}/>},
  terms:{title:'Demo terms and privacy',screen:()=> <Terms/>},
  'home/processing-info':{title:'Home · processing information',screen:()=> <Home {...homeProps} readOnly={false} initialInfoOpen home={{...data.home,trialSeconds:1556,trialVerified:true}} queue={data.queue}/>},
  'home/trial': {title:'Home · new trial',screen:()=> <Home {...homeProps} readOnly={false} home={{...data.home,todos:[],conversations:[],peopleCount:0,trialSeconds:1800,trialVerified:true}}/>},
  'home/trial-used': {title:'Home · trial used',screen:()=> <Home {...homeProps} readOnly={false} home={{...data.home,trialSeconds:0,trialVerified:true}}/>},
  'opening/page': { title: 'Page · opening', screen: () => <Opening page="People" onRetry={nothing}/> },
  'opening/failed': { title: 'Page · could not open', screen: () => <Opening page="People" failed onRetry={nothing}/> },
  upload: { title: 'Upload · choose a source', screen: () => <Upload people={data.people} readOnly={false} remainingSeconds={152} onFiles={nothing} onStart={nothing} onRetry={nothing}/> },
  "upload/voice-memos": {title:"Upload · voice-memos",screen:()=> <Upload people={data.people} readOnly={false} initialSource="voice-memos" onFiles={nothing} onStart={nothing} onRetry={nothing}/>},
  "upload/whatsapp": {title:"Upload · whatsapp",screen:()=> <Upload people={data.people} readOnly={false} initialSource="whatsapp" onFiles={nothing} onStart={nothing} onRetry={nothing}/>},
  "upload/voice-memos-ready": {title:"Upload · voice-memos-ready",screen:()=> <Upload people={data.people} readOnly={false} initialSource="voice-memos" shortcutReady onFiles={nothing} onStart={nothing} onRetry={nothing}/>},
  "upload/whatsapp-ready": {title:"Upload · whatsapp-ready",screen:()=> <Upload people={data.people} readOnly={false} initialSource="whatsapp" shortcutReady onFiles={nothing} onStart={nothing} onRetry={nothing}/>},
  "upload/voice-memos-guide": {title:"Upload · voice-memos-guide",screen:()=> <Upload people={data.people} readOnly={false} initialSource="voice-memos" initialGuide="voice-memos" onFiles={nothing} onStart={nothing} onRetry={nothing}/>},
  "upload/whatsapp-guide": {title:"Upload · whatsapp-guide",screen:()=> <Upload people={data.people} readOnly={false} initialSource="whatsapp" initialGuide="whatsapp" shortcutReady onFiles={nothing} onStart={nothing} onRetry={nothing}/>},
  "upload/files-guide": {title:"Upload · files-guide",screen:()=> <Upload people={data.people} readOnly={false} initialGuide="files" onFiles={nothing} onStart={nothing} onRetry={nothing}/>},
  "upload/quota-used": {title:"Upload · quota-used",screen:()=> <Upload people={data.people} readOnly={false} remainingSeconds={0} onFiles={nothing} onStart={nothing} onRetry={nothing}/>},
  "upload/shared-quota-used": {title:"Upload · shared-quota-used",screen:()=> <Upload people={data.people} readOnly={false} remainingSeconds={0} incoming={{id:"invented",title:"New recording"}} onFiles={nothing} onStart={nothing} onRetry={nothing}/>},
  'upload/new-person': { title: 'Upload · add a person', screen: () => <Upload people={data.people} readOnly={false} initialFile={new File(["Invented audio"],"Project update.m4a")} initialType="voice" presetPerson="new" onFiles={nothing} onStart={nothing} onRetry={nothing}/> },
  'upload/shared': { title: 'Upload · a WhatsApp voice note', screen: () => <Upload people={data.people} readOnly={false} incoming={{id:'shared',title:'New recording'}} onFiles={nothing} onStart={nothing} onRetry={nothing}/> },
  'upload/loading': { title: 'Upload · opening', screen: () => <Upload people={null} readOnly={false} onFiles={nothing} onStart={nothing} onRetry={nothing}/> },
  'upload/failed': { title: 'Upload · could not open', screen: () => <Upload people={null} readOnly={false} loadError="Your upload could not open. Try again." onFiles={nothing} onStart={nothing} onRetry={nothing}/> },
  'upload/save-failed': { title: 'Upload · could not start', screen: () => <Upload people={data.people} readOnly={false} incoming={{id:'shared',title:'New recording'}} error="KAI could not start. Try again." onFiles={nothing} onStart={nothing} onRetry={nothing}/> },
  'upload/public': { title: 'Upload · read-only', screen: () => <Upload people={null} readOnly onFiles={nothing} onStart={nothing} onRetry={nothing}/> },
  'home/after-upload': { title: 'Home · recording ready to review', screen: () => <Home {...homeProps} home={{...data.home,hasRecordings:true}} readOnly={false} onTick={nothing} queue={[{id:'fresh',title:'A new recording',status:'ready',error:null,suggestion_count:3}]}/> },
  'home/empty-todos': { title: 'Home · no open to-dos', screen: () => <Home {...homeProps} home={{...data.home,todos:[]}} readOnly={false}/> },
  'home/unfinished': {title:'Home · distinct unfinished recordings',screen:()=> <Home {...homeProps} home={{...data.home,trialVerified:true,trialSeconds:1556,hasRecordings:true}} readOnly={false} queue={[{id:'shared',title:'New recording',status:'waiting',error:null,awaiting_person:1,reserved_seconds:27,happened_on:today},{id:'meeting',title:'New recording',status:'failed',error:'KAI could not listen to this recording. Try again.',recording_type:'multiple',reserved_seconds:64,happened_on:today}]}/>},
  'home/speakers': {title:'Home · identify speakers',screen:()=> <Home {...homeProps} readOnly={false} queue={[{id:'meeting',title:'New recording',status:'waiting',error:null,awaiting_speakers:1,recording_type:'multiple',reserved_seconds:64,happened_on:today}]}/>},
  'home/shared': { title: 'Home · recording ready to add', screen: () => <Home {...homeProps} readOnly={false} queue={[{id:'shared',title:'New recording',status:'waiting',error:null,awaiting_person:1}]}/> },
  'recording/linked': { title: 'Recording · linked to a person', screen: () => <LiveRecording first={{...data.recordings.ready,person:data.people[0]}}/> },
  welcome: { title: 'Welcome · with the judge link', screen: () => <Welcome access={{ kind: 'judge', videoUrl: null }} /> },
  'welcome/public': { title: 'Welcome · without the link', screen: () => <Welcome access={{ kind: 'public', videoUrl: null }} /> },
  'welcome/video': { title: 'Welcome · once the video exists', screen: () => <Welcome access={{ kind: 'judge', videoUrl: 'about:blank' }} /> },
  'welcome/opening': { title: 'Welcome · opening the link', screen: () => <Welcome access={null} /> },
  'welcome/failed': { title: 'Welcome · a link that does not open', screen: () => <Welcome access={{ kind: 'public', videoUrl: null }} failed /> },
  'home/loading': { title: 'Home · loading', screen: () => <Home {...homeProps} home={null} readOnly={false} /> },
  'home/failed': { title: 'Home · could not load', screen: () => <Home {...homeProps} home={null} readOnly={false} loadError="Your notebook could not load. Reload this page to try again." /> },
  'home/upload-failed': { title: 'Home · upload refused', screen: () => <Home {...homeProps} readOnly={false} addError="Choose one recording, up to 10 MB." /> },
  'home/paste-failed': { title: 'Home · reading refused', screen: () => <Home {...homeProps} readOnly={false} pasteOpen pasteError="KAI could not start. Try again." /> },
  'people/loading': { title: 'People · loading', screen: () => <People people={null} readOnly={false} onFiles={nothing} /> },
  'people/failed': { title: 'People · could not load', screen: () => <People people={null} readOnly={false} error="People could not load. Reload this page to try again." onFiles={nothing} /> },
  'person/failed': { title: 'Person · could not load', screen: () => <Person person={null} readOnly={false} today={today} error="This person could not load. Go to People and try again." onFiles={nothing} /> },
  'todos/failed': { title: 'To-dos · could not finish', screen: () => <Todos todos={data.todos} readOnly={false} today={today} error="This to-do could not be finished. Try ticking it again." onFiles={nothing} onTick={nothing} /> },
  'recording/edit-failed': { title: 'Recording · edit could not save', screen: () => <LiveRecording first={data.recordings.ready} editing="s3" error="Check the words and use a real date." /> },
  'connect/manual': {title:'Connect · build shortcut manually',screen:()=> <Connect connection={data.connection} readOnly={false} showManual onCopy={nothing}/>},
  'connect/address': {title:'Connect · show private address',screen:()=> <Connect connection={data.connection} readOnly={false} showAddress onCopy={nothing}/>},
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
  'recording/confirmation': {title:'Recording · decision saved',screen:()=> <LiveRecording first={data.recordings.decided} confirmation="All suggestions accepted"/>},
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
  settings: {title:'Settings · your account',screen:()=> <Settings account={{signedIn:true,email:'mara@example.invalid'}} onSignOut={nothing} onDelete={nothing} onRetry={nothing}/>},
  'settings/public': {title:'Settings · signed out',screen:()=> <Settings account={{signedIn:false,email:null}} onSignOut={nothing} onDelete={nothing} onRetry={nothing}/>},
  'settings/invitation': {title:'Settings · invitation',screen:()=> <Settings account={{signedIn:true,email:null}} onSignOut={nothing} onDelete={nothing} onRetry={nothing}/>},
  'settings/loading': {title:'Settings · opening',screen:()=> <Settings account={null} onSignOut={nothing} onDelete={nothing} onRetry={nothing}/>},
  'settings/failed': {title:'Settings · unavailable',screen:()=> <Settings account={null} error="Your account could not load. Try again." onSignOut={nothing} onDelete={nothing} onRetry={nothing}/>},
  'settings/sign-out': {title:'Settings · sign out here',screen:()=> <Settings account={{signedIn:true,email:'mara@example.invalid'}} initialChoice="here" onSignOut={nothing} onDelete={nothing} onRetry={nothing}/>},
  'settings/sign-out-all': {title:'Settings · sign out everywhere',screen:()=> <Settings account={{signedIn:true,email:'mara@example.invalid'}} initialChoice="everywhere" onSignOut={nothing} onDelete={nothing} onRetry={nothing}/>},
  'settings/delete': {title:'Settings · delete confirmation',screen:()=> <Settings account={{signedIn:true,email:'mara@example.invalid'}} initialChoice="delete" onSignOut={nothing} onDelete={nothing} onRetry={nothing}/>},
  'settings/delete-failed': {title:'Settings · delete failed',screen:()=> <Settings account={{signedIn:true,email:'mara@example.invalid'}} initialChoice="delete" error="Your account could not be deleted. Try again." onSignOut={nothing} onDelete={nothing} onRetry={nothing}/>},
  'settings/deleting': {title:'Settings · deleting',screen:()=> <Settings account={{signedIn:true,email:'mara@example.invalid'}} initialChoice="delete" busy onSignOut={nothing} onDelete={nothing} onRetry={nothing}/>},
  'upload/messages': {title:'Upload · Messages guidance',screen:()=> <Upload people={data.people} readOnly={false} initialSource="messages" shortcutReady onFiles={nothing} onStart={nothing} onRetry={nothing}/>},
  'upload/telegram': {title:'Upload · Telegram guidance',screen:()=> <Upload people={data.people} readOnly={false} initialSource="telegram" shortcutReady onFiles={nothing} onStart={nothing} onRetry={nothing}/>},
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
