import { Icon } from '../icons'
import type { Person as PersonRow, PersonPage } from '../types'
import { AddRecordings, Avatar, Button, Card, CountBadge, DueChip, FOCUS, Notice, PushedPage, Quote, Rows, SectionLabel, shortDay, TabPage, Tick, useHref, WhatIsKai } from '../ui'

const needsYou = (person: PersonRow) => person.overdue > 0 || person.soon > 0 || person.suggestions > 0
const urgency = (person: PersonRow) => (person.overdue > 0 ? 0 : person.soon > 0 ? 1 : 2)
const byName = (a: PersonRow, b: PersonRow) => a.name.localeCompare(b.name)

function PersonLine({ person }: { person: PersonRow }) {
  const to = useHref()
  return (
    <li>
      <a href={to('/people/' + person.id)} className={`${FOCUS} flex min-h-[72px] items-center gap-3 px-4 py-3`}>
        <Avatar name={person.name} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-lg/6 font-bold text-zinc-900">{person.name}</span>
          <span className="block truncate text-base font-medium text-zinc-600">{person.company}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          <CountBadge tone="overdue" count={person.overdue} label="overdue" />
          <CountBadge tone="soon" count={person.soon} label="due soon" />
          <CountBadge tone="kai" count={person.suggestions} label="to review" />
          {!needsYou(person) && <Icon name="right" className="size-5 text-zinc-400" />}
        </span>
      </a>
    </li>
  )
}

/**
 * People: "Needs you" by urgency (overdue, then due soon, then suggestions
 * only), then everyone else from A to Z.
 */
export function People({
  people,
  readOnly,
  due,
  adding,
  error,
  onFiles,
}: {
  people: PersonRow[] | null
  readOnly: boolean
  due?: 'overdue' | 'soon'
  adding?: boolean
  error?: string
  onFiles?: (files: File[]) => void
}) {
  const needs = (people ?? []).filter(needsYou).sort((a, b) => urgency(a) - urgency(b) || b.overdue - a.overdue || byName(a, b))
  const rest = (people ?? []).filter((person) => !needsYou(person)).sort(byName)
  return (
    <TabPage
      current="/people"
      title="People"
      subtitle={people ? `${people.length} people in Mara’s conversations` : undefined}
      readOnly={readOnly}
      due={due}
      dock={readOnly ? <WhatIsKai /> : <AddRecordings onFiles={onFiles} busy={adding} />}
    >
      {error && <Notice tone="error">{error}</Notice>}
      {!people && !error && <Notice>Loading people…</Notice>}
      {needs.length > 0 && (
        <section aria-label="Needs you">
          <SectionLabel count={needs.length}>Needs you</SectionLabel>
          <Rows>
            {needs.map((person) => (
              <PersonLine key={person.id} person={person} />
            ))}
          </Rows>
        </section>
      )}
      {rest.length > 0 && (
        <section aria-label={needs.length ? 'Everyone else' : 'Everyone'}>
          <SectionLabel>{needs.length ? 'Everyone else' : 'Everyone'}</SectionLabel>
          <Rows>
            {rest.map((person) => (
              <PersonLine key={person.id} person={person} />
            ))}
          </Rows>
        </section>
      )}
      {people?.length === 0 && <Card className="p-5 text-base font-medium text-zinc-600">People appear here once KAI hears about them in a recording.</Card>}
    </TabPage>
  )
}

/**
 * A person's page: who they are, what is open between you, what KAI noted
 * with the words it heard, and their recordings, newest first.
 */
export function Person({
  person,
  readOnly,
  today,
  adding,
  error,
  pendingTodo,
  onTick,
  onFiles,
}: {
  person: PersonPage | null
  readOnly: boolean
  today: string
  adding?: boolean
  error?: string
  /** The ids of to-dos being marked done. */
  pendingTodo?: string[]
  onTick?: (id: string) => void
  onFiles?: (files: File[]) => void
}) {
  const to = useHref()
  const first = person?.name.split(' ')[0]
  const mine = person?.todos.filter((todo) => !todo.owner_person_id) ?? []
  const theirs = person?.todos.filter((todo) => todo.owner_person_id) ?? []
  const dock = readOnly ? (
    <Button variant="primary" href="/people">
      Back to People
    </Button>
  ) : person?.pending ? (
    <Button variant="primary" icon="sparkle" href={'/recordings/' + person.pending}>
      Review suggestions{person.pendingCount ? ` · ${person.pendingCount}` : ''}
    </Button>
  ) : (
    <AddRecordings onFiles={onFiles} busy={adding} personId={person?.id} />
  )

  const todoRows = (todos: PersonPage['todos'], who: string) => (
    <div>
      <SectionLabel count={todos.length}>{who}</SectionLabel>
      <Rows>
        {todos.map((todo) => (
          <li key={todo.id} className="flex gap-1 py-3 pr-4 pl-2">
            <Tick label={`Mark ${todo.text} done`} busy={pendingTodo?.includes(todo.id)} onTick={readOnly || !onTick ? undefined : () => onTick(todo.id)} />
            <div className="min-w-0 flex-1 pt-2">
              <p className="text-lg/6 font-bold text-zinc-900">{todo.text}</p>
              <p className="mt-1.5">
                <DueChip day={todo.due_on} today={today} />
              </p>
              <div className="mt-2">
                <Quote>{todo.quote}</Quote>
              </div>
            </div>
          </li>
        ))}
      </Rows>
    </div>
  )

  return (
    <PushedPage back="/people" backLabel="Back to People" readOnly={readOnly} dock={dock}>
      {error && <Notice tone="error">{error}</Notice>}
      {!person && !error && <Notice>Loading this person…</Notice>}
      {person && (
        <>
          <Card className="flex items-center gap-4 p-5">
            <Avatar name={person.name} size="lg" />
            <div className="min-w-0">
              <h1 className="text-[26px]/8 font-extrabold tracking-tight">{person.name}</h1>
              <p className="text-base font-medium text-zinc-600">
                {person.role}, {person.company}
              </p>
            </div>
          </Card>

          {mine.length > 0 && todoRows(mine, 'You owe ' + first)}
          {theirs.length > 0 && todoRows(theirs, first + ' owes you')}
          {person.todos.length === 0 && <Card className="p-5 text-base font-medium text-zinc-600">Nothing is open between you and {first}.</Card>}

          <div>
            <SectionLabel>Notes</SectionLabel>
            {person.notes.length ? (
              <Rows>
                {person.notes.map((note) => (
                  <li key={note.id} className="px-4 py-4">
                    <p className="text-lg/7 font-bold text-zinc-900">{note.text}</p>
                    <div className="mt-2">
                      <Quote>{note.quote}</Quote>
                    </div>
                  </li>
                ))}
              </Rows>
            ) : (
              <Card className="p-5 text-base font-medium text-zinc-600">No notes yet.</Card>
            )}
          </div>

          <div>
            <SectionLabel>Recordings</SectionLabel>
            {person.conversations.length ? (
              <Rows>
                {person.conversations.map((recording) => (
                  <li key={recording.id}>
                    <a href={to('/recordings/' + recording.id)} className={`${FOCUS} flex min-h-16 items-center gap-3 px-4 py-3`}>
                      <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-violet-50 text-violet-700">
                        <Icon name="mic" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-base font-bold text-zinc-900">{recording.title}</span>
                        <span className="block text-base font-medium text-zinc-600">{shortDay(recording.happened_on, true)}</span>
                      </span>
                      <Icon name="right" className="size-5 text-zinc-400" />
                    </a>
                  </li>
                ))}
              </Rows>
            ) : (
              <Card className="p-5 text-base font-medium text-zinc-600">No recordings yet.</Card>
            )}
          </div>
        </>
      )}
    </PushedPage>
  )
}
