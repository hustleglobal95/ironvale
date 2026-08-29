// The crown's money. The King takes a slice of everything carried home, banks a
// little of it and spends the rest on the settlement — and the settlement gets
// cheaper and quicker to run as a result. The point of this suite is that the
// tax is a progression and not a punishment, so most of it measures what comes
// back rather than what is taken.
const { chromium, wrap, boot, hud } = require('./harness');

(async () => {
  wrap();
  const b = await chromium.launch();
  const { page, errs } = await boot(b, { diff: 'easy' });
  const ok = (n, c) => console.log((c ? 'PASS' : 'FAIL') + '  ' + n);

  await page.evaluate(() => window.__IV.reveal());

  // ---- collection, and where it goes
  const take = await page.evaluate(() => {
    const g = window.__IV, s = g.sides()[0];
    s.taxRate = 0.20; s.works = 0; s.pool = 0;
    s.treasury = { f: 0, w: 0, g: 0 }; s.taken = { f: 0, w: 0, g: 0 };
    const f0 = s.f;
    // one load carried home, by the same door every load goes through
    const u = g.ents().find(e => e.kind === 'unit' && e.owner === 0);
    u.carry = 100; u.carryType = 'w';
    g.deposit(u);
    return { purse: Math.round(s.w), reserved: +s.treasury.w.toFixed(1),
             works: +s.works.toFixed(1), pool: +s.pool.toFixed(1),
             taken: +s.taken.w.toFixed(1) };
  });
  ok('the King takes his share and the rest reaches the purse (' + take.taken + ' of 100)',
     Math.abs(take.taken - 20) < 0.01);
  ok('a third of it is reserved (' + take.reserved + ')', Math.abs(take.reserved - 6.8) < 0.05);
  ok('and the rest is reinvested (' + take.works + ')', Math.abs(take.works - 13.2) < 0.05);
  ok('the record and the balance start the same', Math.abs(take.works - take.pool) < 0.01);
  ok('a rate of nothing takes nothing', await page.evaluate(() => {
    const g = window.__IV, s = g.sides()[0];
    s.taxRate = 0; const before = s.w, w0 = s.works;
    const u = g.ents().find(e => e.kind === 'unit' && e.owner === 0);
    u.carry = 50; u.carryType = 'w'; g.deposit(u);
    s.taxRate = 0.10;
    return Math.abs(s.w - (before + 50)) < 0.01 && Math.abs(s.works - w0) < 0.01;
  }));

  // ---- prosperity: what comes back
  const rise = await page.evaluate(() => {
    const g = window.__IV, s = g.sides()[0];
    const at = w => { s.works = w; return {
      lv: g.prosperity(0), build: +g.prosperBuild(0).toFixed(3),
      tc: g.bldCost(0, 'tc').w, house: g.bldCost(0, 'house').w }; };
    const out = [at(0), at(200), at(1300), at(5000)];
    s.works = 0;
    return out;
  });
  ok('prosperity climbs with what has been reinvested (' + rise.map(r => r.lv).join('→') + ')',
     rise[0].lv === 0 && rise[3].lv === 5 && rise[1].lv < rise[2].lv);
  ok('and every level makes building cheaper (' + rise.map(r => r.tc).join(' → ') + ')',
     rise[3].tc < rise[0].tc * 0.85);
  ok('the record never falls when the balance is spent', await page.evaluate(() => {
    const g = window.__IV, s = g.sides()[0];
    s.works = 1300; s.pool = 1300;
    const before = g.prosperity(0);
    const p = g.PROJECT()[0];
    g.fund(0, p);
    return g.prosperity(0) === before && s.pool < 1300 && s.works === 1300;
  }));

  // ---- standing: what the kingdom is holding right now
  const stand = await page.evaluate(() => {
    const g = window.__IV, s = g.sides()[0];
    s.works = 0; s.projects = Object.create(null);
    const at = (f, w, t) => {
      s.f = f; s.w = w; s.treasury = { f: 0, w: 0, g: t / 2.2 };
      return { tier: g.standing(0), plot: g.bldCost(0, 'plot').w, farm: g.bldCost(0, 'farm').w };
    };
    return [at(100, 100, 0), at(500, 400, 0), at(800, 600, 300), at(1400, 1000, 800)];
  });
  ok('a poor kingdom pays full price (' + stand[0].plot + 'w for a field)', stand[0].tier === -1);
  ok('and a rich one does not (' + stand.map(x => x.plot).join(' → ') + ')',
     stand[3].plot < stand[0].plot * 0.6);
  ok('the steading gets cheaper too, but later (' + stand.map(x => x.farm).join(' → ') + ')',
     stand[1].farm === stand[0].farm && stand[3].farm < stand[0].farm);

  // ---- the works are bought out of the reinvested share, not the purse
  const works = await page.evaluate(() => {
    const g = window.__IV, s = g.sides()[0];
    s.projects = Object.create(null); s.pool = 0; s.works = 0;
    s.f = 9e3; s.w = 9e3; s.g = 9e3;
    const p = g.PROJECT()[0];
    const richPurseOnly = g.canFund(0, p);          // purse is full, pool is empty
    s.pool = p.price;
    const f0 = s.f, w0 = s.w, gath0 = s.mod ? 0 : 0;
    const gather0 = g.sides()[0].mod.gather;
    const took = g.fund(0, p);
    return { richPurseOnly, took, pool: Math.round(s.pool),
             purseUntouched: s.f === f0 && s.w === w0,
             gather: +(g.sides()[0].mod.gather / gather0).toFixed(2) };
  });
  ok('a full purse does not buy public works', !works.richPurseOnly);
  ok('the reinvested share does (' + works.pool + ' left)', works.took && works.pool === 0);
  ok('and it does not touch the purse', works.purseUntouched);
  ok('shared tools actually reach the villagers (×' + works.gather + ')', works.gather > 1.1);

  // ---- the reserve is there to be opened
  const draw = await page.evaluate(() => {
    const g = window.__IV, s = g.sides()[0];
    s.treasury = { f: 400, w: 300, g: 200 };
    const f0 = s.f, worth0 = Math.round(g.treasuryWorth(0));
    const got = Math.round(g.openTreasury(0, 0.5));
    return { worth0, got, gained: Math.round(s.f - f0), left: Math.round(g.treasuryWorth(0)) };
  });
  ok('opening the treasury moves the reserve into the purse (' + draw.got + ' of ' +
     draw.worth0 + ' worth)', draw.gained > 150 && draw.left < draw.worth0);

  // ---- and all of it survives a save
  const round = await page.evaluate(() => {
    const g = window.__IV, s = g.sides()[0];
    s.taxRate = 0.15; s.works = 900; s.pool = 640;
    s.treasury = { f: 111, w: 222, g: 33 }; s.projects = { tools: 1 };
    const snap = JSON.parse(JSON.stringify(g.snap()));
    g.restore(snap);
    const r = g.sides()[0];
    return { rate: r.taxRate, works: r.works, pool: r.pool,
             res: Math.round(r.treasury.w), proj: Object.keys(r.projects).length,
             lv: g.prosperity(0) };
  });
  ok('a save remembers the whole account (' + JSON.stringify(round) + ')',
     round.rate === 0.15 && round.works === 900 && round.pool === 640 &&
     round.res === 222 && round.proj === 1 && round.lv === 2);

  // ---- the opponent uses it too
  const ai = await page.evaluate(async () => {
    const g = window.__IV, e = g.sides()[1];
    g.setSpeed(8);
    await new Promise(r => setTimeout(r, 12000));
    g.setSpeed(1);
    return { rate: e.taxRate, works: Math.round(e.works), worth: Math.round(g.treasuryWorth(1)) };
  });
  ok('the opponent taxes and banks (' + Math.round(ai.rate * 100) + '%, ' + ai.works +
     ' reinvested, ' + ai.worth + ' reserved)', ai.rate > 0 && ai.works > 0 && ai.worth > 0);

  const h = await hud(page);
  ok('the game is still running', h.over === 'none');
  console.log('ERRORS:', errs.length ? errs.slice(0, 3).join('\n') : 'none');
  await b.close();
})();
