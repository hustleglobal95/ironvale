// The clock. This suite is about how long everything takes and in what order
// it is allowed to happen: a season, a crop, a soldier, and the gap before
// somebody marches at you. It asserts on the shape of the pacing rather than
// on any one number, so a later re-tune moves the numbers and the suite still
// holds the shape down — a season longer than a crop, a soldier quicker than a
// villager, a knight slower than a spearman, and nothing on the field before
// the clock says it may be.
const { chromium, wrap, boot } = require('./harness');

(async () => {
  wrap();
  const b = await chromium.launch();
  const { page, errs } = await boot(b, { diff: 'normal' });
  const ok = (n, c) => console.log((c ? 'PASS' : 'FAIL') + '  ' + n);

  // ---- the year -------------------------------------------------------
  const yr = await page.evaluate(() => {
    const g = window.__IV;
    return { year: g.pace().year, len: g.pace().year / 4 };
  });
  ok('a year is ' + yr.year + ' seconds', yr.year >= 400);
  ok('and a season is ' + yr.len, yr.len === yr.year / 4);

  const seasons = await page.evaluate(() => {
    const g = window.__IV, out = [];
    for (let i = 0; i < 4; i++) { g.setSeason(i); out.push(document.body.className); }
    g.setSeason(1);
    return out;
  });
  ok('all four seasons still dress the world', new Set(seasons).size === 4);

  // ---- crops fit the season -------------------------------------------
  const crop = await page.evaluate(() => {
    const g = window.__IV, c = g.crops();
    return { longest: Math.max(...c.map(x => x.time)),
             wheat: c[0].time, yield: c[0].yield, seed: c[0].seed,
             store: g.sides()[0].seed };
  });
  ok('the slowest crop still fits inside one season (' + crop.longest + ' of ' + yr.len + ')',
     crop.longest < yr.len);
  ok('a crop takes most of a season rather than a moment (' + crop.wheat + ')',
     crop.wheat > yr.len * 0.35);
  ok('yield and seed scaled with it, so the ground is no richer (' +
     (crop.yield / crop.wheat).toFixed(1) + ' food a second)',
     Math.abs(crop.yield / crop.wheat - 11.3) < 1.2);
  ok('the seed store started in proportion (' + crop.store + ')',
     crop.store >= crop.seed * 4 && crop.store <= crop.seed * 7);

  // ---- who is quick to raise ------------------------------------------
  const t = await page.evaluate(() => {
    const U = window.__IV.units();
    const pick = ks => Object.fromEntries(ks.map(k => [k, U[k].time]));
    return pick(['vil','spear','militia','archer','skirm','scout','knight','paladin','ram','mango','bearer']);
  });
  ok('a spearman is the quickest thing in the game (' + t.spear + 's)',
     t.spear < t.vil && t.spear <= Math.min(t.militia, t.archer, t.skirm, t.scout));
  ok('every basic soldier beats a villager to the field',
     t.militia < t.vil && t.archer < t.vil && t.skirm < t.vil);
  ok('a knight is still an investment beside a spearman (' + t.knight + ' vs ' + t.spear + ')',
     t.knight > t.spear * 1.6);
  ok('and a paladin beside a knight (' + t.paladin + ')', t.paladin > t.knight);
  ok('siege is the slowest of the lot (' + t.ram + '/' + t.mango + ')',
     t.ram > t.knight && t.mango > t.ram);

  // ---- the gap between war bands ---------------------------------------
  const gaps = await page.evaluate(() => {
    const g = window.__IV;
    return [0,1,2,3,4,5,6,8,12].map(n => g.gap(n));
  });
  ok('the first war bands are far apart (' + gaps[0] + 's)', gaps[0] >= 80);
  ok('and they close up as the war goes on', gaps[0] > gaps[3] && gaps[3] > gaps[5]);
  ok('but never closer than the floor (' + gaps[8] + ')',
     gaps[8] === Math.min(...gaps) && gaps[8] >= 25);

  // ---- nothing marches before the clock says so -------------------------
  const first = await page.evaluate(() => window.__IV.diff().normal.firstAttack);
  ok('the first war band cannot move for ' + Math.round(first) + 's', first >= 280);

  const early = await page.evaluate(() => {
    const g = window.__IV;
    g.setTime(20);
    const before = g.ents().filter(e => e.owner === 2 && !e.dead).length;
    for (let i = 0; i < 400; i++) g.marauders(1);
    const after = g.ents().filter(e => e.owner === 2 && !e.dead).length;
    g.setTime(g.pace().raidStart + 5);
    for (let i = 0; i < 120; i++) g.marauders(1);
    const later = g.ents().filter(e => e.owner === 2 && !e.dead).length;
    return { before, after, later };
  });
  ok('no marauder leaves a stockade in the first minutes (' + early.after + ')',
     early.after === early.before);
  ok('and they come out once the settlement has had its head start (' + early.later + ')',
     early.later > early.after);

  // ---- a hall raises men, and stops when something says stop -------------
  const prod = await page.evaluate(() => {
    const g = window.__IV, s = g.sides()[0];
    const tc = g.ents().find(e => e.type === 'tc' && e.owner === 0);
    const bx = Math.round(tc.x / 28) + 6, by = Math.round(tc.y / 28);
    const bar = g.mk(0, 'barracks', bx, by, true);
    if (!bar) return { made: false };
    const rallied = !!bar.rally;               // finished halls muster by themselves
    // room for everybody, so the only thing that can stop it is the purse
    for (let i = 0; i < 8; i++) g.mk(0, 'house', bx + 2 + i * 2, by + 4, true);
    g.touch();
    s.f = 300; s.w = 300; s.g = 300;
    bar.rep = 1;
    g.enq(bar, 'spear');
    const c = g.units().spear.cost;
    const before = g.ents().filter(e => e.type === 'spear' && e.owner === 0).length;
    let guard = 0;
    while (guard++ < 6000 && bar.queue.length) g.prod(bar, 0.5);
    const made = g.ents().filter(e => e.type === 'spear' && e.owner === 0).length - before;
    return { made: true, rallied, spears: made,
             food: Math.round(s.f), wood: Math.round(s.w),
             cost: c, queue: bar.queue.length,
             pop: g.ents().filter(e => e.kind === 'unit' && e.owner === 0 && !e.dead).length,
             cap: g.cap ? 0 : 0 };
  });
  ok('a barracks musters its men in front of its own door', prod.rallied);
  ok('a standing order keeps raising them (' + prod.spears + ')', prod.spears >= 6);
  ok('it never spends what is not there (' + prod.food + 'f ' + prod.wood + 'w left)',
     prod.food >= 0 && prod.wood >= 0);
  ok('it stops on its own rather than jamming the queue (' + prod.queue + ' queued)',
     prod.queue === 0);
  ok('and it stopped because it could not pay for the next one',
     prod.food < prod.cost.f || prod.wood < prod.cost.w);

  // ---- the standing order survives a save -------------------------------
  const saved = await page.evaluate(() => {
    const g = window.__IV;
    const bar = g.ents().find(e => e.type === 'barracks' && e.owner === 0);
    bar.rep = 1;
    const snap = g.snap();
    bar.rep = 0;
    g.restore(snap);
    const back = g.ents().find(e => e.type === 'barracks' && e.owner === 0);
    return { rep: !!(back && back.rep), rally: !!(back && back.rally) };
  });
  ok('a save carries the standing order', saved.rep);
  ok('and the muster point with it', saved.rally);

  // ---- every crown ages on the same terms -------------------------------
  const ageing = await page.evaluate(() => {
    const g = window.__IV, out = {};
    for (const o of [1, 3, 4]) {
      const s = g.sides()[o];
      s.age = 0; s.aging = 0; s.f = 9999; s.w = 9999; s.g = 9999;
      g.startAge(o);
      out[o] = Math.round(s.aging);
    }
    return out;
  });
  ok('all three crowns age at the same rate (' + JSON.stringify(ageing) + ')',
     ageing[1] === ageing[3] && ageing[3] === ageing[4] && ageing[1] > 0);

  console.log(errs.length ? 'ERRORS: ' + errs.slice(0, 3).join(' | ') : 'no page errors');
  await b.close();
})();
