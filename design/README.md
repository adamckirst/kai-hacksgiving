# The look of KAI

Every screen of KAI as Copal wants it to look, in every state worth drawing,
on made-up data. It is the reference the app's screens are built to. Nothing
here calls the server.

Written on 25 November 2026 for KAI. It follows the look of Copal's Kopal
design (the font, the colours, the shapes of cards and bars); no file was
copied from it.

## See it

```bash
npx vite --config design/vite.config.ts      # http://127.0.0.1:18560
PLAYWRIGHT_BROWSERS_PATH=.playwright node design/check.mjs
npx tsc --noEmit -p design/tsconfig.json
```

`#/` lists the states; `#/recording/reading` is one. `check.mjs` measures
every state at 375 px against U6 to U8, exits 1 on a failure, and writes a
picture of each whole screen to [`shots/`](shots). Look at the pictures
first.

## What is here

| File | Holds |
|---|---|
| `../src/look/kai.css` | The look in one place: font, page colour, shadows, motion |
| `../src/look/ui.tsx` | The pieces: `TabPage`, `PushedPage`, `Dock`, `Card`, `Rows`, `SectionLabel`, `Button`, `Avatar`, `CountBadge`, `DueChip`, `Segmented`, `Quote`, `Tick`, `Field`, `AddRecordings` |
| `../src/look/icons.tsx` | KAI's own icons. There is no icon library |
| `../src/look/types.ts` | What each screen is given: the shapes the server answers with today |
| `../src/look/screens/` | `Welcome`, `Home`, `Recording`, `People` and `Person`, `Todos`, `Connect`, `Upload`, `Opening`, `Waitlist` and `Operator` |
| `fixtures.ts`, `gallery.tsx` | Mara's made-up data, and the page that shows each state |
| `check.mjs`, `shots/` | The measurement and its pictures |

A screen here fetches nothing and keeps no server state: it takes data and
callbacks. `gallery.tsx` shows how each is called.

## Shared with the app (PRD §7, step 13)

`src/look/` now holds `kai.css`, `ui.tsx`, `icons.tsx`, `types.ts` and
`screens/`. The gallery and app import that one copy. The app controllers
keep fetching, polling, uploads and decisions; the shared screens take data
and callbacks. The old global `src/style.css` is removed. Stock Catalyst is
unchanged, including the dialog used for the editing sheet.

The gallery includes loading and failure states needed by the live app.
`check.mjs` checks all 110 states. The phone suite checks all public and judge
routes, choosing a person before an upload, shared recordings waiting for that choice, Home checkboxes, decisions, editing, errors and quote
highlighting. It checks the filled violet's resting, hover and active colours,
and waits for finite layout transitions to settle through retried assertions.

`app-shots/` holds phone pictures from the real app with local invented data.
Connection addresses are intercepted with invalid layout examples before
capture. To refresh them, run `KAI_SCREENSHOTS=1 npm run test:phone`; the
pictures go to ignored `.data/app-shots/` for inspection before copying here.
Ordinary checks do not rewrite the committed pictures. `shots/` remains the
gallery reference. Different people counts and dates reflect the fixtures,
not a second implementation of the look.

### Each screen's one action

The dock at the foot of the screen holds it, except where noted.

| Screen | Your own copy | Read-only copy |
|---|---|---|
| Welcome | "Try it yourself", in the page | "Try it yourself", with a quiet "Look around" |
| Home, People, To-dos | "Add recordings": opens the upload page to choose a person, then files | "Try it yourself", to trial signup |
| Recording | "Accept all · n"; "Try again" when it failed; no main action when all is decided (Copal’s request). Hidden while a suggestion is edited: "Save and accept" is then the one | "Back to Home" |
| Person | "Review suggestions" when some wait; otherwise "Add recordings" | "Back to People" |
| Upload | "Choose audio files", "Set up shortcut" or "Open WhatsApp" or "Choose saved audio"; "Let KAI read" for a shared recording | "Try it yourself" |
| Connect | "Copy your address", in the first card | "Try it yourself" |

### What the look shows that the server does not send yet

Each is optional in `types.ts`, and the screen is whole without it.

- `/api/home`: `due_on` and `person_name` on a to-do; `happened_on` on a recording.
- `/api/people/<id>`: `pendingCount`, for "Review suggestions · 4".
- The red or amber dot on the To-dos tab (`due`) needs the two counts on
  every tab page.

### What differs from the app today, on purpose

- People: "Everyone else" leaves out the people already under "Needs you".
- Editing a suggestion is a sheet from the foot of the phone (the kit's `Dialog`).
- The words on Welcome are new. They are Copal's to change.

## Rules of the look

- Violet is KAI's: the one action of a screen, a suggestion, a quote. Red is
  overdue. Amber is due today or tomorrow. Nothing else is coloured.
- No text under 16 px, and no link, button or field under 44 px. Small
  uppercase labels and icon-only buttons do not belong here.
- One filled violet button per screen (`variant="primary"`). Everything else
  is `soft`, `quiet` or `outline`.
- The look changes on Copal's words. When the app needs a state that is not
  drawn, add it to `gallery.tsx` in the same pull request.

The public header says “Read-only demo”; private copies show only KAI and the settings button.
The trial gallery includes signup, busy, error, empty notebook and used quota states.

The trial also shows code entry and wrong-code states. Credit is granted only
after verification, for at most 100 people and one trial per email/public IP.

Phone setup is three compact steps: copy the private address, add the iOS
shortcut, then try it. Manual setup is a closed disclosure under step 2.
The private address is a separate disclosure, opened automatically if copying
fails. Both expanded states are included in the gallery.

Verified trial Home and signup explain recording-ready emails: suggestion
counts and a review link, with recording content kept in KAI.

The recording-ready email uses the same lavender background, white card and
violet call-to-action as the app. `email-ready.html` and `email-empty.html`
are invented-data captures from `src/email/ready.ts`; their phone pictures
are `shots/email-ready.png` and `shots/email-empty.png`. The entry title is
shown in the subject and body, as Copal requested.


Notebook navigation is Home, Library, People and Tasks. Connections moves to
an always-available settings button; a Home card offers phone setup until
it is marked done or a shared recording arrives. The notification bell sits
left of Add recordings and opens ready/failed recording updates. Opening an
update marks only its current status read; Library keeps the full history.
These views are newly written in KAI’s style. No other repository was opened.

Add recordings offers Voice Memos, WhatsApp and Files, with sharing guides.
App choices return from shortcut setup to the selected source. Files keeps
the person choice before reading. Remaining trial time is shown; when it
is used, the notebook remains readable. The launch-post link is hidden
until Copal supplies it. Shared recordings with already reserved time can
still finish after the allowance reaches zero.

Voice Memos shows sharing instructions after setup, with a Files fallback.
Its rejected direct-launch address is not used. WhatsApp keeps its app link.

Recordings now have three explicit types: a memo from me, a voice note from
someone else, or multiple speakers. Only the voice note asks who is speaking
before transcription. Multiple speakers pauses at “Who said what?” with
labelled passages and Me/existing/new-person choices before suggestions.
Memo recordings stay in the library without a speaker picker, and personal
tasks can be accepted without creating a contact.

The three recording types use one compact segmented selector, with a short
explanation beneath the selected choice, as Copal requested.

Failure emails use a generic message and one violet Open recording action,
with no recording title or contents. `email-failed.html` and
`shots/email-failed.png` show the invented example. Home distinguishes
unfinished recordings by type, duration and date, and shows when speaker
identification is needed. Verified trial copy covers ready and failed mail.

Recording pages put actionable suggestions above the linked person, summary
and words. Pending suggestions stay before accepted/rejected ones. Each
note and kept promise names the person it updates; a task distinguishes its
owner from the person it is about. Personal tasks say “For you”. Names come
from the same notebook's existing or newly proposed people, including before
acceptance. These are display labels, not changes to the stored suggestions.

Search sits to the right of Add recordings (and the public trial action),
with notifications kept on the left. It opens one notebook search, grouped
as Library, People and Tasks. The gallery covers initial, matching, empty,
loading, failed, public and result-limit states. Task results open their own
read-only-or-actionable detail view, including completed tasks. Search and
task detail each keep one violet action; all data stays notebook-scoped.

Copal’s phone refinements: focused Search with a shorter notice and no subtitle; private headers omit the notebook label. Pending suggestions stay above the summary. Reviewed suggestions follow it, before the waitlist. A floating confirmation acknowledges saved decisions. Fully reviewed recordings move from the Home queue to Recent recordings.
