import clsx from 'clsx'
import { createContext, useContext, type ComponentPropsWithoutRef, type ReactNode } from 'react'
import { Icon, type IconName } from './icons'

/*
 * The pieces every screen is made of. Three rules hold in all of them, and
 * `design/check.mjs` measures them at 375 px:
 *   - no text under 16 px;
 *   - every link, button and field is at least 44 px wide and tall;
 *   - one screen has exactly one filled violet button: its one action.
 */

/* ---------- addresses ---------- */

/** The app's own paths ("/people"). The gallery maps them to its hash routes. */
const HrefContext = createContext<(path: string) => string>((path) => path)
export const HrefProvider = HrefContext.Provider
export const useHref = () => useContext(HrefContext)
const NotebookStatusContext=createContext({unread:0})
export const NotebookStatusProvider=NotebookStatusContext.Provider

/* ---------- surfaces ---------- */

export const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600'
export const CARD = 'rounded-3xl bg-white shadow-card ring-1 ring-violet-950/[0.04]'
export const GLASS = 'bg-white/75 shadow-float ring-1 ring-black/[0.06] backdrop-blur-2xl backdrop-saturate-[1.8]'
const DIVIDE = 'divide-y divide-zinc-100'

export function Card({ className, kai, children, ...props }: { kai?: boolean } & ComponentPropsWithoutRef<'section'>) {
  return (
    <section {...props} className={clsx(CARD, kai && 'ring-2 ring-violet-200', className)}>
      {children}
    </section>
  )
}

/** A card of rows with hairlines between them. */
export function Rows({ className, kai, children }: { className?: string; kai?: boolean; children: ReactNode }) {
  return (
    <ul className={clsx(CARD, DIVIDE, 'overflow-hidden', kai && 'ring-2 ring-violet-200', className)}>{children}</ul>
  )
}

/** The small heading over a card. Violet with a sparkle when it is KAI's. */
export function SectionLabel({
  children,
  tone = 'plain',
  count,
  action,
  id,
}: {
  children: ReactNode
  tone?: 'plain' | 'kai' | 'overdue' | 'soon'
  count?: number
  action?: ReactNode
  id?: string
}) {
  const icon: IconName | null = tone === 'kai' ? 'sparkle' : tone === 'overdue' ? 'warning' : tone === 'soon' ? 'clock' : null
  return (
    <div className="mb-2 flex min-h-11 items-end justify-between gap-3 px-1">
      <h2
        id={id}
        className={clsx(
          'flex items-center gap-1.5 pb-1 text-base font-extrabold',
          tone === 'kai' && 'text-violet-700',
          tone === 'overdue' && 'text-rose-700',
          tone === 'soon' && 'text-amber-700',
          tone === 'plain' && 'text-zinc-500'
        )}
      >
        {icon && <Icon name={icon} className="size-5" />}
        {children}
        {count !== undefined && <span className="font-bold opacity-70">· {count}</span>}
      </h2>
      {action}
    </div>
  )
}

/* ---------- buttons ---------- */

const PILL = clsx(
  'inline-flex min-h-12 min-w-11 items-center justify-center gap-2 rounded-full px-5 text-base font-bold transition',
  'disabled:opacity-50 aria-disabled:opacity-50',
  FOCUS
)
const VARIANT = {
  /** The screen's one action. Use it once per screen. */
  primary: 'bg-violet-600 text-white shadow-action hover:bg-violet-700 active:bg-violet-800',
  soft: 'bg-violet-50 text-violet-700 hover:bg-violet-100',
  quiet: 'text-zinc-600 hover:bg-zinc-100',
  outline: 'bg-white text-zinc-800 ring-1 ring-zinc-200 hover:bg-zinc-50',
}
type Variant = keyof typeof VARIANT

type ButtonProps = { variant?: Variant; icon?: IconName; wide?: boolean; href?: string } & Omit<
  ComponentPropsWithoutRef<'button'>,
  'className'
>

export function Button({ variant = 'soft', icon, wide, href, children, type = 'button', ...props }: ButtonProps) {
  const to = useHref()
  const className = clsx(PILL, VARIANT[variant], wide && 'w-full')
  const inner = (
    <>
      {icon && <Icon name={icon} />}
      {children}
    </>
  )
  if (href !== undefined && !props.disabled)
    return (
      <a href={href.startsWith('/') ? to(href) : href} className={className}>
        {inner}
      </a>
    )
  return (
    <button type={type} {...props} className={className}>
      {inner}
    </button>
  )
}

/** A round glass button for the top corners: back, close. */
export function RoundLink({ href, label, icon }: { href: string; label: string; icon: IconName }) {
  const to = useHref()
  return (
    <a href={to(href)} aria-label={label} className={clsx(GLASS, FOCUS, 'grid size-11 place-items-center rounded-full text-zinc-800')}>
      <Icon name={icon} />
    </a>
  )
}

/** A violet text link that is still a full 44 px target. */
export function TextLink({ href, children, icon }: { href: string; children: ReactNode; icon?: IconName }) {
  const to = useHref()
  const external = /^https?:/.test(href)
  return (
    <a
      href={external ? href : to(href)}
      {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
      className={clsx(FOCUS, 'inline-flex min-h-11 min-w-11 items-center gap-1.5 rounded-full text-base font-bold text-violet-700')}
    >
      {children}
      {icon && <Icon name={icon} className="size-4" />}
    </a>
  )
}

/* ---------- people, badges, chips ---------- */

const AVATAR_TONES = [
  'bg-sky-200 text-sky-900',
  'bg-amber-200 text-amber-900',
  'bg-emerald-200 text-emerald-900',
  'bg-rose-200 text-rose-900',
  'bg-teal-200 text-teal-900',
]

/** One colour per person everywhere, chosen from the name. */
export function Avatar({ name, size = 'md', you }: { name: string; size?: 'md' | 'lg'; you?: boolean }) {
  const initials = name
    .split(/\s+/)
    .map((word) => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  const tone = AVATAR_TONES[[...name].reduce((sum, letter) => sum + letter.charCodeAt(0), 0) % AVATAR_TONES.length]
  return (
    <span
      aria-hidden="true"
      className={clsx(
        'grid shrink-0 place-items-center rounded-full font-extrabold',
        size === 'lg' ? 'size-16 text-xl ring-4 ring-white' : 'size-11 text-base',
        you ? 'bg-violet-600 text-white' : tone
      )}
    >
      {initials}
    </span>
  )
}

/** The counts on a person's row: red overdue, amber due soon, violet for KAI. */
export function CountBadge({ tone, count, label }: { tone: 'overdue' | 'soon' | 'kai'; count: number; label: string }) {
  if (!count) return null
  return (
    <span
      aria-label={`${count} ${label}`}
      className={clsx(
        'inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-base font-extrabold',
        tone === 'overdue' && 'bg-rose-600 text-white',
        tone === 'soon' && 'bg-amber-400 text-amber-950',
        tone === 'kai' && 'bg-violet-100 text-violet-800'
      )}
    >
      <Icon name={tone === 'overdue' ? 'warning' : tone === 'soon' ? 'clock' : 'sparkle'} className="size-4" />
      {count}
    </span>
  )
}

export type DueTone = 'overdue' | 'soon' | 'later'

/** Overdue once the day has passed; due soon on the day and the day before. */
export function dueTone(day: string | null, today: string): DueTone | null {
  if (!day) return null
  if (day < today) return 'overdue'
  return day <= addDays(today, 1) ? 'soon' : 'later'
}

export function addDays(day: string, days: number) {
  const date = new Date(day + 'T12:00:00Z')
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/** "Nov 26", in the reader's own language. */
export function shortDay(day: string, weekday = false) {
  return new Date(day + 'T12:00:00Z').toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
    ...(weekday ? { weekday: 'short' } : {}),
  })
}

export function dueWords(day: string, today: string) {
  if (day < today) return `Overdue · ${shortDay(day)}`
  if (day === today) return 'Due today'
  if (day === addDays(today, 1)) return 'Due tomorrow'
  return `Due ${shortDay(day, true)}`
}

export function DueChip({ day, today }: { day: string | null; today: string }) {
  const tone = dueTone(day, today)
  if (!day || !tone) return null
  if (tone === 'later') return <span className="font-semibold text-zinc-600">{dueWords(day, today)}</span>
  return (
    <span
      className={clsx(
        'inline-flex min-h-7 items-center gap-1 rounded-full px-2.5 text-base font-bold ring-1',
        tone === 'overdue' ? 'bg-rose-50 text-rose-700 ring-rose-200' : 'bg-amber-50 text-amber-800 ring-amber-200'
      )}
    >
      <Icon name={tone === 'overdue' ? 'warning' : 'clock'} className="size-4" />
      {dueWords(day, today)}
    </span>
  )
}

export function Chip({ icon, children, tone = 'plain' }: { icon?: IconName; children: ReactNode; tone?: 'plain' | 'kai' | 'good' }) {
  return (
    <span
      className={clsx(
        'inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 text-base font-bold',
        tone === 'plain' && 'bg-zinc-100 text-zinc-700',
        tone === 'kai' && 'bg-violet-100 text-violet-800',
        tone === 'good' && 'bg-emerald-50 text-emerald-800'
      )}
    >
      {icon && <Icon name={icon} className="size-4" />}
      {children}
    </span>
  )
}

/* ---------- small parts ---------- */

/** Two or three choices in one glass bar: "Mine" and "Waiting on". */
export function Segmented<T extends string>({
  label,
  value,
  onChange,
  items,
}: {
  label: string
  value: T
  onChange: (value: T) => void
  items: { key: T; label: string }[]
}) {
  return (
    <div role="group" aria-label={label} className={clsx(GLASS, 'flex rounded-full p-1')}>
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          aria-pressed={item.key === value}
          onClick={() => onChange(item.key)}
          className={clsx(
            FOCUS,
            'min-h-11 flex-1 rounded-full px-3 text-base font-bold transition',
            item.key === value ? 'bg-white text-violet-700 shadow-sm ring-1 ring-black/[0.04]' : 'text-zinc-600'
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

/** The words KAI heard. Tapping it shows them in the transcript. */
export function Quote({ children, onClick }: { children: string; onClick?: () => void }) {
  const className = 'block w-full border-l-[3px] border-violet-300 py-1.5 pl-3 text-left text-base/7 font-medium text-zinc-600 italic'
  if (!onClick) return <blockquote className={className}>“{children}”</blockquote>
  return (
    <button type="button" onClick={onClick} aria-label={`Show in the words: ${children}`} className={clsx(className, FOCUS, 'min-h-11 rounded-r-xl hover:bg-violet-50')}>
      “{children}”
    </button>
  )
}

/** The round tick on a to-do. With no `onTick` it is only a mark. */
export function Tick({ label, busy, onTick }: { label: string; busy?: boolean; onTick?: () => void }) {
  const ring = <span className={clsx('block size-6 rounded-full border-2 border-violet-300 bg-white', busy && 'animate-kai-pulse border-violet-600')} />
  if (!onTick) return <span className="grid size-11 shrink-0 place-items-center">{ring}</span>
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked="false"
      aria-label={label}
      disabled={busy}
      onClick={onTick}
      className={clsx(FOCUS, 'grid size-11 shrink-0 place-items-center rounded-full hover:bg-violet-50')}
    >
      {ring}
    </button>
  )
}

/** Three dots that breathe while KAI works. */
export function Working() {
  return (
    <span className="inline-flex items-center gap-1" aria-hidden="true">
      {[0, 1, 2].map((dot) => (
        <span key={dot} className="size-2 animate-kai-pulse rounded-full bg-violet-600" style={{ animationDelay: `${dot * 0.18}s` }} />
      ))}
    </span>
  )
}

export function Notice({ children, tone = 'plain' }: { children: ReactNode; tone?: 'plain' | 'error' | 'good' }) {
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      className={clsx(
        'rounded-2xl px-4 py-3 text-base font-semibold',
        tone === 'plain' && 'bg-violet-50 text-violet-900',
        tone === 'error' && 'bg-rose-50 text-rose-800',
        tone === 'good' && 'bg-emerald-50 text-emerald-800'
      )}
    >
      {children}
    </p>
  )
}

export const READ_ONLY = 'Read-only demo'

const FIELD = clsx(
  'block w-full rounded-2xl bg-white px-4 text-base text-zinc-900 ring-1 ring-zinc-200 placeholder:text-zinc-500',
  'focus:ring-2 focus:ring-violet-500 focus:outline-none'
)

export function Field({ label, id, ...props }: { label: string; id: string } & Omit<ComponentPropsWithoutRef<'input'>, 'className'>) {
  return (
    <label htmlFor={id} className="block">
      <span className="mb-1.5 block px-1 text-base font-bold text-zinc-700">{label}</span>
      <input id={id} {...props} className={clsx(FIELD, 'h-12')} />
    </label>
  )
}

export function Area({ label, id, ...props }: { label: string; id: string } & Omit<ComponentPropsWithoutRef<'textarea'>, 'className'>) {
  return (
    <label htmlFor={id} className="block">
      <span className="mb-1.5 block px-1 text-base font-bold text-zinc-700">{label}</span>
      <textarea id={id} {...props} className={clsx(FIELD, 'min-h-28 py-3')} />
    </label>
  )
}

/* ---------- the frame of a screen ---------- */

const TABS: { label: string; path: string; icon: IconName }[] = [
  { label: 'Home', path: '/home', icon: 'home' },
  { label: 'Library', path: '/library', icon: 'folder' },
  { label: 'People', path: '/people', icon: 'people' },
  { label: 'Tasks', path: '/todos', icon: 'todo' },
]

export type TabPath = '/home' | '/library' | '/people' | '/todos'

/** The four tabs, floating at the top. `dueTone` turns To-dos red or amber. */
function Tabs({ current, due }: { current: TabPath; due?: 'overdue' | 'soon' }) {
  const to = useHref()
  return (
    <nav aria-label="Main" className={clsx(GLASS, 'flex rounded-full p-1')}>
      {TABS.map((tab) => {
        const active = tab.path === current
        const tone = tab.path === '/todos' ? due : undefined
        return (
          <a
            key={tab.path}
            href={to(tab.path)}
            aria-current={active ? 'page' : undefined}
            data-tone={tone}
            className={clsx(
              FOCUS,
              'relative flex min-h-11 flex-1 items-center justify-center rounded-full px-1 text-base font-bold transition',
              active ? 'bg-white text-violet-700 shadow-sm ring-1 ring-black/[0.04]' : 'text-zinc-600'
            )}
          >
            {tab.label}
            {tone && (
              <span className={clsx('absolute top-1.5 right-2 size-2.5 rounded-full ring-2 ring-white', tone === 'overdue' ? 'bg-rose-600' : 'bg-amber-400')} />
            )}
          </a>
        )
      })}
    </nav>
  )
}

/**
 * A tab page: the name of the notebook, the tabs, a title, the content, and
 * the dock with the screen's one action.
 */
export function TabPage({
  current,
  title,
  subtitle,
  readOnly,
  due,
  dock,
  children,
}: {
  current: TabPath
  title: string
  subtitle?: ReactNode
  readOnly?: boolean
  due?: 'overdue' | 'soon'
  dock?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="isolate mx-auto min-h-dvh max-w-[560px] px-4 pb-32">
      <div className="sticky top-0 z-20 -mx-4 bg-gradient-to-b from-page from-70% to-page/0 px-4 pt-3 pb-4">
        <div className="mb-2 flex items-center justify-between gap-3 px-1">
          <span className="text-xl font-extrabold tracking-tight text-violet-700">KAI</span>
          <div className="flex min-w-0 items-center gap-2">{readOnly && <span className="truncate text-base font-semibold text-zinc-500">{READ_ONLY}</span>}<RoundLink href="/connect" label="Connections" icon="settings"/></div>
        </div>
        <Tabs current={current} due={due} />
      </div>
      <main className="animate-kai-in">
        <header className="px-1 pt-2 pb-5">
          <h1 className="text-[32px]/10 font-extrabold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-base font-medium text-zinc-600">{subtitle}</p>}
        </header>
        <div className="space-y-6">{children}</div>
      </main>
      <Footer />
      {dock && <Dock>{dock}</Dock>}
    </div>
  )
}

/** A screen you reach from a list: a back button instead of the tabs. */
export function PushedPage({
  back,
  backLabel,
  readOnly,
  dock,
  children,
}: {
  back: string
  backLabel: string
  readOnly?: boolean
  dock?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="isolate mx-auto min-h-dvh max-w-[560px] px-4 pb-32">
      <div className="sticky top-0 z-20 -mx-4 flex items-center justify-between bg-gradient-to-b from-page from-60% to-page/0 px-4 pt-3 pb-4">
        <RoundLink href={back} label={backLabel} icon="left" />
        <span className="px-1 text-xl font-extrabold tracking-tight text-violet-700">KAI</span>
      </div>
      <main className="animate-kai-in space-y-6">
        {readOnly && <p className="px-1 text-base font-medium text-zinc-500">{READ_ONLY}</p>}
        {children}
      </main>
      <Footer />
      {dock && <Dock>{dock}</Dock>}
    </div>
  )
}

/** Floats over the foot of the screen and holds its one action. */
export function Dock({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-page from-55% to-page/0 px-4 pt-8 pb-[calc(env(safe-area-inset-bottom)+16px)]">
      <div className="pointer-events-auto mx-auto flex max-w-[528px] justify-center *:w-full">{children}</div>
    </div>
  )
}

export function Footer() {
  return <footer className="pt-10 pb-2 text-center text-base font-semibold text-zinc-500">KAI, by Kopal</footer>
}

/**
 * "Add recordings": the action of every tab page in your own copy. The file
 * field lies over the pill, so one tap opens the phone's own picker.
 */
export function AddRecordings({ personId, hideNotifications }: { onFiles?: (files: File[]) => void; busy?: boolean; personId?: string; hideNotifications?: boolean }) {
  const {unread}=useContext(NotebookStatusContext)
  return <div className="flex w-full items-center gap-3">
    {!hideNotifications && <div className="relative shrink-0"><RoundLink href="/notifications" label={unread ? `Notifications, ${unread} unread`:'Notifications'} icon="bell"/>{unread>0 && <span aria-hidden="true" className="absolute right-1 top-1 size-3 rounded-full bg-rose-600 ring-2 ring-white"/>}</div>}
    <div className="min-w-0 flex-1"><Button variant="primary" wide icon="plus" href={'/upload/new'+(personId ? '?person='+encodeURIComponent(personId) : '')}>Add recordings</Button></div>
    <div className="shrink-0"><RoundLink href="/search" label="Search" icon="search"/></div>
  </div>
}

export function RecordingPicker({ onFiles, busy, disabled, label='Add recordings' }: { label?:string; onFiles: (files: File[]) => void; busy?: boolean; disabled?: boolean }) {
  return (
    <div className="relative">
      <button type="button" tabIndex={-1} aria-hidden="true" disabled={busy || disabled} className={clsx(PILL, VARIANT.primary, 'h-14 w-full text-lg')}>
        <Icon name="plus" />
        {busy ? 'Adding…' : label}
      </button>
      <input
        type="file"
        disabled={busy || disabled}
        accept=".m4a,.opus,.ogg,.mp3,.wav"
        aria-label="Add recording: choose one audio file"
        onChange={(event) => {
          onFiles(Array.from(event.target.files ?? []))
          event.target.value = ''
        }}
        className="peer absolute inset-0 size-full cursor-pointer rounded-full opacity-0"
      />
      <span className="pointer-events-none absolute -inset-1 hidden rounded-full outline-2 outline-violet-600 peer-focus-visible:block" />
    </div>
  )
}

/** The action of a tab page in the read-only copy. */
export function WhatIsKai() {
  return <div className="flex w-full items-center gap-3"><div className="min-w-0 flex-1"><Button variant="primary" wide href="/try">Try it yourself</Button></div><div className="shrink-0"><RoundLink href="/search" label="Search" icon="search"/></div></div>
}
