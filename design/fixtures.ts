import type { Connection, HomeData, Person, PersonPage, QueueItem, Recording, Sample, Suggestion, Todo } from '../src/look/types'
import { addDays } from '../src/look/ui'

/*
 * Made-up data for the gallery: Mara Lindqvist, founder of Loomwork, and the
 * clinics she talks to. Every person, company and sentence is invented.
 * The gallery's "today" is fixed, so the pictures do not change from day to day.
 */
export const TODAY = '2026-11-25'
const day = (offset: number) => addDays(TODAY, offset)

export const people: Person[] = [
  { id: 'dana', name: 'Dana Whitfield', company: 'Willow Dental', role: 'Operations lead', overdue: 1, soon: 0, suggestions: 4 },
  { id: 'ellis', name: 'Ellis Rowan', company: 'Harbour Dental', role: 'Clinic owner', overdue: 0, soon: 1, suggestions: 0 },
  { id: 'sora', name: 'Sora Bell', company: 'Cloudberry Smiles', role: 'Clinic manager', overdue: 0, soon: 0, suggestions: 2 },
  { id: 'ines', name: 'Ines Marlow', company: 'Fernhill Dental Group', role: 'Finance lead', overdue: 0, soon: 0, suggestions: 0 },
  { id: 'teo', name: 'Teo Arden', company: 'Loomwork', role: 'Engineer', overdue: 0, soon: 0, suggestions: 0 },
]

export const todos: Todo[] = [
  { id: 't1', text: 'Send Dana the pricing', due_on: day(-2), owner_person_id: null, person_id: 'dana', person_name: 'Dana Whitfield', owner_name: null, quote: 'I promised to send Dana the pricing.', conversation_id: 'dana-call', group: 'Overdue' },
  { id: 't2', text: 'Send Ellis the trial checklist', due_on: day(1), owner_person_id: null, person_id: 'ellis', person_name: 'Ellis Rowan', owner_name: null, quote: 'I promised to send a trial checklist tomorrow.', conversation_id: 'ellis-call', group: 'Due soon' },
  { id: 't3', text: 'Book the onboarding call with Fernhill', due_on: day(6), owner_person_id: null, person_id: 'ines', person_name: 'Ines Marlow', owner_name: null, quote: 'I said I would book the onboarding call.', conversation_id: 'ines-call', group: 'Later' },
  { id: 't4', text: 'Write up the clinic interview notes', due_on: null, owner_person_id: null, person_id: null, person_name: null, owner_name: null, quote: 'I should write up the interview notes.', conversation_id: 'ines-call', group: 'No date' },
  { id: 't5', text: 'Send the trial dates', due_on: day(0), owner_person_id: 'ellis', person_id: 'ellis', person_name: 'Ellis Rowan', owner_name: 'Ellis Rowan', quote: 'Ellis promised to send the trial dates.', conversation_id: 'ellis-call', group: 'Due soon' },
  { id: 't6', text: 'Share last year’s no-show numbers', due_on: day(8), owner_person_id: 'ines', person_id: 'ines', person_name: 'Ines Marlow', owner_name: 'Ines Marlow', quote: 'Ines will share last year’s no-show numbers.', conversation_id: 'ines-call', group: 'Later' },
]

export const home: HomeData = {
  peopleCount: people.length,
  todos: todos.filter((todo) => !todo.owner_person_id).slice(0, 3),
  conversations: [
    { id: 'ellis-call', title: 'A trial with Ellis', summary: 'Ellis will ask the team about a trial.\nWe will talk again next week.', happened_on: day(-2) },
    { id: 'dana-call', title: 'First call with Dana', summary: 'Dana wants pricing for three clinics.\nHer team needs simpler scheduling.', happened_on: day(-4) },
  ],
}

export const queue: QueueItem[] = [
  { id: 'q1', title: 'After the call with Dana', status: 'ready', error: null },
  { id: 'q2', title: 'Voice note, 21 November', status: 'listening', error: null },
  { id: 'q3', title: 'Voice note, 24 November', status: 'waiting', error: null },
]

export const samples: Sample[] = [
  { id: 'dana', title: 'A follow-up with Dana' },
  { id: 'ellis', title: 'Trial plans with Ellis' },
  { id: 'sora', title: 'Meeting Sora' },
]

const words =
  'I just got off the phone with Dana Whitfield at Willow Dental. Good call. First thing, she thanked me for the pricing I sent Monday, so that one is finally done. Her CFO wants to review security before they sign anything. I promised to send the security questionnaire by Thursday. And Dana promised to introduce me to her CFO next week.'

const suggestion = (id: string, kind: Suggestion['kind'], payload: object, quote: string, status: Suggestion['status'] = 'proposed'): Suggestion => ({
  id,
  kind,
  payload: JSON.stringify(payload),
  person_name: (payload as {person_name?:string}).person_name,
  owner_name: (payload as {owner_person_id?:string}).owner_person_id ? (payload as {person_name?:string}).person_name : null,
  quote,
  status,
})

const suggestions: Suggestion[] = [
  suggestion('s1', 'done', { text: 'Send Dana the pricing', person_id: 'dana', person_name: 'Dana Whitfield' }, 'she thanked me for the pricing I sent Monday'),
  suggestion('s2', 'note', { text: 'Her CFO wants to review security before they sign.', person_id: 'dana', person_name: 'Dana Whitfield' }, 'Her CFO wants to review security before they sign anything.'),
  suggestion('s3', 'todo', { text: 'Send the security questionnaire', due_on: day(1), owner_person_id: null, person_id: 'dana', person_name: 'Dana Whitfield' }, 'I promised to send the security questionnaire by Thursday.'),
  suggestion('s4', 'todo', { text: 'Introduce Mara to the CFO', due_on: day(7), owner_person_id: 'dana', person_id: 'dana', person_name: 'Dana Whitfield' }, 'Dana promised to introduce me to her CFO next week.'),
]

const base: Recording = {
  title: 'After the call with Dana',
  summary: 'Dana thanked Mara for the pricing.\nHer CFO wants a security review before signing.',
  text: words,
  status: 'ready',
  error: null,
  progress: null,
  suggestions,
  happened_on: TODAY,
  source: 'shared',
}

export const recordings: Record<string, Recording> = {
  ready: base,
  listening: { ...base, title: 'Voice note, 25 November', summary: '', text: '', status: 'listening', suggestions: [] },
  reading: { ...base, status: 'reading', progress: 'Reading Dana’s page', suggestions: suggestions.slice(0, 2) },
  decided: {
    ...base,
    suggestions: suggestions.map((s, index) => ({ ...s, status: index === 1 ? 'rejected' : 'accepted' })),
  },
  failed: { ...base, summary: '', status: 'failed', error: 'KAI could not finish reading this recording.', suggestions: [] },
  person: {
    title: 'Meeting Sora',
    summary: 'Sora runs Cloudberry Smiles.\nShe wants room in the day for urgent appointments.',
    text: 'I met Sora Bell, the clinic manager at Cloudberry Smiles. Sora wants scheduling that leaves room for urgent appointments. I promised to send Sora a short overview tomorrow.',
    status: 'ready',
    error: null,
    progress: null,
    happened_on: day(-1),
    source: 'recording',
    suggestions: [
      suggestion('p1', 'person', { name: 'Sora Bell', company: 'Cloudberry Smiles', role: 'Clinic manager' }, 'I met Sora Bell, the clinic manager at Cloudberry Smiles.'),
      suggestion('p2', 'todo', { text: 'Send Sora a short overview', due_on: TODAY, owner_person_id: null, person_name: 'Sora Bell' }, 'I promised to send Sora a short overview tomorrow.'),
    ],
  },
}

export const dana: PersonPage = {
  name: 'Dana Whitfield',
  company: 'Willow Dental',
  role: 'Operations lead',
  pending: null,
  todos: [
    { id: 't1', text: 'Send Dana the pricing', due_on: day(-2), quote: 'I promised to send Dana the pricing.', owner_person_id: null },
    { id: 't7', text: 'Confirm the three clinic addresses', due_on: day(5), quote: 'Dana said she would confirm the three addresses.', owner_person_id: 'dana' },
  ],
  notes: [
    { id: 'n1', text: 'Wants fewer gaps between appointments.', quote: 'She wants fewer gaps between appointments.' },
    { id: 'n2', text: 'Runs three clinics, and decides with her CFO.', quote: 'Dana Whitfield at Willow Dental wants pricing for three clinics.' },
  ],
  conversations: [{ id: 'dana-call', title: 'First call with Dana', happened_on: day(-4) }],
}

export const danaPending: PersonPage = {
  ...dana,
  pending: 'ready',
  pendingCount: 4,
  conversations: [{ id: 'ready', title: 'After the call with Dana', happened_on: TODAY }, ...dana.conversations],
}

export const connection: Connection = {
  uploadAddress: 'https://kai-demo.sprites.app/in/made-up-address-for-the-design-0000',
  assistantAddress: 'https://kai-demo.sprites.app/mcp/made-up-address-for-the-design-0000',
  homeAddress: 'https://kai-demo.sprites.app/upload',
}
