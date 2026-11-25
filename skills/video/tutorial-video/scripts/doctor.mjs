#!/usr/bin/env node
// Check what the skill needs, and with --install fetch what is missing.
//   node doctor.mjs            report
//   node doctor.mjs --install  also install Playwright into ~/.tutorial-video, and a Chromium if no Chrome or Edge is found
import fs from 'fs';
import { execFileSync } from 'child_process';
import { HOME, loadPlaywright, playwrightCli, launch, hasFfmpeg } from './lib.mjs';

const install = process.argv.includes('--install');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
let ok = true;
const line = (good, what, fix) => { console.log(`${good ? 'ok  ' : 'MISS'}  ${what}${good || !fix ? '' : `\n      fix: ${fix}`}`); if (!good) ok = false; };

const major = Number(process.versions.node.split('.')[0]);
line(major >= 18, `Node ${process.versions.node} (18 or newer)`, 'install a current Node from nodejs.org');

let pw = null;
const tryLoad = () => { try { pw = loadPlaywright(); } catch { pw = null; } };
tryLoad();
if (!pw && install) {
  fs.mkdirSync(HOME, { recursive: true });
  console.log(`installing playwright-core into ${HOME} ...`);
  execFileSync(npm, ['install', '--prefix', HOME, '--no-fund', '--no-audit', 'playwright-core'], { stdio: 'inherit', shell: process.platform === 'win32' });
  tryLoad();
}
line(!!pw, 'Playwright', 'node doctor.mjs --install');

if (pw) {
  let browser = null;
  const tryLaunch = async () => { try { browser = await launch(pw, { headless: true }); } catch { browser = null; } };
  await tryLaunch();
  if (!browser && install) {
    console.log('no Chrome or Edge found: downloading Chromium for Playwright ...');
    execFileSync(process.execPath, [playwrightCli(), 'install', 'chromium'], { stdio: 'inherit' });
    await tryLaunch();
  }
  if (browser) { const v = browser.version(); await browser.close(); line(true, `A browser (Chromium engine ${v})`); }
  else line(false, 'A browser (Chrome, Edge or Chromium)', 'install Google Chrome, or run: node doctor.mjs --install');
}

line(hasFfmpeg(), 'ffmpeg', process.platform === 'darwin' ? 'brew install ffmpeg' : process.platform === 'win32' ? 'winget install ffmpeg' : 'sudo apt install ffmpeg');

console.log(ok ? '\nReady.' : '\nNot ready: fix the lines marked MISS.');
process.exit(ok ? 0 : 1);
