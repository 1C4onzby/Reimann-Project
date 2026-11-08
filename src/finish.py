"""Final assembly: subtitles + picture + sound -> out/The_Music_of_the_Zeros.mp4

  python3 src/finish.py
Writes out/The_Music_of_the_Zeros.srt (also embedded as a soft subtitle track)
and out/The_Music_of_the_Zeros.mp4 (1920x1080, 30 fps, H.264 + AAC 48 kHz),
normalized to -16 LUFS integrated with a -1.5 dBTP ceiling (two-pass loudnorm).
"""
import json
import os
import re
import subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "out")
NAME = "The_Music_of_the_Zeros"


def ts(t):
    ms = int(round(t * 1000))
    return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"


def chunks(text, limit=84):
    """split a line at sentence or clause ends into captions of at most ~84 characters"""
    parts = re.split(r"(?<=[.?!:])\s+|(?<=,)\s+", text)
    out, cur = [], ""
    for p in parts:
        if cur and len(cur) + 1 + len(p) > limit:
            out.append(cur)
            cur = p
        else:
            cur = (cur + " " + p).strip()
    if cur:
        out.append(cur)
    return out


def wrap(s, width=42):
    if len(s) <= width:
        return s
    words, best = s.split(), None
    for i in range(1, len(words)):
        a, b = " ".join(words[:i]), " ".join(words[i:])
        score = max(len(a), len(b))
        if best is None or score < best[0]:
            best = (score, a + "\n" + b)
    return best[1]


def srt(tl):
    n, rows = 1, []
    for ln in tl["lines"]:
        cs = chunks(ln["text"])
        total = sum(len(c) for c in cs)
        t = ln["start"]
        for c in cs:
            d = ln["dur"] * len(c) / total
            rows.append(f"{n}\n{ts(t)} --> {ts(t + d - 0.04)}\n{wrap(c)}\n")
            n += 1
            t += d
    return "\n".join(rows)


def run(cmd):
    return subprocess.run(cmd, check=True, capture_output=True, text=True)


def main():
    tl = json.load(open(os.path.join(ROOT, "build/timeline.json")))
    os.makedirs(OUT, exist_ok=True)
    srt_path = os.path.join(OUT, NAME + ".srt")
    open(srt_path, "w").write(srt(tl))
    mix = os.path.join(ROOT, "build/audio/mix.wav")
    # pass 1: measure loudness
    r = run(["ffmpeg", "-hide_banner", "-i", mix, "-af", "loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"])
    m = json.loads(r.stderr[r.stderr.rindex("{"): r.stderr.rindex("}") + 1])
    af = ("loudnorm=I=-16:TP=-1.5:LRA=11:linear=true:"
          f"measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}:"
          f"measured_thresh={m['input_thresh']}:offset={m['target_offset']},aresample=48000")
    mp4 = os.path.join(OUT, NAME + ".mp4")
    run(["ffmpeg", "-y", "-v", "error", "-i", os.path.join(ROOT, "build/video/silent.mp4"), "-i", mix, "-i", srt_path,
         "-map", "0:v", "-map", "1:a", "-map", "2:s", "-c:v", "copy", "-af", af, "-c:a", "aac", "-b:a", "256k", "-ar", "48000",
         "-c:s", "mov_text", "-metadata:s:s:0", "language=eng", "-metadata:s:a:0", "language=eng",
         "-metadata", "title=The Music of the Zeros", "-t", f"{tl['duration']:.3f}", "-movflags", "+faststart", mp4])
    print("measured input", m["input_i"], "LUFS,", m["input_tp"], "dBTP ->", mp4)


if __name__ == "__main__":
    main()
