#!/usr/bin/env bash
# Operator runs this only against their own already-created Sprite.
# On first install stdout contains the private setup link: redirect it to a
# new mode-600 ~/kai-links.txt, never an agent transcript or build log.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
org="${1:?usage: scripts/deploy-personal.sh ORG SPRITE COMMIT HTTPS_ORIGIN FROM_ADDRESS}"
personal_sprite="${2:?Sprite name required}"
commit="$(git rev-parse --verify "${3:?commit required}^{commit}")"
origin="${4:?Sprite HTTPS origin required}"
mail_from="${5:?verified Resend sender required}"
[[ "$org" =~ ^[a-zA-Z0-9][a-zA-Z0-9-]*$ && "$personal_sprite" =~ ^[a-zA-Z0-9][a-zA-Z0-9-]*$ && "$commit" =~ ^[0-9a-f]{40}$ ]] || exit 1
[[ "$personal_sprite" != kai ]] || { echo 'Choose your own Sprite name, not the shared demo kai.' >&2; exit 1; }
command -v sprite >/dev/null || { echo 'The operator must install and sign in to the Sprites CLI first.' >&2; exit 1; }
sprite checkpoint create -o "$org" -s "$personal_sprite" --comment "Before personal KAI $commit" >&2
sprite exec -o "$org" -s "$personal_sprite" --no-port-forward --stdin -- bash -s -- "$commit" "$origin" "$mail_from" < scripts/deploy-personal-on-sprite.sh
