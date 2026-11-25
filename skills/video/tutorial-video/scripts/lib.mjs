// Shared helpers: where state lives, how Playwright and a browser are found, argument parsing.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath, pathToFileURL } from 'url';
import { execFileSync } from 'child_process';

/** State outside the skill folder (a plugin install is read-only): Playwright, browser profiles, the session. */
export const HOME = process.env.TUTORIAL_VIDEO_HOME || path.join(os.homedir(), '.tutorial-video');
export const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Playwright from next to the scripts, from the working directory, or from HOME (doctor.mjs --install puts it there). */
const bases = () => [import.meta.url, pathToFileURL(path.join(process.cwd(), 'x.js')).href, pathToFileURL(path.join(HOME, 'x.js')).href];
export function loadPlaywright() {
  for (const base of bases()) for (const name of ['playwright-core', 'playwright']) {
    try { return createRequire(base)(name); } catch {}
  }
  throw new Error(`Playwright is not installed. Run:\n  node "${path.join(HERE, 'doctor.mjs')}" --install`);
}
/** The command-line entry of the Playwright package that loadPlaywright() finds (used to download a browser). */
export function playwrightCli() {
  for (const base of bases()) for (const name of ['playwright-core', 'playwright']) {
    try { return path.join(path.dirname(createRequire(base).resolve(`${name}/package.json`)), 'cli.js'); } catch {}
  }
  throw new Error('Playwright is not installed.');
}

// The person's own Chrome first, then Edge, then the Chromium that Playwright downloads.
const CHANNELS = ['chrome', 'msedge', 'chromium'];
const missing = e => /not found|doesn't exist|does not exist|ENOENT|install/i.test(String(e && e.message));
const NO_BROWSER = `No Chrome, Edge or Chromium found. Install Google Chrome, or run:\n  node "${path.join(HERE, 'doctor.mjs')}" --install`;

async function firstChannel(start, prefer) {
  const order = prefer ? [prefer, ...CHANNELS.filter(c => c !== prefer)] : CHANNELS;
  let last;
  for (const channel of order) {
    try { return { result: await start(channel === 'chromium' ? {} : { channel }), channel }; }
    catch (e) { last = e; if (!missing(e)) throw e; }
  }
  throw new Error(`${NO_BROWSER}\n(${String(last && last.message).split('\n')[0]})`);
}

/** A headless browser for rendering frames. */
export async function launch(pw, opts = {}) {
  return (await firstChannel(c => pw.chromium.launch({ ...c, ...opts }))).result;
}

/** A browser with a profile that keeps its sign-ins between sessions. */
export async function launchPersistent(pw, profileDir, opts = {}, prefer) {
  const { result, channel } = await firstChannel(c => pw.chromium.launchPersistentContext(profileDir, { ...c, ...opts }), prefer);
  return { context: result, channel };
}

export function hasFfmpeg() {
  try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); return true; } catch { return false; }
}

/** `--flag value`, `--flag=value` and bare `--bool` (names listed in `bools`); everything else is positional. */
export function parseArgs(argv, bools = []) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--') && a.length > 2) {
      const eq = a.indexOf('=');
      const name = eq > 0 ? a.slice(2, eq) : a.slice(2);
      if (eq > 0) out[name] = a.slice(eq + 1);
      else if (bools.includes(name) || i + 1 >= argv.length) out[name] = true;
      else out[name] = argv[++i];
    } else out._.push(a);
  }
  return out;
}

export const readJSON = (file, fallback) => {
  if (!fs.existsSync(file)) { if (fallback !== undefined) return fallback; throw new Error(`Missing ${file}`); }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
};
export const writeJSON = (file, data) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n'); };
