// The three-dimensional view. Two things matter here and they pull against
// each other: it has to look like a place, and it must not become a different
// game. Every assertion below is one or the other.
const { chromium, wrap, boot, hud } = require('./harness');

(async () => {
  wrap();
  const b = await chromium.launch();
  const { page, errs } = await boot(b, { diff: 'easy' });
  const ok = (n, c) => console.log((c ? 'PASS' : 'FAIL') + '  ' + n);

  // ---- it comes up at all
  const up = await page.evaluate(() => {
    const g = window.__IV; g.v3on(); const V = g.v3();
    return { on: V.on, ready: V.ready, tris: V.triCount / 3, water: (V.waterCount || 0) / 3,
             err: g.glErr(), body: document.body.classList.contains('v3d') };
  });
  ok('the 3D view starts and builds a terrain mesh (' + up.tris + ' triangles)',
     up.on && up.ready && up.tris > 1000);
  ok('the map has a water surface of its own (' + up.water + ' triangles)', up.water > 0);
  ok('no GL error after the first frames', up.err === 0);
  ok('the page is marked as 3D so the flat canvas steps aside', up.body);

  // ---- elevation is decoration and nothing else
  const flat = await page.evaluate(() => {
    const g = window.__IV;
    const u = g.ents().find(e => e.kind === 'unit' && e.owner === 0);
    const before = { x: u.x, y: u.y, id: u.id };
    // the height field must have relief, and the unit must not have any
    let lo = 1e9, hi = -1e9;
    const [MW, MH] = g.dims();
    for (let i = 0; i < 200; i++) {
      const h = g.hAt(Math.random() * MW * 28, Math.random() * MH * 28);
      lo = Math.min(lo, h); hi = Math.max(hi, h);
    }
    return { before, relief: hi - lo, z: u.z === undefined };
  });
  ok('the ground actually rolls (' + flat.relief.toFixed(0) + ' units of relief)', flat.relief > 40);
  ok('units carry no height of their own — the simulation stays flat', flat.z);

  // ---- picking: what you click is what you see
  const pick = await page.evaluate(() => {
    const g = window.__IV; g.reveal();
    const out = [];
    for (let sx = 150; sx <= 1300; sx += 160)
      for (let sy = 100; sy <= 690; sy += 90) {
        const w = g.tw(sx, sy), s = g.proj(w.x, w.y);
        if (!s) continue;
        out.push(Math.hypot(s[0] - sx, s[1] - sy));
      }
    out.sort((a, c) => a - c);
    return { n: out.length, med: out[out.length >> 1], p90: out[Math.floor(out.length * 0.9)] };
  });
  ok('a click lands where the pixel is drawn (median ' + pick.med.toFixed(0) +
     'px, p90 ' + pick.p90.toFixed(0) + 'px)', pick.med < 28 && pick.p90 < 84);

  // ---- figures are picked where they are drawn, not where their feet land
  const figs = await page.evaluate(() => {
    const g = window.__IV;
    const all = g.ents().filter(e => !e.dead && (e.kind === 'unit' || e.kind === 'bld'));
    const us = g.ents().filter(e => e.kind === 'unit' && e.owner === 0).slice(0, 12);
    let hit = 0, n = 0;
    for (const u of us) {
      const s = g.proj(u.x, u.y);
      if (!s || s[0] < 20 || s[0] > innerWidth - 20 || s[1] < 60 || s[1] > innerHeight - 180) continue;
      // A figure with somebody else standing on the same pixels is drawn
      // behind them, and picking the one in front is the right answer. Only
      // figures standing alone can say anything about whether picking works.
      let crowded = false;
      for (const o of all) {
        if (o === u) continue;
        const t = g.proj(o.x, o.y);
        if (t && Math.hypot(t[0] - s[0], t[1] - s[1]) < 26) { crowded = true; break; }
      }
      if (crowded) continue;
      n++;
      const p = g.pickH(s[0], s[1] - 8);
      if (p && p.id === u.id) hit++;
    }
    return { hit, n };
  });
  ok('every figure on screen picks as itself (' + figs.hit + '/' + figs.n + ')',
     figs.n > 0 && figs.hit === figs.n);

  // ---- the game is actually playable through the 3D camera. Every mouse path
  // funnels through toWorld(), so this is the assertion that the funnel holds.
  const id = await page.evaluate(() => {
    const g = window.__IV;
    const u = g.ents().find(e => e.kind === 'unit' && e.owner === 0 && e.type === 'vil');
    // Stand him still and give him room. The question here is whether a click
    // in the three-dimensional view reaches the right figure, not whether the
    // valley is busy — and the valley is busy now.
    u.task = 'idle'; u.target = null; u.resT = null; u.vx = 0; u.vy = 0;
    g.ents().forEach(e => {
      if (e !== u && e.kind === 'unit' && Math.hypot(e.x - u.x, e.y - u.y) < 90) {
        if (e.owner !== 0) e.dead = true;
        else { e.x += 150; e.task = 'idle'; e.target = null; e.resT = null; e.vx = 0; e.vy = 0; }
      }
    });
    g.go(u.x, u.y);
    return u.id;
  });
  await page.waitForTimeout(400);
  await page.waitForTimeout(200);
  const at = await page.evaluate(i => {
    const u = window.__IV.ents().find(e => e.id === i);
    return window.__IV.proj(u.x, u.y);
  }, id);
  await page.mouse.click(at[0], at[1] - 8);
  await page.waitForTimeout(300);
  ok('clicking a figure selects it in 3D',
     await page.evaluate(() => window.__IV.sel().length === 1));

  await page.mouse.click(at[0] + 220, at[1] + 60, { button: 'right' });
  await page.waitForTimeout(1200);
  ok('right-clicking the ground orders a move in 3D', await page.evaluate(i => {
    const u = window.__IV.ents().find(e => e.id === i);
    return u && (u.task === 'move' || u.task === 'gather');
  }, id));

  const before = await page.evaluate(() => {
    const s = window.__IV.sides()[0]; s.w = 900; s.f = 900;
    return window.__IV.ents().filter(e => e.kind === 'bld' && e.owner === 0).length;
  });
  await page.keyboard.press('e');
  await page.waitForTimeout(200);
  ok('a build card arms in 3D', await page.evaluate(() => !!window.__IV.placing()));
  // Hunt for ground the ghost is willing to sit on rather than assuming a fixed
  // offset is clear — in 3D that offset lands wherever the hillside puts it.
  let spot = null;
  for (const [dx, dy] of [[-160,40],[-220,10],[-90,80],[160,60],[220,-10],[60,110],[-260,90],[280,80]]) {
    const sx = at[0] + dx, sy = at[1] + dy;
    if (sx < 40 || sx > 1400 || sy < 70 || sy > 700) continue;
    await page.mouse.move(sx, sy);
    await page.waitForTimeout(120);
    if (await page.evaluate(p => window.__IV.ghostOk(p[0], p[1]), [sx, sy])) { spot = [sx, sy]; break; }
  }
  ok('the ghost finds ground it will accept', !!spot);
  // Somebody may have walked into the footprint between the hunt and the
  // click. Re-read the ghost at the last moment and step aside if so, rather
  // than blaming the placement for a villager who wandered past.
  if (spot) {
    for (let n = 0; n < 6; n++) {
      if (await page.evaluate(p => window.__IV.ghostOk(p[0], p[1]), spot)) break;
      await page.waitForTimeout(250);
      await page.mouse.move(spot[0], spot[1]);
    }
    await page.mouse.click(spot[0], spot[1]); await page.waitForTimeout(500);
  }
  ok('and the building goes down where the ghost was', await page.evaluate(n =>
    window.__IV.ents().filter(e => e.kind === 'bld' && e.owner === 0).length > n, before));

  // ---- the camera moves without the game noticing
  const cam = await page.evaluate(() => {
    const g = window.__IV, V = g.v3();
    const a = { yaw: V.yaw, pitch: V.pitch, dist: V.dist };
    const t0 = g.t(), n0 = g.ents().length;
    g.orbit(0.3, 0.1, 1.4);
    return { moved: V.yaw !== a.yaw && V.pitch !== a.pitch && V.dist !== a.dist,
             clamped: V.pitch <= 1.30 && V.dist <= 2600, ents: g.ents().length === n0 };
  });
  ok('orbit and zoom move the camera', cam.moved);
  ok('the camera stays inside its limits', cam.clamped);
  ok('moving the camera changes nothing in the world', cam.ents);

  // ---- and back again
  const back = await page.evaluate(() => {
    const g = window.__IV; g.v3on();
    const V = g.v3();
    const w = g.tw(700, 400);
    const c = g.cam();
    return { off: !V.on, body: !document.body.classList.contains('v3d'),
             flatPick: Math.abs(w.x - (700 + c.x)) < 1 && Math.abs(w.y - (400 + c.y)) < 1 };
  });
  ok('the flat view comes back', back.off && back.body);
  ok('and picking goes back to being a straight offset', back.flatPick);

  const h = await hud(page);
  ok('the game is still running after both switches', h.over === 'none');

  console.log('ERRORS:', errs.length ? errs.slice(0, 3).join('\n') : 'none');
  await b.close();
})();
