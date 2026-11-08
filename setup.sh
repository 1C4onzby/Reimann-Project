#!/usr/bin/env bash
# One-time setup for the film pipeline. Safe to run again (skips what is already there).
#   bash setup.sh            # everything needed to build the film
#   bash setup.sh --asr      # also the speech-recognition model used to check the narration (~460 MB)
# Needs: python3, node/npm, ffmpeg, Playwright with Chromium (preinstalled in Claude cloud sessions).
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
say() { printf '\033[1m%s\033[0m\n' "$*"; }

if ! command -v fluidsynth >/dev/null || [ ! -s /usr/share/sounds/sf2/FluidR3_GM.sf2 ]; then
  say "installing FluidSynth and the FluidR3 General MIDI SoundFont"
  apt-get update -qq
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq fluidsynth fluid-soundfont-gm
fi
say "python packages"
python3 -m pip install -q -r requirements.txt
say "node packages (MathJax, fonts)"
npm ci --silent --no-audit --no-fund
mkdir -p models
for f in kokoro-v1.0.onnx voices-v1.0.bin; do
  if [ ! -s "models/$f" ]; then
    say "downloading the Kokoro voice model: $f"
    curl -fsSL -o "models/$f.part" "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/$f"
    mv "models/$f.part" "models/$f"
  fi
done
if [ "${1:-}" = "--asr" ] && ! ls -d models/sherpa-onnx-nemo-parakeet* >/dev/null 2>&1; then
  say "downloading the Parakeet speech-recognition model"
  python3 -m pip install -q -r requirements-check.txt
  curl -fsSL -o models/p.tar.bz2 https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-nemo-parakeet-tdt-0.6b-v2-int8.tar.bz2
  (cd models && tar xjf p.tar.bz2 && rm p.tar.bz2)
fi
say "ready"
