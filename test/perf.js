// Render-cost benchmark.
//
//   node test/perf.js [file.html] [label]
//
// Frame-rate sampling through requestAnimationFrame is dominated by whatever
// else the machine is doing, so it cannot tell a 10% rendering change from
// noise. This measures the thing we actually control: the wall time of one
// draw() call, taken as the median of seven batches of twenty synchronous
// calls, with the whole map revealed so nothing is culled.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const src = process.argv[2] ? path.resolve(process.argv[2]) : path.join(ROOT, 'ironvale.html');
const label = process.argv[3] || path.basename(src);
const TMP = path.join(ROOT, '.tmp');
const OUT = path.join(TMP, 'perf.html');

let html = fs.readFileSync(src, 'utf8');
if (!/window\.__IVP=/.test(html)) {
  html = html.replace(/\n(function draw\(\)|function frame\()/,
    "\nwindow.__IVP={reveal:()=>{vis.fill(2);},go:centerOn,draw:()=>draw()," +
    "dims:()=>[MAP_W,MAP_H,WORLD_W,WORLD_H]," +
    "spr:()=>(typeof SPRITE==='object'?Object.keys(SPRITE).length:-1)};\n$1");
}
fs.mkdirSync(TMP, { recursive: true });
fs.writeFileSync(OUT,
  '<!doctype html><html><head><meta charset="utf-8"></head><body>' + html + '</body></html>');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  await page.goto('file://' + OUT);
  await page.waitForTimeout(400);
  await page.click('.diff[data-d="easy"]').catch(() => {});
  await page.click('#startBtn');
  await page.waitForTimeout(1200);

  if (!await page.evaluate(() => typeof window.__IVP === 'object')) {
    console.log('no hook could be injected into ' + label);
    await browser.close();
    return;
  }
  await page.evaluate(() => window.__IVP.reveal());

  const sample = async name => {
    const ms = await page.evaluate(() => {
      const runs = [];
      for (let b = 0; b < 7; b++) {
        const t0 = performance.now();
        for (let i = 0; i < 20; i++) window.__IVP.draw();
        runs.push((performance.now() - t0) / 20);
      }
      runs.sort((a, b) => a - b);
      return runs[3];
    });
    return name + ': ' + ms.toFixed(2) + 'ms';
  };

  const d = await page.evaluate(() => window.__IVP.dims());
  const out = [];
  await page.evaluate(() => window.__IVP.go(400, 400));
  out.push(await sample('start-area'));
  await page.evaluate(([w, h]) => window.__IVP.go(w * 0.5, h * 0.5), [d[2], d[3]]);
  out.push(await sample('map-centre'));
  await page.evaluate(([w, h]) => window.__IVP.go(w * 0.8, h * 0.25), [d[2], d[3]]);
  out.push(await sample('far-quadrant'));

  const spr = await page.evaluate(() => window.__IVP.spr());
  console.log('=== ' + label + '  (sprites cached: ' + spr + ')');
  console.log(out.join('  |  '));
  if (errs.length) console.log('ERRORS: ' + errs.join('; '));
  await browser.close();
})();
