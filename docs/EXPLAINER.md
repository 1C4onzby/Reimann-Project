# The Music of the Zeros: how the film works

A companion to `out/The_Music_of_the_Zeros.mp4` (8 min 45 s, 1920×1080, 30 fps,
stereo, English narration with an embedded subtitle track and a separate `.srt`).

The film turns the Riemann Hypothesis into an orchestra. Every nontrivial zero of
the zeta function becomes an instrument. A wave travels from left to right along
the critical line. When it reaches a zero, that instrument lights up, and every
instrument already lit strikes again with it, together, at the same volume.
Later, the same instruments rebuild the prime numbers.

It is a **translation into sound, not a proof**. The film says so, and so does
this document.

---

## 1. The story, scene by scene, and where it sits in AP Calculus BC

| # | Scene | What you see and hear | AP Calculus BC |
|---|---|---|---|
| 1 | Counting primes | The staircase π(x) for x ≤ 100, then x/ln x (Gauss) and Li(x) = ∫₂ˣ dt/ln t. An inset fills the area under 1/ln t as Li(x) is drawn. A readout at x = 10⁶: π = 78,498; x/ln x misses by 6,116; Li(x) misses by 129. | **Unit 6**: the definite integral as accumulation of a rate (here a density of primes, about 1/ln t). |
| 2 | The zeta function | ζ(s) = Σ 1/nˢ. Partial sums for s = 2 settle at π²/6 ≈ 1.6449; for s = 1 (harmonic series) they track ln N + 0.5772 and never settle. Inset: bars 1/n² under the curve 1/x². | **Unit 10**: p-series test, harmonic series, integral test; **Unit 6**: improper integrals ∫₁^∞ dx/xˢ = 1/(s−1). |
| 3 | Euler's product | 1/(1−p⁻ˢ) = 1 + p⁻ˢ + p⁻²ˢ + …; tiles 1 to 30 with their prime factorizations; Σ 1/nˢ = Π 1/(1−p⁻ˢ). | **Unit 10**: geometric series a/(1−r). Unique factorization makes each n appear once. |
| 4 | Complex exponents | s = σ + it; e^{iθ} = cos θ + i sin θ on the unit circle; n⁻ˢ = n^{−σ} e^{−it ln n} as an arrow of length n^{−σ} and angle −t ln n; the arrows for s = 1.5 + 5i spiral in to ζ(1.5 + 5i) ≈ 0.810 + 0.134i. | **Unit 10**: Maclaurin series of eˣ, sin x, cos x give Euler's formula. **Unit 9**: polar form (length and angle). |
| 5 | The critical line | Partial sums of 1 + x + x² + … agree with 1/(1−x) only on (−1, 1), yet 1/(1−x) exists everywhere except x = 1. Zeta extends the same way (analytic continuation). Trivial zeros at −2, −4, −6; the critical strip; 13 zeros on σ = ½; more than ten trillion checked. | **Unit 10**: interval of convergence. Analytic continuation itself is beyond BC; the geometric series is the BC-level picture of it. |
| 6 | Walking the line | The line turns on its side. The Riemann–Siegel function Z(t), real valued with \|Z(t)\| = \|ζ(½+it)\|, is drawn for 0 ≤ t ≤ 60. Z(a) < 0 < Z(b) forces a zero between: 13 sign changes, 13 zeros expected. | **Unit 1**: the Intermediate Value Theorem (Z is continuous). |
| 7 | Zeros as instruments | The sonification sweep. 13 instruments light up one by one; synchronized strikes at each zero. | (the sonification; see section 2) |
| 8 | One volume for all | The explicit formula; x^{½+iγ} = √x · e^{iγ ln x}; each zero's wave −2√x/\|ρ\| · cos(γ ln x − arg ρ). Thirteen equal meters; a hypothetical zero at σ = ¾ grows louder. | Exponent and logarithm rules (**Units 2–3** use eˣ and ln x throughout); Euler's formula again. |
| 9 | The primes, in sync | Adding 1, 2, 3, 5, … 1,000 zero-waves turns a smooth curve into the prime staircase ψ(x). A playhead sweeps x from 2 to 52; at every prime and prime power the staircase jumps and all instruments strike together. | **Unit 10**: partial sums of a series (here a series of functions). |
| 10 | Close | The BC tools used, and an honest ending. | |

---

## 2. The sonification: what each sound means

**Each zero is an instrument.** Zero number n is ½ + iγₙ. Its instrument is tuned to
exactly **fₙ = 10 γₙ Hz**, so the first zero (γ₁ = 14.1347) sounds at 141.35 Hz. Pitch
is proportional to γ because, in the explicit formula, γ is literally the frequency
of that zero's wave in the variable ln x. The resulting pitches are not a familiar
musical scale: they are the zeta function's own tuning.

| n | γₙ | Instrument | Target Hz | Measured Hz | Error |
|---|---|---|---|---|---|
| 1 | 14.134725 | Cello | 141.35 | 141.27 | −1.0 ¢ |
| 2 | 21.022040 | Harp | 210.22 | 210.18 | −0.3 ¢ |
| 3 | 25.010858 | French horn | 250.11 | 250.22 | +0.7 ¢ |
| 4 | 30.424876 | Vibraphone | 304.25 | 304.36 | +0.6 ¢ |
| 5 | 32.935062 | Clarinet | 329.35 | 329.31 | −0.2 ¢ |
| 6 | 37.586178 | Viola | 375.86 | 375.81 | −0.3 ¢ |
| 7 | 40.918719 | Marimba | 409.19 | 409.07 | −0.5 ¢ |
| 8 | 43.327073 | Flute | 433.27 | 433.40 | +0.5 ¢ |
| 9 | 48.005151 | Celesta | 480.05 | 479.87 | −0.7 ¢ |
| 10 | 49.773832 | Oboe | 497.74 | 497.70 | −0.1 ¢ |
| 11 | 52.970321 | Piano | 529.70 | 529.98 | +0.9 ¢ |
| 12 | 56.446248 | Violin | 564.46 | 564.23 | −0.7 ¢ |
| 13 | 59.347044 | Tubular bells | 593.47 | 596.40 | +8.5 ¢ |

(1 cent = 1/100 of a semitone; about 5 ¢ is the smallest pitch difference most
listeners notice. A tubular bell has no single clear fundamental, which is why
its reading is the least precise.) The current values are always in
`build/audio/report.json` after a build.

**The same volume.** Every instrument is matched to the same loudness, −20 LUFS
(ITU-R BS.1770 K-weighted loudness, measured on each note; spread 0.0 LU). This
stands for the mathematical heart of the hypothesis: each zero's wave grows like
x raised to the zero's real part, and on the critical line that real part is ½
for every zero. Equal real parts, equal growth, equal volume.

**The wave, left to right.** During the sweep a voice glides at 10·t Hz while the
playhead moves along the line. Its loudness follows |Z(t)|, so it swells and
fades like the wave on screen, and it is panned from the left ear to the right
with the playhead. At each zero, |Z| = 0: the glide falls silent exactly where it
reaches the zero's own pitch, and that instrument takes over.

**Synchronized.** At each zero, the newly lit instrument and every instrument
already lit start on the same instant. Struck instruments (harp, vibraphone,
marimba, celesta, piano, bells) sound within a few milliseconds of their start.
Bowed and blown ones need longer to speak (a bowed cello note takes about 240 ms
to reach half volume), so each is started early by its measured attack time, the
time its envelope needs to reach −12 dB of its peak (cello 136 ms, violin 66 ms,
viola 61 ms, flute 24 ms, horn 23 ms). Their audible onset then lands on the
zero with the struck instruments, and the note swells into the strike. During
the prime sweep all thirteen strike together at every prime power, panned to
where the playhead is.

**The counterfactual.** In scene 8 a hypothetical zero at real part ¾ (a trumpet
at 350 Hz) swells by up to +20 dB over the balanced chord: the ratio x^{¾}/x^{½}
= x^{¼} as x runs from 1 to 10⁴. No such zero has ever been found.

---

## 3. The mathematics, checked

Every number in the film is computed, not copied (`src/math/compute.py`):

- **Zeros**: the first 1,000 nontrivial zeros, computed with `mpmath.zetazero` at 30
  digits; every real part is ½ to 20 digits. They agree with the uploaded table
  (`100000zeroes.txt`, A. Odlyzko's values) to within 5×10⁻¹⁰, the table's own precision.
- **Z(t)**: computed with `mpmath.siegelz` on 0 ≤ t ≤ 62; Z(0) = ζ(½) = −1.4603545.
  Its sign changes land within 0.02 of the zeros (14 below t = 62, 13 below t = 60).
- **Explicit formula**: ψ(x) = x − Σ_ρ x^ρ/ρ − ln 2π − ½ ln(1 − x⁻²), summing each
  conjugate pair as −2√x/|ρ| · cos(γ ln x − arg ρ). With 1,000 zeros it matches the
  true ψ(x) at x = 10.5, 20.5, 30.5, 40.5, 50.5 to within 0.02.
- **Prime counts**: π(10⁶) = 78,498 (sieve); Li(10⁶) = ∫₂^{10⁶} dt/ln t = 78,626.5;
  x/ln x = 72,382.4.
- **Facts in the narration**: Riemann's paper (1859); the p-series and integral
  tests; ζ(2) = π²/6; H_N ≈ ln N + 0.5772; Euler's product; trivial zeros at the
  negative even integers; all nontrivial zeros in 0 < σ < 1; more than 10¹³ zeros
  verified on the line (Gourdon 2004; Platt and Trudgian 2021, to height 3×10¹²);
  RH ⇔ π(x) = Li(x) + O(√x ln x) (von Koch 1901); "very close pairs are rare" is
  the observed repulsion of zeros (Montgomery's pair correlation, Odlyzko's data),
  stated in the film with "seem to".

The narration was transcribed back with an offline speech recognizer
(`src/audio/asr_check.py`) to confirm every line is spoken as written.

### Checks on the finished film (`src/verify.py`, run on the MP4 itself)

| Check | Result |
|---|---|
| Video | H.264, 1920×1080, 30 fps, 525.13 s (matches the timeline) |
| Audio | AAC, 48 kHz stereo; −16.0 LUFS integrated, −1.6 dBTP true peak |
| Subtitles | one English track embedded, plus `out/The_Music_of_the_Zeros.srt` |
| Picture sync | in decoded frames, each of the 13 nodes is dark 0.1 s before its zero and lit 0.1 s after |
| Sound sync | the MP4 soundtrack sits 0.00 ms from the mix; struck-instrument onsets at zeros 2–13 fall within ±1.2 ms of the zero times |
| Tuning | 12 of 13 instruments within ±1 cent of 10γ Hz; tubular bells +8.5 cents |
| Loudness match | all 13 instruments at −20.00 LUFS (spread 0.0 LU) |
| Narration | transcribed back from the final mix, music included: no line less intelligible than the clean voice |

---

## 4. About the uploaded Riemann repositories

All five were read. What each contributed:

- **reimann-hypothesis-neural-network**: its `100000zeroes.txt` is used as the
  independent check on the computed zeros. (The neural network itself predicts
  zeros by curve fitting; that cannot say anything about the hypothesis, so it is
  not part of the film.)
- **Reimann-Hypothesis (RH.py)**: π(x) against x/ln x is the film's first scene,
  extended with Li(x), which is the comparison the hypothesis is actually about.
- **reimann-hypothesis (paper repo)**: the explicit formula and the idea that each
  zero contributes a wave are the backbone of scenes 8 and 9. One correction:
  `explicit_formula_verification.py` adds log n for composite numbers that are not
  prime powers (for example 6 and 10), so it reports ψ(10) = 11.93 instead of
  7.83, and its large "discrepancies" come from that bug, not from the formula.
  With ψ computed correctly the formula agrees closely (section 3). The paper's
  claim that its framework proves the spectrum equals the zeros is not an accepted
  proof; the film states that no proof is known.
- **REIMANN-HYPOTHESIS (λ-artifact essay)**: a philosophical essay arguing the
  hypothesis is undecidable. That is not established mathematics, so the film does
  not use it.
- **Reimann-hypothesis-**: a README only.

---

## 5. Rebuilding the film

```bash
bash setup.sh           # FluidSynth + SoundFont, Python and Node packages, the Kokoro voice model
bash build.sh           # math, voice, timeline, orchestra + mix, picture, final mux
```

`SKIP_MATH=1` reuses the committed `data/math.json`. `node src/render/render.mjs stills 330,352`
renders single frames for checking. The whole pipeline is deterministic, and picture and
sound read one shared timeline (`build/timeline.json`), so they cannot drift apart.

Credits: zeros computed with mpmath; checked against A. Odlyzko's table. Narration:
Kokoro TTS (voice am_michael), via kokoro-onnx. Instruments: FluidR3 General MIDI
SoundFont (MIT), rendered with FluidSynth. Equations: MathJax. Type: Inter, Inter
Tight and JetBrains Mono (SIL Open Font License). Rendering: Chromium via Playwright, ffmpeg.
