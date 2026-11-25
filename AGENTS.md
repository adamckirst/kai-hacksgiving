# KAI: instructions for the building agent

You build KAI, a one-week contest entry, from [`PRD.md`](PRD.md). The PRD
decides what is built; this file decides how you work. Two goals, in this
order: **speed** (a working, deployed demo early; a first-time user gets
value in the first minute) and **usability** (phone first, plain words, one
obvious action per screen). When two ways both satisfy the PRD, take the
one that ships sooner.

Copal is the operator. He reads on an iPhone and gives about an hour a day.
He decides product questions; you decide technical ones and say what you
chose in one line.

## Model

Codex on `gpt-6-astra` at reasoning effort `high`. Not `gpt-6.2-astra`.

- T3 Code: the thread's model and effort pickers.
- CLI: `codex -m gpt-6-astra -c model_reasoning_effort="high"`. Check a
  flag with `codex --help` before relying on it.
- `xhigh` only for a bug still open after two attempts at `high`; go back
  to `high` once it is fixed.

## One step, one pull request

1. Take the lowest-numbered step of PRD §7 that is not merged. Update
   `main`, then branch `step-<n>-<slug>` from it.
2. Build only that step, with the least code that passes its checks. Leave
   out every option, layer and feature the step does not name.
3. Run `npm run check` and each check the PRD lists for the step. For a
   check "on the Sprite", deploy the branch's head with
   `scripts/deploy.sh <commit>` and measure it there.
4. Push and open the PR with the body below.
5. Run the review loop until it reports zero blockers.
6. Merge with `gh pr merge <pr> --squash --delete-branch`, deploy `main`,
   confirm `/healthz` reports the merged commit, report to Copal, and start
   the next step.

After step 12 is merged and deployed, stop and report. Stretch steps start
only on Copal's word. Cutting scope (PRD §11's cut order) is Copal's
decision: when a step is running a day late, tell him and name the next cut.

### PR body

The shape below is a shape, not content. Write `none` under a heading that
has nothing.

```markdown
## Step <n>: <name>

<Two lines: what a person can now do.>

## Checks
| Check (PRD §7) | Result | Evidence |
|---|---|---|
| <the check, in the PRD's words> | passed / failed / not run | <command and the line of output that shows it> |

## Skipped
## Failed
## Unknown
## Answers to the review
```

A check you did not run is `not run`, with the reason. Never write `passed`
for a check you did not watch pass on this head.

### When a check needs a step of Copal's

Sprite checks need Copal's steps in PRD §9. If one is not done: tell him
the exact step, in the PRD's words; leave the PR open with the check as
`not run`; branch the next step from this PR's branch and keep building.
Come back, run the check and finish the loop when his step is done.

## The review loop

`scripts/review-pr.sh <pr>` starts a fresh, read-only review by Claude
Fable 5.2. It reads `main`'s PRD, the PR body, the diff and earlier rounds,
runs `npm run check` itself, and posts the review as a PR comment ending in
`Blockers: <n>`.

- Run it from a checkout whose `HEAD` is the PR's pushed head, with no
  uncommitted change.
- Run it with **escalated, unsandboxed permission**: the `claude` CLI needs
  the network and a writable `~/.claude`. Inside a sandbox it exits 2; that
  is the sandbox, not a quota.
- It takes up to 30 minutes and blocks. Run it once and wait for it. Never
  run two at a time, and never commit in that checkout while it runs.

| Exit | Meaning | You do |
|---|---|---|
| 0 | `Blockers: 0` | Merge (step 6). |
| 1 | One or more blockers | Fix each with the smallest change, push, update the PR body, run it again. No limit on rounds. |
| 2 | No review came back | Read what it printed. Sandboxed: run it again unsandboxed. Otherwise run it once more. After two in a row, stop and tell Copal what it printed. |

Merge only when the newest review comment says `Blockers: 0` and names the
PR's current head. If you think a blocker is wrong, do not work around it:
under "Answers to the review" in the PR body, give the file, line and
output that show it, and run the review again. Notes in a review are
optional; take one only if it is cheap and helps the demo.

## Rules that hold for every step

The full text is PRD §10. What they mean for your actions:

- **New code only.** Everything here is written this week. Never open,
  read or copy from `~/kosmos-ai`, any other repository on this machine, or
  Kopal's design reference. Libraries from npm are fine.
- **Catalyst.** Unzip only `catalyst-ui-kit/typescript/` from
  `~/tailscale-inbox/catalyst-ui-kit.zip` into `src/catalyst/`, unchanged.
  Open nothing else in that folder. Style KAI by composing those
  components from outside `src/catalyst/`.
- **Invented data only** in the repository, the seed, the samples and the
  tests: no real person, company or conversation. Audio and video files
  are never committed (`.gitignore` blocks them); tests make audio in code.
- **Real data stays on the Sprite.** Never print or read a judge's
  recording, its words, or a waitlist address. Report counts only.
- **Secrets.** No key, token or password in a file, commit, PR, log or
  this thread. The judge link and Copal's download link are secrets too:
  write them to `~/kai-links.txt` on kosmoslab (mode 600) with a command
  whose output you redirect and never see, and tell Copal the file is ready.
- **Copal's steps stay Copal's.** Never create or delete a Sprite, a
  connector, a key or an account, never enter payment details, and never
  spend money. Make the Sprite's URL public only after Copal writes "make
  the Sprite's URL public". When you need a step of his, tell him exactly
  what to click or type, and when.
- **KAI proposes; the person decides.** KAI never sends anything and never
  acts outside the app. Copy credits what the AI does to "KAI" and follows
  U8's word list.
- **The contest.** Commits carry their real dates; never rewrite history
  or a date. One Sprite, `kai`. The repository stays public.
- **This machine runs live services.** Bind a dev server to `127.0.0.1` on
  a port from 18500 up, and stop it when the check is done. Change nothing
  outside this repository and the Sprite `kai`.
- **The plan and the referee change only on Copal's words.** `PRD.md`,
  `AGENTS.md`, `scripts/review-pr.sh` and `scripts/review-prompt.md` are
  edited only when he asks, with his words quoted in the PR body.

## Reports to Copal

After each merge, and whenever you stop, write at most ten short lines in
plain words: the step and its PR link; what he can open on his phone and
what to try; his next step from PRD §9, exactly as he should do it. End
every report with these three lines, each `none` when empty:

```
Skipped: <what you did not do>
Failed: <what did not work>
Still unknown: <what nobody has checked yet>
```

## When you are stuck

- A PRD line that cannot be built as written, or two that disagree: stop
  that step, quote both lines, give your recommendation, and ask Copal one
  question. Keep working on anything that does not depend on the answer.
- A connector that does not answer from the Sprite: PRD §11 names the
  fallback. Switching provider needs Copal, because the connector is his.
- A command that fails twice the same way: read its log before a third
  try. Never loop on it.
