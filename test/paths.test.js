// Getting there. The game has no pathfinder — units steer, and terrain is a
// wall they have to feel their way along. This suite holds down the thing that
// goes wrong when that fails: a unit that stops on a beach and will not walk
// around the water in front of it.
const { chromium, wrap, boot } = require('./harness');

(async () => {
  wrap();
  const b = await chromium.launch();
  const { page, errs } = await boot(b, { diff: 'hard' });
  const ok = (n, c) => console.log((c ? 'PASS' : 'FAIL') + '  ' + n);

  await page.evaluate(() => {
    const g = window.__IV, s = g.sides()[0];
    s.f = s.w = s.g = 9e3; s.age = 3;
    g.reveal();
    const tc = g.ents().find(e => e.type === 'tc' && e.owner === 0);
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * 6.283, r = 40 + Math.random() * 500;
      g.spawn(0, ['militia', 'archer', 'vil', 'spear', 'knight', 'scout'][i % 6],
              tc.x + Math.cos(a) * r, tc.y + Math.sin(a) * r);
    }
  });

  // ---- nobody grinds against a coast
  const march = await page.evaluate(async () => {
    const g = window.__IV, [MW, MH] = g.dims();
    const book = new Map();
    for (const u of g.ents()) {
      if (u.kind !== 'unit' || u.owner !== 0) continue;
      // The distances a player actually clicks, not corner to corner: a march
      // long enough to meet water, short enough to finish inside the test.
      let x, y, tries = 0;
      do {
        const a = Math.random() * 6.283, r = 600 + Math.random() * 900;
        x = Math.max(60, Math.min(MW * 28 - 60, u.x + Math.cos(a) * r));
        y = Math.max(60, Math.min(MH * 28 - 60, u.y + Math.sin(a) * r));
        tries++;
      } while (g.wet((x / 28) | 0, (y / 28) | 0) && tries < 40);
      g.move(u, x, y);
      book.set(u.id, { x, y, px: u.x, py: u.y, still: 0, worst: 0, done: false });
    }
    const frozen = [];
    for (let i = 0; i < 280; i++) {
      await new Promise(r => setTimeout(r, 100));
      for (const u of g.ents()) {
        if (u.kind !== 'unit' || u.owner !== 0 || u.dead) continue;
        const k = book.get(u.id); if (!k) continue;
        if (u.task !== 'move') { k.done = true; continue; }
        const moved = Math.hypot(u.x - k.px, u.y - k.py);
        k.px = u.x; k.py = u.y;
        k.still = (Math.hypot(u.x - k.x, u.y - k.y) > 40 && moved < 0.4) ? k.still + 1 : 0;
        k.worst = Math.max(k.worst, k.still);
        if (k.still === 50 && frozen.length < 5)
          frozen.push({ t: u.type, x: u.x | 0, y: u.y | 0, gx: k.x | 0, gy: k.y | 0 });
      }
    }
    let done = 0, worst = 0;
    for (const [id, k] of book) {
      const u = g.ents().find(e => e.id === id);
      if (u && !u.dead && Math.hypot(u.x - k.x, u.y - k.y) < 60) done++;
      worst = Math.max(worst, k.worst);
    }
    return { n: book.size, done, worst, frozen };
  });
  ok('no unit stands still against terrain for five seconds (worst run ' +
     (march.worst / 10).toFixed(1) + 's)' +
     (march.frozen.length ? ' ' + JSON.stringify(march.frozen[0]) : ''), march.worst < 50);
  ok('they arrive (' + march.done + '/' + march.n + ')',
     march.done >= Math.ceil(march.n * 0.9));

  // ---- and the arithmetic survives it
  ok('no unit ends with a broken position or velocity', await page.evaluate(() =>
    window.__IV.ents().every(e => e.dead || e.kind !== 'unit' ||
      (Number.isFinite(e.x) && Number.isFinite(e.y) &&
       Number.isFinite(e.vx) && Number.isFinite(e.vy) && Number.isFinite(e.face)))));

  // ---- a target in open water is refused rather than ground at forever
  const lake = await page.evaluate(() => {
    const g = window.__IV, [MW, MH] = g.dims();
    let best = null;
    for (let y = 8; y < MH - 8; y += 2) for (let x = 8; x < MW - 8; x += 2) {
      if (!g.wet(x, y)) continue;
      let n = 0;
      for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) if (g.wet(x + i, y + j)) n++;
      if (!best || n > best[2]) best = [x, y, n];
    }
    if (!best) return null;
    const u = g.ents().find(e => e.kind === 'unit' && e.owner === 0 && e.type === 'militia');
    // He has to survive the walk for the walk to be the thing under test. The
    // marauders are not part of this question.
    u.hp = u.maxHp = 9e4;
    for (const r of g.ents()) if (r.type === 'raider') r.dead = true;
    g.move(u, best[0] * 28, best[1] * 28);
    return u.id;
  });
  if (lake === null) { ok('this map has a lake to test against', false); }
  else {
    // He walks the shore first now, looking for a way round; the ceiling on a
    // single order is what eventually tells him there isn't one. Run the clock
    // fast rather than making the suite wait a minute for it.
    await page.evaluate(() => window.__IV.setSpeed(4));
    await page.waitForTimeout(22000);
    await page.evaluate(() => window.__IV.setSpeed(1));
    const gave = await page.evaluate(i => {
      const u = window.__IV.ents().find(e => e.id === i);
      return u ? { task: u.task, wet: window.__IV.wet((u.x / 28) | 0, (u.y / 28) | 0) } : null;
    }, lake);
    ok('a footman told to walk into a lake works the shore, then gives up (' +
       (gave && gave.task) + ')', gave && gave.task !== 'move');
    ok('and he is still on dry land', gave && !gave.wet);
  }

  console.log('ERRORS:', errs.length ? errs.slice(0, 3).join('\n') : 'none');
  await b.close();
})();
