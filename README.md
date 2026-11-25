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
People lists Mara’s invented contacts. The other tabs explain what comes
in later steps. Stop it with Ctrl-C. The local SQLite file is ignored by git;
seed data is inserted only once and dates are relative to that first run.
`KAI_DB` can select a database path (use a path outside the code folder on
the Sprite). `HOST`, `PORT`, and `KAI_COMMIT` configure the service address
and health response. No provider is called by this step.
