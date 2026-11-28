# KAI, by Kopal: PRD for Fly.io Hacksgiving 2026

You have recordings you never replay: voice memos, WhatsApp voice notes,
recorded meetings. KAI gets the value out of them. Share one in, and KAI
transcribes it and suggests the people, notes, to-dos and kept promises in
it, each with the quote it heard. You accept, edit or reject. An assistant
such as Claude can then read what you accepted, over MCP.

This is a one-week build, new from the first commit. Decisions marked
**(Copal)** are the operator's, from the interview of 2026-11-24. The rest
are technical decisions, each with its reason.

## 1 · Goal and success criteria

**The contest** (fly.io/hacksgiving, read 2026-11-24):

- C1. An agent that runs on a Fly.io Sprite and uses at least one Sprites
  connector. KAI uses two: Anthropic and AssemblyAI **(Copal)**.
- C2. Built during Hacksgiving week, 23 to 29 November. Every commit is
  dated in that week.
- C3. One entry, following Fly.io's terms of service.
- C4. Submitted before 23:59 Pacific on Sunday 29 November. Our own
  deadline is 12:00 Pacific that day.

**Speed of delivery:**

- D1. A page served from the Sprite, and both connectors answering, by
  Wednesday 25.
- D2. A recording becomes suggestions on the Sprite by Thursday 26.
- D3. Every must-have deployed by Friday 27.
- D4. Video recorded on the deployed demo on Saturday 28.

**Speed of use** (measured on the Sprite, median of three runs):

- U1. The judge link opens the Welcome screen. One tap on "Try it
  yourself" shows a founder's data already in place: people, to-dos and
  past recordings. No sign-up, no typing.
- U2. A 60-second recording shows its first suggestion within 45 seconds
  of being added.
- U3. A sample transcript shows its first suggestion within 10 seconds of
  the tap, and all within 30 **(Copal)**.
- U4. One tap decides a suggestion. One tap accepts all.
- U5. After the Sprite has slept, the first screen answers within 3 seconds.

**Usability** (checked in a browser test at 375 px wide, on every screen):

- U6. No sideways scroll. Body text at least 16 px. Non-interactive status
  badges, including overdue/due-soon labels and their counts, may use 14 px
  (Copal). Tap targets stay at least 44 px.
- U7. Exactly one filled violet button: the screen's one obvious action.
  Exception (Copal): private recording pages may omit the main action while
  loading, waiting, listening or reading before the first suggestion, and
  when ready with no pending suggestions. Keep Accept all when proposals
  exist, Try again on failure and Save and accept while editing.
  Settings uses secondary account actions rather than a filled violet main
  button; its destructive confirmation uses red (§21, Copal's chosen design).
- U8. Plain words. The screens never say "AI", "LLM", "entity", "extract",
  "prompt" or "token". What the AI does is credited to "KAI".

## 2 · The demo script (the video, about 90 seconds)

The person is Mara Lindqvist, founder of Loomwork, a made-up company
selling scheduling software to dental clinics **(Copal: a startup founder)**.
She records a voice note after every call and never listens to one again.

1. **0:00** Mara opens KAI on her phone. People shows "Needs you": Dana
   Whitfield, with "1 overdue" in red. KAI already holds her older
   recordings.
2. **0:10** In WhatsApp she holds the voice note she recorded after today's
   call with Dana, taps Share, then "Send to KAI" **(Copal)**.
3. **0:20** KAI says "Listening", then "Reading Dana's page". The words
   appear, then suggestions one by one.
4. **0:30** The moment we protect **(Copal: "KAI remembers")**. KAI knows
   Dana and suggests: mark "Send Dana the pricing" done, quoting "she
   thanked me for the pricing I sent Monday"; a note about her CFO; a to-do
   "Send the security questionnaire by Thursday"; and one Dana owes Mara,
   an introduction to the CFO.
5. **0:45** Mara taps a quote and sees it highlighted in the words. She
   taps "Accept all".
6. **0:55** She picks three older recordings from Voice Memos at once. KAI
   works through them, oldest first. A new person appears.
7. **1:10** Dana's page: her recordings, her notes, what is open. Then
   To-dos: "Mine" and "Waiting on".
8. **1:20** In the Claude app she asks "What do I owe Dana this week?".
   Claude answers from KAI, with the quote.
9. **1:30** End card: "KAI, by Kopal. One Fly.io Sprite. Connectors:
   Anthropic and AssemblyAI. Would you use something like this?"

## 3 · Scope

**In (must-have):**

- Add recordings: choose up to five audio files at once **(Copal)**. KAI
  transcribes each and reads them oldest first.
- "Send to KAI" from the iPhone's share sheet, so a WhatsApp voice note or
  a Voice Memos recording goes in without opening KAI **(Copal)**.
- A second way in: paste a transcript, or tap one of three sample
  transcripts. It is the base of the build and our fallback if
  transcription fails.
- KAI's suggestions, each with a quote checked against the words.
- Accept, edit, reject, and accept all.
- KAI remembers: it matches people it already knows and suggests ticking
  off kept promises.
- People: "Needs you" first, then everyone A to Z.
- A person's page: open to-dos, notes with quotes, recordings.
- To-dos: "Mine" and "Waiting on" **(Copal)**; overdue, due soon, later.
- A read-only MCP endpoint **(Copal: must-have, replaces "Ask KAI")**.
- A Welcome screen **(Copal)**: what KAI is, the video, and "Try it
  yourself". No code link.
- A private judge link, which gives the founder's data ready to explore.
  Everyone else can browse a read-only copy **(Copal)**.
- A waitlist **(Copal)**: one card, "Would you use something like this?
  Leave your email and I'll write once if it becomes a product", with one
  email field, a quiet "Keep me posted" button and a link to the X post.
  It sits at the foot of Home and under the suggestions once a visitor has
  decided them. The README links to the demo for it.

**No built-in sample recordings (Copal).** A judge sees the data already
there and adds their own recording.

**Stretch, in this order:** follow-up drafts with Copy and "Open in mail";
adding a to-do by hand; dark mode.

**Out:** a recorder, Plaud, any link to kopal.ai, any email sent by the
app, a chat inside the app, "Tell KAI why", sign-up, accounts, spaces,
sharing, export, notifications, MCP writes, Pinecone, Box, Ollama, other
languages, sharing in from Android, a separate desktop layout.

## 4 · Screens

0. **Welcome:** what KAI is in two lines, the video ("See the demo"), and
   one button, "Try it yourself", which goes to Home.
1. **Home:** "Add recordings", the queue ("Listening to 2 of 3"), "or
   paste a transcript", the sample transcripts, and what was added before.
2. **Recording:** what KAI is doing, its suggestions, and the words with
   quotes highlighted.
3. **People:** "Needs you" by urgency (overdue, due soon, suggestions),
   then everyone A to Z.
4. **Person:** name and company, open to-dos, notes with quotes,
   recordings newest first.
5. **To-dos:** "Mine" and "Waiting on"; Overdue, Due soon, Later, No date;
   tick to finish.
6. **Connect:** "Send to KAI from your phone" (your own address and the
   steps to add the shortcut) and "Connect an assistant" (the address to
   copy, three steps, what the assistant can read).

**Everyone starts at Welcome.** With the judge link, "Try it yourself"
opens the judge's own copy. Without it, the button reads "Look around" and
opens the read-only copy, where one line says: "A read-only demo with
made-up data." The code link lives in the README, not in the app.

**What KAI suggests:** a new person; a note about a person; a to-do of
yours; a to-do someone owes you; marking a to-do done. Stretch: a follow-up
draft.

**What needs your approval:** all of it. Nothing reaches People or To-dos
until you accept it. Accepting something about a new person accepts the
person. Rejecting a person rejects their pending suggestions. KAI never
sends anything and never acts outside the app. The assistant only reads.

**Without asking,** KAI transcribes a recording, gives it a title and a
two-line summary, keeps its words, and deletes its audio once transcribed.

**The look** is written new, in the spirit of Kopal's design: cards, the
Manrope font, violet for KAI and the main action, red for overdue, amber
for due today or tomorrow. One layout, centred on wide screens. `design/`
holds every screen in that look, on made-up data **(Copal)**; the app's
screens are built to it in step 13.

## 5 · Data model

Seven SQLite tables. Every row but the waitlist's carries `workspace_id`.

- `workspaces`: id, kind (judge or public), mcp_token, upload_token,
  created_at.
- `conversations`: id, title, summary, source (recording, shared, paste,
  sample), text, happened_on, status (waiting, listening, reading, ready,
  failed), error.
- `suggestions`: id, conversation_id, kind (person, note, todo, done),
  payload (JSON), quote, status (proposed, accepted, rejected).
- `people`: id, name, company, role.
- `notes`: id, person_id, conversation_id, text, quote.
- `todos`: id, text, owner_person_id (empty means yours), due_on, status
  (open, done), quote, conversation_id.
- `waitlist`: email (unique), created_at. Nothing else: no name, nothing
  about the visitor's device, no tie to a workspace.

Accepting a suggestion writes its row to `people`, `notes` or `todos` in
one transaction. Those three tables hold accepted things only. A
recording's date is its file's date, and "by Friday" is counted from it.

## 6 · Stack, connectors and deployment

- **TypeScript everywhere, one `package.json`.** One language and one
  toolchain is the fastest thing for Codex to build and for a review to read.
- **Server: Node with Express and SQLite (`better-sqlite3`).** One process
  on port 8080, where the Sprite's URL routes. The database is one file on
  the Sprite's persistent disk, outside the code folder.
- **Screens: React, Vite, Tailwind, Headless UI and the Catalyst kit**
  **(Copal)**. Catalyst gives finished buttons, fields, dialogs and badges,
  and it is what Copal's design work uses, so his feedback carries over.
  Its licence, read on 2026-11-24 from the kit's own `LICENSE.md`, allows a
  free, open-source app whose source is public, and forbids handing the
  components on by themselves. So the stock kit sits in `src/catalyst/`
  under its own licence, and MIT covers everything else.
- **Listening: AssemblyAI through its connector.** Files of at most 10 MB
  and 5 minutes, in the formats phones produce: `.m4a` from Voice Memos,
  `.opus` and `.ogg` from WhatsApp, `.mp3`, `.wav`.
- **Reading: Claude through the Anthropic connector.** Model
  `claude-sonnet-5-5`, effort `low` to start: the mid-size model chosen
  with the 10-second target. KAI is a tool loop. It is given the list of
  known people, calls `get_person` to read a page, then calls one
  `propose_*` tool per suggestion. Each suggestion is saved as its tool
  call completes, so the first appears before KAI has finished.
- **Checks on what KAI returns.** A quote must appear in the words exactly,
  and a date must be a real date. A failing call is handed back to KAI as
  an error and never shown. A refusal or an error ends the run as "failed"
  with "Try again".
- **One queue, in the database.** Recordings wait, then are listened to
  and read one at a time, oldest first, so each one sees what the earlier
  ones taught KAI. The queue picks up again whenever the Sprite wakes.
- **The screen polls** for progress every second. Streaming through the
  Sprite's proxy is not documented; polling needs nothing from it.
- **"Send to KAI" is an iOS Shortcut**, because a web app cannot appear in
  the iPhone's share sheet. The shortcut posts the shared audio to
  `/in/<upload token>`, the workspace's own address, then opens KAI. The
  Connect screen gives the address and the steps.
- **MCP:** the official TypeScript SDK at `/mcp/<mcp token>`, stateless
  JSON answers, four read tools: `list_people`, `get_person`, `list_todos`,
  `search` (which also searches the recordings' words). No sessions, so a
  sleeping Sprite loses nothing. It calls no model, so it spends nothing.
- **No key anywhere near the code.** Fly's gateway holds both keys. The
  Sprite calls `api.sprites.dev/v1/gateway/<provider>/<connection id>/…`
  with no authorization header, and the gateway refuses calls from outside
  the Sprite. So local runs and tests use a scripted fake KAI and a fake
  transcriber (`KAI_MODEL=fake`); the real ones run only on the Sprite.
- **Access.** The judge link carries a secret made on the Sprite and kept
  only there. It sets a cookie and gives that browser its own copy of
  Mara's data, with its own upload and MCP tokens. Without it, a visitor
  sees one shared copy, and every route that writes or calls a provider
  refuses. The waitlist is the one exception.
- **A judge's own recording is theirs.** On Upload and in the signup terms only, KAI says **(Copal)**:
  "Your recording is transcribed by AssemblyAI and read by Claude. It stays
  in your own copy of this demo, which is deleted on 8 December."
- **The waitlist is fenced.** It takes one well-formed address of at most
  254 characters, 5 tries an hour from one visitor, 2,000 rows in all, and
  ignores a repeat. The addresses stay in the Sprite's database: never in a
  log, a model call, an MCP answer, the repository or an agent's thread.
  Copal alone downloads them, from a page behind his own secret link.
  Codex reports the count only.
- **Spend limits in the app:** per workspace per day, 10 recordings and 30
  readings; in total per day, 60 recordings and 150 readings; 20,000
  characters per transcript. The cap on each key is the last line.
- **Deployment:** one Sprite, `kai`. `scripts/deploy.sh <commit>` takes a
  checkpoint, checks out that commit, builds, restarts the Sprite service
  `kai`, and confirms `/healthz` reports that commit. A service restarts
  itself when the Sprite wakes. Codex deploys a PR's head to run its "on
  the Sprite" checks, and `main` after each merge. It never creates or
  deletes a Sprite, a connector or a key.

## 7 · Build plan

One step is one pull request. Every step passes `npm run check` (types,
unit tests, the phone browser test of U6 to U8) and its own checks below.
"On the Sprite" checks need Copal's steps (§9); if those are not done,
Codex takes the next step that does not need them and comes back.

**Wednesday 25**

1. **Skeleton.** Server, the seven tables, Mara's seeded data, the tabs, a
   read-only People list. *Checks:* `npm run check`; People lists the seeded
   people at 375 px.
2. **Access.** Welcome, the judge link, a workspace per judge, the
   read-only public copy with its one line. *Checks:* a test walks every
   route and shows that each writing route refuses the public copy; two
   judge browsers do not see each other's changes; U1; Welcome shows no
   video player until `VIDEO_URL` is set.
3. **On the Sprite.** `scripts/deploy.sh`, the service, and a ping of each
   connector run from inside the Sprite. *Checks:* `/healthz` on the
   Sprite's address reports the merged commit; the model ping prints the
   model's name; the listening ping transcribes a two-second test tone
   made in code; the same calls from kosmoslab are refused.
4. **KAI reads.** Paste and sample transcripts, the tool loop, the quote
   and date checks, the limits, the Recording screen. *Checks:* with the
   fake KAI, each sample gives its expected suggestions; a made-up quote is
   never stored; the 31st reading of a day is refused; on the Sprite, U3.

**Thursday 26**

5. **KAI listens.** Add up to five recordings, the queue, AssemblyAI, the
   words on screen. *Checks:* an 11 MB file and a sixth file are refused;
   with the fake transcriber, three files are read oldest first; `.m4a` and
   `.opus` are accepted; the audio file is gone afterwards; a queue stopped
   halfway finishes after a restart; on the Sprite, U2 with a recording
   Copal makes from `samples/memo-script.md`.
6. **Decide.** Accept, edit, reject, accept all; People with "Needs you";
   the Person page. *Checks:* accepting writes exactly the expected rows;
   rejecting a person rejects their suggestions; U4.
7. **KAI remembers.** Matching known people, `get_person`, "mark done".
   *Checks:* on the Sprite, `npm run kai:check` runs the three samples
   three times each; the Dana sample suggests marking the pricing to-do
   done and creates no second Dana, every time.

**Friday 27**

8. **To-dos.** "Mine" and "Waiting on", the groups, tick to finish, red and
   amber on People. *Checks:* a to-do due yesterday is under Overdue and
   puts its person first in "Needs you".
9. **Send to KAI.** `/in/<upload token>` and the Connect screen's steps.
   *Checks:* a posted audio file joins that workspace's queue; a wrong
   token gets 404; the limits of step 5 hold; Copal shares a WhatsApp voice
   note from his iPhone and sees its suggestions.
10. **MCP.** The endpoint and "Connect an assistant". *Checks:* a scripted
    MCP client lists the tools and reads Dana's open to-dos; a wrong token
    gets 404; no tool writes.

**Saturday 28**

11. **Waitlist.** The card, the fenced route, Copal's download page.
    *Checks:* a read-only visitor can leave an address and can change
    nothing else; a malformed address, a sixth try in an hour and row 2,001
    are refused; a repeat adds no row; after a sign-up the address appears
    in no log line, no MCP answer and no workspace's data; the download
    refuses the judge link and any wrong secret; the button is not the
    screen's filled violet one.
12. **Polish.** Copal's notes from the phone, the video on Welcome and in
    the README. *Checks:* `npm run check`; every criterion in §1 has its status
    listed in the PR body. Final U1–U5 measurements belong to step 13, on the
    deployed build with the finished screens and upload flow.

13. **The look.** The app's screens are the ones in `design/`, as its
    README describes, with every behaviour kept. *Checks:* `design/check.mjs`
    passes on the gallery; the phone test of U6 to U8 passes on every route
    in a judge's copy and in the read-only copy; every earlier test passes;
    the PR body shows each app screen beside its picture in `design/shots/`;
    U1–U5 are measured on this deployed head, with three runs and their medians
    listed in the PR body. The targets in §1 are unchanged.

Stretch steps follow only when steps 12 and 13 are merged. The video (§9)
is recorded after step 13.

## 8 · Review and merge

- Codex builds with `gpt-6-astra` at `high` effort.
- Each PR body lists the step's checks with their results, then what was
  skipped, what failed and what is unknown.
- `scripts/review-pr.sh <pr>` runs a fresh, read-only review by Claude
  Fable 5.2, which reads this PRD, the PR body and the diff, and posts its
  review on the PR.
- A blocker is only: a check that fails or was not run; a crash on the demo
  path; data loss; a secret, real personal data or copied code (§10) in
  the repository; a broken contest rule; or provider access or spending beyond the explicitly authorised
  judge and public-trial limits (§§6 and 12). Everything else is a note.
- Codex fixes every blocker and asks again, with no limit on rounds. At
  "Blockers: 0" Codex merges and deploys.

## 9 · Copal's steps

**Tuesday 24**

- Approve this PRD.
- Create the Fly.io account from the contest page and add a card.
- In the Anthropic Console, make a workspace `kai-hacksgiving` with a $20
  spend limit and one key in it.
- A new AssemblyAI account on its free credit, with no card, and one key.

**Wednesday 25, morning**

- In a kosmoslab terminal: `curl -fsSL https://sprites.dev/install.sh | sh`
  (the Sprites tool, once), then `sprite login`, then `sprite create kai`.
- Fly dashboard, your organisation, Sprites, Connectors, Add connector:
  once for Anthropic and once for AssemblyAI, pasting each key. In each
  one's access settings turn off "Allow all sprites" and set the name
  prefix `kai`.
- When step 3 is merged, tell Codex "make the Sprite's URL public". Codex
  runs `sprite url update --auth public` and saves the judge link and your
  download link to `~/kai-links.txt` on kosmoslab, a file only you open.
  Neither link is ever written in a thread, the repository or a log.
- Open a new X account named Kopal **(Copal)** and post nothing yet.
- Each day to Saturday: an hour on the phone, notes into the Codex thread.

**Thursday 26**

- Record one voice memo from `samples/memo-script.md` and add it to KAI.

**Friday 27**

- Add the "Send to KAI" shortcut on your iPhone, following the Connect
  screen, and share one WhatsApp voice note of an invented script.
- In Claude, Settings, Connectors, add a custom connector with the address
  from "Connect an assistant".

**Saturday 28**

- Record four more invented voice notes for the video, then the video
  itself: an iPhone screen recording that follows §2. Send the file to
  kosmoslab; Codex puts it on the Sprite for the Welcome screen.
- Open your download link once, to see that the waitlist reaches you.

**Sunday 29, by 12:00 Pacific**

- Post the video from the new X account, tagging @flydotio, with the code
  link. Give Codex the post's address: the waitlist card links to it.
- Fill in the form: your name and email, the agent's name ("KAI, by
  Kopal"), what it does, the connectors (Anthropic, AssemblyAI), the code
  link, the demo link (the judge link), the post's link.

**Tuesday 8 December**

- Download the waitlist first. Then delete the Sprite, both connectors
  and both keys, and archive the repository.

## 10 · Rules

- The contest's rules, C1 to C4.
- New code only. Nothing is copied from kosmos-ai or from Kopal's design
  reference: that code was written before the week. Libraries are fine.
  The one kit copied in is stock Catalyst, from Copal's own Tailwind Plus
  download, in `src/catalyst/` only. `LICENSE` says that folder is Tailwind
  Labs' and is not covered by MIT, and the README says the same.
- Invented data only in everything we make: the repository, the seeded
  data, the samples, Copal's test recordings, the video. Never a real
  person, company or conversation. Two exceptions hold real data, on the
  Sprite only: a recording a judge chooses to add to their own copy, and
  the waitlist.
- The waitlist's addresses are used for one purpose, a single note if this
  becomes a product, and the card says so, with "ask me and I delete it".
- No key, token or password in a file, a commit, a PR or a log. The judge
  link's secret lives only on the Sprite and is shown only to Copal.
- KAI never sends, and never acts outside the app.
- The story is told straight **(Copal)**. The agent is "KAI, by Kopal": a
  byline in the README, the app's footer, the form and the post, which
  comes from the new X account named Kopal. The README says once, in
  Copal's voice: the idea had been brewing in my mind for a while, and
  Hacksgiving inspired me to build it, from scratch, this week. No text
  calls this the first build of the idea or says there was no earlier
  work, because neither is true. Beyond the byline and the waitlist card:
  no pitch and no link to kopal.ai.
- Public repository, MIT licence for our own code **(Copal)**.

## 11 · Risks, and what we cut first

- **The gateway is new to us.** Step 3 proves both connectors on day one.
  If the Anthropic SDK cannot use the gateway's address, KAI calls it over
  plain HTTPS. If AssemblyAI cannot be reached through it, we ask Copal
  for the Deepgram connector instead.
- **The Sprite sleeps about 30 seconds after the last request.** The queue
  lives in the database and picks up again on the next request. A step
  stuck for two minutes is tried once more, then marked "failed" with
  "Try again".
- **Getting a recording out of the iPhone takes steps.** Voice Memos needs
  Share, then "Send to KAI", or "Save to Files" first for several at once.
  The shortcut is added by hand, once. Copal tries the whole path on
  Friday; if it is clumsy, the video shows the file picker instead.
- **A custom connector in Claude may not accept our address.** Claude Code
  is the fallback for the video's last scene.
- **A judge's recording is real content on our Sprite.** It stays in their
  own copy, its audio is deleted once transcribed, and everything is
  deleted on 8 December. The line beside "Add recordings" says so.
- **The waitlist is a door open to strangers, and real data.** The fence
  in §6 limits both. Whether the one-line notice is enough under privacy
  law where Copal lives is his to confirm; it is not legal advice.
- **A brand-new X account may be limited** in posting video or in reach.
  Copal opens it on Wednesday, not Sunday. The contest needs only the
  post's link.
- **Free compute is $5 a month by Fly's page.** A Sprite bills only while
  awake, so the week should cost under that.
- **Twelve steps in four days is tight.** Thursday carries the most.
- **Speed against care.** If KAI misses the Dana check at effort `low`, we
  raise the effort and accept a slower first suggestion before we accept a
  wrong one.

**Cut order if we fall behind:** every stretch; then the waitlist's email
field (the card keeps its X link); then the public read-only copy (a
visitor without the link sees Welcome only); then editing
a suggestion; then "Waiting on"; then several recordings at once (one at a
time); then "Send to KAI" (the file picker stays); then MCP. Recordings
and "KAI remembers" are never cut.

## 12 · Public recording trial (Copal, 26 November)

Copal asked to “open up the demo with one hour of recording quota for
anyone who wants to sign up for the wait list” and approved updating the
PRD for “one 60-minute trial per email, linked to a private notebook,
while keeping the existing overall daily spending caps.” This replaces
§3's exclusion of signup, §4's public entry action, §5's prohibition on a
waitlist/workspace link, and §6's waitlist-only public write exception.

- Welcome offers “Try it yourself” to join the waitlist and “Look around”
  to browse. The public notebook says “Read-only demo” quietly in its
  header. Its main action leads to the trial signup. No video yet.
- Joining for a trial creates an empty private notebook in this browser.
  Its access, upload and read-only MCP work like a judge's copy. Existing
  judge links still open their seeded notebooks without signup.
- One hour total of uploaded recording duration per email, rounded up to
  whole seconds per file, reserved atomically for the whole batch before
  processing. Failed batches reserve nothing; retries of the same accepted
  upload do not consume the hour again. A new upload consumes time even
  if transcription fails. Remaining time appears on Home.
- The waitlist alone links an email to a notebook. Addresses never enter
  model input, MCP results, app logs or notebook APIs. An email alone never
  reopens a notebook; only its existing browser cookie can. A code sent through Kopal’s Resend account verifies ownership before
  granting any trial credit. Verification email is the only new sending
  exception; KAI still sends no notes, promises or follow-ups. Another email in the same browser
  cannot refill its allowance. Existing waitlist-only signups can claim
  their first trial; repeated claims from a different browser are refused.
- The existing daily caps (10 recordings/30 readings per notebook,
  60 recordings/150 readings overall), file limits, waitlist fences and
  provider limits stay unchanged. The hour may span days. No extra Sprite,
  connector, account or paid upgrade. Signup itself calls no provider.
- Visitors may add their own recordings, private on the Sprite, just as
  judges may (§10 exception). Audio is deleted after transcription; all
  notebooks are deleted on 8 December. Signup explains the linked email,
  one future product note, browser-only access, and daily limits.
- Checks: `npm run check`; gallery at 375 px; signup yields an empty,
  isolated notebook; public browsing stays read-only; email cannot reopen
  another notebook; duplicates and concurrency cannot refill time; duration
  quota survives restart and covers browser and shared uploads; rejected
  batches reserve nothing; existing daily caps still apply; email stays out
  of notebook APIs and MCP. Verify signup and isolation on the Sprite with
  invented data, without calling paid providers.


### Trial verification and abuse limits (Copal, 26 November)

Copal requested: “We need a verification code sent there. We can do that
with our Kopal Resend account” and “block different emails in the same IP”
and “limit the free credits to 100 users”. These requirements supersede
§12's original unverified signup and §3/§10's blanket prohibition on sending
for verification messages only. No new paid plan is authorised.

- A fresh short-lived single-use code proves email ownership before a
  trial is granted. Two server-only tables hold expiring challenges and bounded send counters.
  Store only a protected code digest; never log or persist
  the code itself. Bound guesses, resends, sends per IP, and overall sends.
  Use the existing Kopal Resend account through its Sprite connector; Copal
  alone creates/configures that connector and supplies a verified sender.
- Grant at most 100 trials in total, atomically, only after verification.
  Enforce one grant per normalized email and per public IP, across browsers
  and restarts. Store a keyed digest of the IP, not the raw address. Shared
  networks share one allowance; changing IP can evade an IP rule, so it is
  additional friction rather than proof of a unique human. Never trust a
  client-supplied forwarding header without verifying the deployed proxy.
- Existing unverified trial notebooks retain their data, but must verify
  before further provider use. Verification does not refill used duration.
  Existing private judge invitations continue unchanged.
- The first 100 grants retain their original hour; requests after the cap
  may join the waitlist without credits. The existing per-day, per-file and
  provider limits stay in place. One hundred hours is an audio allowance,
  not a promise that the full application bill will be $23. Retries,
  Claude, email and compute must also remain bounded.
- Checks also cover wrong/expired/reused codes, send failures and throttles,
  concurrency at the 100th grant, one IP with multiple emails, email/IP
  normalization, quota persistence, and verification of existing trials
  without a refill. Confirm real email receipt and code entry with Copal;
  check the Sprite proxy overwrites spoofed IP headers before enabling
  public trials. Until then new claims remain paused.


## 13 · Recording-ready email (Copal, 26 November)

Copal requested “notifications through email that the upload has been
transcribed and summarized” in “a friendly tone as update from Kai”,
instead of phone notifications. He approved “one friendly email per
completed recording, sent only to its notebook’s verified address, with
suggestion counts and a ‘Review in KAI’ link (keeping transcript and
personal details inside KAI)” with “Yes, counts and a review link”.

This is a second, narrow exception to §§3, 4, 10 and 12’s no-sending rules
and to §12’s verification-only email exception. It supersedes §10’s
single-purpose restriction for verified trial addresses only. KAI still
sends no promises, follow-ups or messages to a person mentioned in a recording.

- For new audio uploads, including shared voice notes, send one friendly
  completion message after transcription, summary and suggestion creation
  have all finished successfully. Do not send for old recordings, pasted
  transcripts, samples, failures or waitlist-only/unverified addresses.
- Send only to the verified email attached to that notebook, through the
  existing Resend connector. Include counts of proposed people, notes,
  to-dos and kept promises; include no names beyond the title, words, summary text,
  quotes or suggested actions. With zero suggestions, say the transcript
  and summary are ready. Say the person decides what to keep.
- “Review in KAI” opens that recording in the existing notebook browser.
  It contains no access secret and grants no access in another browser.
  Email is not notebook recovery. Explain the browser requirement.
- Persist delivery state across restarts, use provider idempotency and
  bounded retries, and never change recording success because mail fails.
  At most three attempts per recording within 23 hours of the first
  attempt, 10 recording-email attempts per notebook and 60 overall per
  rolling day. Verification and recording mail share the existing overall
  cap of 100 send attempts per rolling day. No new connector or paid plan.
- Explain these messages in trial signup and on the verified trial’s Home
  screen. Existing waitlist-only subscriptions keep their original promise.
- Checks: `npm run check`; gallery at 375 px; one message for a ready
  verified recording, including shared uploads and zero suggestions;
  none for failures, old recordings, samples, pasted words or unverified
  addresses; correct notebook/recipient isolation; no content or secrets
  in the email; duplicate kicks, retries and restarts do not create another
  logical message; sending failure leaves suggestions intact; all attempt
  limits hold. Check the new queue on the Sprite using a fake mail sender
  and invented data, without sending to a real address. Copal confirms
  receipt after uploading his own invented recording.


### Completion email presentation (Copal, 26 November)

Copal confirmed “the email arrived and the link worked”, then requested
“a call to action in the same style as the app” and “the title of the entry
that Kai created on the subject and the body of the email.”
This permits the recording title in addition to §13’s counts and review
link. Use a white card, lavender background and one violet “Review in KAI”
button. Keep a plain-text alternative. Escape the title in HTML and remove
line breaks from the subject; freeze the title with the counts for retries.
No transcript, summary text or suggestion text is added.


## 14 · Notebook navigation and adding recordings (Copal, 26 November)

Copal requested a “notifications tab accessible through a button on the
left side of the add recordings”, and the main sections “home, library,
people, and tasks”, moving Connect out of the main tabs. He confirmed
“Build it fresh in KAI’s style”; no Kosmos-AI code or design is used.

- Main tabs are Home, Library, People and Tasks. Library lists all of the
  notebook’s recordings. Home keeps current progress, tasks and recent items.
- A bell beside Add recordings opens recording-ready and failed-reading
  updates. New updates are visibly unread until their recording is opened.
  All reads and read-state changes are confined to the current notebook.
- Connections is reached through a settings button. Home offers shortcut
  setup through the two-step first-use guide and later assistant offer in
  §22.
  The browser cannot inspect installed shortcuts; the state is a user
  confirmation or a successful share, not an installation claim.
- Add recordings offers Voice Memos, WhatsApp and Files. Each app has an
  information button with its sharing steps. App sharing goes through the
  iOS shortcut; people without completed setup are directed to Connections.
  Files opens an audio-only picker. Keep the person choice before reading.
- Keep the one-hour trial. Show remaining time and enforce it on the server,
  along with the existing 10 MB/five-minute file and daily limits. The hour
  does not increase per-file limits. When exhausted, keep the notebook
  readable and offer “Show KAI some love” only when the launch X post is set.
  Copal says that post is not published yet and will announce the app to judges.
- Navigation PR checks: `npm run check`; gallery at 375 px; the four tabs
  and settings route; Library and notifications stay within a notebook;
  read-state and shortcut setup survive reload; public writes remain refused.
- Upload follow-up PR checks: `npm run check`; gallery at 375 px; three
  upload sources, their guidance and setup routing; non-audio and over-quota
  files are refused; no missing-post link is shown. Phone app launches and
  sharing need Copal’s iPhone check.

### After the video and finished demo: own provider keys (superseded by §18)

Copal requested that people eventually “add their own API key from Assembly
AI and the AI model for processing summaries and todos when their quota
expires”, explicitly “a stretch on the PRD after the video is created and
the demo is ready.” Do not build, collect or store those keys now. After
those prerequisites and Copal’s go-ahead, agree a secure credential design
and provider rules before implementation. The current one-hour trial and
connector setup remain in force.

## 15 · Recording types and speaker identity (Copal, 26 November)

Copal requested “memo from myself, voice note from someone else, and
multiple speakers” because “Person for this recording” did not explain
whether it meant the speaker or someone mentioned. He approved updating
this PRD and enabling AssemblyAI speaker labels only for multiple speakers:
“Approve flows and speaker labels”. This replaces §14’s generic person
choice before reading with an explicit recording type.

- Ask what kind of recording it is before processing. A memo from me needs
  no person selection and stays in my library. KAI treats first-person
  statements as mine; it does not assume every notebook owner is Mara.
- A voice note from someone else requires choosing an existing person or
  adding the speaker before transcription. Their first-person promises are
  theirs, not mine. It needs no second speaker-selection screen.
- Multiple speakers needs no names before transcription. Enable speaker
  labels on the existing AssemblyAI model and connector for this type only.
  Save labelled passages, delete the audio as before, and pause before
  reading. Show passages for each speaker and let me choose Me, an existing
  person or Add a person. KAI reads only after all speakers are identified.
  Keep this state across restarts; naming speakers never retranscribes or
  consumes recording time again. Only explicit choices identify speakers.
- Summary and suggestions use that speaker context; quotes remain exact
  transcript text. Suggestions still require acceptance. Completion email
  follows finished suggestions, never the intermediate speaker screen.
- Speaker labels add $0.02 per audio hour at the approved current rate,
  at most $2 across the 100 original trial hours if all use this type.
  Existing one-hour, 100-user, file, daily and provider limits stay in force.
  No provider switch, new account, new key or paid-plan change is authorised.
- Checks: `npm run check`; gallery at 375 px; memo and single-speaker
  attribution are distinct; a voice note requires a speaker; multiple
  speakers pause before any reading or completion mail; assignments are
  confined to the notebook and survive restart; no repeated transcription
  or duration charge after identification; only multiple-speaker provider
  requests enable speaker labels; phone tests walk all three flows.
- Copal tries an invented recording with two speakers on the deployed
  build and confirms labelled passages can be assigned before suggestions.


### Recording failure emails (Copal, 26 November)

Copal reported “I didn't get an email notifying me of the error” and
approved “Allow failure emails” for one friendly failure email per recording,
with a link to retry in KAI, no recording details, and the existing limits.
This supersedes §13's exclusion of failures.

- Email the notebook's verified address when a new uploaded or shared
  recording finishes in a failed state, whether listening or reading failed.
  Do not email intermediate automatic retries or the speaker-identification
  pause. No title, transcript, suggestions or provider error goes in this email.
- Send at most one logical failure email for that recording, across manual
  retries and restarts. A later success may still send its one ready email.
  A pending failure email is not sent while the recording is retrying or ready.
- Both kinds share the existing notebook, global and verification send caps;
  each message keeps the existing three-attempt/23-hour idempotency window.
  Use the existing Resend connector. No extra account or paid-plan change.
- The link opens the existing recording in its original browser and grants
  no access. Retrying keeps that recording and does not charge its duration
  again; existing daily limits remain enforced.
- Checks: transcription and reading failures notify only their verified
  owner; no details or secrets in failure mail; duplicate kicks, repeated
  failures and restarts produce one logical failure message; success after
  retry can still notify; stale failure messages are suppressed; shared
  send caps hold; the gallery includes the failure email and Home states.

## 16 · Demo information and signup terms (Copal)

- Home shows its email-update explanation behind an info control only while
  a recording is processing. Support tap, keyboard focus and hover. Waiting
  for recording type or speaker identification is not processing.
- Put remaining trial time in a compact Demo info card. Move the recording
  privacy notice from Home to Upload and the terms.
- Signup links to plain-language demo terms and requires agreement before
  granting access. Explain the hour, first-100 and network limits, providers,
  notebook deletion date, email uses, browser access and reviewing suggestions.
  Record the accepted terms version and time with the verified trial.
- Checks: npm run check; gallery at 375 px; processing-only info and readable
  quota; signup cannot grant access without terms agreement; no change to
  existing grants or limits.

### Thirty-minute trial and longer recordings (Copal)

Copal requested “lower the demo allowance to 30 minutes instead of 60”
and accepting audio “smaller than 30 minutes”, refusing uploads beyond
remaining time with a friendly email. Asked about file-size changes he
chose “Keep 10 MB; extend duration”. These rules supersede earlier hour
and five-minute limits; the 10 MB file limit stays.

- New trials get 1,800 seconds. Existing trials deduct time already used
  from the new 30-minute allowance, once, never below zero. Existing accepted
  uploads keep their reservation and can finish or retry without another charge.
- Each file must be under 30 minutes and at most 10 MB. All selected files
  must fit the remaining allowance; reject the whole batch without charging.
  Keep five files per upload, 100 users, existing daily and provider caps.
- Audio transcripts may be up to 60,000 characters; pasted text stays at
  20,000. A longer audio job may run up to ten minutes; short jobs keep
  their two-minute timeout. Provider duration is still capped by the reservation.
- A quota-rejected batch queues one friendly email to its verified owner:
  explain remaining time, thank them for their interest and confirm that
  Kopal will let them know if KAI becomes a product. No recording contents,
  names or private addresses in the email. Repeated identical submissions
  do not create more messages. Use the same sending caps, retry count and
  idempotency window as other recording emails. Rejected audio is not retained.
- Checks: migration deducts used time only once; a 5m35 recording under
  10 MB is accepted when quota permits; a 30-minute file and over-quota
  batch are refused; both upload routes queue quota mail for verified owners
  only; duplicates, restarts and retries preserve mail limits and reservations.


## 17 · Single recording imports for the demo (Copal)

Copal requested “let's keep it to single imports now and keep batch uploads
outside the demo”. This supersedes every earlier requirement to select or
share several files at once, including the batch segment in §2 and the
batch checks in §7. Batch imports are outside this demo.

- Accept exactly one audio file per upload, from Files or Send to KAI. The
  file picker selects one file. Refuse multi-file requests in both routes
  before saving audio, reserving quota, creating people or calling providers.
- Explain the single-file limit on Upload, in sharing guidance and in terms.
  Keep the three recording types, 10 MB limit, under-30-minute duration,
  remaining trial allowance and all existing daily and email limits.
- Existing recordings and queued work remain available and can finish.
  Separate single-file uploads may still wait in the existing queue.
- Checks: npm run check; gallery at 375 px; one file works through each
  upload route; two files are refused with a clear message and no stored
  audio, new records, quota charge, provider call or email. Existing queued
  recordings still complete across restart. Check both routes on the Sprite
  with invented data and fake providers.

## 18 · Email sign-in and your own KAI (Copal, 27 November)

Copal requested “a login that stays with their email” and suggested testers
“open a Sprite and implement their own Kai instance”. He chose this over
hosted provider keys: “I think that is better than storing their keys in
our instance”, then approved the revised email sign-in/self-hosting plan
with “Yes”. This starts that stretch now; the video remains on hold.
It replaces §14's postponed own-key stretch, §12's browser-only recovery
restriction and the earlier exclusion of an in-app setup/code link.

### Email sign-in on the shared demo

- An existing verified tester signs in with their email and a fresh,
  short-lived, single-use code through the existing Resend connector.
  Successful verification opens the SAME notebook on another browser.
  An email alone grants no access. No new notebook, trial, duration refill,
  IP grant or waitlist subscription is created by signing in.
- Keep signup's first-100, one-email/one-IP and 30-minute grant rules. Login
  to an existing notebook works after the grant cap and from a different
  network. Waitlist-only and unverified addresses cannot recover a notebook.
- Use protected code digests, bounded guesses and resends, and the existing
  combined email-send caps. Distinguish login from signup challenges so
  codes cannot cross flows or be reused. Return generic code-request replies
  rather than disclosing whether an address owns a notebook. Never log or
  persist a plaintext code or expose addresses in notebook APIs or MCP,
  except the authenticated owner's account response for Settings (§21).
- Keep Sign in in settings for signed-out visitors only; signed-in owners
  see their account and sign-out actions (§21). On Welcome, Try it yourself
  handles both new and returning testers through §20; omit the separate Sign in action
  **(Copal: “Update the PRD and remove Welcome’s Sign in”)**. Keep Sign out
  for this browser and Sign out everywhere for the notebook. Browser revocation
  does not rotate upload/MCP addresses. Do not silently switch a signed-in browser to a
  different notebook; make the change explicit before verifying it.
- Update terms, signup and email-link wording for verified email recovery;
  increment the terms version. Existing judge invitations remain valid and
  are not automatically linked to an email or merged with trial notebooks.
- Checks: npm run check; gallery at 375 px; fresh verification reopens the
  same notebook across browsers without new rows or quota; wrong, expired,
  replayed and cross-flow codes fail; notebook isolation and generic request
  replies hold; email limits hold; grant exhaustion and a changed network
  do not block existing login; sign-out and revocation work without breaking
  upload/MCP links. Check recovery on the Sprite with invented data and a
  fake mail sender. Copal confirms real code receipt and reopening his
  notebook in a second browser without sharing his email or code.

### Self-hosted continuation, no tester keys in the demo

- When the trial time is used, offer “Keep using KAI on your own Sprite”
  with one “Run your own KAI” action. Settings also links to the public
  repository's setup guide. Explain that a personal instance starts fresh;
  this step includes no notebook export, transfer or migration.
- Do not collect, store or proxy testers' provider keys in the shared demo.
  They create their own Sprite and put their own Anthropic and AssemblyAI
  credentials into Fly connectors restricted to their Sprite. All provider
  calls still use connectors. Email login on a personal instance requires
  the owner's own Resend sender/domain and connector; state this plainly.
- Deliver the setup guide as a portable, copy-and-paste coding-agent prompt
  in a public Markdown file. Copal requested “a prompt with a step by step
  guide” that testers can paste into their coding agent. The prompt walks
  them through creating a Sprite and connecting keys in Fly, then has the
  agent deploy and verify the reviewed KAI code. It is grounded in this
  repository's tested setup commands, names the supported environment and
  prerequisites, gives one human action at a time, stops on missing access
  or repeated errors, and never asks for credentials in chat. Do not present
  it as an unattended one-click install or have it rebuild KAI from scratch.
  Publish the source in this repository and offer Copy prompt and Markdown
  download through KAI; a kopal.ai-hosted copy is a separate publishing step
  for Copal, not permission to open another repository on this machine.
- Provide a tested, operator-run setup path and explicit personal-instance
  mode. It starts with one owner's empty notebook and no public trial signup
  or shared-demo waitlist. A private setup capability and verified email
  establish the first owner atomically; public visitors cannot claim it.
  Existing owner login is then the email-code flow above. KAI's shared demo
  configuration, accounts, mail sender and secrets must never be reused.
- The owner controls hosting, visibility, provider budgets, backups and
  deletion. The personal instance does not inherit the demo's 8 December
  deletion promise or its free 30-minute subsidy. Keep the single-file,
  10 MB, under-30-minute, queue, daily processing and email bounds explicit.
  The shared demo retains all its current limits and deletion notice.
- Explain setup and costs before asking readers to create anything. The
  agent only writes/tests setup code and instructions; it creates no Sprite,
  connector, account or key and incurs no new spending. Live checks remain
  on the existing kai Sprite; a separate installation is Copal/tester's step.
- Credit copy: AssemblyAI offers $50 in free trial credits; “roughly 200
  hours” is an estimate at current prices, depending on features and credit
  availability, not an allowance promised by KAI. Claude API usage is billed
  through the tester's Claude Console account; hosting and email have their
  own costs/limits. Link official current credit and pricing pages. Do not
  claim extra judging points: the published contest rules promise none for
  a self-hosting guide.
- Checks: npm run check; gallery at 375 px; exhausted-trial and settings
  links open the guide; shared-demo limits and connector-only calls remain;
  personal mode has no public trial grants, requires private setup plus
  verified email for the sole owner, cannot be claimed twice or by another
  address, and survives restart; correct instance-specific copy and limits;
  deployment options and secret-safe instructions checked with fake command
  runners and invented databases; prompt copy/download work at 375 px and
  the prompt matches the tested setup commands and human approval boundaries. Smoke-test setup/recovery in an isolated
  fixture on the existing Sprite with fake providers. Copal/tester performs
  the separate real-instance install; mark that operator check not run until
  confirmed, and do not claim it passed based on fixtures.

Implement in order: this plan PR, email sign-in PR, then personal-instance
setup/guide and continuation UI PR. Each goes through the existing review
loop, merge and deployment. The secret and connector-only rules stay intact;
AGENTS.md and the review scripts need no change for this plan.


## 19 · Quieter email card and compact status labels (Copal)

Copal approved “Allow 14 px status badges” and “Update the card flow in the
PRD” after requesting smaller overdue labels and a secondary-looking email
card with a dashed outline. These rules supersede §3's waitlist-only card
and U6's former blanket 16 px minimum; all other access and spending rules
stay unchanged.

- Use 14 px type only for non-interactive status badges and counts, such as
  overdue and due-soon labels. Body text remains at least 16 px; interactive
  targets remain at least 44 px. Update the phone and gallery checks to
  recognize only this narrow typography exception.
- Give the email card a quiet dashed outline. On public Home it offers a
  main “Try it myself” and a secondary “Keep me posted” action. Signed-in
  notebooks keep the waitlist-only action; the trial does not replace their
  notebook or replenish their allowance.
- “Try it myself” uses the email already entered in that card, then opens
  an information and terms-agreement popup before requesting a verification
  code. The popup does not ask for the email again. It explains the existing
  demo allowance, eligibility, privacy, email uses and deletion; its terms
  link and required checkbox precede sending. The same email-code proof and
  current grant limits apply before opening the empty private notebook.
- Hide the floating public trial button while the card's trial action is
  in view, and restore it on scrolling away. Keep one filled violet action;
  while the popup is open, its submit action is the filled one. Search stays
  available. Keep me posted still only joins the waitlist and grants no trial.
- Keep the entered address in transient component state, never a URL,
  browser storage, a log or a model call. Closing the popup retains the
  card's input and does not grant access or send a code before agreement.
- Checks: npm run check; gallery at 375 px; status badges are 14 px while
  body text and tap targets retain their minimums; phone and desktop scrolling
  hand off the trial action without duplicates; card signup reuses the email,
  requires agreement and verifies through the existing flow; cancellation
  preserves input; waitlist-only signup still creates no trial. Verify the
  deployed public layout and run isolated signup checks on the Sprite with
  invented data and fake providers; do not use real tester addresses.


## 20 · Verify email first, reuse existing agreement (Copal)

Copal reported that an email already associated with recordings was sent
through trial information and agreement again. He approved “Verify first;
reuse prior agreement (Recommended)”: verify the email first for everyone,
then reopen an existing notebook using its prior agreement, and ask for
terms only for a new notebook or changed terms. This supersedes §19's
checkbox-before-sending order and §18's repeated agreement during sign-in.
The email card also explains both trying KAI and joining the waitlist.

- Public Home's Try it myself action reuses the entered email and immediately
  requests a verification code. The shared demo's /try and /login entry
  screens use the same verification-first behavior. Keep me posted remains
  a separate waitlist-only action. No entered address goes in a URL, browser
  storage, log, model input or notebook API response.
- Before successful verification, the response and visible flow do not
  disclose whether the address owns a notebook. Do not add an address-lookup
  endpoint or show different first screens for existing/new addresses.
  Keep generic code-request replies, existing send/guess limits, protected
  digests, expiration, browser binding and single-use proof. The request
  itself authorizes only the verification email, not a trial or subscription.
- After proof, an existing verified owner with the current accepted terms
  goes straight to the SAME notebook. Preserve recordings, remaining time,
  grants and the existing terms version/acceptance time. Do not record a new
  agreement merely because a code was verified. Existing login still works
  after the 100-user cap and from a different network, with no refill.
- A new eligible tester sees the demo information and required terms checkbox
  AFTER verification and BEFORE any notebook, grant or trial subscription is
  created. An existing owner whose terms version is old or missing agrees to
  the current version after proof, before that new browser gains access.
  Record a new acceptance version/time only on explicit agreement.
- Keep the verified identity in short-lived server-controlled state bound to
  the requesting browser. Closing or expiring the terms step creates no
  grant. Repeated requests, duplicate agreement submissions and concurrent
  claims cannot create extra notebooks, reuse proof or refill time.
- Preserve existing notebook isolation, explicit switching of signed-in
  browsers, invitation behavior and original-browser safeguards for legacy
  unverified notebooks. Keep the 30-minute/100-user/one-email/one-IP grant
  rules, daily/provider limits and shared email-send caps. No new connector,
  key, account or provider is authorized.
- Explain both email-card actions plainly: try personal recordings with 30
  minutes of demo time, or receive one future product note. Keep the dashed
  card and scrolling handoff. Returning owners see code entry without the
  signup information or repeated checkbox when their agreement is current.
- Checks: npm run check; gallery at 375 px; public card, /try and /login go to
  code entry first without revealing account existence; a verified returning
  owner opens the same notebook without a checkbox, changed quota, new rows
  or rewritten agreement; new and outdated-agreement paths require explicit
  consent after proof; no pre-consent grant or subscription; expiry, wrong
  codes, replay, another browser, duplicate consent and concurrent claims
  fail safely; existing ownership, grant and send limits remain enforced.
  Verify the deployed public flow and isolated existing/new-owner cases on
  the Sprite with invented data and fake providers. Never ask Copal to share
  his address, code or recording details when checking the deployed flow.


## 21 · App shelf, Settings and account deletion (Copal)

Copal chose “app shelf is much better. let's go with that”, then Settings
version “1”, with “everywhere not outlined, to differntiate from sign out”.
He requested Delete my account in red and no “Email verified” label. He
approved “Update the PRD” for these screens, the owner's account-email
response and deletion with protected quota fingerprints retained until the
demo ends. These rules supersede §14's source layout and direct gear-to-
Connections route, and the blanket email-response restrictions in §§12,
18 and 20 only for the authenticated owner's account response below.

On 28 November Copal approved the compact-row revision: “without telegram”,
“Start with voice memos”, and “Great. Deploy that”. He then approved
“Update the PRD to match (Recommended)”. The revised source list and popup
setup link below replace the earlier three-app shelf.

### Add recordings

- Use the selected App shelf layout in KAI's existing look. Files is first,
  with Choose audio file as the main action. Its description is exactly
  “One audio file · up to 10 MB · under 30 minutes”, replacing “Your own
  memo, a voice note or a meeting.” Do not repeat that limits line below.
- Show app sharing separately from local Files in compact rows with 30 px
  official app artwork: Voice Memos first, then WhatsApp and Messages.
  Use the heading “or share from any of your apps, for example:”. Do not
  offer Telegram in this list; existing Telegram source links may retain
  their guidance. Use official SVG artwork where available and Apple's
  official PNG artwork for its apps.
- Each row has accessible sharing help in a dismissible popup. Beneath its
  instructions, always show “Set up the KAI shortcut for iOS”, linking to
  Connections and preserving the selected source for the return to Upload.
  Keep the inline Send to KAI setup link too. Guidance works by tap and
  keyboard. Voice Memos gives manual sharing instructions and a Files
  fallback, not the Safari-rejected launch address. WhatsApp keeps its app
  link; Messages keeps its current composition launch, as Copal chose,
  with guidance to close the draft and open the intended conversation.
  Do not imply that a browser can inspect installed apps or shortcuts.
- Make phone-sharing setup available here through Connections. If setup is
  incomplete, guide the person there before sharing. Return to the selected
  source afterwards. If setup is already confirmed or a share has succeeded,
  keep it available without repeating the setup demand; let the person
  dismiss the guidance and return to Upload. Connections also remains
  reachable through Settings and retains assistant setup.
- Local Files selection leads to the existing three recording-type selector
  before upload/processing; an incoming shared recording pauses for the same
  choice before transcription. Preserve §15's speaker rules: no person for
  Memo from me, one speaker before transcription for Someone else, and
  speaker assignment after transcription but before reading for Multiple
  speakers. Selecting a file alone calls no provider.
- Keep single imports, 10 MB, under 30 minutes, remaining trial time,
  server-side validation, privacy notice and all daily/provider/mail limits.
  Unsupported app launches retain clear manual-sharing and Files guidance.

### Settings and the owner's account

- The gear opens Settings. The selected first design has a rounded account
  card, then a Connections card. For a verified signed-in owner, show Signed
  in as and their email. Omit Email verified and Sign in. Sign out is an
  outlined button; Sign out everywhere is a plain secondary button without
  an outline. Delete my account is a separate red action below the cards.
- Signed-out visitors see Sign in, with no private account details or
  deletion action. Invitation-only notebooks retain their current access
  warning and sign-out behavior; do not invent or attach an email for them.
- Return the address only from a dedicated authenticated owner-account
  response, scoped to that browser's notebook and marked no-store. Never
  accept a target email or notebook from the client for this read. All
  general notebook APIs, MCP, logs, models, URLs and browser storage remain
  address-free; generic pre-verification responses remain unchanged.
- Keep sign-out confirmation and existing revocation behavior. Sign out
  everywhere revokes browser sessions but leaves sharing and MCP links
  working. Ordinary Settings has no filled violet main action; destructive
  confirmation uses one red Delete my account and a quiet Keep my account.

### Delete my account

- Only an authenticated verified owner can request deletion of their own
  notebook. Ask for an explicit confirmation explaining that recordings,
  people, notes and tasks will be deleted, the waitlist subscription removed,
  all browsers signed out, and sharing/assistant links stopped. Cancel does
  nothing. No public, invitation-only or cross-notebook deletion is allowed.
- Delete the live notebook, its remaining audio, suggestions, people, notes,
  tasks, notifications, queued mail, waitlist entry, ownership challenges and
  browser sessions. Revoke upload/MCP capabilities. Work already in flight
  must not recreate deleted rows, restart processing or enqueue more mail;
  cancellation/restart and repeated deletion requests must be safe. A mail
  request already handed to its provider cannot be recalled.
- Retain protected email/IP quota fingerprints until the demo ends on
  8 December, solely to enforce one trial per email/IP and the 100-grant
  limit. Keep bounded usage/send counters needed for existing daily caps;
  deletion must not reset allowances, grant totals or sending limits. Do not
  retain raw email, IP, recording content or active access credentials for
  this purpose. Apply these checks to every remaining grant entry path and
  migrate existing grants without refilling time or exposing addresses.
- Explain deletion and the limited retention in terms and its confirmation;
  increment the terms version, preserving §20's explicit agreement rules.
  Do not promise removal from historical checkpoints before the existing
  end-of-demo teardown. The agent tests only invented accounts; actual
  account deletion is initiated by the person in KAI. No Sprite, connector,
  provider account or key is created or deleted by this change.

### Delivery and checks

Land this approved plan first, then the implementation with the gallery's
new states. Both use the existing review, merge and deployment loop.

- npm run check; gallery at 375 px; Files-first shelf, exact limits copy,
  setup/return/dismiss paths, accessible sharing guidance and all three
  recording types. Existing single-file/quota validation remains enforced.
- Settings shows only its authenticated owner's email; public/invitation
  responses and general notebook/MCP APIs disclose none. Sign-out actions
  retain their behavior and distinct styles; confirmation/cancel states
  are accessible on phones and desktop.
- Deletion tests cover authorization, another notebook's isolation, atomic
  database cleanup, remaining audio cleanup, browser/upload/MCP revocation,
  outstanding verification proofs, queued/in-flight work and mail, duplicate
  requests and restart. Deleted owners cannot reclaim a trial with the same
  email or IP, including concurrent claims and older signup endpoints.
  The 100-grant total and existing daily/provider/email caps cannot refill.
- Verify the deployed layout and isolated deletion/ownership/limit cases on
  the Sprite with invented data and fake providers. Never delete or inspect
  a real tester's account to prove this check. Copal checks app launches and
  sharing on his iPhone; list each launch as not run until confirmed.


## 22 · First recording onboarding (Copal, 28 November)

Copal approved the initial design and deployment, then revised it: “there's
only two steps. One is setting up the shortcut and the other one is sending
the recording.” He approved updating this section with “1, and give them the
option to not upload anything but still complete the flow with synthetic
data like the screens you showed me”. This replaces the previous three-step
and first-ready dismissal rules, and §14's earlier setup card.

- After email proof and any required terms agreement, a new verified notebook
  opens shortcut setup as its first screen. Existing notebooks retain their
  normal destination and data. Phone onboarding has exactly two steps: set
  up the shortcut, then send a recording. No third processing step is shown.
- An explicit shortcut checkbox is saved to the notebook. Checking it moves
  directly to sharing; the completed setup step stays hidden on Home across
  reloads and browsers. Never infer installation from opening a shortcut link.
  A failed save remains recoverable. Setup can still be opened deliberately
  through sharing help or Settings. Files remains available.
- Use Copal's updated iCloud shortcut, with its public /upload return already
  preset. Copy only the notebook's private receiving address. Manual setup
  remains a closed disclosure. Sharing has compact Voice Memos, WhatsApp and
  Messages rows, the approved artwork, launches and instructions. Remove the
  rejected generic app-launch fallback sentence. Keep the horizontal type
  selector and all speaker choices before provider processing as in §15.
- Offer “Try an example instead” from Home's first-use guide, shortcut setup
  and sharing. This is an explicit alternative to providing audio or setting
  up the phone shortcut. Use the existing invented Sora sample transcript,
  clearly labelled as made-up content. KAI reads it using the existing queue
  and reader; proposals require the same accept/edit/reject decisions. No
  audio, duration charge, transcription or recording email. Reading limits
  still apply. Repeated/concurrent taps reopen the same example, without new
  rows or repeated provider work. Never mix in another notebook's content.
- Only after the first accepted audio starts processing, or the user chooses
  the example, offer assistant setup. Merely selecting a file, an upload
  waiting for type choice, arbitrary pasted text, rejected uploads and public
  browsing cannot trigger it. Speaker identification takes priority. The
  offer appears with processing and on Home; if processing finishes quickly,
  it may remain beside the result so it is not missed. Never block suggestions.
- “Connect my assistant” opens the existing assistant instructions without
  repeating phone setup. “I've connected it” or “Later” finishes onboarding
  persistently for that notebook; neither is proof of a working MCP connection.
  Keep Settings' Connections entry available afterwards. Existing notebooks
  with recordings at migration do not receive this first-use offer again.
- No new provider, key, connector, quota, email or spending allowance. Signup
  still verifies first and requires terms before granting the notebook.
- Checks: npm run check; gallery at 375 px covering both phone steps, sample
  choice, assistant offer and assistant-only setup; new verified entry starts
  setup; shortcut confirmation hides that step and survives reload; failures
  recover; Files and incoming shares keep type/speaker choices; no assistant
  offer before processing/example; invented example is isolated, idempotent,
  uses no recording quota and requires acceptance; assistant dismissal and
  completion survive restart and stay notebook-scoped. Verify deployed layout
  and isolated cases on the Sprite with invented data and fake providers.
  Copal confirms installing the updated shortcut and sharing invented audio
  on iPhone; mark this operator check not run until confirmed.
