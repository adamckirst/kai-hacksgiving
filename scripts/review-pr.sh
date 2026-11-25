#!/usr/bin/env bash
# scripts/review-pr.sh <pr>
#
# A fresh, read-only review of one pull request by Claude Fable 5.2, posted
# on the PR as a comment that names the model that answered.
#
# Exit 0: zero blockers.  1: one or more.  2: no review came back.
#
# Run it from a checkout whose HEAD is the PR's pushed head, outside any
# sandbox: the claude CLI needs the network and a writable ~/.claude.
set -uo pipefail

MODEL=claude-fable-5-2
FALLBACK=claude-opus-5-5
EFFORT=high

fail() { echo "review-pr: $*" >&2; exit 2; }

pr="${1:-}"
[[ "$pr" =~ ^[0-9]+$ ]] || fail "usage: scripts/review-pr.sh <pr-number>"
cd "$(git rev-parse --show-toplevel 2>/dev/null)" || fail "not inside a git checkout"

work="$(mktemp -d)" || fail "cannot make a temporary folder"
trap 'rm -rf "$work"' EXIT

gh pr view "$pr" --json title,body,state,headRefOid,baseRefName,comments >"$work/pr.json" \
  || fail "cannot read PR #$pr"
head="$(jq -r .headRefOid "$work/pr.json")"
base="$(jq -r .baseRefName "$work/pr.json")"
[[ "$(jq -r .state "$work/pr.json")" == OPEN ]] || fail "PR #$pr is not open"
[[ "$(git rev-parse HEAD)" == "$head" ]] \
  || fail "HEAD is not the PR's head ${head:0:8}: check out its branch and push first"
git diff --quiet HEAD || fail "uncommitted changes: commit and push them first"
git fetch --quiet origin main "$base" || fail "cannot fetch origin"

# The plan and the referee's rules come from main, never from the PR.
git show origin/main:PRD.md >"$work/PRD.md" || fail "no PRD.md on main"
git show origin/main:scripts/review-prompt.md >"$work/prompt.md" || fail "no review prompt on main"

jq -r '"# " + .title + "\n\n" + (.body // "")' "$work/pr.json" >"$work/pr-body.md"
jq -r '.comments[] | "## Comment of " + .createdAt + "\n\n" + .body + "\n"' "$work/pr.json" >"$work/earlier-rounds.md"
[[ -s "$work/earlier-rounds.md" ]] || echo "No earlier rounds." >"$work/earlier-rounds.md"
{
  echo "## Files changed"
  git diff --stat=200 "origin/$base...HEAD"
  echo
  echo "## Diff (package-lock.json and src/catalyst/ left out)"
  git diff "origin/$base...HEAD" -- . ':(exclude)package-lock.json' ':(exclude)src/catalyst'
} >"$work/diff.txt"

post() { gh pr comment "$pr" --body-file "$1" >/dev/null || fail "the review could not be posted on PR #$pr"; }

# The check, run here so that nobody takes anybody's word for it.
if [[ -f package.json ]] && jq -e .scripts.check package.json >/dev/null 2>&1; then
  echo "review-pr: running npm run check" >&2
  timeout 20m npm run check >"$work/check-full.txt" 2>&1
  code=$?
  { echo "npm run check: exit code $code"; echo; tail -n 60 "$work/check-full.txt"; } >"$work/check.txt"
  if ((code != 0)); then
    {
      echo "## Review of \`${head:0:8}\`: no model was asked"
      echo
      echo "\`npm run check\` failed on this head, which is blocker (a). The end of its output:"
      echo
      echo '```'
      tail -n 40 "$work/check-full.txt"
      echo '```'
      echo
      echo "Blockers: 1"
    } >"$work/comment.md"
    post "$work/comment.md"
    echo "review-pr: npm run check failed; Blockers: 1" >&2
    exit 1
  fi
else
  echo "This head has no package.json with a \"check\" script, so nothing was run." >"$work/check.txt"
fi

{
  cat "$work/prompt.md"
  echo
  echo "## Inputs"
  echo
  echo "- Pull request: #$pr, head $head, base $base"
  echo "- The PRD: $work/PRD.md"
  echo "- The PR's title and body: $work/pr-body.md"
  echo "- The diff: $work/diff.txt"
  echo "- The check run: $work/check.txt"
  echo "- Earlier rounds: $work/earlier-rounds.md"
} >"$work/message.md"

echo "review-pr: asking $MODEL to review PR #$pr at ${head:0:8} (up to 30 minutes)" >&2
timeout 30m claude --print --safe-mode \
  --model "$MODEL" --fallback-model "$FALLBACK" --effort "$EFFORT" \
  --tools "Read,Grep,Glob,Bash" \
  --permission-mode bypassPermissions --permission-prompts none \
  --no-session-persistence --output-format json \
  <"$work/message.md" >"$work/out.json" 2>"$work/err.txt"
code=$?

review="$(jq -r 'select(.is_error != true) | .result // empty' "$work/out.json" 2>/dev/null)"
if [[ -z "$review" ]]; then
  tail -n 20 "$work/err.txt" >&2
  head -c 2000 "$work/out.json" >&2
  fail "no review came back (claude exit code $code)"
fi
model="$(jq -r '(.modelUsage // {}) | to_entries | max_by(.value.outputTokens // 0) | .key // empty' "$work/out.json" 2>/dev/null)"
model="${model:-$MODEL (as requested; the answer did not name its model)}"

last="$(printf '%s\n' "$review" | grep -v '^[[:space:]]*$' | tail -n 1)"
if [[ ! "$last" =~ ^Blockers:\ ([0-9]+)$ ]]; then
  printf '%s\n' "$review" >&2
  fail "the review does not end with a line \"Blockers: <n>\""
fi
blockers="${BASH_REMATCH[1]}"

now="$(gh pr view "$pr" --json headRefOid --jq .headRefOid)" || fail "cannot read PR #$pr again"
[[ "$now" == "$head" ]] || fail "the PR's head moved during the review: run it again"

{ echo "## Review of \`${head:0:8}\` by $model"; echo; printf '%s\n' "$review"; } >"$work/comment.md"
post "$work/comment.md"
echo "review-pr: posted on PR #$pr by $model; $last" >&2
((blockers == 0)) && exit 0
exit 1
