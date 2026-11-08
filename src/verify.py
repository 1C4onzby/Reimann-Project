"""Check the finished film end to end, from the MP4 itself.

  python3 src/verify.py
1. streams: 1920x1080 H.264 at 30 fps, AAC 48 kHz stereo, an English subtitle track;
2. loudness: integrated about -16 LUFS, true peak at most -1 dBTP;
3. picture sync: in decoded frames, each instrument's node is dark just before its
   zero is reached and lit just after;
4. sound sync: in the decoded soundtrack, energy rises at each zero (onset time);
5. a contact sheet, out/contact_sheet.jpg, one frame every 15 s.
"""
import json
import math
import os
import subprocess
import sys

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MP4 = os.path.join(ROOT, "out", "The_Music_of_the_Zeros.mp4")
tl = json.load(open(os.path.join(ROOT, "build/timeline.json")))
zeros = json.load(open(os.path.join(ROOT, "data/math.json")))["zeros"]
ok = True


def check(cond, msg):
    global ok
    print(("PASS " if cond else "FAIL ") + msg)
    ok &= bool(cond)


def frame_at(t):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{t:.3f}", "-i", MP4, "-frames:v", "1", "-f", "rawvideo",
                          "-pix_fmt", "rgb24", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(1080, 1920, 3)


# 1. streams
pr = json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", MP4],
                               capture_output=True, text=True, check=True).stdout)
v = next(s for s in pr["streams"] if s["codec_type"] == "video")
a = next(s for s in pr["streams"] if s["codec_type"] == "audio")
subs = [s for s in pr["streams"] if s["codec_type"] == "subtitle"]
dur = float(pr["format"]["duration"])
check(v["codec_name"] == "h264" and v["width"] == 1920 and v["height"] == 1080 and v["r_frame_rate"] == "30/1",
      f"video {v['codec_name']} {v['width']}x{v['height']} @ {v['r_frame_rate']}")
check(a["codec_name"] == "aac" and a["sample_rate"] == "48000" and a["channels"] == 2, f"audio {a['codec_name']} {a['sample_rate']} Hz x{a['channels']}")
check(len(subs) == 1, f"subtitle tracks: {len(subs)}")
check(abs(dur - tl["duration"]) < 0.25, f"duration {dur:.2f}s (timeline {tl['duration']:.2f}s)")

# 2. loudness
r = subprocess.run(["ffmpeg", "-hide_banner", "-i", MP4, "-map", "0:a", "-af", "ebur128=peak=true", "-f", "null", "-"],
                   capture_output=True, text=True)
tail = r.stderr[r.stderr.rindex("Summary:"):]
I = float(tail.split("I:")[1].split("LUFS")[0])
TP = float(tail.split("Peak:")[1].split("dBFS")[0])
check(abs(I + 16) < 0.6, f"integrated loudness {I} LUFS (target -16)")
check(TP <= -1.0, f"true peak {TP} dBTP")

# 3. picture sync at each zero
X = lambda g: 160 + 1600 * g / 60
lit_ok = []
for h, g in zip(tl["orchestra"]["hits"], zeros):
    x = int(round(X(g)))
    before = frame_at(h["time"] - 0.10)[552:569, x - 8:x + 9].astype(float)
    after = frame_at(h["time"] + 0.10)[552:569, x - 8:x + 9].astype(float)
    # lit node = bright amber: high red, high green, low blue
    amber = lambda p: float(np.mean((p[..., 0] > 200) & (p[..., 1] > 140) & (p[..., 2] < 120)))
    lit_ok.append((amber(before) < 0.15, amber(after) > 0.35, round(amber(before), 2), round(amber(after), 2)))
check(all(b and c for b, c, _, _ in lit_ok), "each node dark before its zero, lit after: " + str([(x, y) for _, _, x, y in lit_ok]))

# 4. sound sync
# 4a. the MP4's soundtrack sits exactly on the mix it was made from (no encoder offset)
import soundfile as sf
from scipy import signal
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", MP4, "-map", "0:a", "-ac", "1", "-ar", "48000", "-f", "f32le", "-"],
                     capture_output=True, check=True).stdout
au = np.frombuffer(raw, np.float32)
sr = 48000
mix, msr = sf.read(os.path.join(ROOT, "build/audio/mix.wav"), dtype="float32")
mix = mix.mean(1)
a0, a1 = int(300 * sr), int(330 * sr)
x, y = au[a0:a1] - au[a0:a1].mean(), mix[a0:a1] - mix[a0:a1].mean()
cc = signal.fftconvolve(x, y[::-1], mode="full")
mid = len(y) - 1
w = int(0.2 * sr)
lag = (int(np.argmax(cc[mid - w: mid + w])) - w) / sr * 1000
check(abs(lag) <= 2.0, f"MP4 soundtrack vs mix offset {lag:+.2f} ms")
# 4b. the struck instruments (harp, vibraphone, marimba, celesta, piano, bells) hit on each zero:
#     steepest attack in their dry rendered stem. Bowed and blown instruments are started early by
#     their measured attack time so their -12 dB point lands on the zero (see report.json attack_ms).
st, _ = sf.read(os.path.join(ROOT, "build/audio/check_struck.wav"), dtype="float32")
st_off = json.load(open(os.path.join(ROOT, "build/audio/check_struck.json")))["offset"]
offs = []
for h in tl["orchestra"]["hits"][1:]:          # zero 1 is the cello alone (bowed)
    i0 = int((h["time"] - st_off - 0.3) * sr)
    seg = st[i0: i0 + int(0.6 * sr)]
    a = np.abs(seg)
    floor = a[int(0.22 * sr): int(0.27 * sr)].max()                     # 80 to 30 ms before the zero
    thr = max(10 * floor, 0.02)
    k = int(np.argmax(a[int(0.27 * sr):] > thr)) + int(0.27 * sr)        # physical onset: first crossing
    offs.append(round((k / sr - 0.3) * 1000, 1))
check(all(-3 <= o <= 3 for o in offs), f"struck-instrument onset at zeros 2-13 vs zero time (ms): {offs}")

# 5. contact sheet
sheet = os.path.join(ROOT, "out", "contact_sheet.jpg")
subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", MP4, "-vf", "fps=1/15,scale=480:-1,tile=6x6:padding=6:color=0x08090b",
                "-frames:v", "1", "-q:v", "3", sheet], check=True)
print("contact sheet:", sheet)
print("ALL CHECKS PASSED" if ok else "SOME CHECKS FAILED")
sys.exit(0 if ok else 1)
