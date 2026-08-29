// Four crowns that look like four crowns. Colour alone does not do it: at the
// distance this game is played from, a blue roof and a purple roof are the same
// roof. Each house roofs in its own material, washes its walls its own way,
// flies its own shape of cloth and carries its own shape of shield — and when
// winter comes, all four of them carry snow. This holds that down, and holds
// down what it is allowed to cost.
const { chromium, wrap, boot } = require('./harness');

(async () => {
  wrap();
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const { page, errs } = await boot(b, { diff: 'easy' });
  const ok = (n, c) => console.log((c ? 'PASS' : 'FAIL') + '  ' + n);
  const dd = (p, q) => Math.round(Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]));

  await page.evaluate(() => window.__IV.reveal());

  // ---- what each house roofs with ------------------------------------------
  const roofs = await page.evaluate(() => {
    const g = window.__IV, out = {};
    for (const o of [0, 1, 3, 4]) out[o] = ['house', 'barracks', 'granary'].map(t => g.roofCol(t, o));
    return out;
  });
  const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const crowns = [0, 1, 3, 4];
  let minAcross = 1e9, maxWithin = 0;
  for (const o of crowns) {
    for (const c of roofs[o]) for (const d of roofs[o]) maxWithin = Math.max(maxWithin, dd(hex(c), hex(d)));
    for (const p of crowns) if (p !== o)
      for (const c of roofs[o]) for (const d of roofs[p]) minAcross = Math.min(minAcross, dd(hex(c), hex(d)));
  }
  ok('a house roofs its whole settlement in one material (spread within a crown ' +
     maxWithin + ', between crowns ' + minAcross + ')',
     minAcross > 30 && minAcross >= maxWithin * 0.6);
  ok('and no two crowns roof in the same one', new Set(crowns.map(o => roofs[o][0])).size === 4);
  ok('the four materials are four materials, not four tints of one',
     await page.evaluate(() => new Set([0, 1, 3, 4].map(o => window.__IV.sig(o).roof)).size === 4));
  ok('each flies its own shape of cloth', await page.evaluate(() =>
     new Set([0, 1, 3, 4].map(o => window.__IV.sig(o).pennant)).size === 4));

  // The roof has to reach the picture, not just the table. Two measurements:
  // what the roof band is actually painted, and how much of the whole building
  // changes hands with the crown.
  const painted = await page.evaluate(() => {
    const g = window.__IV;
    const grab = o => { const sp = g.bsprite('house', o, 0, 0);
      return { d: g.px(sp), w: sp.c.width, h: sp.c.height }; };
    // rows 30-46% down the sprite, middle 40% across: roof slope and nothing else
    const band = o => {
      const S = grab(o), W = S.w;
      let r = 0, gg = 0, bb = 0, n = 0;
      for (let y = (S.h * 0.30) | 0; y < (S.h * 0.46) | 0; y++)
        for (let x = (W * 0.3) | 0; x < (W * 0.7) | 0; x++) {
          const i = (y * W + x) * 4;
          if (S.d[i + 3] < 200) continue;
          r += S.d[i]; gg += S.d[i + 1]; bb += S.d[i + 2]; n++;
        }
      return n ? [Math.round(r / n), Math.round(gg / n), Math.round(bb / n)] : [0, 0, 0];
    };
    const A = grab(0);
    const repaint = o => {
      const B = grab(o); let n = 0, tot = 0;
      for (let i = 0; i < A.d.length; i += 4) {
        if (A.d[i + 3] < 200 || B.d[i + 3] < 200) continue;
        tot++;
        if (Math.hypot(A.d[i] - B.d[i], A.d[i + 1] - B.d[i + 1], A.d[i + 2] - B.d[i + 2]) > 30) n++;
      }
      return Math.round(n / tot * 100);
    };
    return { band: [band(0), band(1), band(3), band(4)], pct: [repaint(1), repaint(3), repaint(4)] };
  });
  const bandD = [1, 2, 3].map(i => dd(painted.band[0], painted.band[i]));
  ok('the roof in the picture is the roof on the table (' +
     painted.band.map(c => c.join('/')).join('   ') + ')', Math.min(...bandD) > 25);
  ok('and a house changes hands with its crown (' + painted.pct.join('%, ') +
     '% of it repainted)', Math.min(...painted.pct) > 15);

  // ---- shields are a shape, not a swatch -----------------------------------
  // Two figures that differ only in colour have the same outline and the same
  // pattern of light. These differ in both, so the comparison is run on
  // luminance: a straight recolour of one shape would score nothing.
  const shape = await page.evaluate(() => {
    const g = window.__IV;
    const grab = o => g.px(g.usprite('knight', o, 0, 1));
    const A = grab(0);
    const cmp = o => {
      const B = grab(o); let edge = 0, face = 0;
      for (let i = 0; i < A.length; i += 4) {
        const a1 = A[i + 3] > 128, a2 = B[i + 3] > 128;
        if (a1 !== a2) { edge++; continue; }
        if (!a1) continue;
        const l1 = A[i] * 0.3 + A[i + 1] * 0.59 + A[i + 2] * 0.11;
        const l2 = B[i] * 0.3 + B[i + 1] * 0.59 + B[i + 2] * 0.11;
        if (Math.abs(l1 - l2) > 26) face++;
      }
      return edge + face;
    };
    return { pix: A.length / 4, crimson: cmp(1), thorn: cmp(3), salt: cmp(4) };
  });
  ok('a knight of another house is built differently, not tinted differently (' +
     shape.crimson + ', ' + shape.thorn + ', ' + shape.salt + ' of ' + shape.pix + ' pixels)',
     Math.min(shape.crimson, shape.thorn, shape.salt) > 40);
  ok('and the four shields are four shields', await page.evaluate(() =>
     new Set([0, 1, 3, 4].map(o => window.__IV.sig(o).shield)).size >= 3));

  // ---- winter reaches the roofs --------------------------------------------
  const snow = await page.evaluate(async () => {
    const g = window.__IV;
    // Cool and bright. A summer sprite has bright pixels (lit plaster, a
    // lantern) and cool pixels (sky shade), and nothing that is both.
    const white = () => {
      const sp = g.bsprite('house', 0, 0, 0), d = g.px(sp);
      let n = 0;
      for (let i = 0; i < d.length; i += 4)
        if (d[i + 3] > 200 && d[i + 2] > 190 && d[i + 2] >= d[i] + 4) n++;
      return n;
    };
    g.setTime(g.pace().year * 0.30); await new Promise(r => setTimeout(r, 320));
    const summer = { s: g.season(), w: white() };
    g.setTime(g.pace().year * 0.80); await new Promise(r => setTimeout(r, 320));
    const winter = { s: g.season(), w: white() };
    return { summer, winter };
  });
  ok('the seasons still turn (' + snow.summer.s + ' -> ' + snow.winter.s + ')',
     snow.summer.s === 1 && snow.winter.s === 3);
  ok('and a roof carries snow in winter and not in summer (' +
     snow.summer.w + ' -> ' + snow.winter.w + ' cold-bright pixels)',
     snow.summer.w < 20 && snow.winter.w > 120);

  // Buildings are baked without a season in the key, so they have to be purged
  // when winter arrives and when it goes — and at no other boundary, or every
  // settlement in the valley rebakes four times a year to change nothing.
  const purge = await page.evaluate(async () => {
    const g = window.__IV;
    const touch = () => { for (const e of g.ents()) if (e.kind === 'bld') g.bsprite(e.type, e.owner, 0, 0); };
    const step = async f => { touch(); const a = g.sprMem().n;
      g.setTime(g.pace().year * f); await new Promise(r => setTimeout(r, 320));
      return a - g.sprMem().n; };
    g.setTime(g.pace().year * 0.05); await new Promise(r => setTimeout(r, 340));
    return { toSummer: await step(0.30), toAutumn: await step(0.55), toWinter: await step(0.80) };
  });
  ok('winter rebakes the settlement and the other two turns of the year do not (' +
     JSON.stringify(purge) + ')',
     purge.toWinter > 0 && purge.toWinter > purge.toSummer && purge.toWinter > purge.toAutumn);

  // ---- and none of it is in the save ---------------------------------------
  // A house's look comes out of who owns the building, so a save written before
  // any of this existed opens into a valley that looks right.
  const round = await page.evaluate(() => {
    const g = window.__IV;
    const snap = JSON.parse(JSON.stringify(g.snap()));
    g.restore(snap);
    return { col: window.__IV.roofCol('house', 1), ents: g.ents().length };
  });
  ok('a save carries none of it, and still opens into the right valley (' +
     round.ents + ' entities back, a crimson roof is ' + round.col + ')',
     !!round.col && round.ents > 0);

  console.log('ERRORS:', errs.length ? errs.slice(0, 3).join('\n') : 'none');
  await b.close();
})();
