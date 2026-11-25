#!/usr/bin/env node
// Turn a capture (flow.json + shots/) and a storyboard (video.json) into a video.
//
//   node render.mjs <video-dir> init               write a starter video.json from flow.json
//   node render.mjs <video-dir> timeline           print when each step and action happens
//   node render.mjs <video-dir> check              stills at every press and page change, tiled into check/sheet-*.jpg
//   node render.mjs <video-dir> still <t> [t...]   full-size stills at the given seconds, into check/
//   node render.mjs <video-dir> render [--workers 3] [--fps 30] [--no-audio] [--keep-frames]
//                                                  -> <video-dir>/out/<name>.mp4 and <name>.jpg (the poster)
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { pathToFileURL } from 'url';
import { HERE, loadPlaywright, launch, hasFfmpeg, parseArgs, readJSON, writeJSON } from './lib.mjs';

const flags = parseArgs(process.argv.slice(2), ['no-audio', 'keep-frames']);
const [dirArg, mode = 'render', ...rest] = flags._;
if (!dirArg) { console.error('usage: node render.mjs <video-dir> init|timeline|check|still|render'); process.exit(1); }
const dir = path.resolve(dirArg), at = (...p) => path.join(dir, ...p);
const flow = readJSON(at('flow.json'));

if (mode === 'init') {
  if (fs.existsSync(at('video.json')) && !flags.force) { console.error('video.json already exists (use --force to replace it)'); process.exit(1); }
  const chip = a => a.type === 'click' || a.type === 'select' ? (a.label || '').slice(0, 28) : a.type === 'type' ? (a.label || 'Fill in').slice(0, 28) : '';
  writeJSON(at('video.json'), {
    name: path.basename(dir),
    eyebrow: 'Product name',
    title: 'What the viewer will *do*',
    subtitle: 'One line on what it takes, for example: three steps, one minute.',
    railLabel: '',
    brand: {},
    steps: [{ title: 'Name this step', note: '', actions: flow.actions.map(a => (chip(a) ? { use: a.id, chip: chip(a) } : a.id)) }],
    outro: { title: 'Done.', tag: 'What they have now.', small: '' },
  });
  console.log(`wrote ${at('video.json')}: split the actions into steps and write the words. See references/storyboard.md`);
  process.exit(0);
}

const video = readJSON(at('video.json'));
const pw = loadPlaywright();
const build = at('.build'); fs.mkdirSync(build, { recursive: true });

// The player page with the storyboard and the capture inside it, next to shots/ so the pictures resolve.
const pageFile = at('.player.html');
const data = JSON.stringify({ video, flow }).replace(/</g, '\\u003c');
fs.writeFileSync(pageFile, fs.readFileSync(path.join(HERE, 'player', 'player.html'), 'utf8').replace('/*DATA*/null/*DATA*/', () => data));

const browser = await launch(pw, { headless: true });
async function openPage() {
  const p = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await p.goto(pathToFileURL(pageFile).href);
  await p.waitForFunction(() => window.ready || window.DATA === null, null, { timeout: 5000 }).catch(() => {});
  if (errors.length) { await browser.close(); console.error('the player stopped:\n  ' + errors.join('\n  ')); process.exit(1); }
  await p.evaluate(() => window.ready);
  if (errors.length) { await browser.close(); console.error('the player reported:\n  ' + errors.join('\n  ')); process.exit(1); }
  return p;
}
const page = await openPage();
const TL = await page.evaluate(() => window.TIMELINE);
const still = async (p, t, file, quality = 88) => { await p.evaluate(t => window.seek(t), t); await p.screenshot({ path: file, type: 'jpeg', quality }); };

if (mode === 'timeline') {
  console.log(`${TL.duration} s, ${TL.presses.length} clicks`);
  for (const s of TL.steps) console.log(`\n${s.start.toFixed(2).padStart(6)}  STEP  ${s.title}`);
  console.log('');
  for (const a of TL.actions) console.log(`${a.start.toFixed(2).padStart(6)}  ${String(a.id).padEnd(5)} ${a.type.padEnd(7)} ${a.press != null ? 'press ' + a.press.toFixed(2).padStart(6) : ' '.repeat(12)}  until ${a.end.toFixed(2).padStart(6)}  ${a.label || ''}`);
} else if (mode === 'still') {
  fs.mkdirSync(at('check'), { recursive: true });
  for (const t of rest.map(Number)) { const f = at('check', `t${t.toFixed(2)}.jpg`); await still(page, t, f, 90); console.log(f); }
} else if (mode === 'check') {
  // A still at every press (the pointer must sit on its target), every page change and every step change.
  const cd = at('check'); fs.rmSync(cd, { recursive: true, force: true }); fs.mkdirSync(cd, { recursive: true });
  const times = rest.length ? rest.map(Number).map(t => ({ t, label: '' })) : TL.checks;
  const cells = [];
  for (let i = 0; i < times.length; i++) { const f = path.join(build, `c${String(i).padStart(3, '0')}.jpg`); await still(page, times[i].t, f, 80); cells.push({ f, ...times[i] }); }
  const sheet = await browser.newPage({ viewport: { width: 1920, height: 1200 } });
  const per = 9; let n = 0;
  for (let i = 0; i < cells.length; i += per) {
    const html = `<body style="margin:0;background:#111;font:600 15px Arial;color:#eee"><div style="display:grid;grid-template-columns:repeat(3,640px);">` +
      cells.slice(i, i + per).map(c => `<div><img src="${pathToFileURL(c.f).href}" style="width:640px;height:360px;display:block"><div style="padding:6px 8px 12px;height:22px;overflow:hidden;white-space:nowrap">${c.t.toFixed(2)} s &nbsp; ${c.label.replace(/[<&]/g, '')}</div></div>`).join('') + `</div></body>`;
    const hf = path.join(build, 'sheet.html'); fs.writeFileSync(hf, html);
    await sheet.goto(pathToFileURL(hf).href); await sheet.waitForLoadState('load');
    const out = path.join(cd, `sheet-${String(++n).padStart(2, '0')}.jpg`);
    await sheet.screenshot({ path: out, type: 'jpeg', quality: 82, fullPage: true }); console.log(out);
  }
  console.log(`${cells.length} stills on ${n} sheet(s). Look at every one. For a full-size frame: node render.mjs <video-dir> still <seconds>`);
} else if (mode === 'render') {
  if (!hasFfmpeg()) { await browser.close(); console.error('ffmpeg is missing. Run: node doctor.mjs'); process.exit(1); }
  const fps = Number(flags.fps || video.fps || 30), N = Math.round(TL.duration * fps);
  const workers = Math.max(1, Math.min(Number(flags.workers || 3), os.cpus().length));
  const fd = path.join(build, 'frames'); fs.rmSync(fd, { recursive: true, force: true }); fs.mkdirSync(fd, { recursive: true });
  const name = f => path.join(fd, `f${String(f).padStart(5, '0')}.jpg`);
  const pages = [page]; while (pages.length < workers) pages.push(await openPage());
  let done = 0; const started = Date.now();
  await Promise.all(pages.map(async (p, w) => {
    for (let f = w; f < N; f += workers) {
      await still(p, f / fps, name(f), 93);
      if (++done % 150 === 0) console.log(`frame ${done}/${N}`);
    }
  }));
  console.log(`${N} frames in ${((Date.now() - started) / 1000).toFixed(0)} s`);
  // The poster becomes frame 0 (it replaces a frame, so length and sync stay the same): players and feeds show the title, not an empty stage.
  const posterT = typeof video.poster === 'number' ? video.poster : TL.poster;
  fs.mkdirSync(at('out'), { recursive: true });
  const base = video.name || path.basename(dir);
  fs.copyFileSync(name(Math.min(N - 1, Math.round(posterT * fps))), at('out', `${base}.jpg`));
  fs.copyFileSync(at('out', `${base}.jpg`), name(0));
  const audio = !flags['no-audio'] && video.audio !== false && TL.presses.length > 0;
  const args = ['-loglevel', 'error', '-y', '-framerate', String(fps), '-i', path.join(fd, 'f%05d.jpg')];
  if (audio) { const wav = path.join(build, 'clicks.wav'); clicksWav(TL.presses, TL.duration, wav); args.push('-i', wav, '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '192k', '-shortest'); }
  else args.push('-an');
  const out = at('out', `${base}.mp4`);
  args.push('-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out);
  execFileSync('ffmpeg', args, { stdio: 'inherit' });
  if (!flags['keep-frames']) fs.rmSync(fd, { recursive: true, force: true });
  console.log(`wrote ${out}\n${TL.duration} s, ${TL.presses.length} clicks${audio ? ', with click sounds' : ', silent'}`);
} else { console.error(`unknown mode "${mode}"`); await browser.close(); process.exit(1); }
await browser.close();

// One soft mouse click per press, and silence otherwise: a press and a quieter release 75 ms later.
// Made here from filtered noise and a short tone, so the skill ships no sound files.
function clicksWav(times, duration, file) {
  const sr = 48000, n = Math.ceil(duration * sr), buf = new Float32Array(n);
  let seed = 7; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
  const tick = (t0, gain, f) => {
    const s0 = Math.round(t0 * sr), len = Math.round(0.035 * sr); let lp = 0, hp = 0;
    for (let i = 0; i < len && s0 + i < n; i++) {
      const tt = i / sr; lp += 0.32 * (rnd() - lp); hp += 0.06 * (lp - hp);
      buf[s0 + i] += gain * (0.9 * (lp - hp) * Math.exp(-tt / 0.0035) + 0.45 * Math.sin(2 * Math.PI * f * tt) * Math.exp(-tt / 0.005));
    }
  };
  for (const t of times) { tick(t, 1, 1900); tick(t + 0.075, 0.5, 2500); }
  let peak = 0; for (const v of buf) peak = Math.max(peak, Math.abs(v));
  const k = peak ? 0.35 / peak : 0;                       // peak at about -9 dB
  const pcm = Buffer.alloc(44 + n * 2);
  pcm.write('RIFF', 0); pcm.writeUInt32LE(36 + n * 2, 4); pcm.write('WAVEfmt ', 8); pcm.writeUInt32LE(16, 16); pcm.writeUInt16LE(1, 20); pcm.writeUInt16LE(1, 22);
  pcm.writeUInt32LE(sr, 24); pcm.writeUInt32LE(sr * 2, 28); pcm.writeUInt16LE(2, 32); pcm.writeUInt16LE(16, 34); pcm.write('data', 36); pcm.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) pcm.writeInt16LE(Math.round(clamp(buf[i] * k, -1, 1) * 32767), 44 + i * 2);
  fs.writeFileSync(file, pcm);
}
function clamp(x, a, b) { return Math.min(b, Math.max(a, x)); }
