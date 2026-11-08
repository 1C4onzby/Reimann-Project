'use strict';
/* The eleven scenes. Each is a pure function of film time T (seconds).
   Beats are tied to narration line starts L(i), so picture follows the voice. */

const S = {};
const P = {};   // precomputed data

/* geometry of the critical-line view, shared by "zline", "orchestra" and the title */
const OX = t => M + (W - 2 * M) * t / 60;
const AXY = 560, ZA = 62;

function Zat(t) {
  const z = D.Z, i = (t - z.t0) / z.dt, k = Math.floor(i);
  if (k < 0) return z.v[0];
  if (k >= z.v.length - 1) return z.v[z.v.length - 1];
  return lerp(z.v[k], z.v[k + 1], i - k);
}
function interp(x, xs, ys) {
  if (x <= xs[0]) return ys[0];
  for (let i = 0; i < xs.length - 1; i++) if (x <= xs[i + 1]) return lerp(ys[i], ys[i + 1], (x - xs[i]) / (xs[i + 1] - xs[i]));
  return ys[ys.length - 1];
}
const sweepT = T => interp(T, TL.orchestra.knots.map(k => k[0]), TL.orchestra.knots.map(k => k[1]));
const primeX = T => { const p = TL.primesync; return lerp(p.x0, p.x1, clamp((T - p.start) / (p.end - p.start))); };

function clipX(xpx, fn) { ctx.save(); ctx.beginPath(); ctx.rect(0, 0, xpx, H); ctx.clip(); fn(); ctx.restore(); }
function clipRect(x0, y0, x1, y1, fn) { ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, x1 - x0, y1 - y0); ctx.clip(); fn(); ctx.restore(); }

function arrow(x0, y0, x1, y1, o = {}) {
  line(x0, y0, x1, y1, o);
  const L2 = Math.hypot(x1 - x0, y1 - y0), h = Math.min(o.head ?? 12, L2 * 0.45);
  if (h < 2) return;
  const a = Math.atan2(y1 - y0, x1 - x0);
  alpha(o.a ?? 1);
  ctx.fillStyle = o.color || C.ink;
  ctx.beginPath(); ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - h * Math.cos(a - 0.38), y1 - h * Math.sin(a - 0.38));
  ctx.lineTo(x1 - h * Math.cos(a + 0.38), y1 - h * Math.sin(a + 0.38));
  ctx.closePath(); ctx.fill();
}

/* "12" -> [["2","2"],["3",""]] drawn as 2²·3 with real superscripts */
function factor(n) { const f = []; for (let p = 2; p <= n; p++) { let k = 0; while (n % p === 0) { n /= p; k++; } if (k) f.push([String(p), k > 1 ? String(k) : '']); } return f; }
function drawFactor(n, x, y, o) {
  if (n === 1) { text('1', x, y, { font: F.monoS, color: C.muted, align: 'center', a: o.a }); return; }
  const parts = factor(n);
  ctx.font = F.monoS;
  let w = 0; parts.forEach(([b, e], i) => { w += textW(b, F.monoS) + (e ? textW(e, '500 11px "JetBrains Mono"') + 1 : 0) + (i < parts.length - 1 ? textW('·', F.monoS) : 0); });
  let cx = x - w / 2;
  parts.forEach(([b, e], i) => {
    text(b, cx, y, { font: F.monoS, color: C.muted, a: o.a }); cx += textW(b, F.monoS);
    if (e) { text(e, cx + 1, y - 7, { font: '500 11px "JetBrains Mono"', color: C.muted, a: o.a }); cx += textW(e, '500 11px "JetBrains Mono"') + 1; }
    if (i < parts.length - 1) { text('·', cx, y, { font: F.monoS, color: C.muted, a: o.a }); cx += textW('·', F.monoS); }
  });
}

window.SCENES_INIT = () => {
  // Li(x) = int_2^x dt / ln t, by the trapezoid rule
  P.li = [[2, 0]]; let acc = 0;
  for (let x = 2.05; x <= 100.0001; x += 0.05) { acc += 0.05 * 0.5 * (1 / Math.log(x - 0.05) + 1 / Math.log(x)); P.li.push([x, acc]); }
  P.primes = D.pi.primes.filter(p => p <= 100);
  const sp = D.series.spiral;
  P.spiral = sp;
  // psi exact staircase up to 52
  P.psiSteps = [[0, 0]]; let ps = 0;
  for (const [q, p, lp] of D.psi.jumps) { P.psiSteps.push([q, ps]); ps += lp; P.psiSteps.push([q, ps]); }
  P.psiSteps.push([52, ps]);
  P.psiAt = x => { let s = 0; for (const [q, p, lp] of D.psi.jumps) if (q <= x) s += lp; return s; };
};

/* ================================================================ title */
S.title = (T, sc) => {
  const end = sc.end;
  text('The Music of the Zeros', W / 2, 430, { font: F.hero, align: 'center', ls: '-2px', a: fin(T, 0.3, 1.6) });
  text('The Riemann Hypothesis, heard through the tools of AP Calculus BC', W / 2, 498,
    { font: '500 28px Inter', color: C.muted, align: 'center', a: fin(T, 1.0, 1.4) });
  const [d0, d1] = TL.cues.title_draw, p = clamp((T - d0) / (d1 - d0));
  const y = 650;
  line(M, y, lerp(M, W - M, p), y, { color: C.amber, w: 2 });
  D.zeros.forEach((g, i) => {
    if (p * 60 < g) return;
    if (i > 0) circle(OX(g), y, 4.5, { stroke: C.muted, w: 1.5, fill: C.bg });
  });
  const tz = TL.cues.title_first_zero, x1 = OX(D.zeros[0]);
  if (T >= tz) {
    const e = T - tz;
    glow(x1, y, 54, C.glow, 0.45 * Math.exp(-e * 1.3) + 0.16);
    circle(x1, y, 10 + 80 * easeOut(e / 1.6), { stroke: C.glow, w: 1.5, a: 0.7 * (1 - clamp(e / 1.6)) });
    circle(x1, y, 6.5, { fill: C.glow });
  }
  const k = fin(T, d1, 0.8);
  text('the critical line, σ = ½', M, y + 44, { font: F.monoS, color: C.muted, a: k });
  text('t = 60', W - M, y + 44, { font: F.monoS, color: C.muted, align: 'right', a: k });
  text('first zero, t = 14.1347', x1, y - 30, { font: F.monoS, color: C.ink2, align: 'center', a: fin(T, tz + 0.3, 0.8) });
};

/* ================================================================ primes: pi(x), x/ln x, Li(x) */
S.primes = (T, sc) => {
  const k2 = L(2), k3 = L(3), k4 = L(4), k5 = L(5), k6 = L(6), k7 = L(7);
  const a0 = fin(T, sc.start + 0.4, 0.8);
  const { X, Y } = chart({ x0: 0, x1: 100, y0: 0, y1: 30, px0: M, px1: 1180, py0: 900, py1: 300,
    xt: [0, 20, 40, 60, 80, 100], yt: [0, 10, 20, 30], xl: 'x', a: a0 });
  // primes appear on the axis, one by one
  const n = P.primes.length;
  P.primes.forEach((p, i) => {
    const ti = k2 + 0.4 + i * (LD(2) - 0.8) / n;
    if (T < ti) return;
    const e = T - ti;
    circle(X(p), Y(0), 5, { fill: C.amber, a: fin(T, ti, 0.25) });
    circle(X(p), Y(0), 5 + 18 * easeOut(e / 0.6), { stroke: C.amber, w: 1.2, a: 0.6 * (1 - clamp(e / 0.6)) });
  });
  text('primes up to 100', M, 940, { font: F.monoS, color: C.muted, a: vis(T, k2 + 0.3, k3 + 0.6) });
  // pi(x) staircase
  const stair = [[0, 0]]; let c = 0;
  for (const p of P.primes) { stair.push([X(p), Y(c)]); c++; stair.push([X(p), Y(c)]); }
  stair[0] = [X(0), Y(0)]; stair.push([X(100), Y(c)]);
  const ps = ease(prog(T, k3 + 0.5, 3.4));
  if (ps > 0) clipX(lerp(X(0), X(100), ps) + 1, () => path(stair, { color: C.ink, w: 2.5 }));
  // x / ln x (blue)
  const gl = ease(prog(T, k4 + 0.42 * LD(4), 3.0));
  const xl = []; for (let x = 2; x <= 100; x += 0.5) xl.push([X(x), Y(x / Math.log(x))]);
  if (gl > 0) clipX(lerp(X(2), X(100), gl) + 1, () => path(xl, { color: C.blue, w: 2 }));
  // Li(x) (amber), drawn while the integral accumulates in the inset
  const t5 = k5 + 0.55 * LD(5), li = ease(prog(T, t5, 3.6));
  const lp = P.li.filter((_, i) => i % 4 === 0).map(([x, v]) => [X(x), Y(v)]);
  if (li > 0) clipX(lerp(X(2), X(100), li) + 1, () => path(lp, { color: C.amber, w: 2 }));
  // legend: always present for >= 2 series
  let lx = M; const ly = 262;
  lx += key(lx, ly, C.ink, 'π(x), prime count', { a: fin(T, k3 + 0.5) }) + 30;
  lx += key(lx, ly, C.blue, 'x / ln x', { a: fin(T, k4 + 0.42 * LD(4)) }) + 30;
  key(lx, ly, C.amber, 'Li(x)', { a: fin(T, t5) });

  // right panel
  const R = 1290;
  const panelOut = 1 - fin(T, k6 - 0.2, 0.6);
  tex('pi_def', R, 300, { a: fin(T, k3 + 0.6) * panelOut });
  tex('xlnx', R, 380, { a: fin(T, k4 + 0.42 * LD(4)) * panelOut });
  text('Gauss', R + 90, 418, { font: F.small, color: C.muted, a: fin(T, k4 + 0.42 * LD(4)) * panelOut });
  tex('li', R, 470, { a: fin(T, k5 + 0.3 * LD(5)) * panelOut });
  // inset: area under 1/ln t accumulates up to the current x of the Li curve
  const ia = fin(T, k5 + 0.25 * LD(5)) * panelOut;
  if (ia > 0) {
    const I = chart({ x0: 0, x1: 100, y0: 0, y1: 1.6, px0: R + 30, px1: 1760, py0: 860, py1: 640, xt: [2, 100], yt: [], a: ia });
    const xc = lerp(2, 100, li);
    alpha(ia * 0.28); ctx.fillStyle = C.amber; ctx.beginPath(); ctx.moveTo(I.X(2), I.Y(0));
    for (let t = 2; t <= xc; t += 0.5) ctx.lineTo(I.X(t), I.Y(1 / Math.log(t)));
    ctx.lineTo(I.X(xc), I.Y(1 / Math.log(Math.max(2, xc)))); ctx.lineTo(I.X(xc), I.Y(0)); ctx.closePath(); ctx.fill();
    const cv = []; for (let t = 2; t <= 100; t += 0.5) cv.push([I.X(t), I.Y(1 / Math.log(t))]);
    path(cv, { color: C.ink, w: 1.5, a: ia });
    tex('inv_ln', I.X(30), 650, { a: ia });
    text('area so far: Li(' + Math.round(xc) + ') = ' + interp(xc, P.li.map(p => p[0]), P.li.map(p => p[1])).toFixed(1),
      R + 30, 900, { font: F.monoS, color: C.ink2, a: ia * (li > 0 ? 1 : 0) });
  }
  // readout at one million
  const big = D.pi.big[D.pi.big.length - 1];
  const rows = [
    ['x', fmt(big[0]), '', k6 + 0.2],
    ['π(x)', fmt(big[1]), '', k6 + 0.25 * LD(6)],
    ['x / ln x', fmt(big[2]), '−' + fmt(big[1] - big[2]), k6 + 0.5 * LD(6)],
    ['Li(x)', fmt(big[3]), '+' + fmt(big[3] - big[1]), k6 + 0.74 * LD(6)],
  ];
  rows.forEach(([a, b, c2, t0], i) => {
    const y = 330 + i * 62, k = fin(T, t0);
    text(a, R, y, { font: F.monoL, color: C.muted, a: k });
    text(b, R + 290, y, { font: F.monoL, color: C.ink, align: 'right', a: k });
    if (c2) text(c2, 1760, y, { font: F.monoL, color: i === 3 ? C.ink : C.ink2, align: 'right', a: k });
  });
  text('MISS', 1760, 300 - 6, { font: F.tag, color: C.muted, align: 'right', ls: '2px', a: fin(T, k6 + 0.5 * LD(6)) });
  line(R, 300 + 4 * 62 - 22, 1760, 300 + 4 * 62 - 22, { color: C.faint, a: fin(T, k7) });
  text('RIEMANN HYPOTHESIS', R, 610, { font: F.tag, color: C.muted, ls: '2px', a: fin(T, k7 + 0.2) });
  tex('rh_pi', R, 630, { a: fin(T, k7 + 0.4), scale: 0.98 });
};

/* ================================================================ series: p-series, harmonic, integral test */
S.series = (T, sc) => {
  const k8 = L(8), k10 = L(10), k11 = L(11), k12 = L(12), k13 = L(13);
  tex('zeta_sum', M, 190, { a: fin(T, k8 + 1.0) });
  const ca = fin(T, k10 - 0.3);
  const { X, Y } = chart({ x0: 0, x1: 41, y0: 0, y1: 4.5, px0: M, px1: 1180, py0: 950, py1: 470,
    xt: [1, 10, 20, 30, 40], yt: [0, 1, 2, 3, 4], xl: 'N terms', yl: 'partial sum', a: ca });
  // pi^2/6 reference
  const ra = fin(T, k11 + 2.6);
  line(X(0), Y(D.series.pi2_6), X(41), Y(D.series.pi2_6), { color: C.muted, w: 1, dash: [6, 6], a: ra });
  text('π²/6 = 1.6449…', X(41), Y(D.series.pi2_6) - 12, { font: F.monoS, color: C.ink2, align: 'right', a: ra });
  // s = 2 partial sums
  D.series.p2.forEach((v, i) => {
    const ti = k11 + 0.3 + i * 0.06; if (T < ti) return;
    circle(X(i + 1), Y(v), 4.5, { fill: C.amber, a: fin(T, ti, 0.2) });
  });
  // harmonic partial sums
  D.series.harmonic.forEach((v, i) => {
    const ti = k12 + 0.4 + i * 0.09; if (T < ti) return;
    circle(X(i + 1), Y(v), 4.5, { fill: C.blue, a: fin(T, ti, 0.2) });
  });
  const la = fin(T, k12 + 5.0);
  const lnN = []; for (let x = 1; x <= 41; x += 0.25) lnN.push([X(x), Y(Math.log(x) + 0.5772)]);
  path(lnN, { color: C.muted, w: 1.2, dash: [5, 6], a: la });
  text('ln N + 0.5772', X(41), Y(Math.log(41) + 0.5772) - 14, { font: F.monoS, color: C.ink2, align: 'right', a: la });
  let lx = M; const ly = 400;
  lx += key(lx, ly, C.amber, 's = 2  (converges)', { dot: true, a: fin(T, k11 + 0.3) }) + 34;
  key(lx, ly, C.blue, 's = 1  (harmonic series, diverges)', { dot: true, a: fin(T, k12 + 0.4) });

  const R = 1290;
  tex('pseries', R, 196, { a: fin(T, k10 + 0.4), scale: 0.95 });
  tex('zeta2', R, 330, { a: fin(T, k11 + 0.4), scale: 0.95 });
  tex('harm', R, 440, { a: fin(T, k12 + 0.5), scale: 0.95 });
  tex('integral', R, 586, { a: fin(T, k13 + 0.4), scale: 0.95 });
  // integral test inset: rectangles 1/n^2 on [n-1, n] sit under y = 1/x^2
  const ia = fin(T, k13 + 1.2);
  if (ia > 0) {
    const I = chart({ x0: 0.6, x1: 9.4, y0: 0, y1: 1.1, px0: R + 20, px1: 1760, py0: 960, py1: 700, xt: [1, 3, 5, 7, 9], yt: [], a: ia });
    for (let n = 2; n <= 9; n++) {
      const kk = fin(T, k13 + 1.4 + (n - 2) * 0.18, 0.3) * ia;
      alpha(kk * 0.55); ctx.fillStyle = C.blue;
      const x0 = I.X(n - 1) + 1, x1 = I.X(n) - 1, y = I.Y(1 / (n * n));
      ctx.fillRect(x0, y, x1 - x0, I.Y(0) - y);
    }
    const cv = []; for (let x = 0.75; x <= 9.4; x += 0.05) cv.push([I.X(x), I.Y(Math.min(1.1, 1 / (x * x)))]);
    path(cv, { color: C.ink, w: 1.8, a: ia });
    text('bars 1/n², curve 1/x²', I.X(9.4), 728, { font: F.monoS, color: C.ink2, align: 'right', a: ia });
  }
};

/* ================================================================ Euler product */
S.euler = (T, sc) => {
  const k14 = L(14), k15 = L(15), k16 = L(16), k17 = L(17);
  const out = 1 - fin(T, k17, 0.6);
  tex('zeta_sum_s', W / 2, 200, { align: 'center', a: vis(T, k14 + 0.2, k15 + 0.3) });
  tex('geo', W / 2, 205, { align: 'center', a: fin(T, k15 + 0.7) * out });
  tex('geo2', W / 2, 340, { align: 'center', a: fin(T, k15 + 0.55 * LD(15)) * out });
  tex('geo3', W / 2, 430, { align: 'center', a: fin(T, k15 + 0.72 * LD(15)) * out });
  tex('euler', W / 2, 270, { align: 'center', a: fin(T, k17 + 0.2, 0.8) });
  text('sum over all whole numbers', W / 2 - 160, 460, { font: F.monoS, color: C.muted, align: 'center', a: fin(T, k17 + 1.4) });
  text('product over all primes', W / 2 + 175, 460, { font: F.monoS, color: C.muted, align: 'center', a: fin(T, k17 + 1.8) });
  // tiles: every whole number, built once from primes
  const tw = 140, th = 96, gap = 13, cols = 10, x0 = (W - (cols * tw + (cols - 1) * gap)) / 2, y0 = 590;
  const dim = 1 - 0.45 * fin(T, k17, 0.8);
  for (let n = 1; n <= 30; n++) {
    const i = n - 1, cx = x0 + (i % cols) * (tw + gap), cy = y0 + Math.floor(i / cols) * (th + gap);
    const ti = k16 + 0.5 + i * (LD(16) - 1.5) / 30, a = fin(T, ti, 0.4) * dim;
    if (a <= 0) continue;
    alpha(a); ctx.fillStyle = '#101317'; ctx.beginPath(); ctx.roundRect(cx, cy + (1 - fin(T, ti, 0.4)) * 10, tw, th, 6); ctx.fill();
    const isP = factor(n).length === 1 && factor(n)[0][1] === '' && n > 1;
    if (isP) circle(cx + tw - 14, cy + 14, 4, { fill: C.amber, a });
    text(String(n), cx + tw / 2, cy + 50, { font: '700 34px "Inter Tight"', color: C.ink, align: 'center', a });
    drawFactor(n, cx + tw / 2, cy + 80, { a });
  }
  key(x0, y0 + 3 * (th + gap) + 30, C.amber, 'prime', { dot: true, a: fin(T, k16 + 1.0) * dim });
};

/* ================================================================ complex exponent, Euler's formula, spiral */
S.complex = (T, sc) => {
  const k18 = L(18), k19 = L(19), k20 = L(20), k21 = L(21);
  const R = 1060;
  tex('s_def', R, 210, { a: fin(T, k18 + 0.3) });
  tex('maclaurin', R, 300, { a: fin(T, k19 + 0.3) });
  tex('eulerf', R, 400, { a: fin(T, k19 + 0.62 * LD(19)) });
  tex('term', R, 500, { a: fin(T, k20 + 0.3) });
  tex('polar', R, 580, { a: fin(T, k20 + 0.5 * LD(20)) });
  tex('spiral_val', R, 700, { a: fin(T, k21 + 0.62 * LD(21)), color: 'ink' });
  text('POLAR FORM: LENGTH r, ANGLE θ', R, 650, { font: F.tag, color: C.muted, ls: '2px', a: fin(T, k20 + 0.5 * LD(20)) });

  // A1: the s-plane with one point
  const a1 = vis(T, k18 + 0.2, k19 + 0.4);
  if (a1 > 0) {
    const ox = 330, oy = 880, u = 95, sx = ox + 1.5 * u, sy = oy - 5 * u;
    line(ox - 120, oy, ox + 3.6 * u, oy, { color: C.faint, w: 1.5, a: a1 });
    line(ox, oy + 40, ox, oy - 6.4 * u, { color: C.faint, w: 1.5, a: a1 });
    text('σ  (real part)', ox + 3.6 * u, oy + 32, { font: F.monoS, color: C.muted, align: 'right', a: a1 });
    text('t  (imaginary part)', ox + 12, oy - 6.4 * u + 4, { font: F.monoS, color: C.muted, a: a1 });
    line(sx, sy, sx, oy, { color: C.muted, w: 1, dash: [5, 5], a: a1 });
    line(ox, sy, sx, sy, { color: C.muted, w: 1, dash: [5, 5], a: a1 });
    glow(sx, sy, 34, C.glow, 0.3 * a1); circle(sx, sy, 6, { fill: C.glow, a: a1 });
    text('s = 1.5 + 5i', sx + 16, sy - 12, { font: F.mono, color: C.ink, a: a1 });
    text('1.5', sx, oy + 28, { font: F.monoS, color: C.ink2, align: 'center', a: a1 });
    text('5', ox - 12, sy + 5, { font: F.monoS, color: C.ink2, align: 'right', a: a1 });
  }
  // A2: unit circle, e^{i theta}
  const a2 = vis(T, k19 + 0.4, k20 + 0.4);
  if (a2 > 0) {
    const cx = 540, cy = 600, r = 230, th = 0.5 * Math.max(0, T - (k19 + 0.6 * LD(19))) + 0.7;
    line(cx - r - 40, cy, cx + r + 40, cy, { color: C.faint, w: 1.5, a: a2 });
    line(cx, cy + r + 40, cx, cy - r - 40, { color: C.faint, w: 1.5, a: a2 });
    circle(cx, cy, r, { stroke: C.muted, w: 1.2, a: a2 });
    const px = cx + r * Math.cos(th), py = cy - r * Math.sin(th);
    line(cx, cy, px, cy, { color: C.blue, w: 3, a: a2 });
    line(px, cy, px, py, { color: C.amber, w: 3, a: a2 });
    arrow(cx, cy, px, py, { color: C.ink, w: 2.5, a: a2, head: 16 });
    alpha(a2); ctx.strokeStyle = C.ink2; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(cx, cy, 46, -(th % (2 * Math.PI)), 0); ctx.stroke();
    text('θ', cx + 58 * Math.cos(th / 2 % Math.PI), cy - 58 * Math.sin(th / 2 % Math.PI) + 6, { font: '600 22px Inter', color: C.ink, align: 'center', a: a2 });
    text('cos θ', (cx + px) / 2, cy + (Math.sin(th) >= 0 ? 30 : -14), { font: F.mono, color: C.ink2, align: 'center', a: a2 });
    text('sin θ', px + (Math.cos(th) >= 0 ? 12 : -12), (cy + py) / 2 + 6, { font: F.mono, color: C.ink2, align: Math.cos(th) >= 0 ? 'left' : 'right', a: a2 });
    let lx = cx - r - 40; const ly = cy + r + 86;
    lx += key(lx, ly, C.blue, 'cos θ, real part', { a: a2 }) + 30;
    key(lx, ly, C.amber, 'sin θ, imaginary part', { a: a2 });
  }
  // B: arrows n^{-s} tip to tail, spiralling to zeta(s)
  const b = fin(T, k20 + 0.4, 0.6);
  if (b > 0) {
    const sp = P.spiral;
    const box = { x0: 170, x1: 930, y0: 230, y1: 980 };
    let mnx = 0, mxx = 0, mny = 0, mxy = 0;
    for (const [x, y] of sp) { mnx = Math.min(mnx, x); mxx = Math.max(mxx, x); mny = Math.min(mny, y); mxy = Math.max(mxy, y); }
    // camera: the whole path first, then zoom onto the spiral as the arrows pile up
    let zx0 = 1e9, zx1 = -1e9, zy0 = 1e9, zy1 = -1e9;
    for (const [x, y] of sp.slice(2)) { zx0 = Math.min(zx0, x); zx1 = Math.max(zx1, x); zy0 = Math.min(zy0, y); zy1 = Math.max(zy1, y); }
    const padx = (zx1 - zx0) * 0.3, pady = (zy1 - zy0) * 0.3;
    const zk = ease(prog(T, k21 + 0.2 * LD(21), 0.45 * LD(21)));
    const bx0 = lerp(mnx, zx0 - padx, zk), bx1 = lerp(mxx, zx1 + padx, zk), by0 = lerp(mny, zy0 - pady, zk), by1 = lerp(mxy, zy1 + pady, zk);
    const s = Math.min((box.x1 - box.x0) / (bx1 - bx0), (box.y1 - box.y0) / (by1 - by0)) * 0.92;
    const cx = (box.x0 + box.x1) / 2 - s * (bx0 + bx1) / 2, cy = (box.y0 + box.y1) / 2 + s * (by0 + by1) / 2;
    const Px = p => [cx + s * p[0], cy - s * p[1]];
    ctx.save(); ctx.beginPath(); ctx.rect(130, 200, 840, 820); ctx.clip();
    line(Px([mnx - 0.05, 0])[0], cy, Px([mxx + 0.05, 0])[0], cy, { color: C.faint, w: 1.2, a: b });
    line(cx, Px([0, mny - 0.05])[1], cx, Px([0, mxy + 0.05])[1], { color: C.faint, w: 1.2, a: b });
    text('Re', Px([mxx + 0.05, 0])[0], cy + 26, { font: F.monoS, color: C.muted, align: 'right', a: b });
    text('Im', cx + 10, Px([0, mxy + 0.05])[1] + 4, { font: F.monoS, color: C.muted, a: b });
    // how many arrows: 3 slowly during line 20, then the rest during line 21
    let k = 0;
    if (T > k20 + 0.6) k = Math.min(3, (T - (k20 + 0.6)) / 1.6);
    if (T > k21) k = Math.max(k, 3 + 77 * ease(prog(T, k21 + 0.3, 0.55 * LD(21))));
    const kf = Math.floor(k);
    for (let i = 1; i <= Math.min(80, kf + 1); i++) {
      const f = i <= kf ? 1 : k - kf; if (f <= 0) continue;
      const [x0, y0] = Px(sp[i - 1]), [x1, y1] = Px(sp[i]);
      const xe = lerp(x0, x1, f), ye = lerp(y0, y1, f);
      const w = i <= 3 ? 3 : Math.max(1.1, 2.4 - i * 0.02);
      arrow(x0, y0, xe, ye, { color: i <= 3 ? C.ink : C.ink2, w, head: i <= 3 ? 16 : (i < 12 ? 9 : 0), a: b * (i <= 12 ? 1 : 0.8) });
      if (i <= 3) text('n = ' + i, (x0 + xe) / 2 + 14, (y0 + ye) / 2 - 10, { font: F.monoS, color: C.ink2, a: b * fin(T, k20 + 0.6 + (i - 1) * 1.6, 0.5) * (1 - fin(T, k21 + 1.0)) });
    }
    const za = fin(T, k21 + 0.62 * LD(21));
    const [zx, zy] = Px(D.series.spiral_zeta);
    glow(zx, zy, 40, C.glow, 0.35 * za); circle(zx, zy, 7, { fill: C.glow, a: za });
    ctx.restore();
    text('ζ(1.5 + 5i)', zx + 22, zy - 18, { font: F.mono, color: C.ink, a: za });
    text(zk > 0.5 ? 'zoomed in' : '', 170, 990, { font: F.monoS, color: C.muted, a: b * fin(T, k21 + 0.5 * LD(21)) });
  }
};

/* ================================================================ strip: continuation, trivial zeros, critical line */
S.strip = (T, sc) => {
  const k22 = L(22), k23 = L(23), k24 = L(24), k25 = L(25), k26 = L(26), k27 = L(27), k28 = L(28);
  // 22: the series stops converging
  const a22 = vis(T, k22 + 0.2, k23 + 0.2);
  tex('zeta_sum', W / 2, 380, { align: 'center', a: a22 });
  text('converges only when σ > 1', W / 2, 600, { font: F.body, color: C.ink2, align: 'center', a: a22 * fin(T, k22 + 1.6) });
  // 23: geometric series analogy
  const aA = vis(T, k23 + 0.3, k24 + 0.3);
  if (aA > 0) {
    const { X, Y } = chart({ x0: -2.5, x1: 2.5, y0: -4, y1: 6, px0: M, px1: 1180, py0: 940, py1: 280,
      xt: [-2, -1, 0, 1, 2], yt: [-4, -2, 0, 2, 4, 6], base: 0, a: aA });
    const band = fin(T, k23 + 0.42 * LD(23));
    alpha(aA * band * 0.10); ctx.fillStyle = C.amber; ctx.fillRect(X(-1), Y(6), X(1) - X(-1), Y(-4) - Y(6));
    text('interval of convergence, −1 < x < 1', X(0), Y(6) + 26, { font: F.monoS, color: C.ink2, align: 'center', a: aA * band });
    line(X(1), Y(6), X(1), Y(-4), { color: C.muted, w: 1, dash: [5, 6], a: aA * fin(T, k23 + 0.6 * LD(23)) });
    clipRect(M, 280, 1180, 940, () => {
      for (let N = 1; N <= 8; N++) {
        const ka = fin(T, k23 + 0.8 + (N - 1) * 0.55, 0.4) * aA;
        if (ka <= 0) continue;
        const pts = []; for (let x = -2.5; x <= 2.5; x += 0.02) { let sN = 0; for (let j = 0; j < N; j++) sN += Math.pow(x, j); pts.push([X(x), Y(Math.max(-6, Math.min(8, sN)))]); }
        path(pts, { color: C.blue, w: 1.4, a: ka * (0.35 + 0.08 * N) });
      }
      const fa = fin(T, k23 + 0.62 * LD(23)) * aA;
      const b1 = [], b2 = [];
      for (let x = -2.5; x < 0.84; x += 0.02) b1.push([X(x), Y(1 / (1 - x))]);
      for (let x = 1.15; x <= 2.5; x += 0.02) b2.push([X(x), Y(1 / (1 - x))]);
      path(b1, { color: C.ink, w: 2.5, a: fa }); path(b2, { color: C.ink, w: 2.5, a: fa });
    });
    let lx = M; const ly = 262;
    lx += key(lx, ly, C.blue, 'partial sums of 1 + x + x² + …', { a: fin(T, k23 + 0.8) * aA }) + 30;
    key(lx, ly, C.ink, '1 / (1 − x)', { a: fin(T, k23 + 0.62 * LD(23)) * aA });
    tex('geo_x', 1290, 330, { a: aA * fin(T, k23 + 0.3) });
    tex('geo_int', 1290, 430, { a: aA * fin(T, k23 + 0.42 * LD(23)) });
    text('…but 1 / (1 − x) is defined', 1290, 520, { font: F.small, color: C.ink2, a: aA * fin(T, k23 + 0.62 * LD(23)) });
    text('everywhere except x = 1', 1290, 552, { font: F.small, color: C.ink2, a: aA * fin(T, k23 + 0.62 * LD(23)) });
  }
  // 24-28: the complex plane
  const aB = fin(T, k24 + 0.2, 0.7);
  if (aB > 0) {
    const X = s => M + (s + 7.5) * 100, Y = t => 980 - (t + 4) * (750 / 66);
    line(X(-7.5), Y(0), X(2.5), Y(0), { color: C.faint, w: 1.5, a: aB });
    line(X(0), Y(-4), X(0), Y(62), { color: C.faint, w: 1.5, a: aB });
    for (const s of [-6, -4, -2, 1]) text(s < 0 ? '−' + (-s) : String(s), X(s), Y(0) + 28, { font: F.monoS, color: C.muted, align: 'center', a: aB });
    for (const t of [20, 40, 60]) text(String(t), X(0) - 12, Y(t) + 5, { font: F.monoS, color: C.muted, align: 'right', a: aB });
    text('σ', X(2.5), Y(0) - 12, { font: F.mono, color: C.muted, align: 'right', a: aB });
    text('t', X(0) + 12, Y(62) + 6, { font: F.mono, color: C.muted, a: aB });
    // strip
    const sa = fin(T, k26 + 0.3);
    alpha(aB * sa * 0.12); ctx.fillStyle = C.ink; ctx.fillRect(X(0), Y(62), X(1) - X(0), Y(0) - Y(62));
    text('critical strip', X(1) + 14, Y(52), { font: F.monoS, color: C.ink2, a: aB * sa });
    text('0 < σ < 1', X(1) + 14, Y(52) + 22, { font: F.monoS, color: C.muted, a: aB * sa });
    // pole
    const pa = fin(T, k24 + 0.6 * LD(24));
    line(X(1) - 9, Y(0) - 9, X(1) + 9, Y(0) + 9, { color: C.ink, w: 2.2, a: aB * pa });
    line(X(1) - 9, Y(0) + 9, X(1) + 9, Y(0) - 9, { color: C.ink, w: 2.2, a: aB * pa });
    text('pole, s = 1', X(1) + 16, Y(0) - 16, { font: F.monoS, color: C.ink2, a: aB * pa * (1 - sa) });
    // trivial zeros
    [-2, -4, -6].forEach((s, i) => {
      const ta = fin(T, k25 + 0.25 * LD(25) + i * 0.6, 0.4);
      circle(X(s), Y(0), 7, { fill: C.blue, a: aB * ta });
    });
    text('trivial zeros', X(-4), Y(0) - 22, { font: F.monoS, color: C.ink2, align: 'center', a: aB * fin(T, k25 + 0.7 * LD(25)) });
    // critical line and the zeros on it
    const ca = prog(T, k27 + 0.3, 2.2);
    if (ca > 0) {
      line(X(0.5), Y(0), X(0.5), lerp(Y(0), Y(62), ease(ca)), { color: C.amber, w: 2, a: aB });
      D.zeros.forEach((g, i) => {
        const tz = k27 + 0.3 + 2.2 * (g / 62);
        if (T < tz) return;
        circle(X(0.5), Y(g), 5.5, { fill: C.glow, a: aB * fin(T, tz, 0.3) });
        circle(X(0.5), Y(g), 5.5 + 16 * easeOut((T - tz) / 0.7), { stroke: C.glow, w: 1, a: aB * 0.6 * (1 - clamp((T - tz) / 0.7)) });
      });
      text('σ = ½', X(0.5) - 12, Y(0) + 30, { font: F.mono, color: C.ink, align: 'right', a: aB * fin(T, k27 + 1.0) });
    }
    // right panel
    const Rx = 1290;
    text('ANALYTIC CONTINUATION', Rx, 300, { font: F.tag, color: C.muted, ls: '2px', a: aB * fin(T, k24 + 0.4) });
    text('ζ is defined on the whole plane', Rx, 340, { font: F.small, color: C.ink2, a: aB * fin(T, k24 + 0.6) });
    text('except at s = 1', Rx, 370, { font: F.small, color: C.ink2, a: aB * fin(T, k24 + 0.6) });
    text('RIEMANN HYPOTHESIS', Rx, 470, { font: F.tag, color: C.muted, ls: '2px', a: aB * fin(T, k27 + 0.4) });
    tex('rh', Rx, 492, { a: aB * fin(T, k27 + 0.6), scale: 0.9 });
    text('ZEROS CHECKED', Rx, 640, { font: F.tag, color: C.muted, ls: '2px', a: aB * fin(T, k28 + 0.2) });
    const cnt = 1e13 * ease(prog(T, k28 + 0.3, 2.4));
    text(fmt(Math.round(cnt / 1e9) * 1e9) + (cnt >= 1e13 - 1 ? '+' : ''), Rx, 692, { font: '500 40px "JetBrains Mono"', color: C.ink, a: aB * fin(T, k28 + 0.2) });
    text('all on the line', Rx, 730, { font: F.small, color: C.ink2, a: aB * fin(T, k28 + 2.6) });
    text('No proof is known.', Rx, 800, { font: '600 26px Inter', color: C.ink, a: aB * fin(T, k28 + 0.7 * LD(28)) });
  }
};

/* ================================================================ zline: rotate the line, Z(t), IVT */
S.zline = (T, sc) => {
  const k29 = L(29), k30 = L(30), k31 = L(31), k32 = L(32);
  const e = ease(prog(T, k29 + 0.7, 2.8));
  // rotation from the strip's vertical line to the horizontal axis
  const k0 = 750 / 66, k1 = (W - 2 * M) / 60;
  const c0 = [960, 980 - (30 + 4) * k0], c1 = [OX(30), AXY];
  const ph = lerp(-Math.PI / 2, 0, e), kk = lerp(k0, k1, e), cc = [lerp(c0[0], c1[0], e), lerp(c0[1], c1[1], e)];
  const pos = t => [cc[0] + kk * (t - 30) * Math.cos(ph), cc[1] + kk * (t - 30) * Math.sin(ph)];
  const [ax0, ay0] = pos(0), [ax1, ay1] = pos(60);
  line(ax0, ay0, ax1, ay1, { color: C.amber, w: 2, a: 1 - 0.75 * fin(T, k30) });
  line(ax0, ay0, ax1, ay1, { color: C.faint, w: 1.5, a: fin(T, k30) });
  // ticks after the turn
  const ta = fin(T, k29 + 3.4);
  for (let t = 0; t <= 60; t += 10) text(String(t), OX(t), AXY + 30, { font: F.monoS, color: C.muted, align: 'center', a: ta });
  text('t', W - M + 18, AXY + 6, { font: F.mono, color: C.muted, a: ta });
  // Z(t)
  const zp = ease(prog(T, k30 + 0.4, 4.0));
  const pts = []; for (let t = 0; t <= 60; t += 0.1) pts.push([OX(t), AXY - ZA * Zat(t)]);
  if (zp > 0) clipX(OX(60 * zp) + 1, () => path(pts, { color: C.ink, w: 2.2 }));
  tex('Z', M, 196, { a: fin(T, k30 + 0.5) });
  tex('Zabs', M, 262, { a: fin(T, k30 + 0.55 * LD(30)) });
  // zeros as dots on the moving line (they were amber dots on the vertical line)
  const sc32 = k32 + 0.3;
  D.zeros.forEach((g, i) => {
    const [x, y] = pos(g);
    const before = 1 - fin(T, k30 + 0.2);                        // carried over from the strip
    circle(x, y, 5.5, { fill: C.glow, a: before });
    const tz = sc32 + i * 0.32;                                   // counted again as sign changes
    if (T >= tz) {
      circle(OX(g), AXY, 6, { fill: C.glow, a: fin(T, tz, 0.25) });
      circle(OX(g), AXY, 6 + 18 * easeOut((T - tz) / 0.6), { stroke: C.glow, w: 1.2, a: 0.6 * (1 - clamp((T - tz) / 0.6)) });
    }
  });
  // IVT on the first zero
  const ia = vis(T, k31 + 0.4, k32 + 0.2, 0.6);
  if (ia > 0) {
    const a = 13.3, b = 15.0, za = Zat(a), zb = Zat(b);
    for (const [t, z, lab, dx, dy, al] of [[a, za, 'Z(a) < 0', 14, 24, 'left'], [b, zb, 'Z(b) > 0', -14, -4, 'right']]) {
      line(OX(t), AXY, OX(t), AXY - ZA * z, { color: C.blue, w: 1.5, dash: [4, 4], a: ia });
      circle(OX(t), AXY - ZA * z, 6, { fill: C.blue, a: ia });
      text(lab, OX(t) + dx, AXY - ZA * z + dy, { font: F.mono, color: C.ink, align: al, a: ia });
    }
    circle(OX(D.zeros[0]), AXY, 7, { fill: C.glow, a: ia });
    text('c', OX(D.zeros[0]) + 10, AXY + 22, { font: F.mono, color: C.ink, a: ia });
    tex('ivt', W - M, 262, { align: 'right', a: ia, scale: 0.9 });
    text('Z is continuous, so it must cross zero between a and b', W - M, 340, { font: F.small, color: C.ink2, align: 'right', a: ia });
  }
  const ca = fin(T, k32 + 0.3 + 13 * 0.32);
  text('sign changes below t = 60', M, 880, { font: F.mono, color: C.ink2, a: fin(T, k32 + 0.3) });
  text(String(Math.min(13, Math.max(0, Math.floor((T - sc32) / 0.32) + 1))), M + 520, 880, { font: F.mono, color: C.ink, align: 'right', a: fin(T, k32 + 0.3) });
  text('zeros expected below t = 60 (Riemann–von Mangoldt)', M, 916, { font: F.mono, color: C.ink2, a: ca });
  text('13', M + 650, 916, { font: F.mono, color: C.ink, align: 'right', a: ca });
  text('none missing: every zero below t = 60 is on the line', M, 960, { font: F.small, color: C.ink, a: fin(T, k32 + 0.3 + 13 * 0.32 + 1.0) });
};

/* ================================================================ orchestra: the sweep */
S.orchestra = (T, sc) => {
  const k33 = L(33), k34 = L(34), o = TL.orchestra, hits = o.hits;
  const ax = fin(T, sc.start + 0.2);
  line(OX(0), AXY, OX(60), AXY, { color: C.faint, w: 1.5, a: ax });
  for (let t = 0; t <= 60; t += 10) text(String(t), OX(t), AXY + 30, { font: F.monoS, color: C.muted, align: 'center', a: ax * 0.8 });
  // Z(t): a ghost ahead of the wave, bright behind it
  const pts = []; for (let t = 0; t <= 60; t += 0.08) pts.push([OX(t), AXY - ZA * Zat(t)]);
  path(pts, { color: C.ink, w: 1.5, a: ax * 0.13 });
  const swept = T >= o.start ? sweepT(T) : 0;
  if (T >= o.start) clipX(OX(swept), () => path(pts, { color: C.ink, w: 2.4 }));
  tex('freq', W - M, 196, { align: 'right', a: fin(T, k34 + 0.3) });
  text('every instrument matched to the same loudness', W - M, 262, { font: F.small, color: C.ink2, align: 'right', a: fin(T, o.start - 0.5) });
  // instruments
  const lit = hits.filter(h => T >= h.time).length;
  const lastHit = hits.filter(h => T >= h.time).pop();
  D.zeros.forEach((g, i) => {
    const h = hits[i], x = OX(g), row = i % 2, ly = row ? 930 : 852;
    const lw = Math.max(textW(INST[i].instrument, F.label), 90) / 2, lx = clamp(x, M + lw, W - M - lw);
    const ti = k34 + 0.3 + i * Math.min(0.35, (LD(34) - 1.5) / 13);
    const ia = fin(T, ti, 0.5);
    const on = T >= h.time, e = T - h.time;
    // hairline from node to label
    line(x, AXY + 14, x, ly - 26, { color: on ? C.amber : C.faint, w: 1, a: ia * (on ? 0.7 : 1) });
    if (!on) circle(x, AXY, 7, { stroke: C.muted, w: 1.6, fill: C.bg, a: ia });
    else {
      const sinceSync = lastHit ? T - lastHit.time : 99;            // every lit instrument pulses together
      const breathe = T > o.end + 1 ? 0.06 * Math.sin((T - o.end) * 2.2) : 0;
      glow(x, AXY, 58, C.glow, 0.16 + 0.42 * Math.exp(-sinceSync * 2.6) + breathe);
      circle(x, AXY, 8.5, { fill: C.glow });
      circle(x, AXY, 9 + 34 * easeOut(sinceSync / 0.8), { stroke: C.glow, w: 1.3, a: 0.55 * (1 - clamp(sinceSync / 0.8)) });
      if (e < 1.6) {                                                 // the new one: ripple and beam
        circle(x, AXY, 10 + 110 * easeOut(e / 1.4), { stroke: C.glow, w: 2, a: 0.8 * (1 - clamp(e / 1.4)) });
        alpha(0.55 * (1 - clamp(e / 1.6)));
        const gr = ctx.createLinearGradient(0, AXY, 0, AXY - 260);
        gr.addColorStop(0, C.glow + 'aa'); gr.addColorStop(1, C.glow + '00');
        ctx.fillStyle = gr; ctx.fillRect(x - 1.5, AXY - 260, 3, 260);
      }
    }
    const nameA = ia * (on ? 1 : 0.55);
    text(INST[i].instrument, lx, ly, { font: F.label, color: on ? C.ink : C.ink2, align: 'center', a: nameA });
    text('γ ' + g.toFixed(3), lx, ly + 20, { font: F.monoS, color: C.muted, align: 'center', a: nameA });
    text((10 * g).toFixed(1) + ' Hz', lx, ly + 38, { font: F.monoS, color: on ? C.ink2 : C.muted, align: 'center', a: nameA });
  });
  // first-zero callout while it is being described
  const fa = vis(T, k34 + 0.45 * LD(34), o.start + 1.0);
  if (fa > 0) circle(OX(D.zeros[0]), AXY, 18, { stroke: C.ink, w: 1.2, a: fa });
  // playhead
  if (T >= o.start && T <= o.end + 0.6) {
    const pa = 1 - fin(T, o.end, 0.6), x = OX(swept), y = AXY - ZA * Zat(swept);
    line(x, 300, x, 820, { color: C.ink, w: 1, a: 0.22 * pa });
    glow(x, y, 26, '#ffffff', 0.35 * pa); circle(x, y, 5, { fill: C.ink, a: pa });
    text('t = ' + swept.toFixed(2), x, 290, { font: F.monoS, color: C.ink2, align: 'center', a: pa });
  }
  // counter
  text('INSTRUMENTS LIT', M, 214, { font: F.tag, color: C.muted, ls: '2px', a: fin(T, o.start - 0.6) });
  text(lit + ' / 13', M, 252, { font: F.monoL, color: C.ink, a: fin(T, o.start - 0.6) });
};

/* ================================================================ balance: why one volume */
S.balance = (T, sc) => {
  const k39 = L(39), k40 = L(40), k41 = L(41), k42 = L(42), k43 = L(43), k44 = L(44);
  tex('explicit', W / 2, 196, { align: 'center', a: fin(T, k39 + 0.4) });
  tex('xrho', 640, 360, { align: 'center', a: fin(T, k40 + 0.4) });
  tex('wave', 1290, 344, { align: 'center', a: fin(T, k41 + 0.3) });
  text('each zero ρ = ½ + iγ adds one wave', W / 2, 470, { font: F.small, color: C.ink2, align: 'center', a: vis(T, k41 + 0.6, k42 + 0.3) });
  // 41: single waves and their sqrt(x) envelope
  const wa = vis(T, k41 + 0.5, k42 + 0.4);
  if (wa > 0) {
    const { X, Y } = chart({ x0: 1.5, x1: 52, y0: -2.2, y1: 2.2, px0: M, px1: W - M, py0: 990, py1: 540, xt: [10, 20, 30, 40, 50], yt: [], base: 0, xl: 'x', a: wa });
    const xs = []; for (let i = 0; i < D.psi.single['1'].length; i += 3) xs.push(D.psi.x0 + i * D.psi.dx);
    const g1 = D.zeros[0], mod = Math.sqrt(0.25 + g1 * g1);
    const env = xs.map(x => 2 * Math.sqrt(x) / mod);
    path(xs.map((x, j) => [X(x), Y(env[j])]), { color: C.amber, w: 1.5, dash: [6, 6], a: wa });
    path(xs.map((x, j) => [X(x), Y(-env[j])]), { color: C.amber, w: 1.5, dash: [6, 6], a: wa });
    const w1 = []; for (let i = 0; i < D.psi.single['1'].length; i += 3) w1.push([X(xs[i / 3]), Y(D.psi.single['1'][i])]);
    path(w1, { color: C.ink, w: 2, a: wa, upto: ease(prog(T, k41 + 0.8, 3.0)) });
    let lx = M; const ly = 530;
    lx += key(lx, ly, C.ink, 'the wave of the first zero, γ = 14.13', { a: wa }) + 30;
    key(lx, ly, C.amber, 'its envelope, which grows like x to the ½', { dash: [6, 6], a: wa });
  }
  // 42-44: thirteen equal meters, and one hypothetical off-line zero
  const ma = fin(T, k42 + 0.3, 0.7);
  if (ma > 0) {
    const base = 960, unit = 260, dbpx = 11;
    const x0 = 300, dx = 84, bw = 34;
    line(x0 - 40, base - unit, x0 + 12 * dx + bw + 40, base - unit, { color: C.muted, w: 1, dash: [5, 6], a: ma });
    text('x to the ½', x0 - 50, base - unit + 5, { font: F.monoS, color: C.ink2, align: 'right', a: ma });
    const lastP = TL.cues.balance_pulses.filter(p => T >= p).pop();
    const sinceP = lastP !== undefined ? T - lastP : 99;
    for (let i = 0; i < 13; i++) {
      const x = x0 + i * dx, hgt = unit * ease(prog(T, k42 + 0.4 + i * 0.05, 0.9));
      alpha(ma); ctx.fillStyle = C.amber;
      ctx.beginPath(); ctx.roundRect(x, base - hgt, bw, hgt, [4, 4, 0, 0]); ctx.fill();
      alpha(ma * 0.55 * Math.exp(-sinceP * 3)); ctx.fillStyle = C.glow;      // pulses together with the music
      ctx.beginPath(); ctx.roundRect(x, base - hgt, bw, hgt, [4, 4, 0, 0]); ctx.fill();
      text(String(i + 1), x + bw / 2, base + 26, { font: F.monoS, color: C.muted, align: 'center', a: ma });
    }
    text('zeros on the line, ρ = ½ + iγ', x0, base + 58, { font: F.small, color: C.ink2, a: ma });
    // hypothetical zero at 3/4: grows like x^(1/4) relative to the others (capped at x = 10^4, +20 dB)
    const [h0, h1] = TL.cues.hyp;
    const ha = fin(T, h0, 0.5) * (1 - fin(T, h1 - 0.2, 1.2)) * ma;
    if (ha > 0) {
      const pr = clamp((T - h0) / (h1 - h0)), xval = Math.pow(10, 4 * pr), db = 20 * Math.log10(Math.min(10, Math.pow(xval, 0.25)));
      const hx = x0 + 13 * dx + 60, hh = unit + db * dbpx;
      alpha(ha * 0.85); ctx.fillStyle = C.magenta;
      ctx.beginPath(); ctx.roundRect(hx, base - hh, bw, hh, [4, 4, 0, 0]); ctx.fill();
      text('?', hx + bw / 2, base + 26, { font: F.monoS, color: C.ink2, align: 'center', a: ha });
      text('+' + db.toFixed(1) + ' dB', hx + bw / 2, base - hh - 14, { font: F.mono, color: C.ink, align: 'center', a: ha });
      text('a zero at σ = ¾', hx + bw + 20, base - 40, { font: F.small, color: C.ink2, a: ha });
      text('x = ' + fmt(Math.round(xval)), M, 530, { font: F.monoL, color: C.ink, a: ha });
      tex('offline', W / 2, 496, { align: 'center', a: ha, scale: 0.95 });
    }
    text('Balanced: no instrument louder than the rest.', W / 2, 560 + 8, { font: '600 28px Inter', color: C.ink, align: 'center', a: fin(T, k44 + 0.6) });
  }
};

/* ================================================================ primesync: the staircase from the waves */
S.primesync = (T, sc) => {
  const k45 = L(45), k46 = L(46), k47 = L(47), ps = TL.primesync;
  const ca = fin(T, sc.start + 0.3);
  const { X, Y } = chart({ x0: 0, x1: 52, y0: -3, y1: 54, px0: M, px1: W - M, py0: 900, py1: 290,
    xt: [0, 10, 20, 30, 40, 50], yt: [0, 10, 20, 30, 40, 50], base: 0, xl: 'x', a: ca });
  // exact staircase
  path(P.psiSteps.map(([x, y]) => [X(x), Y(y)]), { color: C.ink2, w: 1.5, a: ca * 0.55, dash: [3, 5] });
  tex('psi_def', W - M, 196, { align: 'right', a: fin(T, k45 + 0.3), scale: 0.9 });
  // reconstruction from N zeros
  const [r0, r1] = TL.cues.recon_steps, steps = D.psi.steps;
  const q = clamp((T - r0) / (r1 - r0)) * (steps.length - 1);
  const qi = Math.floor(q), qf = q - qi;
  const curveOf = N => { const v = D.psi.recon[String(N)], pts = []; for (let i = 0; i < v.length; i += 2) pts.push([X(D.psi.x0 + i * D.psi.dx), Y(Math.max(-3, Math.min(54, v[i])))]); return pts; };
  const ra = fin(T, r0 - 0.2, 0.4);
  if (ra > 0) {
    const swept = T >= ps.start ? primeX(T) : null;
    const draw = (pts, a) => {
      if (swept === null) { path(pts, { color: C.amber, w: 2.2, a }); return; }
      clipX(X(swept), () => path(pts, { color: C.amber, w: 2.4, a }));
      ctx.save(); ctx.beginPath(); ctx.rect(X(swept), 0, W, H); ctx.clip(); path(pts, { color: C.amber, w: 2, a: a * 0.32 }); ctx.restore();
    };
    const cur = curveOf(steps[Math.min(qi, steps.length - 1)]);
    if (qi < steps.length - 1 && qf > 0) {
      draw(cur, ra * (1 - qf)); draw(curveOf(steps[qi + 1]), ra * qf);
    } else draw(cur, ra);
    const Nnow = steps[Math.min(steps.length - 1, Math.round(q))];
    text('ZEROS USED', M + 24, 330, { font: F.tag, color: C.muted, ls: '2px', a: ra });
    text('N = ' + fmt(Nnow), M + 24, 366, { font: F.monoL, color: C.ink, a: ra });
  }
  let lx = M; const ly = 262;
  lx += key(lx, ly, C.ink2, 'ψ(x), exact', { dash: [3, 5], a: ca }) + 30;
  key(lx, ly, C.amber, 'sum of the first N waves', { a: fin(T, r0 - 0.2) });
  // the sweep: at each prime power the orchestra strikes together
  if (T >= ps.start - 0.3) {
    const x = primeX(T), pa = 1 - fin(T, ps.end + 0.2, 0.6);
    line(X(x), 290, X(x), 900, { color: C.ink, w: 1, a: 0.25 * pa });
  }
  let last = null;
  for (const e of ps.events) {
    if (T < e.time) break;
    last = e;
    const a = fin(T, e.time, 0.25), d = T - e.time, yv = P.psiAt(e.q);
    const lab = e.q === e.p ? String(e.q) : e.q + '=' + e.p + (Math.round(Math.log(e.q) / Math.log(e.p)) === 2 ? '²' : Math.round(Math.log(e.q) / Math.log(e.p)) === 3 ? '³' : '⁴');
    glow(X(e.q), Y(yv - e.log_p / 2), 40, C.glow, 0.5 * Math.exp(-d * 3));
    const isP = e.q === e.p;
    text(isP ? lab : String(e.q), X(e.q), Y(yv) - 18 - (isP ? 0 : 18), { font: isP ? F.mono : F.monoS, color: isP ? C.ink : C.muted, align: 'center', a });
  }
  // the thirteen instruments, striking in sync
  const ia = fin(T, k45 + 0.3);
  const sinceE = last ? T - last.time : (T >= k45 + 0.2 ? T - (k45 + 0.2) : 99);
  for (let i = 0; i < 13; i++) {
    const x = 640 + i * 53, y = 990;
    glow(x, y, 26, C.glow, ia * (0.12 + 0.5 * Math.exp(-sinceE * 4)));
    circle(x, y, 6, { fill: C.glow, a: ia });
    circle(x, y, 7 + 16 * easeOut(sinceE / 0.5), { stroke: C.glow, w: 1, a: ia * 0.6 * (1 - clamp(sinceE / 0.5)) });
  }
  text('13 instruments', 640 - 30, 996, { font: F.small, color: C.ink2, align: 'right', a: ia });
  text('4 = 2² and 8 = 2³ also step: ψ counts prime powers', W - M, 300, { font: F.monoS, color: C.muted, align: 'right', a: fin(T, ps.start + 2) });
};

/* ================================================================ close */
S.close = (T, sc) => {
  const k49 = L(49), k50 = L(50), k51 = L(51), tf = TL.cues.final_chord;
  const items = [
    ['Infinite series and convergence tests', 'UNIT 10'],
    ["Euler's formula, from Maclaurin series", 'UNIT 10'],
    ['Polar coordinates: a length and an angle', 'UNIT 9'],
    ['The Intermediate Value Theorem', 'UNIT 1'],
    ['Logarithms and exponentials', 'UNITS 2 AND 3'],
    ['Definite integrals as accumulation', 'UNIT 6'],
  ];
  const fr = [0.0, 0.2, 0.37, 0.52, 0.72, 0.86];
  text('THE CALCULUS BC TOOLS WE USED', M + 240, 176, { font: F.tag, color: C.muted, ls: '2px', a: fin(T, k49 - 0.4) * (1 - fin(T, tf - 0.9, 0.8)) });
  const out = 1 - fin(T, tf - 0.9, 0.8);
  const dim = 1 - 0.45 * fin(T, k50);
  items.forEach(([a, u], i) => {
    const k = fin(T, k49 + fr[i] * LD(49)) * out * dim, y = 250 + i * 86;
    line(M + 240, y + 22, W - M - 240, y + 22, { color: C.grid, w: 1, a: k });
    text(a, M + 240, y, { font: '600 32px Inter', color: C.ink, a: k });
    text(u, W - M - 240, y, { font: F.monoS, color: C.muted, align: 'right', ls: '1px', a: k });
  });
  text('A translation into sound, not a proof.', W / 2, 870, { font: '700 40px "Inter Tight"', color: C.ink, align: 'center', a: fin(T, k51 + 0.2) * out });
  // end card
  const ea = fin(T, tf - 0.4, 0.9) * (1 - fin(T, sc.end - 1.4, 1.2));
  if (ea > 0) {
    text('The Music of the Zeros', W / 2, 420, { font: F.hero, align: 'center', ls: '-2px', a: ea });
    const y = 560;
    line(M, y, W - M, y, { color: C.amber, w: 2, a: ea });
    const e = T - tf;
    D.zeros.forEach(g => {
      const x = OX(g);
      glow(x, y, 46, C.glow, ea * (0.16 + (e >= 0 ? 0.45 * Math.exp(-e * 1.6) : 0)));
      circle(x, y, 6.5, { fill: C.glow, a: ea });
      if (e >= 0) circle(x, y, 8 + 60 * easeOut(e / 1.5), { stroke: C.glow, w: 1.3, a: ea * 0.6 * (1 - clamp(e / 1.5)) });
    });
    text('Zeros computed with mpmath and checked against A. Odlyzko’s table of the first 100,000 zeros.', W / 2, 860, { font: F.small, color: C.muted, align: 'center', a: ea });
    text('Narration: Kokoro text to speech (am_michael).  Instruments: FluidR3 General MIDI SoundFont.', W / 2, 892, { font: F.small, color: C.muted, align: 'center', a: ea });
    text('An AP Calculus BC project.', W / 2, 948, { font: F.small, color: C.ink2, align: 'center', a: ea });
  }
};

window.SCENES = S;
