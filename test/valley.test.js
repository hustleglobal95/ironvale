// The things that make the valley a place rather than a board: four kinds of
// berry with their own worth, props underfoot, birds overhead, and the study
// that lets the settlement keep learning after you stop buying it studies.
const { chromium, wrap, boot } = require('./harness');

(async () => {
  wrap();
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const { page, errs } = await boot(b, { diff: 'easy' });
  const ok = (n, c) => console.log((c ? 'PASS' : 'FAIL') + '  ' + n);

  await page.evaluate(() => window.__IV.reveal());

  // ---- berries
  const berry = await page.evaluate(() => {
    const g = window.__IV;
    const bs = g.ents().filter(e => e.kind === 'res' && e.type === 'berry');
    const kinds = {}, amounts = {};
    for (const e of bs) {
      const k = g.bIdx(e);
      kinds[k] = (kinds[k] || 0) + 1;
      amounts[k] = e.max;
    }
    // do bushes of a kind grow near each other, or is it a strict rotation?
    let same = 0, pairs = 0;
    for (const e of bs) for (const o of bs) {
      if (e === o) continue;
      if (Math.abs(e.tx - o.tx) > 3 || Math.abs(e.ty - o.ty) > 3) continue;
      pairs++; if (g.bIdx(e) === g.bIdx(o)) same++;
    }
    return { n: bs.length, kinds: Object.keys(kinds).length, amounts,
             clump: pairs ? same / pairs : 0,
             rates: g.BERRY().map(x => x.rate), names: g.BERRY().map(x => x.name) };
  });
  ok('all four bushes grow on the map (' + berry.kinds + ' kinds, ' + berry.n + ' bushes)',
     berry.kinds === 4 && berry.n > 20);
  ok('each kind holds a different amount (' + JSON.stringify(berry.amounts) + ')',
     new Set(Object.values(berry.amounts)).size === 4);
  ok('and comes out at its own rate (' + berry.rates.join(', ') + ')',
     new Set(berry.rates).size === 4);
  ok('a patch has a character rather than one of each (' +
     Math.round(berry.clump * 100) + '% of near neighbours match)', berry.clump > 0.35);

  // the rate has to reach the villager, not just the table
  const yields = await page.evaluate(async () => {
    const g = window.__IV;
    const out = {};
    for (const kind of [0, 1, 2, 3]) {
      const bush = g.ents().find(e => e.kind === 'res' && e.type === 'berry' && g.bIdx(e) === kind);
      if (!bush) continue;
      const before = bush.amount;
      const u = g.spawn(0, 'vil', bush.x + 14, bush.y + 14);
      g.gather(u, bush);
      await new Promise(r => setTimeout(r, 2600));
      out[g.BERRY()[kind].name] = +(before - bush.amount).toFixed(1);
      u.dead = true;
    }
    return out;
  });
  const vals = Object.values(yields);
  ok('a gooseberry really does come out faster than an elder (' + JSON.stringify(yields) + ')',
     vals.length === 4 && Math.max(...vals) > Math.min(...vals) * 1.25);

  // ---- ground decoration is baked, not drawn
  const bake = await page.evaluate(() => {
    const g = window.__IV;
    const t = [];
    for (let k = 0; k < 5; k++) {
      const t0 = performance.now();
      for (let i = 0; i < 30; i++) g.bake((i * 7 + k * 3) % 18, (i * 5 + k) % 18);
      t.push((performance.now() - t0) / 30);
    }
    t.sort((a, c) => a - c);
    return +t[2].toFixed(3);
  });
  ok('a chunk of decorated ground still bakes in well under a frame (' + bake + 'ms)', bake < 4);

  // ---- birds
  const birds = await page.evaluate(async () => {
    const g = window.__IV;
    while (g.flocks().length) g.flocks().pop();
    g.spawnFlock(); g.spawnFlock();
    const F = g.flocks();
    const n = F.reduce((a, f) => a + f.n, 0);
    const was = F.map(f => [f.x, f.y]);
    await new Promise(r => setTimeout(r, 900));
    const now = F.map(f => [f.x, f.y]);
    const moved = was.every((p, i) => now[i] && Math.hypot(now[i][0] - p[0], now[i][1] - p[1]) > 8);
    // and they leave rather than piling up
    for (const f of g.flocks()) f.life = 999;
    await new Promise(r => setTimeout(r, 200));
    return { flocks: 2, n, moved, left: g.flocks().length };
  });
  ok('a flock is a few birds, not one (' + birds.n + ' across 2 flocks)', birds.n >= 4);
  ok('they fly', birds.moved);
  ok('and they leave', birds.left === 0);
  ok('nothing can select a bird — they are not entities', await page.evaluate(() =>
    window.__IV.ents().every(e => e.kind === 'unit' || e.kind === 'bld' || e.kind === 'res')));

  // the call is occasional and quiet: it must be audible, and under the bed
  const call = await page.evaluate(async () => {
    const S = window.__IV.sfxObj();
    const an = S.ctx.createAnalyser();
    an.fftSize = 2048; an.smoothingTimeConstant = 0;
    S.master.connect(an);
    const bins = new Uint8Array(an.frequencyBinCount);
    const hz = i => i * S.ctx.sampleRate / 2 / an.frequencyBinCount;
    // The loudest bin, not the average across the band. A bed is broadband and
    // averages high; a bird is a tone in two or three bins, and averaging it
    // across a couple of kilohertz divides it away to nothing.
    const band = (lo, hi) => {
      an.getByteFrequencyData(bins);
      let m = 0;
      for (let i = 0; i < bins.length; i++) { const f = hz(i); if (f >= lo && f < hi && bins[i] > m) m = bins[i]; }
      return m;
    };
    const peak = async ms => {
      let p = 0; const t0 = performance.now();
      // The wind bed sits low and the whistle sits high, which is exactly why
      // a small bird can be heard over a gale. Measure where the bird is.
      // Hold the bed steady throughout: three crowns are fighting somewhere on
      // this map at all times now, and a bed that ducks halfway through the
      // window makes the two measurements incomparable.
      while (performance.now() - t0 < ms) {
        window.__IV.calm();
        p = Math.max(p, band(1400, 3000));
        await new Promise(r => setTimeout(r, 8));
      }
      return p;
    };
    // Mute the effects bus for the measurement: villagers chopping and foraging
    // live in the same octave as a small bird, and this is a question about the
    // bird, not about whether someone is felling a tree at the time.
    const fxWas = S.fxVol;
    S.fxVol = 0; if (S.fx) S.fx.gain.value = 0;
    // The ambience bus ducks by up to half while there is fighting, and by this
    // point in the suite the marauders are usually busy. Settle it first, or
    // this measures the battle rather than the bird.
    window.__IV.calm();
    await new Promise(r => setTimeout(r, 900));
    const quiet = await peak(700);
    // ask for the whistle specifically: the rasp lives an octave and a half
    // below this band, and a test that measures whichever one the coin gave it
    // is measuring the coin
    window.__IV.calm();
    // One bird is a coin toss against a gale; a few of them over a second and a
    // half is the thing the player actually hears.
    window.__IV.birdCall('whistle'); window.__IV.birdCall('whistle');
    setTimeout(() => { window.__IV.birdCall('whistle'); window.__IV.birdCall('whistle'); }, 420);
    const loud = await peak(1600);
    S.fxVol = fxWas; if (S.fx) S.fx.gain.value = fxWas;
    return { quiet, loud };
  });
  ok('a bird call carries over the bed (' + call.quiet + ' -> ' + call.loud + ')',
     call.loud > call.quiet + 18);

  // ---- Natural Philosophy
  const phil = await page.evaluate(async () => {
    const g = window.__IV, s = g.sides()[0];
    s.age = 3; s.f = s.w = s.g = 9e4;
    const tc = g.ents().find(e => e.type === 'tc' && e.owner === 0);
    const uni = g.mk(0, 'uni', tc.tx + 6, tc.ty, true);
    const before = { gather: s.mod.gather, phil: s.mod.phil };
    // nothing is learned before the study
    g.learn(s, 'f', 5000); g.learn(s, 'w', 5000);
    const beforeFound = Object.keys(s.found).length;
    s.teching = 'philosophy'; s.techT = 0.01;
    await new Promise(r => setTimeout(r, 900));
    return { uni: uni.id, before, beforeFound, phil: s.mod.phil, learn: { ...s.learn } };
  });
  ok('the study is one of the university\'s seven', await page.evaluate(() =>
    window.__IV.ents().some(e => e.type === 'uni') && window.__IV.sides()[0].mod.phil === 1));
  ok('nothing is discovered before it is studied', phil.beforeFound === 0);
  // Villagers keep working while the study finishes, so the ledger is not
  // literally zero by the time it is read — it is nowhere near the 5000 of each
  // that was carried home before anyone knew to write it down.
  ok('the ledger ignores everything carried home before the study (' +
     Math.round(phil.learn.f) + 'f, ' + Math.round(phil.learn.w) + 'w of 5000 each)',
     phil.learn.f < 400 && phil.learn.w < 400);

  const found = await page.evaluate(() => {
    const g = window.__IV, s = g.sides()[0];
    const gather0 = s.mod.gather;
    const seen = [];
    const feed = (k, n) => { for (let i = 0; i < n; i++) g.learn(s, k, 100); };
    feed('f', 4); feed('w', 4);
    seen.push(Object.keys(s.found).slice());
    feed('f', 20); feed('w', 20); feed('g', 20);
    return { first: seen[0], all: Object.keys(s.found), gather0, gather1: s.mod.gather,
             armour: s.mod.armor, gold: s.mod.goldRate,
             state: g.compounds(s).map(x => [x.c.id, x.done, +x.p.toFixed(2)]) };
  });
  ok('the first compound falls out of the work itself (' + found.first.join(',') + ')',
     found.first.length === 1 && found.first[0] === 'tallow');
  ok('all six are there to be found (' + found.all.length + '/6)', found.all.length === 6);
  ok('and each one actually changes the empire (gather ' + found.gather0.toFixed(2) +
     ' -> ' + found.gather1.toFixed(2) + ', armour +' + found.armour + ', gold x' +
     found.gold.toFixed(2) + ')',
     found.gather1 > found.gather0 && found.armour >= 1 && found.gold > 1);

  // and it survives a save
  const round = await page.evaluate(() => {
    const g = window.__IV;
    const snap = JSON.parse(JSON.stringify(g.snap()));
    g.restore(snap);
    const s = g.sides()[0];
    return { found: Object.keys(s.found).length, learn: s.learn.f > 0, phil: s.mod.phil };
  });
  ok('a save remembers what the settlement worked out', round.found === 6 && round.learn && round.phil === 1);

  console.log('ERRORS:', errs.length ? errs.slice(0, 3).join('\n') : 'none');
  await b.close();
})();
