# KAI, by Kopal

You have recordings you never replay: voice memos, WhatsApp voice notes,
recorded meetings. KAI gets the value out of them. Share one in, and KAI
transcribes it and suggests the people, notes, to-dos and kept promises in
it, each with the quote it heard. You accept, edit or reject. An assistant
such as Claude can then read what you accepted, over MCP.

KAI is an entry in [Fly.io Hacksgiving 2026](https://fly.io/hacksgiving).
It runs on one Fly.io Sprite and uses two Sprites connectors: Anthropic,
to read, and AssemblyAI, to listen.

The idea had been brewing in my mind for a while, and Hacksgiving inspired
me to build it, from scratch, this week.

## Status

Being built, 24 to 29 November 2026. The demo link and the video arrive
here as the build reaches them.

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

`src/catalyst/`, once it exists, holds the Catalyst UI kit by Tailwind
Labs. It is **not** covered by MIT: it is used here under the Tailwind Plus
licence and may not be copied out of this project or reused on its own.

## Run the skeleton locally

Use Node 24 or later. Run `npm ci`,
`PLAYWRIGHT_BROWSERS_PATH=.playwright npx playwright install chromium`,
then `npm run check`. The check runs TypeScript, database/API unit tests,
a production build, and the phone browser checks at 375 px on every tab.

`npm run build && npm start` serves the app at `http://127.0.0.1:18500`.
Welcome opens a read-only copy of Mara’s invented notebook. Home shows her
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
and health response. No provider is called by this step.

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
quote when tapped. Suggestions stay out of People and To-dos until the
decision step is built. Home links to earlier recordings.

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
375 px sample flow through quote highlighting. U3 still requires three timed
runs on the Sprite; local fake-reader speed is not that measurement.

## Add recordings (step 5)

Home accepts one to five `.m4a`, `.opus`, `.ogg`, `.mp3` or `.wav` files.
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

U2 is not established by these checks: Copal must record
[`samples/memo-script.md`](samples/memo-script.md), then the deployed app’s
first-suggestion time must be measured over three runs.
