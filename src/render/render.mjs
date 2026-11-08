// Render the film's picture with headless Chromium (Playwright) and ffmpeg.
//   node src/render/render.mjs stills 12.5,40,330      -> build/stills/t_0012.50.png
//   node src/render/render.mjs video [workers=4]        -> build/video/silent.mp4
// Frames are pure functions of time, so workers render disjoint frame ranges in parallel.
import { createRequire } from "module";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { texToSvgs } from "./tex.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const B = p => path.join(ROOT, "build", p);

function input() {
  const report = JSON.parse(fs.readFileSync(B("audio/report.json")));
  return {
    math: JSON.parse(fs.readFileSync(path.join(ROOT, "data/math.json"))),
    timeline: JSON.parse(fs.readFileSync(B("timeline.json"))),
    tex: texToSvgs(JSON.parse(fs.readFileSync(path.join(HERE, "tex.json")))),
    instruments: report.instruments,
  };
}

async function openPage(data) {
  const opts = { args: ["--allow-file-access-from-files"] };
  if (process.env.CHROME) opts.executablePath = process.env.CHROME;
  const browser = await chromium.launch(opts);
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto("file://" + path.join(HERE, "index.html"));
  const info = await page.evaluate(d => window.init(d), data);
  if (!info.fontsOk.every(Boolean)) throw new Error("fonts failed to load: " + JSON.stringify(info.fontsOk));
  return { browser, page, info, errors };
}

async function grab(page, f) {
  const url = await page.evaluate(f => { window.renderFrame(f); return window.grab("image/png"); }, f);
  return Buffer.from(url.slice(url.indexOf(",") + 1), "base64");
}

async function stills(times) {
  const data = input();
  const { browser, page, info, errors } = await openPage(data);
  fs.mkdirSync(B("stills"), { recursive: true });
  for (const t of times) {
    const f = Math.min(info.frames - 1, Math.round(t * info.fps));
    const file = B(`stills/t_${t.toFixed(2).padStart(7, "0")}.png`);
    fs.writeFileSync(file, await grab(page, f));
    console.log(file);
  }
  if (errors.length) console.log("PAGE ERRORS:\n" + errors.join("\n"));
  await browser.close();
  if (errors.length) process.exit(1);
}

async function segment(data, k, f0, f1) {
  const { browser, page, info, errors } = await openPage(data);
  const out = B(`video/seg_${String(k).padStart(2, "0")}.mp4`);
  const ff = spawn("ffmpeg", ["-y", "-v", "error", "-f", "image2pipe", "-framerate", String(info.fps), "-c:v", "png", "-i", "-",
    "-c:v", "libx264", "-preset", "medium", "-crf", "16", "-pix_fmt", "yuv420p", "-g", "60", "-r", String(info.fps), out],
    { stdio: ["pipe", "inherit", "inherit"] });
  const t0 = Date.now();
  for (let f = f0; f < f1; f++) {
    const buf = await grab(page, f);
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once("drain", r));
    if ((f - f0) % 600 === 0) console.log(`worker ${k}: frame ${f - f0}/${f1 - f0} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  }
  ff.stdin.end();
  const code = await new Promise(r => ff.on("close", r));
  await browser.close();
  if (code !== 0) throw new Error(`ffmpeg failed for segment ${k}`);
  if (errors.length) throw new Error(`page errors in worker ${k}:\n` + errors.join("\n"));
  return out;
}

async function video(workers) {
  const data = input();
  const frames = data.timeline.frames;
  fs.rmSync(B("video"), { recursive: true, force: true });
  fs.mkdirSync(B("video"), { recursive: true });
  const per = Math.ceil(frames / workers);
  const t0 = Date.now();
  const segs = await Promise.all(Array.from({ length: workers }, (_, k) => segment(data, k, k * per, Math.min(frames, (k + 1) * per))));
  fs.writeFileSync(B("video/list.txt"), segs.map(s => `file '${s}'`).join("\n") + "\n");
  await new Promise((res, rej) => spawn("ffmpeg", ["-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", B("video/list.txt"), "-c", "copy", B("video/silent.mp4")],
    { stdio: "inherit" }).on("close", c => c === 0 ? res() : rej(new Error("concat failed"))));
  console.log(`rendered ${frames} frames with ${workers} workers in ${((Date.now() - t0) / 60000).toFixed(1)} min -> build/video/silent.mp4`);
}

const [mode, arg] = process.argv.slice(2);
if (mode === "stills") await stills(arg.split(",").map(Number));
else if (mode === "video") await video(Number(arg || 4));
else { console.log("usage: render.mjs stills t1,t2,... | video [workers]"); process.exit(2); }
