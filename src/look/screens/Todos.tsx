import { useState } from 'react'
import type { Todo, TodoGroup } from '../types'
import { AddRecordings, Card, DueChip, Notice, Rows, SectionLabel, Segmented, TabPage, TextLink, Tick, WhatIsKai } from '../ui'

const GROUPS: { key: TodoGroup; tone: 'overdue' | 'soon' | 'plain' }[] = [
  { key: 'Overdue', tone: 'overdue' },
  { key: 'Due soon', tone: 'soon' },
  { key: 'Later', tone: 'plain' },
  { key: 'No date', tone: 'plain' },
]

/**
 * To-dos: "Mine" (what you promised) and "Waiting on" (what others promised
 * you), by when they are due. Tick one to finish it.
 */
export function Todos({
  todos,
  readOnly,
  today,
  view: firstView = 'mine',
  adding,
  error,
  message,
  pending = [],
  onTick,
  onFiles,
}: {
  todos: Todo[] | null
  readOnly: boolean
  today: string
  view?: 'mine' | 'waiting'
  adding?: boolean
  error?: string
  message?: string
  /** The ids of to-dos being marked done. */
  pending?: string[]
  onTick: (id: string) => void
  onFiles?: (files: File[]) => void
}) {
  const [view, setView] = useState(firstView)
  const waiting = view === 'waiting'
  const shown = todos?.filter((todo) => Boolean(todo.owner_person_id) === waiting)
  const count = (group: TodoGroup) => todos?.filter((todo) => todo.group === group).length ?? 0
  const overdue = count('Overdue')
  const soon = count('Due soon')
  return (
    <TabPage
      current="/todos"
      title="Tasks"
      subtitle={
        todos ? (
          <>
            {overdue > 0 && <span className="font-bold text-rose-700">{overdue} overdue</span>}
            {overdue > 0 && soon > 0 && ' · '}
            {soon > 0 && <span className="font-bold text-amber-700">{soon} due soon</span>}
            {overdue + soon === 0 && 'Nothing due soon'}
          </>
        ) : undefined
      }
      readOnly={readOnly}
      due={overdue ? 'overdue' : soon ? 'soon' : undefined}
      dock={readOnly ? <WhatIsKai /> : <AddRecordings onFiles={onFiles} busy={adding} />}
    >
      <Segmented
        label="Whose to-dos"
        value={view}
        onChange={setView}
        items={[
          { key: 'mine', label: 'Mine' },
          { key: 'waiting', label: 'Waiting on' },
        ]}
      />
      {error && <Notice tone="error">{error}</Notice>}
      {message && <Notice tone="good">{message}</Notice>}
      {!todos && !error && <Notice>Loading to-dos…</Notice>}
      {shown?.length === 0 && (
        <Card className="p-5 text-base font-medium text-zinc-600">
          {waiting ? 'Nobody owes you anything right now.' : 'Nothing to do. KAI adds what you promise in a recording, once you accept it.'}
        </Card>
      )}
      {GROUPS.map(({ key, tone }) => {
        const items = shown?.filter((todo) => todo.group === key) ?? []
        if (!items.length) return null
        return (
          <section key={key} aria-label={key}>
            <SectionLabel tone={tone} count={items.length}>
              {key}
            </SectionLabel>
            <Rows>
              {items.map((todo) => {
                const personId = waiting ? todo.owner_person_id : todo.person_id
                const personName = waiting ? todo.owner_name : todo.person_name
                return (
                  <li key={todo.id} className="flex gap-1 py-2 pr-4 pl-2">
                    <Tick label={`Mark ${todo.text} done`} busy={pending.includes(todo.id)} onTick={readOnly ? undefined : () => onTick(todo.id)} />
                    <div className="min-w-0 flex-1 pt-2">
                      <p className="text-lg/6 font-bold text-zinc-900">{todo.text}</p>
                      <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        {personId && personName && <TextLink href={'/people/' + encodeURIComponent(personId)}>{personName}</TextLink>}
                        <DueChip day={todo.due_on} today={today} />
                      </p>
                    </div>
                  </li>
                )
              })}
            </Rows>
          </section>
        )
      })}
    </TabPage>
  )
}
