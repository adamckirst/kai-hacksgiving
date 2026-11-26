# KAI, by Kopal

You have recordings you never replay: voice memos, WhatsApp voice notes,
recorded meetings. KAI gets the value out of them. Share one in, and KAI
transcribes it and suggests the people, notes, to-dos and kept promises in
it, each with the quote it heard. You accept, edit or reject. An assistant
such as Claude can then read what you accepted, over MCP.

KAI is an entry in [Fly.io Hacksgiving 2026](https://fly.io/hacksgiving).
It is built for one Fly.io Sprite and two Sprites connectors: Anthropic,
to read, and AssemblyAI, to listen.

The idea had been brewing in my mind for a while, and Hacksgiving inspired
me to build it, from scratch, this week.

## Status

[Open the live demo](https://kai-b6whz.sprites.app/). Everyone can browse the
read-only notebook, or join the waitlist for an empty private notebook with
one hour of recording time and its own assistant connection. Existing judge
invitations still open seeded editable copies. Video waits for Copal’s
approval of the final product.

## How it is built

- [`PRD.md`](PRD.md) is the plan: what KAI does, the screens, the data, the
  build steps and the rules.
- [`AGENTS.md`](AGENTS.md) is how the work is done. A coding agent (Codex)
  builds one step per pull request, and a second, read-only agent (Claude)
  reviews each one with [`scripts/review-pr.sh`](scripts/review-pr.sh)
  before it merges.
- The review ends with a line `Blockers: <n>`. A pull request merges only
  at zero.
- Every person, company and conversation in this repository is invented.

## Licence

The code written for KAI is under the [MIT licence](LICENSE).

`src/catalyst/` holds the Catalyst UI kit by Tailwind
Labs. It is **not** covered by MIT: it is used here under the Tailwind Plus
licence and may not be copied out of this project or reused on its own.

## Run locally

Use Node 24 or later. Run `npm ci`,
`PLAYWRIGHT_BROWSERS_PATH=.playwright npx playwright install chromium`,
then `npm run check`. The check runs TypeScript, database/API unit tests,
a production build, and the phone browser checks at 375 px on every tab.

`npm run build && npm start` serves the app at `http://127.0.0.1:18500`.
Welcome offers a private recording trial or a look around Mara’s invented notebook. Home shows her
people count, open to-dos and past recordings. People lists her contacts.
Stop the server with Ctrl-C. Local runs use an in-memory database, keeping
access secrets out of files; all local changes disappear on restart.

On the Sprite, `KAI_DB` selects a database outside the code folder.
For an in-memory local run, `KAI_JUDGE_SECRET` supplies the secret for a link
in the form `/#judge=…`; production generates and persists it on the Sprite.
Do not put that secret in shell history, logs or this repository. Step 3
will provision it on the Sprite and save the link for Copal. Each browser
that opens the link receives its own newly seeded workspace and an
HttpOnly session cookie. The fragment is removed before the session opens.
With no configured secret, new judge sessions are refused.
`VIDEO_URL` enables the Welcome video; without it there is no video player.
`NODE_ENV=production` enables Secure cookies; the deployed service requires
HTTPS. `HOST`, `PORT`, and `KAI_COMMIT` configure the service address
and health response. Local mode calls no providers. Production uses the configured Sprites connectors.

## Deploy to the existing Sprite (step 3)

Copal first completes PRD §9: install and sign in to the Sprites CLI,
create `kai`, and add the Anthropic and AssemblyAI connectors with access
restricted to the `kai` prefix. The agent never creates those resources.

Run `scripts/deploy.sh <commit>` from this checkout. It checkpoints `kai`,
fetches that commit into `/home/sprite/kai`, builds with dev dependencies
included, and creates/restarts the `kai` HTTP service on port 8080.
It verifies the commit through `/healthz` inside the Sprite. It refuses a
dirty remote checkout. It leaves URL access private and never restores a
checkpoint automatically, because that could discard accepted data.
A failed build leaves the service stopped; fix the build and redeploy.

The service stores SQLite in `/home/sprite/kai-state/kai.sqlite`. Production
refuses a missing, in-memory or in-checkout database path. It creates the
invitation secret once inside the public workspace’s otherwise unused
`mcp_token` field. That workspace must never expose an MCP endpoint.
No invitation secret appears in service arguments, output or an env file.
The link will be saved for Copal when he authorizes public URL access.

Run `sprite exec -s kai --no-port-forward --dir /home/sprite/kai -- npm run connectors:check`
for the real pings. It discovers the two permitted gateway URLs, calls the
specified Claude model, and transcribes a generated two-second WAV held
only in memory. It reports the model name and completion status, never
provider response bodies. It deletes the test transcript afterwards.
For the outside refusal check, run:

```sh
sprite exec -s kai --no-port-forward --dir /home/sprite/kai -- node --import tsx scripts/gateway-addresses.ts | npm run connectors:check -- --outside
```

The pipe carries gateway addresses, never provider credentials. All calls use the gateway without
an Authorization header. Neither command runs as part of `npm run check`.
The deploy’s internal health check does not prove the separate PRD check
on the Sprite’s HTTPS address; that must be checked with authenticated
access before merging, without making the URL public early.

References: [Fly services](https://docs.fly.io/sprites/concepts/services),
[Fly connectors](https://docs.fly.io/sprites/concepts/connectors),
[Claude Messages](https://platform.claude.com/docs/en/api/messages/create),
[AssemblyAI upload](https://www.assemblyai.com/docs/pre-recorded-audio/api-reference/files/upload)
and [transcription](https://www.assemblyai.com/docs/pre-recorded-audio/api-reference/transcripts/submit).

## Read a transcript (step 4)

In a judge copy, Home accepts up to 20,000 characters and a conversation
date, or one of three invented samples. A Recording page polls each second,
shows suggestions as each tool call finishes, and highlights a supporting
quote when tapped. Suggestions stay out of People and To-dos until you accept them. Home links to earlier recordings.

Local runs use a scripted reader (`KAI_MODEL=fake`). It produces the expected
suggestions for the three samples; other local text receives a title and
summary but no proposed items. Production uses Claude through the Sprites
connector unless explicitly configured as fake. There is no direct-provider
fallback and no provider key. The gateway is called with plain HTTPS and
[Claude’s streaming event format](https://platform.claude.com/docs/en/build-with-claude/streaming).

A quote must occur verbatim in the words, dates must exist, and referenced
people must belong to the current workspace or its pending proposals.
Rejected tool calls return an error to KAI without saving a suggestion.
Refusals and interrupted reads become “Try again”. Every new read or retry
reserves one of the workspace’s 30 daily readings and the shared 150 daily
readings in a database transaction. Two counter columns on `workspaces`
persist the current UTC day’s usage; there are still seven tables.

Local checks cover every sample, invented quotes, impossible dates, foreign
people, reading limits, retry accounting, incremental tool handling, and the
375 px sample flow through quote highlighting. On step 4's reviewed head
`37a9051`, three real-connector browser runs measured U3 at a median 6.85
seconds to the first suggestion and 10.68 seconds to all suggestions.
Final-product measurements must be repeated on its own deployed head.

## Add recordings (step 5)

Add recordings opens an upload page. Choose an existing person, add a person,
or continue without one, then choose one to five `.m4a`, `.opus`, `.ogg`, `.mp3` or `.wav` files.
Each must be at most 10 MB and five minutes. The server parses the audio’s
duration, validates the whole batch, and reserves both recording and reading
allowances before enqueueing it. File dates come from the file picker;
within a day, the original timestamps determine the queue order.

Audio is stored alongside the database, outside the production checkout,
with private file permissions. The database tracks its path, batch, original
time, attempt count and whether transcription has finished. A single worker
listens and reads oldest first. It commits the words before deleting local
audio, so a restart between those operations can finish safely. Identical
suggestions from an interrupted read are not duplicated. A stuck operation
is aborted after two minutes and retried once, with another allowance
reserved. Another interruption ends with Try again. Startup and incoming
requests resume the queue. The screen polls each second.

Recording limits are 10 per workspace and 60 total per UTC day. The real
transcriber calls AssemblyAI only through its connector; the fake returns
invented sample words. Local checks use generated audio only. FFmpeg must
be installed to generate the `.m4a` and `.opus` test files; it is not needed
by the deployed app. Files made during tests stay in ignored `.data/`
folders and are removed when the tests finish. The restart test closes and
reopens a disk-backed database while keeping all access credentials out of
that database. The phone test uploads a generated WAV and sees the words.

Copal recorded [`samples/memo-script.md`](samples/memo-script.md). On step
5's reviewed head `6f85365`, three browser uploads measured U2 at a median
15.98 seconds to the first suggestion. A temporary copy added trailing
silence to reach 60 seconds; it was removed after the check. Each run
confirmed that the words persisted and uploaded audio was removed.

## Decide what to keep (step 6)

Each suggestion has Accept, Edit and Reject. Accept all keeps the current
suggestions in one transaction. Accepting a note or promise about a new
person also accepts that person. Rejecting a new person rejects their
pending items. Repeating an acceptance does not create duplicate rows.
Editing changes the words or due date but keeps the original supporting
quote; the screen always has one filled violet action.

People shows Needs you before Everyone. Dana’s overdue pricing promise is
already there. A person’s page shows accepted open to-dos, notes with quotes
and recordings newest first. A subject `person_id` on to-dos distinguishes
who a promise concerns from who owes it; the existing seed is backfilled
without replacing rows. People, notes and to-dos still contain accepted
items only. Browser checks exercise the real acceptance routes in separate
judge sessions and verify that the other copy does not receive the change.

## Remember people and promises (step 7)

KAI receives the known people list and must call `get_person` before
proposing something about a known person. That read contains accepted notes,
open promises and recordings from the same workspace. Matching names and
companies reuse a person instead of proposing a duplicate. A kept-promise
proposal points to an existing open to-do and carries its supporting quote;
only acceptance marks it done. The Recording screen can show “Reading Dana’s
page” while this happens.

`KAI_MODEL=fake npm run kai:check` exercises the check harness locally.
On the Sprite, run `npm run kai:check` from the deployed checkout. It opens
nine fresh invented copies through the app: three samples, three runs each.
It verifies each sample, accepts the results, and checks that Dana’s pricing
promise is done and no second Dana exists. These are normal app requests,
so they count toward daily limits. Only counts and timings are printed;
the invitation and browser cookies stay in process memory. The real check
refuses to run outside a Sprite. Its timing output describes HTTP polling;
it is not a claim about a phone or cold-start performance.

## Finish a to-do (step 8)

To-dos separates Mine from Waiting on. Each view groups open promises into
Overdue, Due soon (today or tomorrow), Later and No date, using the same UTC
calendar as People. A judge ticks a promise once to finish it; the original
words and quote remain stored. Public visitors can browse both views but
cannot finish anything. Completing a promise removes it from open lists
and from the person's urgency count. The checks cover year boundaries,
private completion, repeated requests, failed requests, and both phone views.

## Send to KAI from an iPhone (step 9)

A judge's Connect screen shows their private upload address and the actions
for a “Send to KAI” shortcut. Enable Files and Media in the share sheet,
read the input file's Creation Date, format it as ISO 8601 including time,
and POST a Form with a File named `recordings` (Shortcut Input) and a Text
named `date` (Formatted Date). Read the response dictionary's `error`: if
it has a value, Show Alert and Stop This Shortcut. After End If, Open URLs
opens this site's `/upload` page in Safari, where the judge's existing cookie
selects their copy. The shared recording waits there until they choose a person
or continue without one and tap Let KAI read. Older shortcuts that open Home
are taken to the waiting upload automatically. If the source
app provides no original date, Ask for Input can supply Date and Time for
Format Date instead. The shortcut is tried on Copal's iPhone before this
step can merge; the browser tests are not a substitute for that check.

`/in/<upload token>` accepts only POST. Invalid addresses return 404 before
a file is parsed; a valid address grants upload access only, never a browser
session or read access. An Origin header is refused on this shortcut route.
It uses the same validation, limits and oldest-first queue as Home and
records the source as `shared`. For a batch, clients send up to five files
under `recordings` and a `dates` JSON array of millisecond timestamps, just
as Home does. The one-file shortcut uses the ISO date field above. Missing
or invalid dates are refused instead of silently using the upload day.

Browser signing now uses a separate `session_secret` in `workspaces`.
During upgrade, the previous signing value stays there so existing cookies
continue to work; a new, independent upload address is made before addresses
are exposed for the first time. The migration is transactional and runs
once. Tests exercise it with an in-memory database image; no credentials are
written to a local test file. The public copy never exposes an upload address.
Phone layout tests display a deliberately invalid example address, so test
artifacts cannot contain a usable private address.

Setup references: Apple's [share-sheet guide](https://support.apple.com/guide/shortcuts/apd163eb9f95/ios),
[HTTP request actions](https://support.apple.com/guide/shortcuts/apd58d46713f/ios),
[date formats](https://support.apple.com/guide/shortcuts/apdfd459e13d/ios)
and [Voice Memos sharing](https://support.apple.com/guide/iphone/iph3d6dc359/ios).

## Connect an assistant (step 10)

Connect gives a judge their private assistant address and three steps for
adding it in Claude. The public copy has no such address. An assistant can
read accepted people, notes and promises, and search original recording
words. It cannot approve a suggestion, tick a promise, upload a recording
or call a provider. Recording words are identified as source material,
which may contain claims the person has not accepted.

`/mcp/<mcp token>` uses the official TypeScript SDK's server and Node
packages. Its compatible Streamable HTTP transport creates a fresh server
for each POST with `sessionIdGenerator: undefined` and
`enableJsonResponse: true`. There is no MCP session to persist or recover.
Invalid addresses—including the public workspace's invitation and an
upload address—return 404. The endpoint rejects browser Origins, accepts
at most 32 KB of JSON and supports no GET stream or DELETE session. It is
mounted before the browser write fence and queue wake middleware: a read
does not wake a queued provider job.

The four tools are `list_people`, `get_person`, `list_todos` and `search`.
They select only the address owner's data. Person pages omit pending
suggestion pointers; notes and promises include supporting quotes. Search
also reads recording words and can find completed accepted promises. No
tool reads workspace secrets or the waitlist. All four are marked read-only.

The `tests/mcp.test.ts` scripted client is the official SDK client over real
HTTP. It lists the tools, reads Dana's open pricing promise and quote,
searches words, checks cross-copy isolation and wrong-address 404s, and
rejects a made-up write tool. The database image is unchanged after those
requests, provider calls stay at zero, and replies are JSON with no MCP
session header. The Connect phone test uses invalid example addresses for
copy and layout checks, keeping private values out of artifacts.

SDK references: [server transport](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/packages/middleware/node/src/streamableHttp.ts)
and [client connection](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/clients/connect.md).
The live Claude app connection remains Copal's PRD §9 step, once deployed.

## Leave an address, or download the list (step 11)

Home and a Recording whose suggestions are all decided show one quiet
waitlist card. It asks for one email, promises one note if KAI becomes a
product, and says “ask me and I delete it”. `X_POST_URL` adds Copal's actual
X post when he provides it; until then the card says the link is pending.
[Open the demo](https://kai-b6whz.sprites.app/) to try the read-only notebook
and join the waitlist.

The waitlist stores `email`, `created_at` and an optional `workspace_id` for
trial claims. The
route accepts one well-formed address up to 254 characters, normalizes case
and surrounding whitespace, ignores repeats, and refuses row 2,001. It
never echoes an address. An anonymous HttpOnly, SameSite browser cookie
identifies a visitor for five attempts in a rolling hour, including invalid
submissions. The cookie's attempt times live separately in the public
workspace's `waitlist_visitors` JSON field and survive service restarts.
No address, IP or device information is stored in the visitor counters. Clearing cookies creates a new anonymous visitor; this is a browser
limit, not proof of a person's identity. Inactive counters expire after an
hour; the form renews an expired visit before submitting. At most 2,000
active visitor entries are kept, so anonymous GETs cannot grow this field
without bound. The global 2,000-row ceiling holds regardless of visitor identity.

Waitlist and operator routes run before provider queue wake middleware.
The signup address goes only to the waitlist insert; neither workspace
queries nor MCP select the waitlist. Errors are generic and no request body
is logged. Tests generate invented addresses at runtime, keep them in
memory, and check zero console output, zero provider calls, no address in
any workspace table or MCP answer, capacity, duplicates and restart limits.

Copal's private link opens `/operator#download=…`. The fragment is removed
before requests, and the browser sends the secret in a header to the count
and download endpoints. The page shows only the count. Download is a plain
text attachment with one address per line; addresses are not rendered on
the page. The operator secret is independent of the judge invitation; the
judge secret and wrong values get 404. Production keeps it in the public
workspace's otherwise unused `upload_token`, which sharing never accepts.
Local tests use only an in-memory database and generated secrets.

After Copal says “make the Sprite's URL public” and public access is set,
run `scripts/save-links.sh <public Sprite URL>` on kosmoslab. It reads the
invitation and creates/reuses the independent download secret on the
Sprite, then writes both links only to `~/kai-links.txt` with mode 600.
It does not change URL access. Do not print or open that file as the agent.
The helper has been syntax-checked only; link delivery remains on hold
while Copal keeps the Sprite private.
Copal alone opens the file and downloads the list. His Saturday download
check and the later X post remain manual PRD §9 steps.

## Final phone polish and live checks (step 12)

Copy feedback appears beside the button used. Completing suggestions cannot
be visually reverted by an older polling response, and a retry starts with
fresh progress text. To-dos waits for access to resolve before saying the
copy is read-only. The phone checks include a delayed-poll regression and
an urgency case where the overdue person comes last alphabetically.
The HTTP body limit accommodates 20,000 Unicode characters even when JSON
escapes every character; the transcript's character limit still applies.

Copal wants to approve the final product, including step 13's look, before
any video work. After that approval and when he supplies the recording, run
`scripts/upload-demo.sh <video-file>`, then deploy the reviewed commit.
The helper converts to H.264/AAC MP4 in an ignored temporary directory,
streams the file to `/home/sprite/kai-state/demo.mp4`, and removes its local
copy. The service startup sets `VIDEO_URL=/demo.mp4` when that file exists;
the app serves byte ranges for seeking. Until then Welcome has no player.
The actual video link belongs here once the Sprite URL is public. The unit
check serves a generated gray test clip; that is not Copal's video and is
never committed or shown as the demo.

After Copal supplies the X post, keep its public address in
`/home/sprite/kai-state/x-post-url.txt` and deploy the reviewed commit.
Startup sets `X_POST_URL` from that non-secret file. Neither video nor post
configuration is erased when the code is redeployed.

Earlier steps' live measurements are recorded in their PRs; they do not
establish the final product's performance. The step-12 PR lists every
C1–C4, D1–D4 and U1–U8 requirement with evidence or “not run”.
In step 13, on its final deployed head, record three runs for each U1–U5
check and the median. Step 12 lists each criterion’s status; it does not deploy
an older build over the approved private preview for those measurements. For U5, close polling tabs, verify sleep through the Sprite control
plane before each run, and measure navigation to the first visible Welcome
action; an already-awake response is not cold-start evidence. Record the
actual video, phone notes, demo URL, post URL and submission confirmation
only when Copal supplies them. The goal is not complete while any required
live check or deployment remains pending.

## The look (step 13)

The app and [gallery](design/README.md) use the same screens in `src/look/`.
Home, People and To-dos open the upload page, where the person is chosen
before transcription starts. A person’s page preselects that person. Suggestions are edited in a bottom sheet;
errors stay inside it. People shows each person once, with Needs you first.
Shared audio stays in the database queue without calling a provider until
the person confirms. This survives restarts and rechecks daily allowances
if confirmation happens on a later day. KAI receives the selected speaker;
without a choice it is told the speaker is unknown, never assumed to be Mara.
Home keeps current and newly completed recordings first, followed by your
to-dos with completion checkboxes. Sample prompts disappear after an audio
upload; upload limits appear only on the upload page. Loading a private route
keeps that page’s loading screen instead of showing Welcome.

[App pictures](design/app-shots/) use invented local data; [gallery pictures](design/shots/)
show the reference. No usable connection address appears in those pictures.
The Sprite URL is public; writes and assistant access require a private
notebook opened through a judge invitation or waitlist trial. Video work waits for Copal’s product approval.

### Public recording trial

“Try it yourself” leads to email verification and an empty private notebook.
A six-digit code sent through the existing Resend Sprite connector expires
in ten minutes and permits five guesses. Codes are protected with a keyed
digest and never logged or stored as plaintext. Sending is limited to once
per email per minute, three per IP per hour and 100 overall in a rolling
day; failed deliveries consume the send allowance too. Resend request
idempotency prevents duplicate delivery on retry.

One normalized email and public IP can receive one trial, with 100 verified
trials in total. The database checks all three limits in the same grant
transaction. Raw IP addresses are not stored: the app keeps a keyed digest.
The Sprite-Client-IP header must be confirmed at the deployed proxy before
public signup is enabled. The operator-only network check returns a digest,
never the IP. Shared Wi-Fi shares an allowance; changing networks can bypass
an IP rule, so the global caps remain the spending boundary.

A trial gets 3,600 seconds, rounded up per uploaded file and reserved
atomically with the daily counters. Rejected batches roll back; accepted
uploads consume time even when transcription fails. Retries of that upload
do not deduct its duration again. Existing unverified trials retain their
notebooks and remaining time but cannot call providers until verified.
Private judge invitations remain separate. Keep the original browser;
this verification flow does not recover another browser’s notebook.

Daily caps, file limits and provider limits are unchanged. A full hour may
span days. One hundred hours is an allowance for new uploaded audio, not a
guarantee about the full bill: retries, Claude, email and compute also count.
Transcription requests do not enable keyterms or other paid add-ons.

The sender is configured only on the Sprite in `kai-state/mail-from`.
No Resend key enters the app; the connector keeps it. A marker at
`kai-state/trial-network-verified` enables signup only after the operator’s
proxy check. Missing configuration fails closed. Two server-only tables
keep short-lived code challenges and bounded send counters. The waitlist
holds the verified date, private notebook link and protected IP digest;
none of these enter notebook/MCP responses.
