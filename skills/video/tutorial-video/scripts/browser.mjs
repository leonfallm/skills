#!/usr/bin/env node
// Drive a real, signed-in browser one command at a time, and record every action for the video.
//
//   node browser.mjs open --dir <video-dir> [--url <url>] [--viewport 1440x900] [--dsf 2] [--profile default] [--headless]
//   node browser.mjs look                       list what can be clicked, with a numbered picture (look/look.png)
//   node browser.mjs click <target>             record a click: the screen before, the hover state, the target's box, the screen after
//   node browser.mjs type <target> <text>       record typing, one picture of the field per character
//   node browser.mjs select <target> <option>   choose an option in a native <select>
//   node browser.mjs key <key>                  press a key (Enter, Escape, Tab ...)
//   node browser.mjs hover <target>             record a hover that reveals something
//   node browser.mjs scroll <pixels|target>     record a scroll
//   node browser.mjs ring <target>              record a highlight on something to read (no click)
//   node browser.mjs mask <from> <to>           replace a text in every later picture (names, e-mail addresses, amounts)
//   node browser.mjs blur <css selector>        blur something in every later picture (avatars, charts)
//   node browser.mjs hide <css selector>        remove something from every later picture (cookie banners, chat bubbles, dev badges)
//   node browser.mjs goto|wait|eval|shot|brand|record|undo|reset|status|close
//
// <target> is a number from `look`, a Playwright selector (text=Save, role=button[name="Save"], #id, .class) or xy=640,320.
// The browser is a separate process that stays open between commands, with its own profile, so a
// sign-in made once in its window is still there next time. See references/capture.md.
import fs from 'fs';
import os from 'os';
import path from 'path';
import http from 'http';
import crypto from 'crypto';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { HOME, loadPlaywright, launchPersistent, parseArgs, readJSON, writeJSON } from './lib.mjs';

const SESSION = path.join(HOME, 'session.json');
const argv = process.argv.slice(2);
if (argv[0] === '--daemon') daemon(JSON.parse(argv[1])).catch(e => { console.error(e); process.exit(1); });
else cli().catch(e => { console.error(String(e.message || e)); process.exit(1); });

// ------------------------------------------------------------------ the command line

async function call(session, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({ host: '127.0.0.1', port: session.port, path: '/', method: 'POST', headers: { 'content-type': 'application/json', 'x-token': session.token, 'content-length': Buffer.byteLength(data) } }, res => {
      let s = ''; res.on('data', d => s += d); res.on('end', () => { try { resolve(JSON.parse(s)); } catch { reject(new Error(s || 'empty answer')); } });
    });
    req.on('error', reject); req.end(data);
  });
}
async function alive(s) { try { return (await call(s, { cmd: 'status' })).ok; } catch { return false; } }

async function cli() {
  const flags = parseArgs(argv, ['headless', 'clear', 'secret', 'all', 'no-record']);
  const [cmd, ...args] = flags._;
  if (!cmd || cmd === 'help') { console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').filter(l => l.startsWith('//')).map(l => l.slice(3)).join('\n')); return; }
  let session = fs.existsSync(SESSION) ? readJSON(SESSION) : null;
  if (session && !(await alive(session))) { fs.rmSync(SESSION, { force: true }); session = null; }

  if (cmd === 'open') {
    if (session) throw new Error(`A browser is already open for ${session.dir}. Close it first: node browser.mjs close`);
    if (!flags.dir) throw new Error('open needs --dir <video-dir> (the folder the capture is saved in)');
    const [w, h] = String(flags.viewport || '1440x900').split('x').map(Number);
    const cfg = { dir: path.resolve(flags.dir), url: flags.url || null, viewport: { w, h, dsf: Number(flags.dsf || 2) }, profile: String(flags.profile || 'default'), headless: !!flags.headless, browser: flags.browser || null };
    fs.mkdirSync(HOME, { recursive: true }); fs.mkdirSync(cfg.dir, { recursive: true });
    const log = fs.openSync(path.join(HOME, 'daemon.log'), 'w');
    spawn(process.execPath, [fileURLToPath(import.meta.url), '--daemon', JSON.stringify(cfg)], { detached: true, stdio: ['ignore', log, log] }).unref();
    for (let i = 0; i < 150; i++) {
      await new Promise(r => setTimeout(r, 200));
      if (fs.existsSync(SESSION)) { session = readJSON(SESSION); if (await alive(session)) break; }
      session = null;
    }
    if (!session) throw new Error(`The browser did not start. Log:\n${fs.readFileSync(path.join(HOME, 'daemon.log'), 'utf8').slice(-1500)}`);
    const r = await call(session, { cmd: 'status' }); console.log(r.out); return;
  }
  if (!session) throw new Error('No browser is open. Start one: node browser.mjs open --dir <video-dir> --url <url>');
  const r = await call(session, { cmd, args, flags });
  if (r.out) console.log(r.out);
  if (!r.ok) { console.error('error: ' + r.error); process.exit(1); }
}

// ------------------------------------------------------------------ the browser process

async function daemon(cfg) {
  const pw = loadPlaywright();
  const { w: W, h: H, dsf } = cfg.viewport;
  const profileDir = path.join(HOME, 'profiles', cfg.profile);
  fs.mkdirSync(profileDir, { recursive: true });
  const { context, channel } = await launchPersistent(pw, profileDir, {
    headless: cfg.headless, viewport: { width: W, height: H }, deviceScaleFactor: dsf,
    args: ['--disable-blink-features=AutomationControlled'], ignoreDefaultArgs: ['--enable-automation'],
  }, cfg.browser);
  let page = context.pages()[0] || await context.newPage();
  context.on('page', p => { page = p; p.on('close', () => { const open = context.pages(); if (open.length) page = open[open.length - 1]; }); });

  const flowFile = path.join(cfg.dir, 'flow.json'), shotsDir = path.join(cfg.dir, 'shots'), lookDir = path.join(cfg.dir, 'look');
  const flow = readJSON(flowFile, { viewport: { w: W, h: H, dsf }, actions: [], masks: [], blurs: [], hides: [] });
  if (flow.viewport.w !== W || flow.viewport.h !== H) throw new Error(`flow.json in ${cfg.dir} was captured at ${flow.viewport.w}x${flow.viewport.h}. Open with the same --viewport, or reset the capture.`);
  flow.masks ||= []; flow.blurs ||= []; flow.hides ||= [];
  let recording = true, lastHash = null, lastFile = null;
  const save = () => writeJSON(flowFile, flow);
  const nextId = () => 'a' + (flow.actions.reduce((n, a) => Math.max(n, Number(String(a.id).slice(1)) || 0), 0) + 1);
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // Wait until the page has stopped changing: no DOM changes for 350 ms and no running finite animation.
  async function settle(max = 6000) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await page.waitForLoadState('domcontentloaded', { timeout: max }).catch(() => {});
        await page.evaluate(max => new Promise(res => {
          let last = performance.now(); const start = last;
          const mo = new MutationObserver(() => { last = performance.now(); });
          mo.observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
          (function tick() {
            const now = performance.now();
            const moving = document.getAnimations().some(a => a.playState === 'running' && a.effect && a.effect.getComputedTiming().iterations !== Infinity);
            if ((now - last > 350 && !moving) || now - start > max) { mo.disconnect(); res(); } else setTimeout(tick, 60);
          })();
        }), max);
        return;
      } catch { await sleep(300); }   // the page navigated under us: wait for the new one
    }
  }

  // Before every picture: replace the masked texts and blur the blurred elements. The page itself re-renders, so this is redone each time.
  async function redact() {
    if (!flow.masks.length && !flow.blurs.length && !flow.hides.length) return;
    await page.evaluate(({ masks, blurs, hides }) => {
      if (masks.length) {
        const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
        while ((n = w.nextNode())) { let v = n.nodeValue, c = false; for (const [from, to] of masks) if (v.includes(from)) { v = v.split(from).join(to); c = true; } if (c) n.nodeValue = v; }
        for (const el of document.querySelectorAll('input,textarea')) { if (el === document.activeElement) continue; let v = el.value, c = false; for (const [from, to] of masks) if (v && v.includes(from)) { v = v.split(from).join(to); c = true; } if (c) el.value = v; }
      }
      let st = document.getElementById('__tv_blur');
      if (blurs.length || hides.length) { if (!st) { st = document.createElement('style'); st.id = '__tv_blur'; document.head.appendChild(st); }
        st.textContent = (blurs.length ? blurs.join(',') + '{filter:blur(9px)!important}' : '') + (hides.length ? hides.join(',') + '{display:none!important}' : ''); }
      else if (st) st.remove();
    }, { masks: flow.masks, blurs: flow.blurs, hides: flow.hides }).catch(() => {});
  }

  // What the product looks like, noted once: the page's background and the colour of its main buttons.
  // The player uses them when video.json names no colours of its own.
  async function hints() {
    return page.evaluate(() => {
      const rgb = c => (c.match(/[\d.]+/g) || []).map(Number);
      const hex = c => '#' + rgb(c).slice(0, 3).map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
      const solid = c => { const v = rgb(c); return v.length >= 3 && (v[3] === undefined || v[3] > 0.5); };
      const sat = c => { const [r, g, b] = rgb(c).map(v => v / 255), mx = Math.max(r, g, b); return mx ? (mx - Math.min(r, g, b)) / mx : 0; };
      const bg = [document.body, document.documentElement].map(e => getComputedStyle(e).backgroundColor).find(solid);
      const area = {};
      for (const el of document.querySelectorAll('button,a,[role=button],input[type=submit]')) { const c = getComputedStyle(el).backgroundColor; if (!solid(c) || sat(c) < 0.35) continue; const r = el.getBoundingClientRect(); area[hex(c)] = (area[hex(c)] || 0) + r.width * r.height; }
      const top = Object.entries(area).sort((a, b) => b[1] - a[1])[0];
      return { page: bg ? hex(bg) : '#ffffff', accent: top ? top[0] : null };
    }).catch(() => ({ page: '#ffffff', accent: null }));
  }

  // A picture of the window. The same picture twice in a row is stored once.
  async function shot(name) {
    await redact();
    if (!flow.hints || !flow.hints.accent) { const h = await hints(); flow.hints = { page: (flow.hints && flow.hints.page) || h.page, accent: h.accent }; }
    const buf = await page.screenshot({ type: 'png', scale: 'device' });
    const hash = crypto.createHash('sha1').update(buf).digest('hex');
    if (hash === lastHash && lastFile && fs.existsSync(path.join(cfg.dir, lastFile))) return lastFile;
    fs.mkdirSync(shotsDir, { recursive: true });
    const rel = `shots/${name}.png`; fs.writeFileSync(path.join(cfg.dir, rel), buf); lastHash = hash; lastFile = rel; return rel;
  }

  const pageUrl = () => page.url();
  const navKey = u => { try { const x = new URL(u); return x.origin + x.pathname + (x.hash.startsWith('#/') ? x.hash : ''); } catch { return u; } };

  // A target: its box in the window, the point to press, its corner radius and a readable name.
  async function resolve(target, { forType = false } = {}) {
    if (/^xy=/.test(target)) { const [x, y] = target.slice(3).split(',').map(Number); return { loc: null, box: { x: x - 12, y: y - 12, w: 24, h: 24 }, point: { x, y }, radius: 8, name: '' }; }
    const loc = locate(target);
    try { await loc.waitFor({ state: 'visible', timeout: 5000 }); }
    catch { throw new Error(`"${target}" is not on the page${/^\d+$/.test(target) ? ' any more: the page changed, run look again' : ''}`); }
    const info = await loc.evaluate(el => {
      const cs = getComputedStyle(el);
      const field = /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName), lab = el.labels && el.labels[0] && el.labels[0].innerText;
      const name = (el.getAttribute('aria-label') || lab || (field ? el.getAttribute('placeholder') || el.getAttribute('name') : el.innerText) || el.getAttribute('title') || '').replace(/\s+/g, ' ').trim().slice(0, 60);
      return { radius: parseFloat(cs.borderTopLeftRadius) || 0, name };
    });
    const bb = await loc.boundingBox();
    if (!bb) throw new Error(`"${target}" has no size on the page`);
    const box = { x: +bb.x.toFixed(1), y: +bb.y.toFixed(1), w: +bb.width.toFixed(1), h: +bb.height.toFixed(1) };
    const px = forType ? box.x + Math.min(box.w - 14, Math.max(box.w * 0.6, 60)) : box.x + box.w / 2;
    return { loc, box, point: { x: +Math.max(box.x + 2, px).toFixed(1), y: +(box.y + box.h / 2).toFixed(1) }, radius: Math.min(info.radius, box.h / 2), name: info.name };
  }

  // A target outside the window is scrolled into view first, and the scroll is recorded so the video shows it.
  const locate = target => /^\d+$/.test(target) ? page.locator(`[data-tv-ref="${target}"]`).first() : page.locator(target).first();

  async function bringIntoView(target, rec) {
    if (/^xy=/.test(target)) return;
    const loc = locate(target);
    await loc.waitFor({ state: 'attached', timeout: 5000 }).catch(() => {});
    const bb = await loc.boundingBox().catch(() => null);
    if (!bb || (bb.y >= 8 && bb.y + bb.height <= H - 8 && bb.x >= 0 && bb.x + bb.width <= W)) return;
    await scrollAction({ loc }, rec, 'into view');
  }

  // Scroll an element into view ({loc}), the window by pixels ({dy}) or a panel by pixels ({loc, dy}),
  // and note which part of the window moved and by how much.
  async function scrollAction({ loc, dy }, rec, label) {
    const id = nextId(), before = rec ? await shot(`${id}-before`) : null, url = pageUrl();
    let res;
    if (loc && dy != null) res = await loc.evaluate((el, dy) => {
      const st = el.scrollTop; el.scrollBy({ top: dy, behavior: 'instant' }); const r = el.getBoundingClientRect();
      return el.scrollTop !== st ? { dy: el.scrollTop - st, box: { x: r.x, y: r.y, w: r.width, h: r.height } } : null;
    }, dy);
    else if (loc) res = await loc.evaluate(el => {
      const anc = []; for (let n = el.parentElement; n; n = n.parentElement) anc.push([n, n.scrollTop]);
      const wy = window.scrollY;
      el.scrollIntoView({ block: 'center', behavior: 'instant' });
      for (const [n, st] of anc) if (n.scrollTop !== st && n !== document.documentElement && n !== document.body) { const r = n.getBoundingClientRect(); return { dy: n.scrollTop - st, box: { x: r.x, y: r.y, w: r.width, h: r.height } }; }
      return window.scrollY !== wy ? { dy: window.scrollY - wy, box: null } : null;
    });
    else res = await page.evaluate(dy => { const wy = window.scrollY; window.scrollBy({ top: dy, behavior: 'instant' }); return window.scrollY !== wy ? { dy: window.scrollY - wy, box: null } : null; }, dy);
    if (!res || !res.dy) return null;
    await sleep(250); await settle(2500);
    if (!rec) return res;
    let box = res.box;
    if (box) { const x0 = Math.max(0, box.x), y0 = Math.max(0, box.y), x1 = Math.min(W, box.x + box.w), y1 = Math.min(H, box.y + box.h); box = { x: +x0.toFixed(1), y: +y0.toFixed(1), w: +(x1 - x0).toFixed(1), h: +(y1 - y0).toFixed(1) }; }
    flow.actions.push({ id, type: 'scroll', label, url, scroll: { dy: Math.round(res.dy), box }, before, after: await shot(`${id}-after`) });
    save(); return res;
  }

  async function pointerAction(type, target, flags, extra) {
    const rec = recording && !flags['no-record'];
    await bringIntoView(target, rec);
    const id = nextId(), url = pageUrl();
    const before = rec ? await shot(`${id}-before`) : null;
    const tg = await resolve(target, { forType: type === 'type' });
    await page.mouse.move(tg.point.x, tg.point.y, { steps: 6 }); await sleep(260);
    const hover = rec ? await shot(`${id}-hover`) : null;
    const a = { id, type, label: flags.label || tg.name || undefined, url, box: tg.box, point: tg.point, radius: tg.radius, before, hover };
    await extra(tg, a, rec);
    await settle();
    if (rec) {
      a.after = await shot(`${id}-after`); a.urlAfter = pageUrl();
      if (navKey(a.urlAfter) !== navKey(url)) a.nav = true;
      flow.actions.push(a); save();
    }
    return `${rec ? id : '(not recorded)'} ${type} ${JSON.stringify(a.label || target)} at ${Math.round(tg.point.x)},${Math.round(tg.point.y)}${a.nav ? '  -> new page ' + a.urlAfter : ''}`;
  }

  const commands = {
    async status() {
      return `browser: ${channel}${cfg.headless ? ' (headless)' : ''}, profile "${cfg.profile}", window ${W}x${H} @${dsf}x\nfolder:  ${cfg.dir}\npage:    ${pageUrl()}\nrecorded: ${flow.actions.length} action(s), recording ${recording ? 'on' : 'off'}, ${flow.masks.length} mask(s), ${flow.blurs.length} blur(s), ${flow.hides.length} hidden`;
    },
    async goto([url]) { if (!url) throw new Error('goto needs a url'); await page.goto(url, { waitUntil: 'domcontentloaded' }); await settle(); return `at ${pageUrl()}`; },
    async wait([what]) {
      if (!what || /^\d+$/.test(what)) await sleep(Number(what || 500));
      else await page.locator(what).first().waitFor({ state: 'visible', timeout: 60000 });
      await settle(); return `ready at ${pageUrl()}`;
    },
    async look(_, flags) {
      const items = await page.evaluate(all => {
        document.querySelectorAll('[data-tv-ref]').forEach(e => e.removeAttribute('data-tv-ref'));
        const sel = 'a[href],button,input:not([type=hidden]),select,textarea,summary,label,[role=button],[role=link],[role=tab],[role=menuitem],[role=menuitemcheckbox],[role=menuitemradio],[role=option],[role=checkbox],[role=radio],[role=switch],[role=combobox],[role=textbox],[contenteditable=true],[tabindex]:not([tabindex="-1"]),[onclick]';
        const out = []; let n = 0;
        for (const el of document.querySelectorAll(sel)) {
          const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
          if (r.width < 4 || r.height < 4 || cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) continue;
          const inWin = r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
          if (!inWin && !all) continue;
          if (inWin) { const hit = document.elementFromPoint(Math.min(innerWidth - 1, Math.max(0, r.left + r.width / 2)), Math.min(innerHeight - 1, Math.max(0, r.top + r.height / 2))); if (hit && !(el.contains(hit) || hit.contains(el))) continue; }
          const role = el.getAttribute('role') || (el.tagName === 'A' ? 'link' : el.tagName === 'INPUT' ? 'input:' + (el.type || 'text') : el.tagName.toLowerCase());
          const field = /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName), lab = el.labels && el.labels[0] && el.labels[0].innerText;
          const name = (el.getAttribute('aria-label') || lab || (field ? el.getAttribute('placeholder') || el.getAttribute('name') : el.innerText) || el.getAttribute('title') || (el.querySelector('img[alt]') || {}).alt || '').replace(/\s+/g, ' ').trim().slice(0, 70);
          el.setAttribute('data-tv-ref', String(++n));
          out.push({ n, role, name, x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), inWin, value: (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') && el.type !== 'password' ? el.value : undefined, checked: el.checked === true || el.getAttribute('aria-checked') === 'true' || undefined });
          if (n >= 200) break;
        }
        const se = document.scrollingElement;
        return { out, title: document.title, scroll: se ? `${Math.round(se.scrollTop)} of ${Math.max(0, se.scrollHeight - innerHeight)}` : '0' };
      }, !!flags.all);
      // the same list as numbered badges on a picture, to tell lookalikes apart
      await redact();
      await page.evaluate(list => {
        const box = document.createElement('div'); box.id = '__tv_marks'; box.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none';
        for (const i of list) if (i.inWin) box.insertAdjacentHTML('beforeend', `<div style="position:absolute;left:${i.x}px;top:${i.y}px;width:${i.w}px;height:${i.h}px;outline:1.5px solid #e8590c"></div><div style="position:absolute;left:${Math.max(0, i.x - 2)}px;top:${Math.max(0, i.y - 9)}px;background:#e8590c;color:#fff;font:700 11px/14px Arial;padding:0 4px;border-radius:3px">${i.n}</div>`);
        document.body.appendChild(box);
      }, items.out);
      fs.mkdirSync(lookDir, { recursive: true });
      const pic = path.join(lookDir, 'look.png');
      await page.screenshot({ path: pic, type: 'png', scale: 'css' });
      await page.evaluate(() => document.getElementById('__tv_marks')?.remove());
      const lines = items.out.map(i => `${String(i.n).padStart(3)}  ${i.role.padEnd(14)} ${JSON.stringify(i.name)}${i.value ? ' value=' + JSON.stringify(i.value) : ''}${i.checked ? ' [checked]' : ''}  @${i.x},${i.y} ${i.w}x${i.h}${i.inWin ? '' : '  (outside the window)'}`);
      return `${pageUrl()}\n"${items.title}"  scrolled ${items.scroll}\n${lines.join('\n') || '(nothing to click)'}\npicture: ${pic}`;
    },
    async shot([name]) {
      await redact(); fs.mkdirSync(lookDir, { recursive: true });
      const pic = path.join(lookDir, `${name || 'shot'}.png`); await page.screenshot({ path: pic, type: 'png', scale: 'css' }); return `picture: ${pic}`;
    },
    async click([target], flags) {
      if (!target) throw new Error('click needs a target');
      return pointerAction('click', target, flags, async () => { await page.mouse.down(); await sleep(60); await page.mouse.up(); });
    },
    async hover([target], flags) {
      if (!target) throw new Error('hover needs a target');
      return pointerAction('hover', target, flags, async () => { await sleep(300); });
    },
    async select([target, option], flags) {
      if (!target || option == null) throw new Error('select needs a target and an option');
      return pointerAction('select', target, flags, async tg => { await tg.loc.selectOption({ label: option }).catch(() => tg.loc.selectOption(option)); });
    },
    async type([target, text], flags) {
      if (!target || text == null) throw new Error('type needs a target and a text');
      return pointerAction('type', target, flags, async (tg, a, rec) => {
        await page.mouse.down(); await sleep(50); await page.mouse.up();
        if (flags.clear && tg.loc) await tg.loc.fill('');
        await sleep(200);
        if (rec) a.focus = await shot(`${a.id}-focus`);
        // one picture of the field after each character, so the video types exactly what the page drew
        const cb = { x: Math.max(0, Math.floor(tg.box.x - 4)), y: Math.max(0, Math.floor(tg.box.y - 4)) };
        cb.w = Math.min(W - cb.x, Math.ceil(tg.box.w + 8)); cb.h = Math.min(H - cb.y, Math.ceil(tg.box.h + 8));
        const chars = [...text], every = Math.ceil(chars.length / 48); a.clips = []; a.clipBox = cb;
        a.text = flags.secret ? '•'.repeat(chars.length) : text;
        for (let i = 0; i < chars.length; i++) {
          await page.keyboard.type(chars[i]); await sleep(35);
          if (rec && ((i + 1) % every === 0 || i === chars.length - 1)) {
            await redact();
            const rel = `shots/${a.id}-k${String(a.clips.length + 1).padStart(2, '0')}.png`;
            fs.writeFileSync(path.join(cfg.dir, rel), await page.screenshot({ type: 'png', scale: 'device', clip: { x: cb.x, y: cb.y, width: cb.w, height: cb.h } }));
            a.clips.push(rel);
          }
        }
      });
    },
    async key([key], flags) {
      if (!key) throw new Error('key needs a key name, for example Enter');
      const rec = recording && !flags['no-record'], id = nextId(), url = pageUrl();
      const before = rec ? await shot(`${id}-before`) : null;
      await page.keyboard.press(key); await settle();
      if (rec) { const a = { id, type: 'key', label: flags.label || key, url, before, after: await shot(`${id}-after`), urlAfter: pageUrl() }; if (navKey(a.urlAfter) !== navKey(url)) a.nav = true; flow.actions.push(a); save(); }
      return `${rec ? id : '(not recorded)'} key ${key}`;
    },
    async scroll([what], flags) {
      if (what == null) throw new Error('scroll needs a number of pixels (optionally --in <panel>) or a target to bring into view');
      const rec = recording && !flags['no-record'], label = flags.label || 'scroll';
      const res = /^-?\d+$/.test(what) ? await scrollAction({ loc: flags.in ? locate(String(flags.in)) : null, dy: Number(what) }, rec, label) : await scrollAction({ loc: locate(what) }, rec, label);
      return res ? `scrolled ${Math.round(res.dy)} px${res.box ? ' inside a panel' : ''}` : 'nothing scrolled. If a panel scrolls and not the window, use: scroll <pixels> --in <panel selector>, or scroll <target>';
    },
    async ring([target], flags) {
      if (!target) throw new Error('ring needs a target');
      await bringIntoView(target, recording);
      const id = nextId(), tg = await resolve(target);
      flow.actions.push({ id, type: 'ring', label: flags.label || tg.name || undefined, url: pageUrl(), box: tg.box, radius: tg.radius, before: await shot(`${id}-before`) }); save();
      return `${id} ring ${JSON.stringify(flags.label || tg.name)}`;
    },
    async mask([from, to], flags) {
      if (flags.clear) { flow.masks = []; save(); return 'masks cleared'; }
      if (!from) return flow.masks.map(m => `${JSON.stringify(m[0])} -> ${JSON.stringify(m[1])}`).join('\n') || '(no masks)';
      flow.masks = flow.masks.filter(m => m[0] !== from); flow.masks.push([from, to ?? '']); save();
      return `every later picture shows ${JSON.stringify(to ?? '')} in place of ${JSON.stringify(from)}`;
    },
    async blur([selector], flags) {
      if (flags.clear) { flow.blurs = []; save(); return 'blurs cleared'; }
      if (!selector) return flow.blurs.join('\n') || '(no blurs)';
      flow.blurs.push(selector); save(); return `every later picture blurs ${selector}`;
    },
    async hide([selector], flags) {
      if (flags.clear) { flow.hides = []; save(); return 'hides cleared'; }
      if (!selector) return flow.hides.join('\n') || '(nothing hidden)';
      flow.hides.push(selector); save(); await redact(); return `every later picture leaves out ${selector}`;
    },
    async eval([code]) { const r = await page.evaluate(code); await settle(1500); return r === undefined ? 'done' : JSON.stringify(r); },
    async brand() {
      const r = await page.evaluate(() => {
        const rgb = c => (c.match(/[\d.]+/g) || []).map(Number);
        const hex = c => { const [r, g, b] = rgb(c); return '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join(''); };
        const sat = c => { const [r, g, b] = rgb(c).map(v => v / 255); const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx ? (mx - mn) / mx : 0; };
        const area = {};
        for (const el of document.querySelectorAll('button,a,[role=button],input[type=submit]')) { const cs = getComputedStyle(el), bg = cs.backgroundColor, a = rgb(bg)[3]; if (a === 0 || sat(bg) < 0.3) continue; const r = el.getBoundingClientRect(); area[hex(bg)] = (area[hex(bg)] || 0) + r.width * r.height; }
        const top = Object.entries(area).sort((a, b) => b[1] - a[1]).slice(0, 3).map(e => e[0]);
        return { buttonColours: top, themeColor: (document.querySelector('meta[name=theme-color]') || {}).content || null, background: hex(getComputedStyle(document.body).backgroundColor), text: hex(getComputedStyle(document.body).color), font: getComputedStyle(document.body).fontFamily, icon: (document.querySelector('link[rel~=icon]') || {}).href || null, title: document.title };
      });
      return JSON.stringify(r, null, 2);
    },
    async record([state]) { if (state) recording = state === 'on'; return `recording ${recording ? 'on' : 'off'}`; },
    async undo() {
      const a = flow.actions.pop(); if (!a) return 'nothing recorded'; save(); lastHash = null;
      return `removed ${a.id} (${a.type} ${JSON.stringify(a.label || '')}). The page itself is not rolled back.`;
    },
    async reset() { flow.actions = []; save(); fs.rmSync(shotsDir, { recursive: true, force: true }); lastHash = null; return 'the capture is empty (masks and blurs are kept)'; },
  };

  const token = crypto.randomBytes(16).toString('hex');
  let queue = Promise.resolve();
  const server = http.createServer((req, res) => {
    let body = ''; req.on('data', d => body += d); req.on('end', () => {
      const send = o => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
      if (req.method !== 'POST' || req.headers['x-token'] !== token) { res.writeHead(403); return res.end(); }   // only our own command line may drive the browser
      let msg; try { msg = JSON.parse(body); } catch { return send({ ok: false, error: 'bad request' }); }
      if (msg.cmd === 'close') { send({ ok: true, out: 'closed' }); return shutdown(); }
      const fn = commands[msg.cmd];
      if (!fn) return send({ ok: false, error: `unknown command "${msg.cmd}". Run: node browser.mjs help` });
      queue = queue.then(() => fn(msg.args || [], msg.flags || {})).then(out => send({ ok: true, out }), e => send({ ok: false, error: String(e.message || e).split('\n')[0] }));
    });
  });
  async function shutdown() { try { fs.rmSync(SESSION, { force: true }); await context.close(); } catch {} process.exit(0); }
  context.on('close', () => { fs.rmSync(SESSION, { force: true }); process.exit(0); });
  server.listen(0, '127.0.0.1', async () => {
    if (cfg.url) { await page.goto(cfg.url, { waitUntil: 'domcontentloaded' }).catch(e => console.error(e.message)); await settle(); }
    save();
    fs.writeFileSync(SESSION, JSON.stringify({ port: server.address().port, token, pid: process.pid, dir: cfg.dir }), { mode: 0o600 });
  });
}
