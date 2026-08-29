// The year and the fields. A farm is no longer a pile of food with a fence
// round it: it is broken ground that gets sown out of seed somebody kept back,
// grows on its own time, ripens into whatever the season and the soil allow,
// and has to be carried into a building big enough to hold it.
const { chromium, wrap, boot, hud } = require('./harness');

(async () => {
  wrap();
  const b = await chromium.launch();
  const { page, errs } = await boot(b, { diff: 'easy' });
  const ok = (n, c) => console.log((c ? 'PASS' : 'FAIL') + '  ' + n);

  await page.evaluate(() => { window.__IV.reveal(); window.__IV.sides()[0].w = 9e4; });

  // ---- the year turns, and re-dresses the world
  const year = await page.evaluate(() => {
    const g = window.__IV, out = [];
    // Start on the season after the one the match opens in, so every step below
    // is a real change — asking for the season you are already in is a no-op,
    // and a no-op proves nothing about what a change does.
    for (const i of [1, 2, 3, 0]) {
      g.setSeason(i);
      out.push({ i: g.season(), name: document.getElementById('seasonName').textContent,
                 motes: g.motes().length, sprites: g.spriteCount(), chunks: g.chunks() });
    }
    return out;
  });
  ok('four seasons, each with its own name (' + year.map(y => y.name.split(' ')[0]).join(', ') + ')',
     year.map(y => y.i).join() === '1,2,3,0');
  ok('the ground cache is dropped when the world changes colour',
     year.every(y => y.chunks <= 2));
  ok('spring, autumn and winter have weather; summer does not (' +
     year.map(y => y.name.split(' ')[0] + ':' + y.motes).join(' ') + ')',
     year[0].motes === 0 && year[1].motes > 0 && year[2].motes > 0 && year[3].motes > 0);
  // the sprite table must not grow without bound as the years pass
  const churn = await page.evaluate(() => {
    const g = window.__IV;
    for (let k = 0; k < 3; k++) for (let i = 0; i < 4; i++) { g.setSeason(i); g.draw(); }
    return g.spriteCount();
  });
  ok('three years of turning does not leak sprites (' + churn + ')', churn < 400);

  // ---- a field, from broken ground to harvest
  await page.evaluate(() => window.__IV.setSeason(1));
  const life = await page.evaluate(async () => {
    const g = window.__IV, s = g.sides()[0];
    s.w = 9e4; s.seed = 200; g.setSpeed(6);
    const tc = g.ents().find(e => e.type === 'tc' && e.owner === 0);
    const f = g.mk(0, 'plot', tc.tx - 6, tc.ty + 4, true);
    f.crop = 0; f.nextCrop = 0;
    const seen = [], seed0 = s.seed;
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 250));
      if (!seen.length || seen[seen.length - 1] !== f.stage) seen.push(f.stage);
      if (f.stage === 3) break;
    }
    return { seen, ripe: Math.round(f.amount), seedSpent: seed0 - s.seed + Math.round(CROPBACK(f)),
             seedNow: Math.round(s.seed), id: f.id };
    function CROPBACK(f) { return 0; }
  });
  ok('a field passes through sown, growing and ripe (' + life.seen.join('→') + ')',
     life.seen.join(',') === '0,1,2,3' || life.seen.join(',') === '1,2,3');
  ok('and stands there with a harvest in it (' + life.ripe + ' food)', life.ripe > 100);
  ok('sowing spends seed and harvesting puts more back (' + life.seedNow + ')', life.seedNow > 200);

  // ---- villagers tend an unripe field and it comes on faster
  const tend = await page.evaluate(async () => {
    const g = window.__IV, s = g.sides()[0];
    const tc = g.ents().find(e => e.type === 'tc' && e.owner === 0);
    const a = g.mk(0, 'plot', tc.tx + 5, tc.ty + 4, true);
    const c = g.mk(0, 'plot', tc.tx + 8, tc.ty + 4, true);
    for (const f of [a, c]) { f.crop = 0; f.stage = 1; f.grow = 0; }
    const hands = [];
    for (let i = 0; i < 3; i++) { const u = g.spawn(0, 'vil', a.x - 20 + i * 14, a.y + 34); g.gather(u, a); hands.push(u); }
    await new Promise(r => setTimeout(r, 4000));
    // The tended field can finish inside the window, in which case its progress
    // is not in `grow` any more — it is in the harvest standing in it.
    const out = { tended: +a.grow.toFixed(1), alone: +c.grow.toFixed(1),
                  ripe: a.stage === 3, tenders: a.tenders };
    for (const u of hands) u.dead = true;
    return out;
  });
  ok('a tended field outgrows one nobody is working (' +
     (tend.ripe ? 'ripe already' : tend.tended) + ' vs ' + tend.alone + ')',
     tend.ripe || tend.tended > tend.alone * 1.25);

  // ---- season and soil both reach the yield
  const yields = await page.evaluate(() => {
    const g = window.__IV, s = g.sides()[0];
    const tc = g.ents().find(e => e.type === 'tc' && e.owner === 0);
    const f = g.mk(0, 'plot', tc.tx - 10, tc.ty + 4, true);
    const out = {};
    for (const [name, season, fert] of [['summer', 1, 1], ['winter', 3, 1], ['summer-spent', 1, 0.3]]) {
      g.setSeason(season);
      f.crop = 0; f.fert = fert; f.stage = 2; f.grow = 1e4;
      g.tickB(f, 0.016);
      out[name] = Math.round(f.amount);
      f.amount = 0; f.stage = 0;
    }
    g.setSeason(1);
    f.dead = true;
    return out;
  });
  ok('winter takes most of the harvest away (' + yields.summer + ' → ' + yields.winter + ')',
     yields.winter < yields.summer * 0.35);
  ok('and worn-out soil takes its share too (' + yields['summer-spent'] + ')',
     yields['summer-spent'] < yields.summer * 0.6);

  // ---- the soil remembers
  const soil = await page.evaluate(async () => {
    const g = window.__IV;
    const tc = g.ents().find(e => e.type === 'tc' && e.owner === 0);
    const f = g.mk(0, 'plot', tc.tx - 13, tc.ty + 4, true);
    f.crop = 0; f.lastCrop = 0; f.stage = 3; f.amount = 0; f.auto = 0;
    const before = g.fertOf(f);
    g.tickB(f, 0.016);                       // the harvest is carried off
    const after = g.fertOf(f);
    // now leave it fallow for a while
    for (let i = 0; i < 400; i++) g.tickB(f, 0.05);
    const rested = g.fertOf(f);
    f.dead = true;
    return { before: +before.toFixed(3), after: +after.toFixed(3), rested: +rested.toFixed(3) };
  });
  ok('working a field costs the soil (' + soil.before + ' → ' + soil.after + ')', soil.after < soil.before);
  ok('and leaving it fallow gives it back (' + soil.rested + ')', soil.rested > soil.after);

  // ---- the larder: a ceiling, spoilage above it, and everyone eating
  const larder = await page.evaluate(async () => {
    const g = window.__IV, s = g.sides()[0];
    const cap0 = g.foodCap(0);
    const tc = g.ents().find(e => e.type === 'tc' && e.owner === 0);
    g.mk(0, 'granary', tc.tx + 12, tc.ty + 2, true);
    const cap1 = g.foodCap(0);
    s.f = cap1 + 600;
    const over0 = s.f;
    await new Promise(r => setTimeout(r, 2500));
    const over1 = s.f;
    // Villagers are out gathering, so the purse is not a clean measure of what
    // is eaten. Drive the larder directly and read the same tick the game runs.
    s.f = cap1 * 0.5;
    const under0 = s.f;
    for (let i = 0; i < 100; i++) g.tickL(0, 0.05);
    return { cap0, cap1, spoiled: over0 - over1, use: g.foodUse(0),
             ate: under0 - s.f, spoilTotal: Math.round(s.spoiled || 0) };
  });
  ok('a granary raises the ceiling (' + larder.cap0 + ' → ' + larder.cap1 + ')', larder.cap1 > larder.cap0);
  ok('food above the ceiling goes bad (' + Math.round(larder.spoiled) + ' lost)', larder.spoiled > 5);
  ok('and everyone eats (' + larder.use.toFixed(2) + '/s, ' + larder.ate.toFixed(0) + ' gone)',
     larder.use > 0 && larder.ate > 0);

  // ---- seed can run out, and can be eaten
  const seed = await page.evaluate(() => {
    const g = window.__IV, s = g.sides()[0];
    const tc = g.ents().find(e => e.type === 'tc' && e.owner === 0);
    const f = g.mk(0, 'plot', tc.tx - 16, tc.ty + 4, true);
    f.stage = 0; f.auto = 1; f.crop = 0;
    s.seed = 2;
    const sown = g.sow(f);
    s.seed = 100; s.f = 100;
    const sown2 = g.sow(f);
    return { refused: !sown, took: sown2, left: Math.round(s.seed) };
  });
  ok('a field cannot be sown without seed', seed.refused);
  ok('and is sown the moment there is some', seed.took && seed.left < 100);

  // ---- and all of it survives a save
  const round = await page.evaluate(() => {
    const g = window.__IV;
    const f = g.ents().find(e => e.type === 'plot' && !e.dead);
    f.crop = 2; f.stage = 2; f.grow = 12.5; f.fert = 0.71; f.lastCrop = 0; f.auto = 0;
    const s = g.sides()[0]; s.seed = 137;
    const snap = JSON.parse(JSON.stringify(g.snap()));
    g.restore(snap);
    const f2 = g.ents().find(e => e.type === 'plot' && !e.dead && Math.abs(e.grow - 12.5) < 0.01);
    return f2 ? { crop: f2.crop, stage: f2.stage, fert: +f2.fert.toFixed(2), auto: f2.auto,
                  seed: Math.round(g.sides()[0].seed) } : null;
  });
  ok('a save remembers what is in the ground (' + JSON.stringify(round) + ')',
     round && round.crop === 2 && round.stage === 2 && round.fert === 0.71 &&
     !round.auto && round.seed === 137);

  // ---- a field being cut looks like a field being cut
  const cut = await page.evaluate(() => {
    const g = window.__IV;
    const f = g.ents().find(e => e.type === 'plot' && !e.dead);
    f.crop = 0; f.stage = 3; f.max = 500;
    const seen = new Set();
    for (const left of [1, 0.8, 0.6, 0.4, 0.2, 0]) { f.amount = 500 * left; seen.add(g.farmVariant(f)); }
    f.stage = 2; const growing = g.farmVariant(f);
    return { states: seen.size, growing, first: Math.min(...seen), last: Math.max(...seen) };
  });
  ok('a field being harvested passes through several states, not one (' + cut.states + ')',
     cut.states >= 4);
  ok('and none of them is the growing field again', cut.first > cut.growing);

  // ---- the steading raises the hands, and each knows one crop
  const hands = await page.evaluate(async () => {
    const g = window.__IV, s = g.sides()[0];
    s.age = 2; s.f = 9e3; s.g = 9e3; s.w = 9e3;
    const tc = g.ents().find(e => e.type === 'tc' && e.owner === 0);
    const farm = g.mk(0, 'farm', tc.tx + 9, tc.ty + 6, true);
    const trains = g.bldTrains('farm');
    const took = trains.map(t => g.enq(farm, t));
    // Training runs on game time, so run the clock rather than the wall.
    g.setSpeed(8);
    await new Promise(r => setTimeout(r, 7000));
    g.setSpeed(1);
    const out = g.ents().filter(e => e.kind === 'unit' && e.owner === 0 && g.unitOf(e.type).crop !== undefined);
    const crops = new Set(out.map(u => g.unitOf(u.type).crop));
    return { trains, took, raised: out.length, crops: crops.size, farmGrows: farm.stage === undefined };
  });
  ok('the steading raises four hands and grows nothing itself (' + hands.trains.join(', ') + ')',
     hands.trains.length === 4 && hands.took.every(Boolean) && hands.farmGrows);
  ok('and they came out knowing different crops (' + hands.raised + ' raised, ' +
     hands.crops + ' crops between them)', hands.raised >= 3 && hands.crops >= 3);

  // ---- a field is broken by a farmer, and carries whoever broke it
  const planted = await page.evaluate(async () => {
    const g = window.__IV;
    const tc = g.ents().find(e => e.type === 'tc' && e.owner === 0);
    const own = g.ents().find(e => e.kind === 'unit' && e.owner === 0 && g.unitOf(e.type).crop === 0);
    const alien = g.ents().find(e => e.kind === 'unit' && e.owner === 0 && g.unitOf(e.type).crop === 1);
    if (!own || !alien) return null;
    // Hunt for ground rather than trusting a fixed offset: the valley is carved
    // for four crowns now and what sits nine tiles below the town center is not
    // the same on every map.
    const mk = (u, crop) => {
      for (let r = 4; r < 16; r++) for (let a = 0; a < 20; a++) {
        const tx = Math.round(tc.tx + Math.cos(a * 0.314) * r), ty = Math.round(tc.ty + Math.sin(a * 0.314) * r);
        if (!g.free(tx, ty, 2, 2, 0, 'plot')) continue;
        const b = g.place('plot', tx, ty, [u]);
        if (b) { b.crop = crop; b.nextCrop = crop; return b; }
      }
      return null;
    };
    const a = mk(own, 0), c = mk(alien, 0);
    if (!a || !c) return null;
    g.setSpeed(6);
    for (let i = 0; i < 40 && (a.building || c.building); i++) await new Promise(r => setTimeout(r, 250));
    g.setSpeed(1);
    return { own: +a.skill.toFixed(2), alien: +c.skill.toFixed(2),
             sown: a.stage > 0 && c.stage > 0, planter: a.planter };
  });
  ok('a farmer on their own crop breaks a better field (' + (planted && planted.own) +
     ' against ' + (planted && planted.alien) + ')',
     planted && planted.own > 1 && planted.alien < 1 && planted.sown);

  const h = await hud(page);
  ok('the game is still running', h.over === 'none');
  console.log('ERRORS:', errs.length ? errs.slice(0, 3).join('\n') : 'none');
  await b.close();
})();
