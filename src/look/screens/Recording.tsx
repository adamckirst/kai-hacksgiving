import { useState, type ReactNode } from 'react'
import { Dialog, DialogActions, DialogBody, DialogTitle } from '../../catalyst/dialog'
import { Icon, type IconName } from '../icons'
import type { Payload, Recording as RecordingData, Source, Suggestion } from '../types'
import { Area, Button, Card, Chip, dueWords, Field, Notice, PushedPage, Quote, SectionLabel, Segmented, shortDay, Working, TextLink } from '../ui'

const SOURCE: Record<Source, { label: string; icon: IconName }> = {
  recording: { label: 'Recording', icon: 'mic' },
  shared: { label: 'Shared from your phone', icon: 'share' },
  paste: { label: 'Pasted', icon: 'doc' },
  sample: { label: 'Sample transcript', icon: 'doc' },
}

/** What a suggestion is, in a few plain words, and what it says. */
function describe(suggestion: Suggestion, today: string) {
  const payload = JSON.parse(suggestion.payload) as Payload
  const who = payload.person_name?.split(' ')[0]
  const due = payload.due_on ? ` · ${dueWords(payload.due_on, today)}` : ''
  if (suggestion.kind === 'person')
    return { icon: 'people' as const, kind: 'New person', title: payload.name ?? '', detail: [payload.role, payload.company].filter(Boolean).join(' at ') }
  if (suggestion.kind === 'note') return { icon: 'doc' as const, kind: who ? `Note about ${who}` : 'Note', title: payload.text ?? '' }
  if (suggestion.kind === 'done') return { icon: 'check' as const, kind: 'Kept promise', title: `Mark “${payload.text}” done` }
  if (payload.owner_person_id) return { icon: 'todo' as const, kind: (who ? `${who} owes you` : 'Waiting on') + due, title: payload.text ?? '' }
  return { icon: 'todo' as const, kind: 'Your to-do' + due, title: payload.text ?? '' }
}

/** One suggestion: what KAI heard, and Accept, Edit or Reject. */
function SuggestionRow({
  suggestion,
  today,
  readOnly,
  busy,
  onQuote,
  onDecide,
  onEdit,
}: {
  suggestion: Suggestion
  today: string
  readOnly: boolean
  busy?: boolean
  onQuote: (quote: string) => void
  onDecide: (id: string, decision: 'accept' | 'reject') => void
  onEdit: (id: string) => void
}) {
  const { icon, kind, title, detail } = describe(suggestion, today)
  const decided = suggestion.status !== 'proposed'
  return (
    <li className="animate-kai-in px-4 py-4">
      <p className="flex items-center gap-1.5 text-base font-bold text-violet-700">
        <Icon name={icon} className="size-5" />
        {kind}
      </p>
      <h3 className={`mt-1 text-lg/7 font-bold ${suggestion.status === 'rejected' ? 'text-zinc-500 line-through' : 'text-zinc-900'}`}>{title}</h3>
      {detail && <p className="text-base font-medium text-zinc-600">{detail}</p>}
      <div className="mt-2">
        <Quote onClick={() => onQuote(suggestion.quote)}>{suggestion.quote}</Quote>
      </div>
      {decided ? (
        <div className="mt-3">
          {suggestion.status === 'accepted' ? (
            <Chip tone="good" icon="check">
              Accepted
            </Chip>
          ) : (
            <Chip icon="x">Rejected</Chip>
          )}
        </div>
      ) : readOnly ? (
        <div className="mt-3">
          <Chip tone="kai" icon="sparkle">
            For review
          </Chip>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-1">
          <Button variant="soft" icon="check" disabled={busy} onClick={() => onDecide(suggestion.id, 'accept')}>
            Accept
          </Button>
          {suggestion.kind !== 'done' && (
            <Button variant="quiet" disabled={busy} onClick={() => onEdit(suggestion.id)}>
              Edit
            </Button>
          )}
          <Button variant="quiet" disabled={busy} onClick={() => onDecide(suggestion.id, 'reject')}>
            Reject
          </Button>
        </div>
      )}
    </li>
  )
}

/** Edit a suggestion before keeping it. A sheet from the foot of the phone. */
export function SuggestionEditor({
  suggestion,
  busy,
  error,
  onSave,
  onCancel,
}: {
  suggestion: Suggestion
  busy?: boolean
  error?: string
  onSave: (edits: Payload) => void
  onCancel: () => void
}) {
  const [value, setValue] = useState<Payload>(() => JSON.parse(suggestion.payload))
  const set = (edits: Payload) => setValue({ ...value, ...edits })
  return (
    <Dialog open onClose={onCancel} className="!rounded-t-[28px] sm:!rounded-[28px]">
      <form
        onSubmit={(event) => {
          event.preventDefault()
          onSave(value)
        }}
      >
        <DialogTitle className="!text-xl !font-extrabold">Edit suggestion</DialogTitle>
        <DialogBody className="space-y-4">
          {error && <Notice tone="error">{error}</Notice>}
          {suggestion.kind === 'person' ? (
            <>
              <Field label="Name" id="edit-name" required value={value.name ?? ''} onChange={(event) => set({ name: event.target.value })} />
              <Field label="Company" id="edit-company" required value={value.company ?? ''} onChange={(event) => set({ company: event.target.value })} />
              <Field label="Role" id="edit-role" required value={value.role ?? ''} onChange={(event) => set({ role: event.target.value })} />
            </>
          ) : (
            <Area label="Words to keep" id="edit-words" required value={value.text ?? ''} onChange={(event) => set({ text: event.target.value })} />
          )}
          {suggestion.kind === 'todo' && (
            <>
              <Field label="Due date" id="edit-due" type="date" value={value.due_on ?? ''} onChange={(event) => set({ due_on: event.target.value || null })} />
              <div>
                <p className="mb-1.5 px-1 text-base font-bold text-zinc-700">Who owes this?</p>
                <Segmented
                  label="Who owes this?"
                  value={value.owner_person_id ? 'them' : 'mine'}
                  onChange={(owner) => set({ owner_person_id: owner === 'mine' ? null : (value.person_id ?? null) })}
                  items={[
                    { key: 'mine', label: 'Mine' },
                    { key: 'them', label: 'Waiting on' },
                  ]}
                />
              </div>
            </>
          )}
        </DialogBody>
        <DialogActions>
          <Button variant="quiet" disabled={busy} onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={busy}>
            Save and accept
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}

/** The words, with the quote that was tapped shown in violet. */
function Words({ text, quote }: { text: string; quote: string }) {
  const start = quote ? text.indexOf(quote) : -1
  return (
    <Card className="p-5">
      <p className="text-base/8 font-medium whitespace-pre-wrap text-zinc-800">
        {start < 0 ? (
          text
        ) : (
          <>
            {text.slice(0, start)}
            <mark>{quote}</mark>
            {text.slice(start + quote.length)}
          </>
        )}
      </p>
    </Card>
  )
}

/**
 * A recording: what KAI is doing, its suggestions, and the words. The dock
 * holds the one action: "Accept all" while there is something to decide,
 * "Try again" when the reading failed, otherwise the way on.
 */
export function Recording({
  recording,
  readOnly,
  today,
  busy,
  editing,
  error,
  actionError,
  waitlist,
  onDecide,
  onAcceptAll,
  onEdit,
  onSaveEdit,
  onCancelEdit,
  onRetry,
}: {
  recording: RecordingData | null
  readOnly: boolean
  today: string
  busy?: boolean
  /** The id of the suggestion being edited. */
  editing?: string | null
  error?: string
  actionError?: string
  waitlist?: ReactNode
  onDecide: (id: string, decision: 'accept' | 'reject') => void
  onAcceptAll: () => void
  onEdit: (id: string) => void
  onSaveEdit: (id: string, edits: Payload) => void
  onCancelEdit: () => void
  onRetry: () => void
}) {
  const [quote, setQuote] = useState('')
  const proposed = recording?.suggestions.filter((s) => s.status === 'proposed') ?? []
  const edited = recording?.suggestions.find((s) => s.id === editing)
  const working = recording?.status === 'waiting' || recording?.status === 'listening' || recording?.status === 'reading'
  const source = recording?.source ? SOURCE[recording.source] : null

  const showQuote = (words: string) => {
    setQuote(words)
    document.getElementById('recording-words')?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }

  const dock = edited ? undefined : recording?.status === 'failed' && !readOnly ? (
    <Button variant="primary" icon="retry" onClick={onRetry}>
      Try again
    </Button>
  ) : !readOnly && proposed.length > 0 ? (
    <Button variant="primary" icon="check" disabled={busy || recording?.status !== 'ready'} onClick={onAcceptAll}>
      Accept all · {proposed.length}
    </Button>
  ) : (
    <Button variant="primary" href={readOnly ? '/home' : '/people'}>
      {readOnly ? 'Back to Home' : 'See people'}
    </Button>
  )

  return (
    <PushedPage back="/home" backLabel="Back to Home" readOnly={readOnly} dock={dock}>
      <header className="px-1">
        <div className="flex flex-wrap items-center gap-2">
          {source && <Chip icon={source.icon}>{source.label}</Chip>}
          {recording?.happened_on && <span className="text-base font-semibold text-zinc-600">{shortDay(recording.happened_on, true)}</span>}
        </div>
        <h1 className="mt-2 text-[30px]/9 font-extrabold tracking-tight">{recording?.title ?? 'Recording'}</h1>
      </header>

      {error && <Notice tone="error">{error}</Notice>}
      {!recording && !error && <Notice>Loading your recording…</Notice>}

      {recording && (
        <>
          {working && (
            <p role="status" className="flex items-center gap-3 rounded-2xl bg-violet-100 px-4 py-3 text-base font-bold text-violet-900">
              <span className="rounded-full bg-white px-2.5 py-2">
                <Working />
              </span>
              {recording.status === 'waiting' ? 'Waiting for KAI…' : recording.status === 'listening' ? 'KAI is listening…' : (recording.progress ?? 'KAI is reading…')}
            </p>
          )}
          {recording.status === 'failed' && <Notice tone="error">{recording.error ?? 'KAI could not read this recording.'}</Notice>}
          {actionError && !edited && <Notice tone="error">{actionError}</Notice>}

          {recording.person && <Card className="p-5"><p className="text-base font-semibold text-zinc-600">Linked to</p><TextLink href={'/people/'+recording.person.id}>{recording.person.name}</TextLink></Card>}

          {recording.summary && (
            <Card className="p-5">
              <p className="flex items-center gap-1.5 text-base font-extrabold text-violet-700">
                <Icon name="sparkle" />
                KAI’s summary
              </p>
              <p className="mt-2 text-lg/8 font-medium whitespace-pre-line text-zinc-800">{recording.summary}</p>
            </Card>
          )}

          {(recording.suggestions.length > 0 || recording.status === 'ready') && (
            <div>
              <SectionLabel tone="kai" count={proposed.length || undefined}>
                {proposed.length ? 'KAI suggests' : 'What KAI suggested'}
              </SectionLabel>
              {recording.suggestions.length > 0 ? (
                <ul className="divide-y divide-zinc-100 overflow-hidden rounded-3xl bg-white shadow-card ring-2 ring-violet-200">
                  {recording.suggestions.map((suggestion) => (
                    <SuggestionRow
                      key={suggestion.id}
                      suggestion={suggestion}
                      today={today}
                      readOnly={readOnly}
                      busy={busy || Boolean(edited)}
                      onQuote={showQuote}
                      onDecide={onDecide}
                      onEdit={onEdit}
                    />
                  ))}
                </ul>
              ) : (
                <Card className="p-5 text-base font-medium text-zinc-600">KAI found no suggestions in these words.</Card>
              )}
            </div>
          )}

          {recording.status === 'ready' && proposed.length === 0 && waitlist}

          {recording.text && (
            <section aria-labelledby="recording-words">
              <SectionLabel id="recording-words">The words</SectionLabel>
              <Words text={recording.text} quote={quote} />
            </section>
          )}
        </>
      )}

      {edited && <SuggestionEditor key={edited.id} suggestion={edited} busy={busy} error={actionError} onCancel={onCancelEdit} onSave={(edits) => onSaveEdit(edited.id, edits)} />}
    </PushedPage>
  )
}
