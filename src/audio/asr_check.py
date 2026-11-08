"""Transcribe every narration line with Parakeet (offline) and compare it with
the script, word by word. Flags lines where the voice may have said something else.
  python3 src/audio/asr_check.py      -> build/voice/asr_report.json
"""
import difflib, glob, json, os, re
import numpy as np, soundfile as sf, sherpa_onnx
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
d = glob.glob(os.path.join(ROOT, "models", "sherpa-onnx-nemo-parakeet*"))[0]
rec = sherpa_onnx.OfflineRecognizer.from_transducer(encoder=f"{d}/encoder.int8.onnx", decoder=f"{d}/decoder.int8.onnx",
    joiner=f"{d}/joiner.int8.onnx", tokens=f"{d}/tokens.txt", model_type="nemo_transducer")
norm = lambda s: [w for w in re.sub(r"[^a-z0-9 ]", " ", s.lower().replace("-", " ")).split() if w]
meta = json.load(open(os.path.join(ROOT, "build/voice/lines.json")))
report = []
for m in meta:
    a, sr = sf.read(os.path.join(ROOT, f"build/voice/line_{m['i']:02d}.wav"), dtype="float32")
    n = int(len(a) * 16000 / sr)
    a16 = np.interp(np.linspace(0, len(a) - 1, n), np.arange(len(a)), a).astype(np.float32)
    s = rec.create_stream(); s.accept_waveform(16000, a16); rec.decode_stream(s)
    heard = s.result.text
    A, B = norm(m["text"]), norm(heard)
    r = difflib.SequenceMatcher(a=A, b=B).ratio()
    report.append({"i": m["i"], "ratio": round(r, 3), "script": m["text"], "heard": heard})
json.dump(report, open(os.path.join(ROOT, "build/voice/asr_report.json"), "w"), indent=1)
for x in sorted(report, key=lambda x: x["ratio"])[:14]:
    print(f"{x['i']:02d} {x['ratio']:.2f} | {x['heard']}")
print("mean similarity", round(float(np.mean([x["ratio"] for x in report])), 3))
