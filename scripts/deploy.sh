#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
commit="$(git rev-parse --verify "${1:?usage: scripts/deploy.sh <commit>}^{commit}")"
[[ "$commit" =~ ^[0-9a-f]{40}$ ]] || exit 1
command -v sprite >/dev/null || { echo 'Install the Sprites CLI and create kai first (PRD §9).' >&2; exit 1; }
# Never create a Sprite or change its URL access policy.
sprite checkpoint create -s kai --comment "Before KAI $commit"
sprite exec -s kai --no-port-forward --stdin -- bash -s -- "$commit" < scripts/deploy-on-sprite.sh
