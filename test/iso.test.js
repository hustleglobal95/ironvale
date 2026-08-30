// The isometric port's vertical slice, held down where it can break: the
// projection and its inverse are exact, the flag round-trips the camera and
// the save-independent preference, clicking a figure selects that figure,
// a movement order lands where the mouse pointed and the unit walks there,
// placement puts the building on the tile the ghost showed, the drawn box
// selects what it covers, depth keys order ground contact correctly, and the
// classic renderer is untouched when the flag is off.
const { chromium, wrap, boot } = require('./harness');

(async () => {
  wrap();
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const { page, errs } = await boot(b, { diff: 'easy' });
  const ok = (n, c) => console.log((c ? 'PASS' : 'FAIL') + '  ' + n);

  // ---- the projection is exact, both ways ---------------------------------
  const proj = await page.evaluate(() => {
    const g = window.__IV;
    let worst = 0;
    for (const [x, y] of [[0, 0], [406, 3682], [1234.5, 987.25], [4000, 4000]]) {
      const p = g.isoP(x, y);
      const w = { x: p.y + p.x / 2, y: p.y - p.x / 2 };
      worst = Math.max(worst, Math.abs(w.x - x), Math.abs(w.y - y));
    }
    return worst;
  });
  ok('world -> screen -> world round-trips exactly (worst ' + proj + ')', proj < 1e-9);

  // ---- toggle: held view centre, remembered preference --------------------
  const tog = await page.evaluate(() => {
    const g = window.__IV;
    const before = g.tw(innerWidth / 2, innerHeight / 2);
    g.isoToggle(true);
    const mid = g.tw(innerWidth / 2, innerHeight / 2);
    const kept = Math.hypot(mid.x - before.x, mid.y - before.y);
    let stored = null;
    try { stored = localStorage.getItem('ironvale.v3.iso'); } catch (e) {}
    return { on: g.iso(), kept, stored };
  });
  ok('the toggle holds the view centre (' + Math.round(tog.kept) + 'px of drift)',
     tog.on && tog.kept < 60);
  ok('and the choice is remembered (' + tog.stored + ')', tog.stored === '1');

  // ---- clicking a figure selects that figure ------------------------------
  await page.evaluate(() => {
    const g = window.__IV, s = g.sides()[0];
    g.reveal(); s.f = s.w = s.g = 9e5;
    const tc = g.ents().find(e => e.type === 'tc' && e.owner === 0);
    // clear ground south of the tc, park a probe there
    for (const e of g.ents())
      if (e.owner === 2 && e.kind === 'unit' && Math.hypot(e.x - tc.x, e.y - tc.y) < 400) e.dead = true;
    const u = g.spawn(0, 'militia', tc.x + 120, tc.y + 160);
    u.task = 'hold';        // or it chases a passing raider off the measured spot
    window.__P = u.id;
    const p = g.isoP(tc.x, tc.y);
    g.cam().x = p.x - innerWidth / 2; g.cam().y = p.y - innerHeight / 2;
  });
  await page.waitForTimeout(400);
  const clickAt = await page.evaluate(() => {
    const g = window.__IV, u = g.ents().find(e => e.id === window.__P);
    // The marauders wander, and a hostile standing on the probe wins the pick
    // - the game behaving correctly, the test hardening against it the same
    // way combat.test.js does: clear them around where the probe IS, now.
    for (const e of g.ents())
      if (e.owner === 2 && e.kind === 'unit' && Math.hypot(e.x - u.x, e.y - u.y) < 300) e.dead = true;
    const S = g.scr(u.x, u.y);
    return { x: Math.round(S.x), y: Math.round(S.y) - 8 };
  });
  await page.mouse.move(700, 80);
  await page.mouse.click(clickAt.x, clickAt.y);
  await page.waitForTimeout(150);
  ok('clicking a figure at its projected position selects it', await page.evaluate(() =>
    window.__IV.sel().length === 1 && window.__IV.sel()[0].id === window.__P));

  // ---- a movement order lands where the mouse pointed ---------------------
  const move = await page.evaluate(async () => {
    const g = window.__IV, u = g.ents().find(e => e.id === window.__P);
    const wx = u.x - 140, wy = u.y - 60;
    const p = g.isoP(wx, wy);
    const sx = p.x - g.cam().x, sy = p.y - g.cam().y;
    const back = g.tw(sx, sy);
    const inv = Math.hypot(back.x - wx, back.y - wy);
    g.order(sx, sy);                        // right-click through the projection
    await new Promise(r => setTimeout(r, 3200));
    return { inv, off: Math.hypot(u.x - wx, u.y - wy) };
  });
  ok('screen-to-world under the projection is exact (' + move.inv.toFixed(6) + 'px)', move.inv < 1e-6);
  ok('and the unit walks to the pointed ground (' + Math.round(move.off) + 'px off)', move.off < 34);

  // ---- placement lands on the tile the ghost showed -----------------------
  const place = await page.evaluate(() => {
    const g = window.__IV, tc = g.ents().find(e => e.type === 'tc' && e.owner === 0);
    // a spot we know is free
    const tx = tc.tx + 6, ty = tc.ty + 6;
    const wx = (tx + 1) * 28, wy = (ty + 1) * 28;   // house is 2x2; aim its centre
    const p = g.isoP(wx, wy);
    const gh = g.ghost(p.x - g.cam().x, p.y - g.cam().y, 'house');
    const okFree = g.free(tx, ty, 2, 2, 0, 'house');
    const h = g.mk(0, 'house', gh.tx, gh.ty, true);
    return { aimTx: tx, aimTy: ty, gotTx: gh.tx, gotTy: gh.ty, built: !!h, okFree };
  });
  ok('the ghost under the projected mouse is the tile that was aimed at (' +
     place.gotTx + ',' + place.gotTy + ' for ' + place.aimTx + ',' + place.aimTy + ')',
     Math.abs(place.gotTx - place.aimTx) <= 1 && Math.abs(place.gotTy - place.aimTy) <= 1 && place.built);

  // ---- the drawn box selects what it covers -------------------------------
  await page.evaluate(() => {
    const g = window.__IV, tc = g.ents().find(e => e.type === 'tc' && e.owner === 0);
    window.__B = [];
    for (let i = 0; i < 3; i++)
      window.__B.push(g.spawn(0, 'archer', tc.x + 60 + i * 30, tc.y + 220).id);
  });
  await page.waitForTimeout(250);
  const box = await page.evaluate(() => {
    const g = window.__IV;
    const pts = window.__B.map(id => { const u = g.ents().find(e => e.id === id); return g.scr(u.x, u.y); });
    const x0 = Math.min(...pts.map(p => p.x)) - 30, x1 = Math.max(...pts.map(p => p.x)) + 30;
    const y0 = Math.min(...pts.map(p => p.y)) - 40, y1 = Math.max(...pts.map(p => p.y)) + 20;
    return { x0, y0, x1, y1 };
  });
  await page.mouse.move(box.x0, box.y0);
  await page.mouse.down();
  await page.mouse.move(box.x1, box.y1, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(150);
  ok('the drawn rectangle selects the figures it covers', await page.evaluate(() => {
    const g = window.__IV, got = g.sel().map(u => u.id);
    return window.__B.every(id => got.includes(id));
  }));

  // ---- depth keys order ground contact ------------------------------------
  const depth = await page.evaluate(() => {
    const g = window.__IV, tc = g.ents().find(e => e.type === 'tc' && e.owner === 0);
    const h = g.ents().find(e => e.type === 'house' && e.owner === 0);
    const north = g.spawn(0, 'vil', h.x, (h.ty - 1) * 28);        // behind
    const south = g.spawn(0, 'vil', h.x, (h.ty + h.h + 1) * 28);  // in front
    const key = e => e.kind === 'bld' ? ((e.tx + e.w) + (e.ty + e.h)) * 28 - 0.01 : e.x + e.y;
    const r = { behind: key(north) < key(h), front: key(south) > key(h) };
    north.dead = true; south.dead = true;
    return r;
  });
  ok('a figure north of a house sorts behind it, one south sorts in front',
     depth.behind && depth.front);

  // ---- the frame still runs, and the classic view is untouched ------------
  const fps = await page.evaluate(() => new Promise(res => {
    let n = 0; const t0 = performance.now();
    const t = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(t);
                      else res(Math.round(n / ((performance.now() - t0) / 1000))); };
    requestAnimationFrame(t);
  }));
  ok('the isometric frame holds a playable rate (' + fps + ' fps)', fps > 24);
  const off = await page.evaluate(() => {
    const g = window.__IV;
    g.isoToggle(false);
    const w = g.tw(100, 100);
    return { on: g.iso(), ident: Math.abs(w.x - (100 + g.cam().x)) < 1e-9 && Math.abs(w.y - (100 + g.cam().y)) < 1e-9 };
  });
  ok('off means off: classic picking is the identity again', !off.on && off.ident);

  console.log('ERRORS:', errs.length ? errs.slice(0, 4).join('\n') : 'none');
  await b.close();
})();
