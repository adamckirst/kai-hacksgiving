#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
[[ $# -eq 1 && -f "$1" ]] || { printf '%s\n' 'Usage: scripts/upload-demo.sh <Copal-invented-demo-video>' >&2; exit 2; }
command -v sprite >/dev/null
command -v ffmpeg >/dev/null
mkdir -p .data
work_dir="$(mktemp -d .data/demo-video-XXXXXX)"
trap 'rm -rf "$work_dir"' EXIT
# H.264/AAC MP4 works in the phone browser; no media enters git.
ffmpeg -hide_banner -loglevel error -i "$1" -c:v libx264 -pix_fmt yuv420p -c:a aac -movflags +faststart "$work_dir/demo.mp4"
sprite exec -s kai --no-port-forward --stdin -- bash -c 'set -eu; umask 077; mkdir -p /home/sprite/kai-state; cat > /home/sprite/kai-state/demo.mp4.incoming; mv /home/sprite/kai-state/demo.mp4.incoming /home/sprite/kai-state/demo.mp4' < "$work_dir/demo.mp4"
printf '%s\n' 'Demo video saved on kai. Deploy the reviewed commit to enable it on Welcome.'
