'use strict';
/* Film engine: design tokens, drawing helpers, scene dispatch.
   Every frame is a pure function of its time, so frames can render in parallel. */

const W = 1920, H = 1080;
const M = 160;                       // equal left and right content edges
const C = {
  bg: '#08090b', ink: '#ECEAE4', ink2: '#B8B6AF', muted: '#7D848E', faint: '#2A2E35', grid: '#15181d',
  // chart series (validated for the dark surface with the dataviz validator)
  blue: '#3987e5', amber: '#c98500', magenta: '#d55181',
  // light, not data: an instrument lighting up
  glow: '#F5B544',
};
const F = {
  tag: '600 14px Inter', title: '700 44px "Inter Tight"', hero: '700 92px "Inter Tight"',
  body: '500 26px Inter', small: '500 19px Inter', label: '600 19px Inter',
  mono: '500 17px "JetBrains Mono"', monoS: '500 15px "JetBrains Mono"', monoL: '500 24px "JetBrains Mono"',
};

let D, TL, TEXS, INST, ctx, FPS;
const IMG = {};
let G = 1;                           // scene opacity (for transitions)

/* ------------------------------------------------------------ math helpers */
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const ease = k => (k = clamp(k), k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const easeOut = k => 1 - Math.pow(1 - clamp(k), 3);
const prog = (T, t0, d) => clamp((T - t0) / d);
const fin = (T, t0, d = 0.6) => ease(prog(T, t0, d));                 // fade in
const vis = (T, t0, t1, d = 0.5) => fin(T, t0, d) * (1 - fin(T, t1 - d, d)); // visible window
const L = i => TL.lines[i].start;                                       // line start
const LE = i => TL.lines[i].start + TL.lines[i].dur;                    // line end
const LD = i => TL.lines[i].dur;
const fmt = (x, d = 0) => x.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

/* ------------------------------------------------------------ drawing helpers */
function alpha(a) { ctx.globalAlpha = clamp(G * a); }

function text(s, x, y, o = {}) {
  if ((o.a ?? 1) <= 0.001) return;
  alpha(o.a ?? 1);
  ctx.font = o.font || F.body;
  ctx.fillStyle = o.color || C.ink;
  ctx.textAlign = o.align || 'left';
  ctx.textBaseline = o.base || 'alphabetic';
  ctx.letterSpacing = o.ls || '0px';
  ctx.fillText(s, x, y);
  ctx.letterSpacing = '0px';
}

function textW(s, font, ls = '0px') { ctx.font = font; ctx.letterSpacing = ls; const w = ctx.measureText(s).width; ctx.letterSpacing = '0px'; return w; }

/* TeX image. align: left|center|right on x; y is the top edge (or centre with vc). */
function tex(key, x, y, o = {}) {
  const a = o.a ?? 1;
  if (a <= 0.001) return;
  const im = IMG[key + '|' + (o.color || 'ink')];
  if (!im) throw new Error('missing tex ' + key);
  const s = o.scale || 1, w = im.width * s, h = im.height * s;
  let x0 = x;
  if (o.align === 'center') x0 = x - w / 2;
  if (o.align === 'right') x0 = x - w;
  const y0 = o.vc ? y - h / 2 : y;
  alpha(a);
  ctx.drawImage(im, x0, y0 + (o.dy || 0), w, h);
  return { w, h, x0, y0 };
}
const texSize = key => { const im = IMG[key + '|ink']; return { w: im.width, h: im.height }; };

function line(x0, y0, x1, y1, o = {}) {
  alpha(o.a ?? 1);
  ctx.strokeStyle = o.color || C.ink; ctx.lineWidth = o.w || 1;
  ctx.setLineDash(o.dash || []);
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  ctx.setLineDash([]);
}

function circle(x, y, r, o = {}) {
  alpha(o.a ?? 1);
  ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2);
  if (o.fill) { ctx.fillStyle = o.fill; ctx.fill(); }
  if (o.stroke) { ctx.strokeStyle = o.stroke; ctx.lineWidth = o.w || 1.5; ctx.stroke(); }
}

function glow(x, y, r, color, a) {
  if (a <= 0.002) return;
  alpha(a);
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color); g.addColorStop(0.35, color + '55'); g.addColorStop(1, color + '00');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}

/* polyline through screen points; `upto` = fraction of points to draw */
function path(pts, o = {}) {
  const n = Math.floor((pts.length - 1) * clamp(o.upto ?? 1)) + 1;
  if (n < 2) return;
  alpha(o.a ?? 1);
  ctx.strokeStyle = o.color || C.ink; ctx.lineWidth = o.w || 2;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.setLineDash(o.dash || []);
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < n; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  if (o.upto !== undefined && o.upto < 1 && n < pts.length) {      // partial last segment
    const f = (pts.length - 1) * o.upto - (n - 1), p = pts[n - 1], q = pts[n];
    ctx.lineTo(lerp(p[0], q[0], f), lerp(p[1], q[1], f));
  }
  ctx.stroke(); ctx.setLineDash([]);
}

/* a chart frame: returns scale functions. Recessive grid and axes, labels in muted ink. */
function chart(o) {
  const X = v => o.px0 + (v - o.x0) / (o.x1 - o.x0) * (o.px1 - o.px0);
  const Y = v => o.py0 - (v - o.y0) / (o.y1 - o.y0) * (o.py0 - o.py1);
  const a = o.a ?? 1;
  if (a > 0.001) {
    for (const v of o.yt || []) {
      line(o.px0, Y(v), o.px1, Y(v), { color: C.grid, w: 1, a });
      text((o.yf || String)(v), o.px0 - 14, Y(v) + 5, { font: F.monoS, color: C.muted, align: 'right', a });
    }
    for (const v of o.xt || []) text((o.xf || String)(v), X(v), o.py0 + 30, { font: F.monoS, color: C.muted, align: 'center', a });
    const yb = o.base !== undefined ? Y(o.base) : o.py0;
    line(o.px0, yb, o.px1, yb, { color: C.faint, w: 1.5, a });
    if (o.xl) text(o.xl, o.px1 + 16, yb + 5, { font: F.monoS, color: C.muted, a });
    if (o.yl) text(o.yl, o.px0, o.py1 - 18, { font: F.monoS, color: C.muted, a });
  }
  return { X, Y };
}

/* legend chip: colored mark + label in ink (text never wears the series color) */
function key(x, y, color, label, o = {}) {
  const a = o.a ?? 1;
  if (o.dot) circle(x + 9, y - 6, 5, { fill: color, a });
  else line(x, y - 6, x + 22, y - 6, { color, w: 3, a, dash: o.dash });
  text(label, x + 32, y, { font: o.font || F.small, color: C.ink2, a });
  return 32 + textW(label, o.font || F.small);
}

/* ------------------------------------------------------------ scene chrome */
function chrome(sc, T) {
  if (!sc.tag) return;
  const k = fin(T, sc.start + 0.15, 0.7);
  text(sc.tag, M, 92, { font: F.tag, color: C.muted, ls: '2px', a: k });
  text(sc.title, M, 146, { font: F.title, color: C.ink, ls: '-0.5px', a: k });
  const idx = TL.scenes.filter(s => s.tag).findIndex(s => s.id === sc.id) + 1;
  const tot = TL.scenes.filter(s => s.tag).length;
  text(String(idx).padStart(2, '0') + ' / ' + String(tot).padStart(2, '0'), W - M, 92, { font: F.monoS, color: C.muted, align: 'right', a: k });
}

/* ------------------------------------------------------------ init + frame */
async function loadImg(k, color, svg) {
  const im = new Image();
  im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.replaceAll('currentColor', color));
  await im.decode();
  IMG[k] = im;
}

window.init = async (input) => {
  D = input.math; TL = input.timeline; TEXS = input.tex; INST = input.instruments; FPS = TL.fps;
  const cv = document.getElementById('c');
  ctx = cv.getContext('2d', { alpha: false });
  const fonts = ['500 20px Inter', '600 20px Inter', '700 40px "Inter Tight"', '500 20px "JetBrains Mono"'];
  for (const f of fonts) { await document.fonts.load(f, 'Aπσγζψρθ'); }
  const colors = { ink: C.ink, muted: C.muted, glow: C.glow };
  await Promise.all(Object.entries(TEXS).flatMap(([k, v]) => Object.entries(colors).map(([cn, col]) => loadImg(k + '|' + cn, col, v.svg))));
  if (window.SCENES_INIT) window.SCENES_INIT();
  return { frames: TL.frames, fps: TL.fps, fontsOk: fonts.map(f => document.fonts.check(f, 'πσγ')) };
};

window.renderFrame = (f) => {
  const T = f / FPS;
  G = 1; ctx.globalAlpha = 1;
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
  for (const sc of TL.scenes) {
    if (T < sc.start || T >= sc.end) continue;
    // dip through dark between scenes
    const din = sc.id === 'title' ? 1 : fin(T, sc.start, 0.55);
    const dout = 1 - fin(T, sc.end - 0.55, 0.55);
    G = din * dout;
    window.SCENES[sc.id](T, sc);
    G = din * dout;
    chrome(sc, T);
  }
  G = 1; ctx.globalAlpha = 1;
};

window.grab = (type = 'image/png', q) => document.getElementById('c').toDataURL(type, q);
