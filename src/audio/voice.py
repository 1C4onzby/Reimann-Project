"""Narration with Kokoro (offline, no API key). One wav per line, so every line's
duration is known exactly and the picture and music can be timed to it.

  python3 src/audio/voice.py [voice] [speed]      defaults: $RH_VOICE or am_michael, 1.0
Writes build/voice/line_XX.wav (24 kHz mono) and build/voice/lines.json.
Adapted from the animation kit's tts_kokoro.py.
"""
import json
import os
import shutil
import sys
import tempfile

import numpy as np
import soundfile as sf
import espeakng_loader
from kokoro_onnx import EspeakConfig, Kokoro

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "build", "voice")

# espeak-ng fails on a long data path, so use a copy at a short path when needed
data = espeakng_loader.get_data_path()
if len(data) > 100:
    short = os.path.join(tempfile.gettempdir(), "kokoro-espeak-ng-data")
    if not os.path.exists(os.path.join(short, "phontab")):
        shutil.rmtree(short, ignore_errors=True)
        shutil.copytree(data, short)
    data = short

voice = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("RH_VOICE", "am_michael")
speed = float(sys.argv[2]) if len(sys.argv) > 2 else 1.0
k = Kokoro(os.path.join(ROOT, "models/kokoro-v1.0.onnx"), os.path.join(ROOT, "models/voices-v1.0.bin"),
           espeak_config=EspeakConfig(lib_path=espeakng_loader.get_library_path(), data_path=data))

lines = json.load(open(os.path.join(ROOT, "narration", "script.json")))
only = os.environ.get("ONLY")  # e.g. ONLY=3,7 re-renders just those lines
os.makedirs(OUT, exist_ok=True)
meta_path = os.path.join(OUT, "lines.json")
meta = json.load(open(meta_path)) if only and os.path.exists(meta_path) else [None] * len(lines)
todo = [int(i) for i in only.split(",")] if only else range(len(lines))
for i in todo:
    text = lines[i]["text"]
    samples, sr = k.create(text, voice=voice, speed=speed, lang="en-us")
    a = np.abs(samples)
    idx = np.where(a > 0.01)[0]
    samples = samples[max(0, idx[0] - int(0.03 * sr)): idx[-1] + int(0.12 * sr)]
    # 15 ms fades so trimmed edges never click
    f = int(0.015 * sr)
    samples[:f] *= np.linspace(0, 1, f)
    samples[-f:] *= np.linspace(1, 0, f)
    path = os.path.join(OUT, f"line_{i:02d}.wav")
    sf.write(path, samples, sr, subtype="FLOAT")  # float: Kokoro peaks can pass 1.0
    meta[i] = {"i": i, "scene": lines[i]["scene"], "text": text, "cue": lines[i].get("cue"),
               "dur": round(len(samples) / sr, 3), "sr": sr, "voice": voice, "speed": speed}
    print(f"{i:02d} {meta[i]['dur']:6.2f}s  {text[:70]}")
json.dump(meta, open(meta_path, "w"), indent=1)
print("total speech", round(sum(m["dur"] for m in meta), 1), "s")
