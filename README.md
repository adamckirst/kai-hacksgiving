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
`KAI_JUDGE_SECRET` supplies the secret for a link in the form `/#judge=…`.
Do not put that secret in shell history, logs or this repository. Step 3
will provision it on the Sprite and save the link for Copal. Each browser
that opens the link receives its own newly seeded workspace and an
HttpOnly session cookie. The fragment is removed before the session opens.
With no configured secret, new judge sessions are refused.
`VIDEO_URL` enables the Welcome video; without it there is no video player.
`NODE_ENV=production` enables Secure cookies; the deployed service requires
HTTPS. `HOST`, `PORT`, and `KAI_COMMIT` configure the service address
and health response. No provider is called by this step.
