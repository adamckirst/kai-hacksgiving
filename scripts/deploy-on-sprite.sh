#!/usr/bin/env bash
set -euo pipefail
commit="${1:?commit required}"
[[ "$commit" =~ ^[0-9a-f]{40}$ ]] || exit 1
repo=/home/sprite/kai
state=/home/sprite/kai-state
umask 077
mkdir -p "$state"
if [[ ! -d "$repo/.git" ]]; then
  git clone https://github.com/adamckirst/kai-hacksgiving.git "$repo"
fi
cd "$repo"
git fetch origin
# Refuse to discard changes in the deployment checkout.
[[ -z "$(git status --porcelain)" ]] || { echo 'Deployment checkout has local changes.' >&2; exit 1; }
# Stop before replacing code; accepted data stays outside this checkout.
if sprite-env services get kai >/dev/null 2>&1; then sprite-env services stop kai >/dev/null; fi
git checkout --detach "$commit"
npm ci --include=dev
npm run build
sprite-env services create kai --cmd /bin/bash --args "$repo/scripts/start-sprite.sh" --dir "$repo" --http-port 8080 --no-stream >/dev/null
sprite-env services restart kai >/dev/null
node --input-type=module - "$commit" <<'JS'
const expected=process.argv[2];
for (let attempt=0;attempt<30;attempt++) {
  try {
    const response=await fetch('http://127.0.0.1:8080/healthz',{signal:AbortSignal.timeout(2000)});
    const health=await response.json();
    if (response.ok && health.commit===expected) {console.log(`/healthz: ${expected}`);process.exit(0);}
  } catch {}
  await new Promise(resolve=>setTimeout(resolve,1000));
}
console.error('Deployment health check failed. The checkpoint is available; no data was rolled back.');
process.exit(1);
JS
