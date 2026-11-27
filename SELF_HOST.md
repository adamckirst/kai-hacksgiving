# Set up my own KAI

Paste this file into your coding agent. It installs the existing KAI code; it does not rebuild the app.

## Goal

Help me run a fresh, private, single-owner KAI on my own Fly.io Sprite. Use the public repository https://github.com/adamckirst/kai-hacksgiving and its personal-instance setup scripts. Guide me through one human action at a time, then deploy and verify the code. My existing demo notebook does not transfer.

## Boundaries

- Work only in a new checkout of this repository and the specific Sprite and Fly organisation I identify. Never use the shared demo Sprite `kai`, Kopal’s accounts, connectors, mail sender, links or database. Do not open other repositories.
- I create accounts, the Sprite, connectors and provider keys, enter payment details, and choose budgets. You never create/delete those resources, make purchases, upgrade plans or change providers. Ask me before deploying to my Sprite or making any real provider call, because usage can cost money. Routine local reading, building and fake-provider tests in the new checkout are allowed.
- Never ask for or display a key, code, session cookie, private setup/share/MCP link or private email address in chat. Keys go directly into my Fly connectors. I enter my owner email and verification code in KAI. Do not read credential stores, browser cookies, production database rows or `~/kai-links.txt`.
- Keep the Sprite URL private while I set up. Making it public requires my explicit instruction. Public visibility is needed for the phone shortcut and external assistants; KAI still requires its own owner session or private feature address.
- Stop the affected step on missing access, an unsupported environment, a failed check, an existing unrelated database/checkout, or an unavailable connector. Read non-sensitive error output before a second attempt; stop and report after two failures. Never print provider responses or secrets while diagnosing. Continue independent local work.
- Do not edit the product, PRD, AGENTS or review rules to get installation working. Explain an incompatibility and ask one question. Preserve the existing provider models, budgets and processing limits.

## 1. Explain costs before creating anything

Read the official pages below and confirm their current conditions with me:

- Fly’s Free plan includes $5 of usage each month, requires a credit card, and automatically moves to Pay As You Go above the allowance. This is a target for light personal use, not a hard spending cap or a promise that this app is always free. Other resources in my organisation share that allowance. Use one Sprite and SQLite, with no additional database or always-on monitor. Close KAI tabs when finished so polling does not keep it awake. Check my actual usage after setup. [Fly plans and rates](https://fly.io/pricing/)
- AssemblyAI offers $50 of initial free credits. At the published recorded-audio rate of $0.21/hour, with speaker labels adding $0.02/hour when selected, “roughly 200 hours” is an estimate; eligibility, other usage and future rates change it. It is not a KAI quota or free summaries. [Credits](https://support.assemblyai.com/articles/5370767329-can-i-sign-up-for-free) · [Rates](https://www.assemblyai.com/pricing)
- Claude API usage is billed through my Claude Console account. I need API access and a budget; a chat subscription alone does not establish the API billing setup. [Claude billing](https://support.claude.com/en/articles/8977456-how-do-i-pay-for-my-claude-api-usage)
- Email sign-in requires my own Resend account, a domain I control with verified sending DNS, an approved From address and a Resend connector. Email and domain costs/limits are separate. Do not reuse Kopal’s domain or sender. [Resend domains](https://resend.com/docs/dashboard/domains/introduction) · [Resend pricing](https://resend.com/pricing)

The app keeps one file per upload, at most 10 MB and under 30 minutes. It processes one queue. Per notebook per day: ten recordings and thirty readings. Instance-wide: sixty recordings and 150 readings. Email attempts share a 100/day cap; recording notices also cap at ten/notebook and sixty overall. These are request limits, not a dollar guarantee. There is no demo 30-minute subsidy and no automatic 8 December deletion; I own backups and deletion.

## 2. Check the environment and code

Supported path: a macOS or Linux terminal with Bash, Git, Node 24 and npm, an agent able to run commands there, and the authenticated Sprites CLI. The Sprite must also have Node 24 and npm. Check versions and CLI help rather than guessing flags. If the environment differs, stop and explain the missing prerequisite; do not change system installations without permission.

Ask where I want the new checkout. Clone `https://github.com/adamckirst/kai-hacksgiving.git` on `main` into a new directory. Read `AGENTS.md`, `PRD.md` §18, this file, `scripts/deploy-personal.sh`, `scripts/deploy-personal-on-sprite.sh`, `scripts/init-personal.ts` and `scripts/start-personal.sh`. This is an installation of existing reviewed code, not a new contest build. Preserve my selected coding agent and model; do not start the contest-building PR workflow or edit its rules. Confirm the commit belongs to merged `main`; do not deploy an unreviewed branch without my explicit testing instruction.

Run `npm ci`, install the local test browser with `PLAYWRIGHT_BROWSERS_PATH=.playwright npx playwright install chromium`, then `npm run check`. These tests use invented data and fake providers. If browser system dependencies are missing, explain the exact prerequisite; do not silently install system packages. Record the commit and observed test results. No failed or unrun check is a pass.

## 3. Guide my account and connector setup

Give one action at a time and wait for confirmation:

1. I open Fly.io and create or choose my organisation on the Free plan, reviewing the allowance and overage rules. I install/authenticate the Sprites CLI using Fly’s current official instructions. Do not use automatic account creation or payment tools.
2. I choose a fresh Sprite name such as `my-kai` and run `sprite create my-kai -o MY_ORG` after checking `sprite create --help`. It stays private. Ask only for its non-secret organisation name, Sprite name and HTTPS origin from `sprite info`; do not ask for account credentials. Do not select any existing shared demo instance.
3. I create or choose my AssemblyAI and Claude Console accounts, review credits and set provider spending limits where available, and create their keys myself. In Fly dashboard → my organisation → Sprites → Connectors → Add connector, I add one AssemblyAI and one Anthropic connector. I paste keys in Fly, never here. Turn off “Allow all sprites” and restrict access to my Sprite. Avoid a name-prefix rule that would accidentally allow unrelated Sprites.
4. I configure my verified sending domain in Resend, make a Sending-access key restricted to that domain, and add one Resend connector in Fly restricted to my Sprite. I provide the public sending address, not the key or my private login address. Wait until verification and connector setup are complete. No alternative login provider or unverified-email fallback.

The app discovers its three connectors through Fly’s gateway. Provider keys never belong in `.env`, code, command arguments or this chat. Missing or ambiguous connectors must be fixed by me in Fly.

## 4. Install after my explicit approval

Confirm the named target and expected usage with me first. The tested entry point is:

```bash
scripts/deploy-personal.sh MY_ORG MY_SPRITE REVIEWED_COMMIT HTTPS_SPRITE_ORIGIN VERIFIED_FROM_ADDRESS
```

Replace these non-secret placeholders with shell-quoted values; resolve the reviewed commit with `git rev-parse HEAD`. The command takes a checkpoint, installs/builds this repository at `/home/sprite/kai`, initializes personal mode in `/home/sprite/kai-state`, and starts its `kai` service on port 8080. It refuses the shared Sprite name and pre-existing non-personal databases. Do not use the shared-demo `scripts/deploy.sh`.

**The first command’s stdout is a private setup link.** Before running, arrange for that stdout to go directly to a NEW owner-only `~/kai-links.txt`, using `umask 077` and Bash `set -o noclobber`. Never tee, capture, open, preview or paste its contents. If that file already exists, stop and ask me to preserve it and choose a different private destination; do not overwrite it. Logs and health results go to stderr. Tell me where the private file is, without reading it. Do not replace or change my owner email on later deployments.

Confirm `/healthz` reports the requested commit, `instance: personal`, and `reading: connector` from inside my Sprite. This confirms configuration, not a real provider request. No public URL change is needed for the owner to open a private Sprite URL and authenticate with Fly.

## 5. Let me claim the notebook

Ask me to open the private setup link myself, in a browser signed in to my Fly organisation. In KAI I enter my owner email, agree to instance terms, receive the code through my own Resend connector and verify it. Ask only whether it arrived and opened an empty notebook. I must not share the address, code or link with you.

The private setup capability plus email verification can establish only one owner. After successful setup it cannot be claimed again. Sign in on another browser with a fresh email code and confirm that it opens the same notebook. There is no public signup, waitlist, trial grant or imported Mara data on this instance.

## 6. Test, then explain day-to-day use

Ask my permission for one short invented recording test, which uses my provider allowance. I upload it, choose a recording type, see suggestions and accept or reject them. Ask for the result only, not recording contents. Confirm the ready email and its review link work. If something fails, diagnose status/counts and generic error categories only. Do not print transcripts, recipient addresses or upstream responses.

If I want WhatsApp sharing or an external assistant, explain that the Sprite URL needs to be public and ask for that specific permission. Check `sprite config update --help` or `sprite url update --help` before changing access. Keep upload and MCP addresses private. Follow KAI’s Connections instructions for the shortcut and read-only assistant link.

Tell me how to check Fly/provider usage, close KAI tabs when idle, keep original audio, and make a private backup of `/home/sprite/kai-state` through my own account. Backups contain private data; never download/read them into your agent session. Updates must use a reviewed commit and preserve that state directory. I manage deletion and any provider retention myself. Do not promise unlimited free usage or automatic budget enforcement.

## Done and reporting

Finish with the public repository/commit, the non-secret app origin and status, checks actually observed, and my remaining actions. Separate a successful fake-provider fixture from a real installation or recording test. Report Skipped, Failed and Still unknown. Never claim setup is complete before I confirm the owner email, notebook recovery and recording flow.

Target: a coding agent with a local terminal. Optimized for installing reviewed KAI code with human-controlled accounts, spending and credentials.

This prompt is for an agentic tool with real system access. Review the scope locks, forbidden actions, and stop conditions before pasting. Confirm file paths, directories, and permissions match the actual project.
