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

- U6. No sideways scroll. Text at least 16 px. Tap targets at least 44 px.
- U7. Exactly one filled violet button: the screen's one obvious action.
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
- **A judge's own recording is theirs.** On Home only, beside "Add recordings", KAI says **(Copal)**:
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
  to-dos and kept promises; include no names, titles, words, summary text,
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
