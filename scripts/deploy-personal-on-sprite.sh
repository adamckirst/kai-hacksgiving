#!/usr/bin/env bash
set -euo pipefail
commit="${1:?commit required}"
origin="${2:?origin required}"
mail_from="${3:?sender required}"
[[ "$commit" =~ ^[0-9a-f]{40}$ ]] || exit 1
repo=/home/sprite/kai
state=/home/sprite/kai-state
umask 077
# Refuse a demo/existing foreign database before touching the code or service.
if [[ -e "$state/kai.sqlite" && ! -f "$state/personal-instance" ]]; then echo 'Existing database is not a personal KAI instance.' >&2; exit 1; fi
if [[ -e "$repo" && ! -d "$repo/.git" ]]; then echo 'The code path already belongs to something else.' >&2; exit 1; fi
if [[ ! -d "$repo/.git" ]]; then git clone https://github.com/adamckirst/kai-hacksgiving.git "$repo" >&2; fi
cd "$repo"
[[ "$(git remote get-url origin)" = https://github.com/adamckirst/kai-hacksgiving.git ]] || { echo 'Unexpected deployment repository.' >&2; exit 1; }
[[ -z "$(git status --porcelain)" ]] || { echo 'Deployment checkout has local changes.' >&2; exit 1; }
git fetch origin >&2
if sprite-env services get kai >/dev/null 2>&1; then sprite-env services stop kai >/dev/null; fi
git checkout --detach "$commit" >&2
npm ci --include=dev >&2
npm run build >&2
# The only stdout is the first private setup link. Never tee it into logs.
node --import tsx scripts/init-personal.ts "$origin" "$mail_from"
sprite-env services create kai --cmd /bin/bash --args "$repo/scripts/start-personal.sh" --dir "$repo" --http-port 8080 --no-stream >/dev/null
sprite-env services restart kai >/dev/null
node --input-type=module - "$commit" <<'JS'
const expected=process.argv[2];
for(let attempt=0;attempt<30;attempt++){
 try{const r=await fetch('http://127.0.0.1:8080/healthz',{signal:AbortSignal.timeout(2000)});const h=await r.json();if(r.ok && h.commit===expected && h.instance==='personal' && h.reading==='connector'){console.error('Personal KAI health matches '+expected);process.exit(0)}}catch{}
 await new Promise(r=>setTimeout(r,1000));
}
console.error('Personal deployment health check failed. Inspect status without printing private configuration.');process.exit(1);
JS
