import { useState, type ReactNode } from 'react'
import { Icon } from '../icons'
import type { HomeData, QueueItem, Sample } from '../types'
import { AddRecordings, Area, Button, Card, DueChip, Field, FOCUS, Notice, Rows, SectionLabel, TabPage, TextLink, useHref, WhatIsKai, Working, Tick } from '../ui'

export const RECORDING_NOTICE =
  'Your recording is transcribed by AssemblyAI and read by Claude. It stays in your own copy of this demo, which is deleted on 8 December.'

const STATUS: Record<QueueItem['status'], string> = {
  waiting: 'Waiting',
  listening: 'KAI is listening…',
  reading: 'KAI is reading…',
  ready: 'Ready',
  failed: 'Could not be read',
}

/** "Listening to 2 of 3": what KAI is working through, oldest first. */
function Queue({ items }: { items: QueueItem[] }) {
  const to = useHref()
  const active = items.findIndex((item) => item.status === 'listening' || item.status === 'reading')
  const heading = active < 0 ? 'Your recordings' : `${items[active].status === 'listening' ? 'Listening to' : 'Reading'} ${active + 1} of ${items.length}`
  return (
    <div>
      <SectionLabel tone="kai">{heading}</SectionLabel>
      <Rows kai>
        {items.map((item) => (
          <li key={item.id}>
            <a href={to((item.awaiting_person ? '/upload/' : '/recordings/') + item.id)} className={`${FOCUS} flex min-h-16 items-center gap-3 px-4 py-3`}>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-bold text-zinc-900">{item.title==='New recording' ? (item.recording_type ? {memo:'My memo',voice:'Voice note',multiple:'Multiple speakers'}[item.recording_type] : 'Shared recording') : item.title}</span>
                <span className={`block text-base font-medium ${item.status === 'failed' ? 'text-rose-700' : 'text-zinc-600'}`}>
                  {item.awaiting_person ? 'Choose the recording type to start' : item.awaiting_speakers ? 'Identify speakers to continue' : item.status === 'failed' ? (item.error ?? STATUS.failed) : item.status === 'reading' ? (item.progress ?? STATUS.reading) : item.status === 'ready' && item.suggestion_count ? `${item.suggestion_count} suggestions to review` : STATUS[item.status]}
                </span>
                {item.reserved_seconds!=null && <span className="block text-base text-zinc-500">{Math.floor(item.reserved_seconds/60)} min {item.reserved_seconds%60} sec · {item.happened_on}</span>}
              </span>
              {item.status === 'listening' || item.status === 'reading' ? (
                <Working />
              ) : item.status === 'ready' ? (
                <Icon name="check" className="size-5 text-emerald-600" />
              ) : null}
              <Icon name="right" className="size-5 text-zinc-400" />
            </a>
          </li>
        ))}
      </Rows>
    </div>
  )
}

/** The second way in: paste the words, or tap a sample. */
function Paste({
  samples,
  busy,
  error,
  open,
  today,
  onRead,
  onSample,
}: {
  samples: readonly Sample[]
  busy?: boolean
  error?: string
  open?: boolean
  today: string
  onRead: (text: string, day: string) => void
  onSample: (id: string) => void
}) {
  const [shown, setShown] = useState(Boolean(open))
  const [text, setText] = useState('')
  const [day, setDay] = useState(today)
  return (
    <div>
      <SectionLabel>No recording at hand?</SectionLabel>
      <Card className="overflow-hidden">
        <ul className="divide-y divide-zinc-100">
          {samples.map((sample) => (
            <li key={sample.id}>
              <button type="button" aria-label={sample.title} disabled={busy} onClick={() => onSample(sample.id)} className={`${FOCUS} flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left disabled:opacity-50`}>
                <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-violet-50 text-violet-700">
                  <Icon name="doc" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-bold text-zinc-900">{sample.title}</span>
                  <span className="block text-base font-medium text-zinc-600">A sample transcript</span>
                </span>
                <Icon name="right" className="size-5 text-zinc-400" />
              </button>
            </li>
          ))}
        </ul>
        <div className="border-t border-zinc-100 p-2">
          {!shown ? (
            <Button variant="quiet" wide icon="pencil" onClick={() => setShown(true)}>
              Paste a transcript
            </Button>
          ) : (
            <form
              className="space-y-3 p-2"
              onSubmit={(event) => {
                event.preventDefault()
                onRead(text, day)
              }}
            >
              <Area label="The words from your conversation" id="words" rows={5} maxLength={20000} required value={text} onChange={(event) => setText(event.target.value)} />
              <p className="px-1 text-base font-medium text-zinc-500">{text.length.toLocaleString()} of 20,000 characters</p>
              <Field label="When it happened" id="day" type="date" required value={day} onChange={(event) => setDay(event.target.value)} />
              <Button variant="soft" type="submit" wide icon="sparkle" disabled={busy}>
                {busy ? 'Starting…' : 'Let KAI read'}
              </Button>
            </form>
          )}
        </div>
      </Card>
      {error && (
        <div className="mt-3">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
    </div>
  )
}

/**
 * Home. In your own copy: add recordings (the dock), what KAI is working on,
 * a second way in, and what is already in the notebook. In the read-only
 * copy the ways in are left out.
 */
export function Home({
  home,
  queue = [],
  samples = [],
  readOnly,
  today,
  due,
  adding,
  addError,
  pasteOpen,
  pasteBusy,
  pasteError,
  loadError,
  waitlist,
  onFiles,
  onRead,
  onSample,
  onTick,
  pending = [],
}: {
  home: HomeData | null
  queue?: QueueItem[]
  samples?: readonly Sample[]
  readOnly: boolean
  today: string
  due?: 'overdue' | 'soon'
  adding?: boolean
  addError?: string
  pasteOpen?: boolean
  pasteBusy?: boolean
  pasteError?: string
  loadError?: string
  waitlist?: ReactNode
  onTick?: (id: string) => void
  pending?: string[]
  onFiles?: (files: File[]) => void
  onRead: (text: string, day: string) => void
  onSample: (id: string) => void
}) {
  const to = useHref()
  return (
    <TabPage
      current="/home"
      title="Home"
      subtitle="Share a recording in. KAI finds the people, the notes and the promises."
      readOnly={readOnly}
      due={due}
      dock={readOnly ? <WhatIsKai /> : <AddRecordings onFiles={onFiles} busy={adding} />}
    >
      {queue.length > 0 && <Queue items={queue} />}
      {home && !readOnly && !home.shortcutReady && <Card className="space-y-3 p-5"><h2 className="text-xl font-extrabold">Send voice notes straight to KAI</h2><p className="text-base/7 text-zinc-600">Set up the iPhone shortcut once, then share from Voice Memos or WhatsApp.</p><Button variant="outline" href="/connect">Set up your phone</Button></Card>}
      {home?.trialSeconds!=null && !home.trialVerified && <Card className="p-5"><p className="mb-3 text-base/7">Verify your email to continue your trial. Your notebook and remaining time are kept.</p><Button href="/try" variant="outline">Verify email</Button></Card>}
      {home?.trialSeconds!=null && home.trialVerified && <p className="px-1 text-base/7 text-zinc-600">KAI will email you when a recording is ready or needs another try, with a link to open it.</p>}
      {home?.trialSeconds===0 && home.xPostUrl && <Button href={home.xPostUrl} variant="outline">Show KAI some love</Button>}
      {home?.trialSeconds!=null && <p className="px-1 text-base/7 font-medium text-zinc-600">{home.trialSeconds ? `${Math.floor(home.trialSeconds/60)} min ${home.trialSeconds%60} sec of recording time left` : 'You’ve used your hour of recordings. Your notebook and assistant connection are still here.'}</p>}
      {home && !readOnly && home.conversations.length===0 && <Card className="p-5"><h2 className="text-xl font-extrabold">Your notebook starts here</h2><p className="mt-2 text-base/7 text-zinc-600">Add a recording. KAI will find the people, notes and to-dos for you to review.</p></Card>}
      {addError && <Notice tone="error">{addError}</Notice>}
      {loadError && <Notice tone="error">{loadError}</Notice>}
      {!home && !loadError && <Notice>Loading your notebook…</Notice>}
      {home && (
        <section aria-label="My tasks">
          <SectionLabel action={<TextLink href="/todos">All tasks</TextLink>}>My tasks</SectionLabel>
          {home.todos.length ? <Rows>
            {home.todos.map(todo => (
              <li key={todo.id} className="flex gap-1 py-2 pr-4 pl-2">
                <Tick label={`Mark ${todo.text} done`} busy={pending.includes(todo.id)} onTick={readOnly || !onTick ? undefined : ()=>onTick(todo.id)}/><div className="min-w-0 flex-1 pt-2">
                <p className="text-base font-bold text-zinc-900">{todo.text}</p>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-base font-medium text-zinc-600">
                  {todo.person_name}<DueChip day={todo.due_on ?? null} today={today} />
                </p></div>
              </li>
            ))}
          </Rows> : <Card className="p-5 text-base font-medium text-zinc-600">No open to-dos. You’re caught up.</Card>}
        </section>
      )}
      {!readOnly && !home?.hasRecordings && <Paste samples={samples} busy={pasteBusy} error={pasteError} open={pasteOpen} today={today} onRead={onRead} onSample={onSample} />}
      {!readOnly && <p className="px-1 text-base/7 font-medium text-zinc-500">{RECORDING_NOTICE}</p>}

      {home && (
        <>
          <div>
            <SectionLabel action={<TextLink href="/library">Open library</TextLink>}>Recent recordings</SectionLabel>
            <Rows>
              {home.conversations.filter(r=>!queue.some(q=>q.id===r.id)).slice(0,3).map((recording) => (
                <li key={recording.id}>
                  <a href={to('/recordings/' + recording.id)} className={`${FOCUS} flex min-h-16 items-center gap-3 px-4 py-3`}>
                    <span className="min-w-0 flex-1">
                      <span className="block text-base font-bold text-zinc-900">{recording.title}</span>
                      <span className="block text-base font-medium whitespace-pre-line text-zinc-600">{recording.summary}</span>
                    </span>
                    <Icon name="right" className="size-5 text-zinc-400" />
                  </a>
                </li>
              ))}
            </Rows>
          </div>
        </>
      )}
      {waitlist}
    </TabPage>
  )
}
