// Headless checks for the 3D speech model (app/mouth3d.js).
// Run from the repo root:  node tests/mouth3d.headless.js [screenshot-folder]
// Needs Playwright with Chromium. It serves the site itself on a free port.
const http = require('http');
const fs = require('fs');
const path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); } catch (_) { ({ chromium } = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright'))); }

const ROOT = path.resolve(__dirname, '..');
const OUT = process.argv[2] ? path.resolve(process.argv[2]) : null;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

function serve() {
  const srv = http.createServer((req, res) => {
    const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0].split('#')[0]));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise((r) => srv.listen(0, () => r(srv)));
}

let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) failures++; };

(async () => {
  const srv = await serve();
  const url = `http://localhost:${srv.address().port}/index.html#mouth3d`;
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1000, height: 1000 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_/.test(m.text())) errors.push(m.text()); });
  await page.goto(url);
  await page.waitForTimeout(3000);

  const started = await page.evaluate(() => !!window.__three);
  check(started, '3D model starts');
  if (!started) { console.log(await page.$eval('#stage', (e) => e.textContent)); process.exit(1); }
  check(await page.evaluate(() => window.__three.toothCount) === 20, '20 baby teeth (10 top, 10 bottom)');

  const state = () => page.evaluate(() => window.__three._test.state());
  const show = async (s, wait = 900) => { await page.evaluate((s) => window.__three.showSound(s), s); await page.waitForTimeout(wait); return state(); };

  // air route and voicing for each kind of sound
  const expect = {
    S: { mode: 'mouth', voice: 'off' }, Z: { mode: 'mouth', voice: 'on' }, TH: { mode: 'mouth', voice: 'off' },
    AA: { mode: 'mouth', voice: 'on' }, M: { mode: 'nose', voice: 'on' }, N: { mode: 'nose', voice: 'on' },
    P: { mode: 'stop' }, B: { mode: 'stop' }, K: { mode: 'stop' }, G: { mode: 'stop' },
  };
  const gaps = {};
  for (const [s, e] of Object.entries(expect)) {
    const st = await show(s);
    gaps[s] = st.foldGap;
    check(st.mode === e.mode, `${s}: air goes ${e.mode === 'stop' ? 'nowhere, then pops (stop)' : 'out through the ' + e.mode} (got ${st.mode})`);
    if (e.voice) check(st.voice === e.voice, `${s}: voice box ${e.voice === 'on' ? 'buzzing' : 'quiet'} (got ${st.voice})`);
  }
  check(gaps.Z < gaps.S - 0.05, `vocal folds close for Z (${gaps.Z.toFixed(3)}) and open for S (${gaps.S.toFixed(3)})`);

  // soft palate: sealed against the throat for oral sounds, lowered for nasal sounds
  const sTip = (await show('S')).velumTip, mTip = (await show('M')).velumTip;
  check(sTip[0] < 160, `soft palate reaches the back of the throat for S (tip x=${sTip[0].toFixed(0)})`);
  check(mTip[1] > sTip[1] + 40, `soft palate drops for M (tip y ${sTip[1].toFixed(0)} -> ${mTip[1].toFixed(0)})`);

  // stops hold, then release within one cycle
  await page.evaluate(() => window.__three.showSound('P'));
  const phases = [];
  for (let i = 0; i < 14; i++) { phases.push((await state()).phase); await page.waitForTimeout(110); }
  check(phases.some((p) => p < 0.6) && phases.some((p) => p > 0.62), 'P builds up air, then releases it');

  // at rest the model breathes through the nose and the lungs move
  const r1 = await show(null, 300); await page.waitForTimeout(1600); const r2 = await state();
  check(r1.mode === 'breath', 'at rest: breathing');
  check(Math.abs(r2.lungFill - r1.lungFill) > 0.02, `lungs move with breathing (${r1.lungFill.toFixed(2)} -> ${r2.lungFill.toFixed(2)})`);

  // a word streams its sounds in order
  await page.selectOption('#w-pick', 'snake');
  const seen = [];
  for (let i = 0; i < 34; i++) { const st = await state(); if (st.curPid && seen.at(-1) !== st.curPid) seen.push(st.curPid); await page.waitForTimeout(110); }
  check(seen.join(' ') === 'S N EY K', `"snake" plays S N EY K (got ${seen.join(' ')})`);

  // views and labels
  await page.click('[data-view="airway"]'); await page.waitForTimeout(900);
  const air = await state();
  check(['lungs', 'trachea', 'voice', 'nose'].every((l) => air.labels.includes(l)), `lungs-to-nose view shows nose, voice box, windpipe and lungs (${air.labels.join(', ')})`);
  await page.click('[data-view="side"]'); await page.waitForTimeout(900);
  const mouth = await state();
  check(['tongue', 'velum', 'lips'].every((l) => mouth.labels.includes(l)), 'mouth view shows tongue, soft palate and lips');

  // spin all the way round, cut and see-through, saving pictures if a folder was given
  if (OUT) fs.mkdirSync(OUT, { recursive: true });
  const stage = await page.$('#stage');
  for (const cut of [true, false]) {
    const c = await page.$eval('#cut', (e) => e.checked); if (c !== cut) await page.click('#cut');
    for (const [name, t, r] of [['mouth', [0.7, 0.8, 0], 7.4], ['airway', [-0.9, -2.25, 0], 21]]) {
      for (let az = 0; az < 360; az += 45) {
        await page.evaluate(([t, r, az]) => { const { camera, controls } = window.__three._test; const a = az * Math.PI / 180; controls.target.set(...t); camera.position.set(t[0] + r * Math.sin(a), t[1] + r * 0.2, t[2] + r * Math.cos(a)); controls.update(); }, [t, r, az]);
        await page.waitForTimeout(250);
        if (OUT) await stage.screenshot({ path: path.join(OUT, `${name}_${cut ? 'cut' : 'xray'}_${String(az).padStart(3, '0')}.png`) });
      }
    }
  }
  check(errors.length === 0, `no page errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await browser.close(); srv.close();
  console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
  process.exit(failures ? 1 : 0);
})();
