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
| `kai.css` | The look in one place: font, page colour, shadows, motion |
| `ui.tsx` | The pieces: `TabPage`, `PushedPage`, `Dock`, `Card`, `Rows`, `SectionLabel`, `Button`, `Avatar`, `CountBadge`, `DueChip`, `Segmented`, `Quote`, `Tick`, `Field`, `AddRecordings` |
| `icons.tsx` | KAI's own icons. There is no icon library |
| `types.ts` | What each screen is given: the shapes the server answers with today |
| `screens/` | `Welcome`, `Home`, `Recording`, `People` and `Person`, `Todos`, `Connect`, `Waitlist` and `Operator` |
| `fixtures.ts`, `gallery.tsx` | Mara's made-up data, and the page that shows each state |
| `check.mjs`, `shots/` | The measurement and its pictures |

A screen here fetches nothing and keeps no server state: it takes data and
callbacks. `gallery.tsx` shows how each is called.

## Building the app to it (PRD §7, step 13)

1. Move `kai.css`, `ui.tsx`, `icons.tsx`, `types.ts` and `screens/` into
   `src/look/`, and point `gallery.tsx` at them. One copy, so the gallery and
   the app cannot drift.
2. In each app screen keep the fetching, the polling and the actions, and
   render the screen from `src/look/` with them. `src/style.css` goes: its
   rules for `h1`, `nav`, `label` and the rest would fight these.
3. In `kai.css`, change the two `@source` lines to where the files now are.
4. In `tests/phone/usability.ts` (it arrives with the open step PRs), read
   the filled violet as
   `--color-violet-600`, and leave out elements with
   `data-headlessui-focus-guard`: the kit's dialog adds two unseen buttons.
5. Keep every behaviour. This step changes how KAI looks and where its one
   action sits, not what it does.

### Each screen's one action

The dock at the foot of the screen holds it, except where noted.

| Screen | Your own copy | Read-only copy |
|---|---|---|
| Welcome | "Try it yourself", in the page | "Look around", in the page |
| Home, People, To-dos | "Add recordings": one tap opens the phone's file picker, and the upload starts when files are chosen | "What is KAI?", to Welcome |
| Recording | "Accept all · n"; "Try again" when it failed; "See people" when all is decided. Hidden while a suggestion is edited: "Save and accept" is then the one | "Back to Home" |
| Person | "Review suggestions" when some wait; otherwise "Add recordings" | "Back to People" |
| Connect | "Copy your address", in the first card | "What is KAI?" |

### What the look shows that the server does not send yet

Each is optional in `types.ts`, and the screen is whole without it.

- `/api/home`: `due_on` and `person_name` on a to-do; `happened_on` on a recording.
- `/api/readings/<id>`: `happened_on` and `source`, for the line over the title.
- A suggestion's payload: `person_name`, for "Note about Dana" and "Dana
  owes you". Without it the labels are "Note" and "Waiting on".
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
