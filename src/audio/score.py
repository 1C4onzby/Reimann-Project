"""The orchestra: every sound in the film except the voice, plus the final mix.

Mapping (stated in the film):
  * zero n (1/2 + i*gamma_n) is an instrument tuned to exactly 10*gamma_n Hz
    (MIDI note + pitch bend, then measured to check the tuning);
  * every instrument is matched to the same loudness (ITU-R BS.1770 K-weighted),
    the audible stand-in for the shared real part 1/2;
  * a wave travels left to right along the critical line: a voice gliding at
    10*t Hz whose loudness follows |Z(t)|, panned from the left ear to the right.
    It falls silent exactly at each zero, where it meets that zero's pitch;
  * at each zero, that instrument lights up and every lit instrument strikes
    together, at the same instant and the same volume;
  * across the primes, all instruments strike together at every prime power.

Reads build/timeline.json, data/math.json, build/voice/*.wav.
Writes build/audio/{music,voice,mix}.wav and build/audio/report.json.
"""
import json
import math
import os

import fluidsynth
import numpy as np
import soundfile as sf
from scipy import signal

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "build", "audio")
SF2 = os.environ.get("RH_SF2", "/usr/share/sounds/sf2/FluidR3_GM.sf2")
SR = 48000
TARGET_LUFS = -20.0       # every instrument note is matched to this loudness
MUSIC_BUS_DB = -8.0
VOICE_LUFS = -18.0

# zero n -> General MIDI program (0-based). Sustained and struck voices alternate.
INSTRUMENTS = [
    ("Cello", 42), ("Harp", 46), ("French horn", 60), ("Vibraphone", 11), ("Clarinet", 71),
    ("Viola", 41), ("Marimba", 12), ("Flute", 73), ("Celesta", 8), ("Oboe", 68),
    ("Piano", 0), ("Violin", 40), ("Tubular bells", 14),
]

tl = json.load(open(os.path.join(ROOT, "build/timeline.json")))
M = json.load(open(os.path.join(ROOT, "data/math.json")))
ZEROS = M["zeros"]
DUR = tl["duration"] + 0.5
N = int(DUR * SR)
rng = np.random.default_rng(7)


# ---------------------------------------------------------------- loudness
_KB1 = ([1.53512485958697, -2.69169618940638, 1.19839281085285], [1.0, -1.69065929318241, 0.73248077421585])
_KB2 = ([1.0, -2.0, 1.0], [1.0, -1.99004745483398, 0.99007225036621])


def lufs(x):
    """BS.1770 K-weighted loudness of a (n,) or (n,2) signal at 48 kHz (no gating)."""
    x = x if x.ndim == 2 else x[:, None]
    y = signal.lfilter(*_KB2, signal.lfilter(*_KB1, x, axis=0), axis=0)
    ms = np.mean(y ** 2, axis=0).sum()
    return -0.691 + 10 * math.log10(ms + 1e-20)


# ---------------------------------------------------------------- instruments
def render_note(prog, freq, hold=7.0, release=2.5, vel=100):
    """One note from the SoundFont at an exact frequency. Returns (n,2) float."""
    fs = fluidsynth.Synth(gain=0.35, samplerate=float(SR), **{"synth.reverb.active": 0, "synth.chorus.active": 0})
    sfid = fs.sfload(SF2)
    fs.program_select(0, sfid, 0, prog)
    # pitch-bend range = 2 semitones (RPN 0), so 4096 bend units per semitone
    for cc, v in ((101, 0), (100, 0), (6, 2), (38, 0), (101, 127), (100, 127)):
        fs.cc(0, cc, v)
    m = 69 + 12 * math.log2(freq / 440.0)
    note = int(round(m))
    fs.pitch_bend(0, int(round((m - note) * 4096)))
    fs.get_samples(256)
    fs.noteon(0, note, vel)
    a = fs.get_samples(int(hold * SR))
    fs.noteoff(0, note)
    b = fs.get_samples(int(release * SR))
    fs.delete()
    x = np.concatenate([a, b]).astype(np.float32).reshape(-1, 2) / 32768.0
    i0 = np.argmax(np.abs(x).max(1) > 1e-4)   # start exactly at the attack
    return x[i0:]


def measure_f0(x, lo, hi):
    """Fundamental: autocorrelation finds the period (and the octave); then the
    power-weighted centre of the spectrum within 70 cents of it gives the value.
    The centre is robust to piano inharmonicity (which biases autocorrelation)
    and to string vibrato (which splits a single FFT peak into sidebands)."""
    y = x[int(0.25 * SR): int(2.25 * SR)].mean(1).astype(np.float64)
    y = y - y.mean()
    ac = signal.fftconvolve(y, y[::-1])[len(y) - 1:]
    a, b = int(SR / hi), int(SR / lo)
    k = a + int(np.argmax(ac[a:b]))
    f_ac = SR / k
    p = np.abs(np.fft.rfft(y * np.hanning(len(y)), 8 * len(y))) ** 2
    fr = np.fft.rfftfreq(8 * len(y), 1 / SR)
    m = (fr > f_ac * 2 ** (-70 / 1200)) & (fr < f_ac * 2 ** (70 / 1200))
    return float(np.sum(fr[m] * p[m]) / np.sum(p[m]))


def limit(x, thr=0.7, hold=0.012):
    """Look-ahead peak limiter: gain dips just before a peak and recovers smoothly."""
    from scipy.ndimage import maximum_filter1d
    a = np.abs(x) if x.ndim == 1 else np.abs(x).max(1)
    r = 1 - np.minimum(1, thr / np.maximum(a, 1e-9))
    r = maximum_filter1d(r, size=int(2 * hold * SR) + 1)
    b, c = signal.butter(1, 40 / (SR / 2))
    r = np.maximum(signal.filtfilt(b, c, r), 0)
    g = (1 - r) if x.ndim == 1 else (1 - r)[:, None]
    return np.clip(x * g, -thr * 1.02, thr * 1.02)


ATTACK = []   # per instrument: the note is started this much early so it is heard on the beat


def build_templates():
    tpl, rep = [], []
    for n, ((name, prog), g) in enumerate(zip(INSTRUMENTS, ZEROS)):
        f = 10 * g
        x = render_note(prog, f)
        f0 = measure_f0(x, f / 1.6, f * 1.6)
        oct_fix = 0
        # some GM presets sound an octave away from the written note; correct and re-render
        for _ in range(2):
            r = f0 / f
            if abs(math.log2(r) - round(math.log2(r))) < 0.05 and round(math.log2(r)) != 0:
                oct_fix -= round(math.log2(r))
                x = render_note(prog, f * 2 ** oct_fix)
                f0 = measure_f0(x, f / 1.6, f * 1.6)
        # samples are not all perfectly in tune: remove the measured offset once, keep the better take
        if abs(1200 * math.log2(f0 / f)) > 3:
            x2 = render_note(prog, f * 2 ** oct_fix * f / f0)
            f2 = measure_f0(x2, f / 1.6, f * 1.6)
            if abs(math.log2(f2 / f)) < abs(math.log2(f0 / f)):
                x, f0 = x2, f2
        L = lufs(x[int(0.02 * SR): int(1.5 * SR)])
        x *= 10 ** ((TARGET_LUFS - L) / 20)
        L2 = lufs(x[int(0.02 * SR): int(1.5 * SR)])
        cents = 1200 * math.log2(f0 / f)
        env = np.convolve(np.abs(x[: int(0.6 * SR)]).max(1), np.ones(240) / 240, mode="same")
        # perceived onset of a slow (bowed or blown) attack comes early in its rise: align the -12 dB point
        attack = float(np.argmax(env >= 0.25 * env.max()) / SR)
        ATTACK.append(attack)
        rep.append({"attack_ms": round(attack * 1000, 1), "n": n + 1, "instrument": name, "gm_program": prog, "target_hz": round(f, 3),
                    "measured_hz": round(f0, 3), "cents_off": round(cents, 2), "octave_fix": oct_fix,
                    "loudness_lufs": round(L2, 2)})
        print(f"  {n + 1:2d} {name:14s} target {f:7.2f} Hz  measured {f0:7.2f} Hz  ({cents:+.1f} cents)  {L2:.2f} LUFS")
        tpl.append(x)
    return tpl, rep


# ---------------------------------------------------------------- helpers
def pan_gains(p):
    """Equal-power pan, p in [0, 1] from left to right."""
    p = min(1.0, max(0.0, p))
    return math.cos(p * math.pi / 2), math.sin(p * math.pi / 2)


def place(buf, x, at, gain=1.0, pan=None):
    i = int(round(at * SR))
    if i >= len(buf):
        return
    if i < 0:
        x, i = x[-i:], 0
    j = min(len(buf), i + len(x))
    seg = x[: j - i] * gain
    if pan is not None:
        gl, gr = pan_gains(pan)
        seg = seg * np.array([gl, gr]) * math.sqrt(2)
    buf[i:j] += seg


def note(tpl, length, release=0.9):
    """A template cut to `length` seconds with a smooth release."""
    n1 = min(len(tpl), int((length + release) * SR))
    y = tpl[:n1].copy()
    k = int(length * SR)
    if k < n1:
        r = n1 - k
        y[k:] *= np.cos(np.linspace(0, np.pi / 2, r))[:, None] ** 2
    return y


def sweep_t(time):
    """critical-line height t reached by the wave at a given film time"""
    kn = tl["orchestra"]["knots"]
    return np.interp(time, [k[0] for k in kn], [k[1] for k in kn])


def Z_of(t):
    z = M["Z"]
    return np.interp(t, z["t0"] + z["dt"] * np.arange(len(z["v"])), z["v"])


def line_start(i):
    return tl["lines"][i]["start"]


def scene(sid):
    return next(s for s in tl["scenes"] if s["id"] == sid)


# ---------------------------------------------------------------- the wave
def glide_voice():
    """10*t Hz glide, loudness |Z(t)|, panned with the wave from left to right."""
    o = tl["orchestra"]
    t0, t1 = o["start"], o["end"] + 0.05
    n = int((t1 - t0) * SR)
    tm = t0 + np.arange(n) / SR
    tt = sweep_t(tm)
    f = 10 * tt
    ph = 2 * np.pi * np.cumsum(f) / SR
    tone = (np.sin(ph) + 0.42 * np.sin(2 * ph + 0.3) + 0.18 * np.sin(3 * ph + 0.9) + 0.07 * np.sin(4 * ph))
    tone += 0.6 * np.sin(ph * 1.0025 + 1.1)  # slow chorus
    amp = np.abs(Z_of(tt)) / 3.0
    amp = np.clip(amp, 0, 1) ** 0.85
    amp *= np.clip((f - 35) / 60, 0, 1)            # fade in above 35 Hz
    edge = np.clip((t1 - tm) / 0.05, 0, 1)
    y = tone * amp * edge
    y *= 10 ** ((-24 - lufs(y[amp > 0.05])) / 20)  # loud parts of the glide at about -24 LUFS
    p = np.clip(tt / 60, 0, 1)
    out = np.zeros((N, 2), np.float32)
    i0 = int(t0 * SR)
    out[i0:i0 + n, 0] = y * np.cos(p * np.pi / 2) * math.sqrt(2)
    out[i0:i0 + n, 1] = y * np.sin(p * np.pi / 2) * math.sqrt(2)
    return out


# ---------------------------------------------------------------- reverb
def reverb(x, seconds=2.6, wet=0.22):
    n = int(seconds * SR)
    t = np.arange(n) / SR
    irs = []
    for c in range(2):
        noise = rng.standard_normal(n)
        bright = noise * np.exp(-t * 6.9 / 0.9)
        dark = signal.lfilter(*signal.butter(2, 2500 / (SR / 2)), noise) * np.exp(-t * 6.9 / seconds)
        ir = 0.5 * bright + dark
        ir[: int(0.018 * SR)] = 0
        irs.append(ir / np.sqrt(np.sum(ir ** 2)))
    y = np.stack([signal.fftconvolve(x[:, c], irs[c])[: len(x)] for c in range(2)], 1)
    return x * (1 - wet) + y * wet * 2.2


# ---------------------------------------------------------------- score
def main():
    os.makedirs(OUT, exist_ok=True)
    print("rendering instrument templates")
    tpl, rep = build_templates()
    pans = [0.06 + 0.88 * g / 60 for g in ZEROS]
    music = np.zeros((N, 2), np.float32)
    events = []

    # drones: a soft pad on the first zero's pitch under the explanation scenes
    pad_cache = {}
    for sid in ["title", "primes", "series", "euler", "complex", "strip", "zline", "balance", "close"]:
        s = scene(sid)
        length = s["end"] - s["start"] + 1.5
        key = round(length, 1)
        if key not in pad_cache:
            lo = render_note(89, 10 * ZEROS[0] / 2, hold=length, release=3.0)
            hi = render_note(48, 10 * ZEROS[0], hold=length, release=3.0)
            m = min(len(lo), len(hi))
            p = lo[:m] + 0.55 * hi[:m]
            p *= 10 ** ((-33 - lufs(p[: int(6 * SR)])) / 20)
            fade = np.minimum(1, np.arange(m) / (2.5 * SR))[:, None]
            pad_cache[key] = p * fade
        place(music, pad_cache[key], s["start"] - 0.3)

    # a quiet harp tone at the start of each explanation scene, on that scene's own zero
    for k, sid in enumerate(["primes", "series", "euler", "complex", "strip", "zline"]):
        place(music, note(tpl[1], 2.5, 1.5) * 10 ** (-9 / 20), scene(sid)["start"] + 0.25, pan=0.5)

    # title: the first instrument alone, softly
    tz = tl["cues"]["title_first_zero"]
    place(music, note(tpl[0], 6.0, 2.5) * 10 ** (-6 / 20), tz - ATTACK[0], pan=pans[0])

    # the orchestra sweep: at zero k, instruments 1..k strike together at equal loudness
    hits = tl["orchestra"]["hits"]
    STRUCK = {"Harp", "Vibraphone", "Marimba", "Celesta", "Piano", "Tubular bells"}
    struck = np.zeros((N, 2), np.float32)   # dry check-stem: struck instruments only (see src/verify.py)
    for k, h in enumerate(hits):
        nxt = hits[k + 1]["time"] if k + 1 < len(hits) else h["time"] + 7.5
        length = nxt - h["time"]
        for j in range(k + 1):
            nt = note(tpl[j], length, 0.9 if k + 1 < len(hits) else 3.0)
            place(music, nt, h["time"] - ATTACK[j], pan=pans[j])
            if INSTRUMENTS[j][0] in STRUCK:
                place(struck, nt, h["time"] - ATTACK[j])
        events.append({"kind": "zero", "n": h["n"], "time": h["time"], "instruments": k + 1})
    music += glide_voice()

    # balance: the balanced chord pulses together; a hypothetical off-line zero swells over it
    bal = scene("balance")
    pulse_times = tl["cues"]["balance_pulses"]
    for a, b in zip(pulse_times, pulse_times[1:] + [bal["end"] + 1.0]):
        for j in range(13):
            place(music, note(tpl[j], b - a, 0.9) * 10 ** (-7 / 20), a - ATTACK[j], pan=pans[j])
        events.append({"kind": "balance", "time": round(float(a), 4)})
    c0, c1 = tl["cues"]["hyp"]
    hyp = render_note(56, 350.0, hold=c1 - c0 + 0.3, release=1.5)
    hyp *= 10 ** ((TARGET_LUFS - lufs(hyp[int(0.02 * SR): int(1.5 * SR)])) / 20)
    tt = np.arange(len(hyp)) / SR
    # loudness ratio of x^(3/4) to x^(1/2) as x runs over the picture's range (1 -> 10^4): up to +20 dB
    x_of = 10 ** (4 * np.clip(tt / (c1 - c0), 0, 1))
    grow = np.minimum(x_of ** 0.25, 10.0)
    fade = np.clip((c1 - c0 + 0.3 - tt) / 1.2 + 1, 0, 1)
    hyp = hyp * (grow * fade)[:, None] * 10 ** (-7 / 20)
    place(music, hyp, c0, pan=0.5)
    events.append({"kind": "hypothetical", "time": c0, "end": c1})

    # prime sync: all instruments together; at each prime power they strike in sync
    ps = tl["primesync"]
    s45 = line_start(45)
    for j in range(13):
        place(music, note(tpl[j], line_start(47) - s45 - 0.2, 1.2) * 10 ** (-6 / 20), s45 + 0.2, pan=pans[j])
    ev = ps["events"]
    for k, e in enumerate(ev):
        nxt = ev[k + 1]["time"] if k + 1 < len(ev) else e["time"] + 3.5
        p = 0.06 + 0.88 * (e["q"] - ps["x0"]) / (ps["x1"] - ps["x0"])
        for j in range(13):
            place(music, note(tpl[j], nxt - e["time"], 0.5 if k + 1 < len(ev) else 2.5) * 10 ** (-6 / 20),
                  e["time"] - ATTACK[j], pan=p)
        events.append({"kind": "prime", "q": e["q"], "time": e["time"]})

    # close: the full balanced chord, once, ringing out under the end card
    cl = scene("close")
    tfin = tl["cues"]["final_chord"]
    for j in range(13):
        place(music, note(tpl[j], 4.5, 2.5) * 10 ** (-5 / 20), tfin - ATTACK[j], pan=pans[j])
    events.append({"kind": "final", "time": tfin})

    o = tl["orchestra"]
    i0, i1 = int((o["start"] - 1) * SR), int((o["end"] + 8) * SR)
    sf.write(os.path.join(OUT, "check_struck.wav"), struck[i0:i1].mean(1), SR, subtype="FLOAT")
    json.dump({"offset": o["start"] - 1}, open(os.path.join(OUT, "check_struck.json"), "w"))

    music = reverb(music)
    music *= 10 ** (MUSIC_BUS_DB / 20)

    # ---- voice: lines placed at their timeline starts
    voice = np.zeros(N, np.float32)
    active = np.zeros(N, np.float32)
    for ln in tl["lines"]:
        v, sr = sf.read(os.path.join(ROOT, f"build/voice/line_{ln['i']:02d}.wav"), dtype="float32")
        v = signal.resample_poly(v, SR, sr).astype(np.float32)
        v *= 10 ** ((-24.0 - lufs(v)) / 20)            # every line at the same loudness first
        v = limit(v, thr=0.4)                            # then shave only the rare sharp peaks (16 dB over loudness)
        i = int(round(ln["start"] * SR))
        voice[i:i + len(v)] += v[: N - i]
        active[i:i + len(v)] = 1
    sp = voice[active > 0]
    voice *= 10 ** ((VOICE_LUFS - lufs(sp)) / 20)

    # ---- ducking: music dips under the voice (less during the orchestra, where music is the point)
    depth = np.full(N, 10 ** (-9 / 20), np.float32)
    for sid, d in (("orchestra", -4.5), ("primesync", -5.0)):
        s = scene(sid)
        depth[int(s["start"] * SR): int(s["end"] * SR)] = 10 ** (d / 20)
    # smooth the activity: 0.25 s attack, 0.7 s release
    win = int(0.05 * SR)
    env = np.convolve(active, np.ones(win) / win, mode="same")
    sm = signal.lfilter([1 - math.exp(-1 / (0.35 * SR))], [1, -math.exp(-1 / (0.35 * SR))], env)
    duck = 1 - np.clip(sm * 1.4, 0, 1) * (1 - depth)
    music_d = music * duck[:, None]

    mix = limit(music_d + voice[:, None], thr=0.89)
    peak = float(np.abs(music_d + voice[:, None]).max())
    sf.write(os.path.join(OUT, "music.wav"), music_d, SR, subtype="FLOAT")
    sf.write(os.path.join(OUT, "voice.wav"), voice, SR, subtype="FLOAT")
    sf.write(os.path.join(OUT, "mix.wav"), mix.astype(np.float32), SR, subtype="FLOAT")
    louds = [r["loudness_lufs"] for r in rep]
    report = {"instruments": rep, "loudness_spread_lu": round(max(louds) - min(louds), 3),
              "max_tuning_error_cents": round(max(abs(r["cents_off"]) for r in rep), 2),
              "events": events, "mix_peak_before_trim": float(peak), "duration": DUR}
    json.dump(report, open(os.path.join(OUT, "report.json"), "w"), indent=1)
    print("loudness spread", report["loudness_spread_lu"], "LU; worst tuning", report["max_tuning_error_cents"],
          "cents; mix peak", round(float(peak), 3))


if __name__ == "__main__":
    main()
