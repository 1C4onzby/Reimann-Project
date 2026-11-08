#!/usr/bin/env bash
# Build the film end to end -> out/The_Music_of_the_Zeros.mp4
#   bash build.sh                 # everything (math ~4 min, voice ~2 min, render ~10 min on 4 cores)
#   SKIP_MATH=1 bash build.sh     # reuse data/math.json (committed)
#   WORKERS=8 bash build.sh       # more render workers
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
say() { printf '\033[1m== %s\033[0m\n' "$*"; }
[ "${SKIP_MATH:-0}" = "1" ] || { say "math: zeros, Z(t), explicit formula"; python3 -I src/math/compute.py "${ZERO_TABLE:-}"; }
say "narration (Kokoro, ${RH_VOICE:-am_michael})"; python3 -I src/audio/voice.py
say "timeline";                    python3 -I src/timeline.py
say "orchestra and mix";           python3 -I src/audio/score.py 2>&1 | grep -v "fluidsynth: warning"
say "picture";                     node src/render/render.mjs video "${WORKERS:-4}"
say "final mux";                   python3 -I src/finish.py
