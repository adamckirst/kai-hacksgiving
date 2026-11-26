/**
 * What the screens are given. These are the shapes the server already
 * answers with (`/api/access`, `/api/home`, `/api/people`, …). A field marked
 * optional is one the design shows when it is there and that the server does
 * not send yet; the README lists them.
 */

export type Access = { kind: 'judge' | 'public'; videoUrl: string | null; trialSeconds?: number | null }

export type Person = {
  id: string
  name: string
  company: string
  role: string
  overdue: number
  soon: number
  suggestions: number
}

export type TodoGroup = 'Overdue' | 'Due soon' | 'Later' | 'No date'

export type Todo = {
  id: string
  text: string
  due_on: string | null
  /** Empty means the to-do is yours; otherwise this person owes it to you. */
  owner_person_id: string | null
  person_id: string | null
  person_name: string | null
  owner_name: string | null
  quote: string
  conversation_id: string
  group: TodoGroup
}

export type PersonPage = {
  id?: string
  name: string
  company: string
  role: string
  /** The recording that still holds suggestions about this person. */
  pending: string | null
  pendingCount?: number
  todos: { id: string; text: string; due_on: string | null; quote: string; owner_person_id: string | null }[]
  notes: { id: string; text: string; quote: string }[]
  conversations: { id: string; title: string; happened_on: string }[]
}

export type SuggestionKind = 'person' | 'note' | 'todo' | 'done'

export type Suggestion = {
  id: string
  kind: SuggestionKind
  /** JSON, as the server stores it. */
  payload: string
  quote: string
  status: 'proposed' | 'accepted' | 'rejected'
}

export type Payload = {
  name?: string
  company?: string
  role?: string
  text?: string
  due_on?: string | null
  owner_person_id?: string | null
  person_id?: string | null
  person_name?: string
}

export type RecordingStatus = 'waiting' | 'listening' | 'reading' | 'ready' | 'failed'
export type Source = 'recording' | 'shared' | 'paste' | 'sample'

export type LinkedPerson = { id: string; name: string; company: string; role: string }
export type PersonChoice = { person_id: string | null } | { new_person: LinkedPerson }

export type Recording = {
  person?: LinkedPerson | null
  awaiting_person?: number
  title: string
  summary: string
  text: string
  status: RecordingStatus
  error: string | null
  progress: string | null
  suggestions: Suggestion[]
  happened_on?: string
  source?: Source
}

export type QueueItem = { id: string; title: string; status: RecordingStatus; error: string | null; progress?: string | null; awaiting_person?: number; suggestion_count?: number }

export type HomeData = {
  trialVerified?: boolean
  trialSeconds?: number | null
  hasRecordings?: boolean
  peopleCount: number
  todos: { id: string; text: string; due_on?: string | null; person_name?: string | null }[]
  conversations: { id: string; title: string; summary: string; happened_on?: string }[]
}

export type Sample = { id: string; title: string }

export type Connection = { uploadAddress: string; assistantAddress: string; homeAddress: string }
