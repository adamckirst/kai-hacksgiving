#!/usr/bin/env bash
set -euo pipefail
cd /home/sprite/kai
[[ "$(cat /home/sprite/kai-state/personal-instance)" = personal ]] || exit 1
export NODE_ENV=production HOST=0.0.0.0 PORT=8080 KAI_INSTANCE=personal
export KAI_DB=/home/sprite/kai-state/kai.sqlite
export KAI_COMMIT="$(git rev-parse HEAD)"
exec node --import tsx src/server/index.ts
