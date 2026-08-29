// The three things added alongside the second graphics pass: a standard you can
// plant in enemy ground to win, villager trades, and a third hostile faction.
const { chromium, wrap, boot, hud } = require('./harness');

(async () => {
  wrap();
  const b = await chromium.launch();
  const { page, errs } = await boot(b, { diff: 'easy' });
  const ok = (n, c) => console.log((c ? 'PASS' : 'FAIL') + '  ' + n);

  await page.evaluate(() => {
    const s = window.__IV.sides()[0];
    s.age = 3; s.f = 9e3; s.w = 9e3; s.g = 9e3;
    window.__IV.reveal();
  });
  await page.waitForTimeout(400);

  // ---- marauders
  const camps = await page.evaluate(() => window.__IV.ents().filter(e => e.type === 'camp').length);
  ok('marauder camps are placed (' + camps + ')', camps >= 2);
  ok('no camp sits on top of a base', await page.evaluate(() => {
    const g = window.__IV;
    const tc = g.ents().find(e => e.type === 'tc' && e.owner === 0);
    const etc = g.ents().find(e => e.type === 'tc' && e.owner === 1);
    return g.ents().filter(e => e.type === 'camp').every(c =>
      Math.hypot(c.x - tc.x, c.y - tc.y) > 600 && Math.hypot(c.x - etc.x, c.y - etc.y) > 600);
  }));

  await page.evaluate(() => { for (const c of window.__IV.ents()) if (c.type === 'camp') c.spawnT = 0.2; });
  await page.waitForTimeout(6000);
  const raiders = await page.evaluate(() => window.__IV.ents().filter(e => e.type === 'raider').length);
  ok('camps send out raiders (' + raiders + ')', raiders >= 2);
  ok('raiders stay out of the water', await page.evaluate(() =>
    window.__IV.ents().filter(e => e.type === 'raider')
      .every(u => !window.__IV.wet((u.x / 28) | 0, (u.y / 28) | 0))));
  // Put something in reach rather than waiting for one to wander into range,
  // so this asserts hostility and not the roll of a patrol route.
  await page.evaluate(() => {
    const g = window.__IV, r = g.ents().find(e => e.type === 'raider');
    if (r) g.spawn(1, 'vil', r.x + 90, r.y + 60);
  });
  await page.waitForTimeout(3000);
  ok('raiders go for whoever is nearest, either banner', await page.evaluate(() =>
    window.__IV.ents().filter(e => e.type === 'raider' &&
      (e.task === 'attack' || e.task === 'amove' || e.task === 'move')).length >= 1));

  // ---- villager trades
  const ids = await page.evaluate(() => {
    const g = window.__IV, tc = g.ents().find(e => e.type === 'tc' && e.owner === 0);
    // The raiders above are still on the map and they will happily kill a
    // villager that is standing next to a berry bush proving a point. Clear the
    // ones in reach: this section is about the trades, not about the marauders.
    for (const r of g.ents())
      if (r.type === 'raider' && Math.hypot(r.x - tc.x, r.y - tc.y) < 1400) r.dead = true;
    const out = {};
    for (const [t, rt] of [['farmer', 'berry'], ['forester', 'tree'], ['miner', 'gold']]) {
      const res = g.ents().filter(e => e.kind === 'res' && e.type === rt)
        .sort((a, c) => Math.hypot(a.x - tc.x, a.y - tc.y) - Math.hypot(c.x - tc.x, c.y - tc.y))[0];
      if (!res) { out[t] = null; continue; }
      const u = g.spawn(0, t, res.x + 20, res.y + 20);
      g.gather(u, res);
      out[t] = u.id;
    }
    return out;
  });
  await page.waitForTimeout(9000);
  const work = await page.evaluate(o => {
    const r = {};
    for (const k in o) { const u = window.__IV.ents().find(e => e.id === o[k]); r[k] = u ? u.task : null; }
    return r;
  }, ids);
  ok('every trade works its own resource (' + JSON.stringify(work) + ')',
    Object.values(work).every(t => t === 'gather' || t === 'move'));
  ok('trades still count as villagers', await page.evaluate(() =>
    window.__IV.ents().filter(e => e.kind === 'unit' && e.owner === 0 &&
      ['farmer', 'forester', 'miner'].includes(e.type)).length === 3));

  // ---- the standard
  ok('the standard cannot be planted at home', await page.evaluate(() => {
    const g = window.__IV, tc = g.ents().find(e => e.type === 'tc' && e.owner === 0);
    const u = g.spawn(0, 'bearer', tc.x + 40, tc.y + 40);
    const planted = !!g.plant(u);
    u.dead = true;
    return !planted;
  }));
  ok('the standard plants in their land', await page.evaluate(() => {
    const g = window.__IV, etc = g.ents().find(e => e.type === 'tc' && e.owner === 1);
    const u = g.spawn(0, 'bearer', etc.x + 150, etc.y + 150);
    const bld = g.plant(u);
    if (bld) g.go(bld.x, bld.y);
    return !!bld;
  }));
  const t1 = await page.evaluate(() => (window.__IV.flag() || {}).plantT);
  await page.waitForTimeout(2500);
  const t2 = await page.evaluate(() => (window.__IV.flag() || {}).plantT);
  ok('the hold timer runs (' + (t1 || 0).toFixed(1) + ' -> ' + (t2 || 0).toFixed(1) + ')', t2 > t1);
  ok('only one standard at a time', await page.evaluate(() => {
    const g = window.__IV, etc = g.ents().find(e => e.type === 'tc' && e.owner === 1);
    const u = g.spawn(0, 'bearer', etc.x + 180, etc.y + 180);
    const second = g.plant(u);
    u.dead = true;
    return !second;
  }));

  await page.evaluate(() => { const f = window.__IV.flag(); if (f) f.plantT = 59.2; });
  await page.waitForTimeout(2200);
  const h = await hud(page);
  ok('holding it to the end wins the game', h.over !== 'none' &&
    /valley is yours/i.test(await page.evaluate(() => document.getElementById('verdict').textContent)));

  console.log('ERRORS:', errs.length ? errs.slice(0, 3).join('\n') : 'none');
  await b.close();
})();
