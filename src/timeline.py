"""One timeline for picture and sound, so they cannot drift apart.

Reads narration/script.json, build/voice/lines.json and data/math.json and writes
build/timeline.json: scene spans, the start of every narration line, the sweep
along the critical line (time -> t), the moment each zero is reached, and the
sweep across the primes (time -> x) with the moment each prime power is reached.
"""
import json
import math
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FPS = 30
GAP = 0.65          # air between narration lines
SCENE_PRE = 1.1     # picture leads the first line of a scene
SCENE_TAIL = 1.3    # and holds after its last line

SCENES = [  # id, label, BC unit tag
    ("title", "", ""),
    ("primes", "Counting primes", "AP CALCULUS BC  ·  UNIT 6  ·  ACCUMULATION AND DEFINITE INTEGRALS"),
    ("series", "The zeta function", "AP CALCULUS BC  ·  UNIT 10  ·  p-SERIES, HARMONIC SERIES, INTEGRAL TEST"),
    ("euler", "Euler's product", "AP CALCULUS BC  ·  UNIT 10  ·  GEOMETRIC SERIES"),
    ("complex", "Complex exponents", "AP CALCULUS BC  ·  UNIT 10  ·  MACLAURIN SERIES   ·   UNIT 9  ·  POLAR FORM"),
    ("strip", "The critical line", "AP CALCULUS BC  ·  UNIT 10  ·  INTERVAL OF CONVERGENCE   ·   BEYOND BC  ·  ANALYTIC CONTINUATION"),
    ("zline", "Walking the line", "AP CALCULUS BC  ·  UNIT 1  ·  INTERMEDIATE VALUE THEOREM"),
    ("orchestra", "Zeros as instruments", "SONIFICATION  ·  EACH ZERO IS AN INSTRUMENT, TUNED TO 10 × γ HZ"),
    ("balance", "One volume for all", "AP CALCULUS BC  ·  EXPONENTIAL AND LOGARITHM RULES   ·   EULER'S FORMULA"),
    ("primesync", "The primes, in sync", "AP CALCULUS BC  ·  UNIT 10  ·  PARTIAL SUMS OF A SERIES OF FUNCTIONS"),
    ("close", "", ""),
]

T_END = 60.0              # sweep along the critical line ends here
SWEEP_V = 1.2             # t-units per second after the first zero
X0, X1 = 2.0, 52.0        # sweep across the primes
PRIME_V = 2.0             # x-units per second


def main():
    lines = json.load(open(os.path.join(ROOT, "build/voice/lines.json")))
    math_d = json.load(open(os.path.join(ROOT, "data/math.json")))
    zeros = math_d["zeros"]
    jumps = math_d["psi"]["jumps"]

    now = 0.0
    scenes, starts = [], [None] * len(lines)
    orchestra, primesync = {}, {}
    for sid, title, tag in SCENES:
        mine = [m for m in lines if m["scene"] == sid]
        s0 = now
        if sid == "title":
            now += 3.6
        elif sid == "close":
            now += 1.6
        else:
            now += SCENE_PRE
        for k, m in enumerate(mine):
            cue = m.get("cue")
            if cue == "mid":
                # after the fifth zero has been heard
                now = max(now, orchestra["hits"][4]["time"] + 0.5)
            if cue == "after":
                now = max(now, orchestra["end"] + 2.6)
            starts[m["i"]] = round(now, 3)
            if cue == "sweep":
                # the wave starts with this line and reaches the first zero just after it
                t_first = now + m["dur"] + 0.9
                knots = [[now, 0.0], [t_first, zeros[0]], [t_first + (T_END - zeros[0]) / SWEEP_V, T_END]]
                hits = []
                for n, g in enumerate(zeros):
                    hits.append({"n": n + 1, "gamma": g, "freq": round(10 * g, 3),
                                 "time": round(t_first + (g - zeros[0]) / SWEEP_V, 4)})
                orchestra = {"start": round(now, 4), "knots": knots, "hits": hits, "end": round(knots[-1][0], 4)}
            if sid == "primesync" and k == 2:
                # the prime sweep starts with "At each prime ..."
                t0 = now
                events = [{"q": q, "p": p, "log_p": lp, "time": round(t0 + 0.6 + (q - X0) / PRIME_V, 4)}
                          for q, p, lp in jumps if X0 <= q <= X1]
                primesync = {"start": round(t0 + 0.6, 4), "end": round(t0 + 0.6 + (X1 - X0) / PRIME_V, 4),
                             "x0": X0, "x1": X1, "events": events}
            now += m["dur"] + GAP
        now -= GAP
        if sid == "orchestra":
            now = max(now, orchestra["end"] + 2.6)
        if sid == "primesync":
            now = max(now, primesync["end"] + 3.2)
        now += 7.5 if sid == "close" else SCENE_TAIL
        scenes.append({"id": sid, "title": title, "tag": tag, "start": round(s0, 3), "end": round(now, 3)})

    # cues shared by picture and sound
    by_id = {sc["id"]: sc for sc in scenes}
    st = {m["i"]: starts[m["i"]] for m in lines}
    bal = by_id["balance"]
    pulses = []
    k = st[42]
    while k < bal["end"] - 1.0:
        pulses.append(round(k, 4))
        k += 2.4
    cues = {
        # title: the critical line draws left to right; the first zero sounds as the line passes it
        "title_draw": [1.2, 4.2],
        "title_first_zero": round(1.2 + 3.0 * zeros[0] / T_END, 4),
        "balance_pulses": pulses,
        "hyp": [round(st[43] + 0.1, 4), st[44]],          # the hypothetical off-line zero swells here
        "recon_steps": [st[46] + 0.3, st[46] + lines[46]["dur"] - 0.2],
        "final_chord": round(by_id["close"]["end"] - 7.2, 4),
    }

    dur = math.ceil(now * FPS) / FPS
    tl = {
        "fps": FPS, "duration": dur, "frames": int(round(dur * FPS)),
        "scenes": scenes,
        "lines": [{"i": m["i"], "scene": m["scene"], "start": starts[m["i"]], "dur": m["dur"], "text": m["text"]}
                  for m in lines],
        "orchestra": orchestra, "primesync": primesync, "cues": cues,
    }
    os.makedirs(os.path.join(ROOT, "build"), exist_ok=True)
    json.dump(tl, open(os.path.join(ROOT, "build/timeline.json"), "w"), indent=1)
    for s in scenes:
        print(f"{s['id']:10s} {s['start']:7.2f} -> {s['end']:7.2f}  ({s['end'] - s['start']:5.1f}s)")
    print("zero hits:", [h["time"] for h in orchestra["hits"]])
    print("prime events:", len(primesync["events"]), primesync["start"], "->", primesync["end"])
    print(f"total {dur:.2f}s = {dur / 60:.2f} min, {tl['frames']} frames")


if __name__ == "__main__":
    main()
