"""Compute every number the video shows or plays, and check it.

Writes data/math.json. Run:  python3 src/math/compute.py [path/to/odlyzko_zeros.txt]

Everything here is computed from first principles with mpmath (arbitrary
precision). The optional zero table (the 100000zeroes.txt file from the
reimann-hypothesis-neural-network repo, originally Odlyzko's table) is used only
as an independent cross-check.
"""
import json
import math
import os
import sys
import time

import mpmath as mp
import numpy as np

mp.mp.dps = 30
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "data", "math.json")

N_INSTRUMENTS = 13          # zeros heard as instruments (all zeros with t < 60)
N_RECON = 1000              # zeros used to rebuild the prime staircase
RECON_STEPS = [1, 2, 3, 5, 10, 20, 50, 100, 300, 1000]
T_MAX = 62.0                # end of the critical-line sweep
X_MAX = 52.0                # end of the prime sweep


def primes_upto(n):
    sieve = np.ones(n + 1, dtype=bool)
    sieve[:2] = False
    for p in range(2, int(n ** 0.5) + 1):
        if sieve[p]:
            sieve[p * p::p] = False
    return [int(p) for p in np.nonzero(sieve)[0]]


def prime_powers_upto(n):
    """[(p^k, p)] sorted: where the Chebyshev psi function jumps, by log p."""
    out = []
    for p in primes_upto(n):
        q = p
        while q <= n:
            out.append((q, p))
            q *= p
    return sorted(out)


def psi_exact(x, pp):
    return sum(math.log(p) for q, p in pp if q <= x)


def main():
    t0 = time.time()
    check = {}

    # 1. Nontrivial zeros 1/2 + i*gamma_n, computed with mpmath
    zeros = [mp.zetazero(n) for n in range(1, N_RECON + 1)]
    assert all(abs(z.real - mp.mpf(1) / 2) < mp.mpf(10) ** -20 for z in zeros), "a zero left the line?"
    gammas = [float(z.imag) for z in zeros]
    check["zeros_computed"] = len(gammas)
    check["all_real_parts_half"] = True

    # Independent cross-check against the uploaded table (Odlyzko)
    table = sys.argv[1] if len(sys.argv) > 1 else None
    if table and os.path.exists(table):
        ref = [float(l) for _, l in zip(range(N_RECON), open(table))]
        diff = max(abs(a - b) for a, b in zip(gammas, ref))
        check["max_abs_diff_vs_table"] = diff
        assert diff < 1e-8, f"zero table disagrees: {diff}"

    # 2. Riemann-Siegel Z(t): real on the critical line, |Z(t)| = |zeta(1/2+it)|
    ts = np.round(np.arange(0.0, T_MAX + 1e-9, 0.02), 4)
    Z = [float(mp.siegelz(t)) for t in ts]
    # sign changes of Z must sit exactly at the first zeros (Intermediate Value Theorem)
    crossings = [float(ts[i]) for i in range(len(ts) - 1) if Z[i] * Z[i + 1] < 0]
    inside = [g for g in gammas if g < T_MAX]
    assert len(crossings) == len(inside), (crossings, inside)
    assert all(abs(c - g) < 0.021 for c, g in zip(crossings, inside))
    check["Z_sign_changes_match_zeros"] = len(crossings)
    check["Z0_equals_zeta_half"] = [Z[0], float(mp.zeta(0.5))]

    # 3. Explicit formula: psi(x) = x - sum_rho x^rho/rho - log(2 pi) - 1/2 log(1 - x^-2)
    #    each conjugate pair adds the wave  -2 sqrt(x)/|rho| cos(gamma ln x - arg rho)
    pp = prime_powers_upto(int(X_MAX) + 10)
    xs = np.round(np.arange(1.5, X_MAX + 1e-9, 0.02), 4)
    g = np.array(gammas)
    mod = np.sqrt(0.25 + g * g)
    arg = np.arctan2(g, 0.5)
    lx = np.log(xs)
    waves = -2.0 * np.sqrt(xs)[None, :] / mod[:, None] * np.cos(np.outer(g, lx) - arg[:, None])
    smooth = xs - math.log(2 * math.pi) - 0.5 * np.log(1 - xs ** -2.0)
    csum = np.cumsum(waves, axis=0)
    recon = {str(n): np.round(smooth + csum[n - 1], 4).tolist() for n in RECON_STEPS}
    # first single waves, for drawing them separately
    single = {str(n): np.round(waves[n - 1], 4).tolist() for n in range(1, N_INSTRUMENTS + 1)}
    errs = []
    for x0 in (10.5, 20.5, 30.5, 40.5, 50.5):
        i = int(round((x0 - 1.5) / 0.02))
        errs.append([x0, psi_exact(x0, pp), float(smooth[i] + csum[-1][i])])
    assert all(abs(a - b) < 0.35 for _, a, b in errs), errs
    check["explicit_formula_1000_zeros"] = errs

    # The bug in explicit_formula_verification.py (paper repo): it adds log(n) for
    # composite n that are not prime powers. psi(10) is 7.832, not 11.926.
    check["psi_10_true"] = psi_exact(10, pp)

    # 4. Prime counting pi(x) against x/ln x and Li(x)  (as in RH.py)
    P = primes_upto(10 ** 6)
    pi_small = [p for p in P if p <= 120]
    big = [10 ** k for k in range(2, 7)]
    pi_big = [[x, sum(1 for p in P if p <= x), x / math.log(x), float(mp.li(x) - mp.li(2))] for x in big]

    # 5. Series for the calculus chapter
    s2 = np.cumsum([1 / n ** 2 for n in range(1, 41)]).tolist()
    harm = np.cumsum([1 / n for n in range(1, 41)]).tolist()
    s = mp.mpc(1.5, 5)
    spiral, acc = [[0.0, 0.0]], mp.mpc(0)
    for n in range(1, 81):
        acc += mp.power(n, -s)
        spiral.append([float(acc.real), float(acc.imag)])
    zs = mp.zeta(s)
    check["spiral_end_vs_zeta"] = [spiral[-1], [float(zs.real), float(zs.imag)]]

    data = {
        "zeros": [round(x, 9) for x in gammas[:N_INSTRUMENTS]],
        "zeros_more": [round(x, 6) for x in gammas[:120]],
        "Z": {"t0": 0.0, "dt": 0.02, "v": [round(v, 5) for v in Z]},
        "psi": {
            "x0": 1.5, "dx": 0.02, "steps": RECON_STEPS, "recon": recon, "single": single,
            "jumps": [[q, p, math.log(p)] for q, p in pp if q <= X_MAX],
        },
        "pi": {"primes": pi_small, "big": pi_big},
        "series": {"p2": s2, "harmonic": harm, "pi2_6": math.pi ** 2 / 6,
                   "spiral": spiral, "spiral_s": [1.5, 5], "spiral_zeta": [float(zs.real), float(zs.imag)]},
        "check": check,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(data, open(OUT, "w"), separators=(",", ":"))
    print(json.dumps(check, indent=1))
    print(f"wrote {OUT} ({os.path.getsize(OUT) / 1e6:.2f} MB) in {time.time() - t0:.1f}s")


if __name__ == "__main__":
    main()
