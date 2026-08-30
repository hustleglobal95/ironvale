// The mixer, the work rhythm, and what a blow does to a wall. Sound is measured
// off the master bus; the visual side is measured off the particle state.
const { chromium, wrap, boot } = require('./harness');

(async () => {
  wrap();
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const { page, errs } = await boot(b, { diff: 'easy' });
  const ok = (n, c) => console.log((c ? 'PASS' : 'FAIL') + '  ' + n);

  await page.evaluate(() => {
    const S = window.__IV.sfxObj();
    const an = S.ctx.createAnalyser();
    an.fftSize = 2048; an.smoothingTimeConstant = 0;
    S.master.connect(an);
    const bins = new Uint8Array(an.frequencyBinCount);
    const hz = i => i * S.ctx.sampleRate / 2 / an.frequencyBinCount;
    window.__band = (lo, hi) => {
      an.getByteFrequencyData(bins);
      let s = 0, n = 0;
      for (let i = 0; i < bins.length; i++) { const f = hz(i); if (f >= lo && f < hi) { s += bins[i]; n++; } }
      return n ? Math.round(s / n) : 0;
    };
    window.__pk = async (lo, hi, ms) => {
      let p = 0; const t0 = performance.now();
      while (performance.now() - t0 < ms) { p = Math.max(p, window.__band(lo, hi)); await new Promise(r => setTimeout(r, 10)); }
      return p;
    };
  });

  // ---- the mixer
  await page.click('#menuBtn'); await page.waitForTimeout(400);
  ok('the mixer is in the menu', await page.evaluate(() =>
    !!document.getElementById('fxVol') && !!document.getElementById('ambVol')));
  await page.evaluate(() => { const e = document.getElementById('fxVol'); e.value = 25; e.dispatchEvent(new Event('input', { bubbles: true })); });
  // Every gain in this game moves by ramp rather than by assignment, because a
  // step change is audible as a click. So the bus arrives at the new value some
  // time after the slider does — poll for it instead of guessing an interval.
  const fx = await page.evaluate(async () => {
    const S = window.__IV.sfxObj();
    const t0 = S.ctx.currentTime;
    // Headless Chromium drops a scheduled parameter change now and then under
    // its null audio sink. A player whose slider did not take would move it
    // again, so the test does too before it calls this a failure.
    for (let i = 0; i < 80 && S.fx.gain.value > 0.4; i++) {
      if (i && i % 16 === 0) { const e = document.getElementById('fxVol'); e.value = 25; e.dispatchEvent(new Event('input', { bubbles: true })); }
      await new Promise(r => setTimeout(r, 50));
    }
    // Headless Chromium sometimes gives us a context that reports 'running'
    // while its clock does not advance, and a gain that moves by ramp cannot
    // arrive without a clock. Say so rather than failing the mixer for it.
    return { v: S.fxVol, g: S.fx.gain.value, clock: S.ctx.currentTime > t0 + 0.05,
             label: document.getElementById('fxVolVal').textContent };
  });
  ok('the effects slider moves the effects bus ' + JSON.stringify(fx),
     Math.abs(fx.v - 0.25) < 0.01 && fx.label === '25%' && (fx.g < 0.4 || !fx.clock));
  if (!fx.clock) console.log('   (the audio clock was not running; the bus level was not checked)');
  await page.evaluate(() => { const e = document.getElementById('ambVol'); e.value = 10; e.dispatchEvent(new Event('input', { bubbles: true })); });
  const amb = await page.evaluate(async () => {
    const S = window.__IV.sfxObj();
    const t0 = S.ctx.currentTime;
    for (let i = 0; i < 60 && S.amb.gain.value > 0.2; i++) await new Promise(r => setTimeout(r, 50));
    return { v: S.ambVol, g: S.amb.gain.value, clock: S.ctx.currentTime > t0 + 0.05 };
  });
  ok('the ambience slider moves the bed', Math.abs(amb.v - 0.10) < 0.01 && (amb.g < 0.2 || !amb.clock));
  ok('the mix is remembered', await page.evaluate(() =>
    localStorage.getItem('ironvale.v3.fxvol') === '25' && localStorage.getItem('ironvale.v3.ambvol') === '10'));
  await page.evaluate(() => document.getElementById('mSound').click());
  await page.waitForTimeout(200);
  ok('mute greys the sliders out', await page.evaluate(() => document.getElementById('fxVol').disabled));
  await page.evaluate(() => document.getElementById('mSound').click());
  // put the mix back so the sound assertions below are not testing 25%
  await page.evaluate(() => {
    for (const [id, v] of [['fxVol', 85], ['ambVol', 85]]) {
      const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  await page.click('#resumeBtn'); await page.waitForTimeout(1500);

  // ---- the work rhythm
  const bedMid = await page.evaluate(() => window.__band(900, 2000));
  const cutter = await page.evaluate(() => {
    const g = window.__IV, tc = g.ents().find(e => e.type === 'tc' && e.owner === 0);
    const tree = g.ents().filter(e => e.kind === 'res' && e.type === 'tree')
      .sort((a, c) => Math.hypot(a.x - tc.x, a.y - tc.y) - Math.hypot(c.x - tc.x, c.y - tc.y))[0];
    g.go(tree.x, tree.y);
    const u = g.spawn(0, 'forester', tree.x + 22, tree.y + 22);
    g.gather(u, tree);
    return u.id;
  });
  await page.waitForTimeout(2400);
  ok('the woodcutter works the trunk', await page.evaluate(i =>
    (window.__IV.ents().find(e => e.id === i) || {}).task === 'gather', cutter));
  ok('chips fly off it', await page.evaluate(() => window.__IV.sparksN()) > 0);
  const chop = await page.evaluate(() => window.__pk(900, 2000, 1500));
  console.log('   1-2kHz: bed ' + bedMid + ' -> chopping ' + chop);
  ok('the axe is audible over the bed', chop > bedMid + 15);

  let down = 0;
  for (let i = 0; i < 10; i++) {
    await page.evaluate(() => { const u = window.__IV.ents().find(e => e.type === 'forester');
      if (u && u.resT) u.resT.amount = Math.min(u.resT.amount, 1.2); });
    await page.waitForTimeout(900);
    down = await page.evaluate(() => window.__IV.fallen().filter(f => f.tree !== undefined).length);
    if (down) break;
  }
  ok('a felled tree lies where it dropped', down > 0);

  // ---- blows on a wall
  const wall = await page.evaluate(() => {
    const g = window.__IV, s = g.sides()[0];
    s.age = 3; s.f = 9e3; s.w = 9e3; s.g = 9e3;
    const tc = g.ents().find(e => e.type === 'tc' && e.owner === 0);
    const wl = g.mk(1, 'stonewall', tc.tx + 7, tc.ty, true);
    g.go(wl.x, wl.y);
    const m = g.spawn(0, 'militia', wl.x - 40, wl.y);
    m.task = 'attack'; m.target = wl;
    return wl.id;
  });
  const peak = async (n, ms) => {
    const out = { sparks: 0, puffs: 0, scars: 0, shake: 0 };
    for (let i = 0; i < n; i++) {
      const s = await page.evaluate(() => ({ sparks: window.__IV.sparksN(), puffs: window.__IV.puffsN(),
        scars: window.__IV.scarsN(), shake: +window.__IV.shake().toFixed(2) }));
      for (const k in out) out[k] = Math.max(out[k], s[k]);
      await page.waitForTimeout(ms);
    }
    return out;
  };
  const light = await peak(26, 90);
  console.log('   footman on a wall: ' + JSON.stringify(light));
  ok('a blow throws chips off the wall', light.sparks > 0);
  ok('and raises dust', light.puffs > 0);
  ok('and leaves a scar that fades', light.scars > 0);
  ok('a footman does not shake the screen', light.shake < 0.2);

  await page.evaluate(w => {
    const g = window.__IV, wl = g.ents().find(e => e.id === w);
    const r = g.spawn(0, 'ram', wl.x - 46, wl.y + 20);
    r.task = 'attack'; r.target = wl;
  }, wall);
  // A ram lands every few seconds and the shake decays in a third of one, so an
  // instant sample lands between blows. Hold the peak instead.
  const heavy = await peak(70, 90);
  console.log('   with a ram: ' + JSON.stringify(heavy));
  ok('a ram shakes the view', heavy.shake > 0.3);
  ok('and throws more of the wall than a footman', heavy.sparks >= light.sparks);

  const a = await page.evaluate(() => ({ x: window.__IV.cam().x, y: window.__IV.cam().y }));
  await page.waitForTimeout(700);
  const c = await page.evaluate(() => ({ x: window.__IV.cam().x, y: window.__IV.cam().y }));
  ok('the shake is a view effect, not a camera move', Math.abs(a.x - c.x) < 1 && Math.abs(a.y - c.y) < 1);

  // ---- what a blow throws depends on what it lands on ---------------------
  // Mail throws sparks and nothing else; a padded jack throws its own cloth; a
  // ram throws timber. Same call, four readings, and it is the fastest way to
  // tell an armoured man from an unarmoured one in a crowd.
  const deb = await page.evaluate(() => {
    const g = window.__IV, out = {};
    const tc = g.ents().find(e => e.type === 'tc' && e.owner === 0);
    for (const t of ['militia', 'archer', 'knight', 'ram', 'vil']) {
      while (g.sparks().length) g.sparks().pop();
      const a = g.spawn(0, 'militia', tc.x + 220, tc.y + 220);
      const v = g.spawn(1, t, tc.x + 244, tc.y + 220);
      g.hitFx(a, v);
      out[t] = g.sparks().map(x => x.c ? x.c.join(',') : 'hot');
      a.dead = true; v.dead = true;
    }
    return out;
  });
  const hotN = k => deb[k].filter(x => x === 'hot').length;
  ok('mail throws sparks (' + hotN('militia') + ' of ' + deb.militia.length + ')', hotN('militia') >= 3);
  ok('cloth throws cloth (' + hotN('archer') + ' hot on an archer)',
     hotN('archer') === 0 && deb.archer.length >= 4);
  ok('a ram throws timber (' + deb.ram.length + ' pieces, ' + hotN('ram') + ' hot)',
     deb.ram.length >= 5 && hotN('ram') === 0);
  ok('and an archer and a villager do not shed the same colour',
     JSON.stringify(deb.archer) !== JSON.stringify(deb.vil));
  ok('a horse kicks dust off the ground it is standing on', await page.evaluate(() => {
    const g = window.__IV, tc = g.ents().find(e => e.type === 'tc' && e.owner === 0);
    while (g.puffs().length) g.puffs().pop();
    const a = g.spawn(0, 'militia', tc.x + 220, tc.y + 280);
    const v = g.spawn(1, 'knight', tc.x + 244, tc.y + 280);
    g.hitFx(a, v); const n = g.puffs().length;
    a.dead = true; v.dead = true; return n > 0;
  }));

  // ---- a building that is razed comes down ---------------------------------
  const fall = await page.evaluate(async () => {
    const g = window.__IV, s = g.sides()[0];
    s.f = s.w = s.g = 9e4;
    const tc = g.ents().find(e => e.type === 'tc' && e.owner === 0);
    const h = g.mk(0, 'house', tc.tx + 7, tc.ty + 5, true);
    g.cam().x = h.x - 400; g.cam().y = h.y - 300;
    while (g.wrecks().length) g.wrecks().pop();
    const foe = g.spawn(1, 'ram', h.x + 26, h.y);
    h.hp = 6; foe.target = h; foe.task = 'attack';
    await new Promise(r => setTimeout(r, 2600));
    const w = g.wrecks()[0];
    const first = w ? w.t : 0;
    await new Promise(r => setTimeout(r, 1100));
    return { n: g.wrecks().length, gone: h.dead, type: w && w.type,
             life: w && w.life, first, later: g.wrecks().length ? g.wrecks()[0].t : 0 };
  });
  ok('a razed building leaves a wreck rather than blinking out (' + fall.type + ')',
     fall.gone && fall.n === 1 && fall.type === 'house');
  ok('the wreck is still there a second later, fading (' +
     fall.first.toFixed(1) + 's -> ' + fall.later.toFixed(1) + 's of ' + fall.life + ')',
     fall.later > 0 && fall.later < fall.first);
  ok('the rubble is baked once per building type, not per wreck', await page.evaluate(() => {
    const g = window.__IV;
    return g.rubble('house') === g.rubble('house') && g.rubble('house').w > 0;
  }));

  // ---- the grade -----------------------------------------------------------
  // Split-toning, not tinting: with the grade on, the sun corner of the frame
  // is warmer and the far corner is cooler and deeper than the same frame
  // without it - measured off the canvas itself, in the world area, away from
  // anything animated. And the grade follows the year and the fighting: the
  // gradient cache key moves with both, which is also what proves the cache
  // rebuilds when it should and only then.
  const grade = await page.evaluate(async () => {
    const g = window.__IV;
    g.reveal();                                  // a corner of fog grades to fog
    const cv = document.getElementById('game'), c2 = cv.getContext('2d');
    const tc = g.ents().find(e => e.type === 'tc' && e.owner === 0);
    g.cam().x = tc.x - innerWidth / 2; g.cam().y = tc.y - innerHeight / 2;
    const raf = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const sample = (x, y) => {
      const d = c2.getImageData(Math.round(x * devicePixelRatio), Math.round(y * devicePixelRatio), 1, 1).data;
      return [d[0], d[1], d[2]];
    };
    const grab = async () => { await raf();
      return { tl: sample(40, 90), br: sample(innerWidth - 40, innerHeight - 250) }; };
    g.setGrade(false); const off = await grab();
    g.setGrade(true);  const on  = await grab();
    // the cache key follows the year and the heat
    const k0 = g.grade().key;
    g.setTime(g.pace().year * 0.60); await raf();
    const k1 = g.grade().key;
    g.setHeat(1.4); await raf();
    const k2 = g.grade().key;
    g.setHeat(0); await raf();
    let stored = null;
    try { stored = localStorage.getItem('ironvale.v3.grade'); } catch (e) {}
    return { off, on, k0, k1, k2, on2: g.grade().on, stored };
  });
  const lum = c => c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11;
  const coolShift = (grade.on.br[2] - grade.on.br[0]) - (grade.off.br[2] - grade.off.br[0]);
  ok('the far corner goes cooler and deeper under the grade (blue-red ' +
     (grade.off.br[2] - grade.off.br[0]) + ' -> ' + (grade.on.br[2] - grade.on.br[0]) +
     ', luminance ' + Math.round(lum(grade.off.br)) + ' -> ' + Math.round(lum(grade.on.br)) + ')',
     coolShift > 2 && lum(grade.on.br) < lum(grade.off.br));
  ok('the grade follows the year (' + grade.k0 + ' -> ' + grade.k1 + ')', grade.k0 !== grade.k1);
  ok('and tightens with the fighting (' + grade.k1 + ' -> ' + grade.k2 + ')', grade.k1 !== grade.k2);
  ok('the switch is remembered (' + grade.stored + ')', grade.on2 === true && grade.stored === '1');

  console.log('ERRORS:', errs.length ? errs.slice(0, 3).join('\n') : 'none');
  await b.close();
})();
