#!/usr/bin/env bash
set -euo pipefail
cd /home/sprite/kai
export NODE_ENV=production HOST=0.0.0.0 PORT=8080
export KAI_DB=/home/sprite/kai-state/kai.sqlite
if [[ -f /home/sprite/kai-state/demo.mp4 ]]; then export VIDEO_URL=/demo.mp4; fi
if [[ -f /home/sprite/kai-state/x-post-url.txt ]]; then export X_POST_URL="$(cat /home/sprite/kai-state/x-post-url.txt)"; fi
export KAI_COMMIT="$(git rev-parse HEAD)"
exec node --import tsx src/server/index.ts
