# Reimann-Project

A repository directed at visualising and investigating the Riemann Hypothesis.

## The Music of the Zeros

An 8 min 45 s film (1920×1080, English narration, subtitles) for an AP Calculus BC
project. Every nontrivial zero of the zeta function becomes a musical instrument,
tuned to ten times its height in hertz and matched to the same loudness. A wave
travels from left to right along the critical line; as it reaches each zero, that
instrument lights up and every lit instrument strikes again, together, at the same
volume. Later the same instruments rebuild the prime numbers through Riemann's
explicit formula.

Along the way the film walks through the calculus it rests on: the p-series and
integral tests, geometric series, Maclaurin series and Euler's formula, polar form,
the Intermediate Value Theorem, logarithms, and integrals as accumulation.

- **How it works, scene by scene, with the BC curriculum mapping and every check:** [`docs/EXPLAINER.md`](docs/EXPLAINER.md)
- **Narration script:** [`narration/script.json`](narration/script.json)
- **Subtitles:** `out/The_Music_of_the_Zeros.srt`

### Build it

```bash
bash setup.sh      # FluidSynth + SoundFont, Python and Node packages, the Kokoro voice model
bash build.sh      # -> out/The_Music_of_the_Zeros.mp4
```

| Step | Code | What it does |
|---|---|---|
| math | `src/math/compute.py` | zeros, Z(t), explicit formula, prime counts, all checked |
| voice | `src/audio/voice.py` | calm male narrator, offline (Kokoro, `am_michael`) |
| timeline | `src/timeline.py` | one schedule for picture and sound |
| orchestra | `src/audio/score.py` | instruments, the wave, synchronized strikes, mix |
| picture | `src/render/` | canvas scenes rendered in Chromium, MathJax equations |
| finish | `src/finish.py` | subtitles, loudness normalization, final MP4 |

The film is a translation into sound, not a proof. The Riemann Hypothesis remains open.
