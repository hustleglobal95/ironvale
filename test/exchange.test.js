// The Concord Exchange: a neutral landmark with a shared, limited larder.
// Held down here: one stands on every map, belonging to nobody; nothing can
// hurt it and soldiers do not pick fights with it; a trade needs somebody at
// the steps, spends real resources, and delivers what it says; the stock is
// shared and runs out; the restock clock refills it; mercenaries fight for
// whoever paid; the other crowns shop from the same shelves; and a save
// carries the ledger - while one written before the Exchange existed opens
// into a valley that has one anyway.
const { chromium, wrap, boot } = require('./harness');

(async () => {
  wrap();
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const { page, errs } = await boot(b, { diff: 'easy' });
  const ok = (n, c) => console.log((c ? 'PASS' : 'FAIL') + '  ' + n);

  // ---- one stands on every map, and it belongs to nobody -------------------
  const ex = await page.evaluate(() => window.__IV.exch());
  ok('one Concord Exchange stands in the valley (5x5 at ' + (ex && ex.tx) + ',' + (ex && ex.ty) + ')',
     !!ex && ex.w === 5 && ex.h === 5);
  ok('and it belongs to nobody', ex.owner === -1);

  // ---- nothing can hurt it, and nobody picks a fight with it ---------------
  const harm = await page.evaluate(async () => {
    const g = window.__IV, b2 = g.exchEnt();
    const hp0 = b2.hp;
    const m = g.spawn(0, 'militia', b2.x - 90, b2.y);
    g.hitE(m, b2);                                   // a blow, delivered directly
    const ram = g.spawn(0, 'ram', b2.x + 100, b2.y);
    ram.task = 'attack'; ram.target = b2;
    m.task = 'amove'; m.tx = b2.x + 200; m.ty = b2.y; m.am = { x: b2.x + 200, y: b2.y };
    await new Promise(r => setTimeout(r, 1500));
    const acquired = m.target === b2;
    const hp1 = b2.hp;
    m.dead = true; ram.dead = true;
    return { hp0, hp1, acquired };
  });
  ok('nothing can hurt it (' + harm.hp0 + ' -> ' + harm.hp1 + ')', harm.hp1 === harm.hp0);
  ok('and an advancing soldier does not pick a fight with it', !harm.acquired);

  // ---- a trade needs somebody at the steps ---------------------------------
  const gate = await page.evaluate(() => {
    const g = window.__IV, s = g.sides()[0];
    s.g = 2000; s.f = 500;
    const far = g.exchBuy(0, 0);                     // nobody near: refused
    return { far };
  });
  ok('with nobody at the steps, no trade', gate.far === false);

  const trade = await page.evaluate(() => {
    const g = window.__IV, s = g.sides()[0], b2 = g.exchEnt();
    const v = g.spawn(0, 'vil', b2.x, b2.y + b2.h * 28 * 0.6);
    const f0 = s.f, g0 = s.g;
    const bought = g.exchBuy(0, 0);                  // the grain shipment
    return { bought, df: Math.round(s.f - f0), dg: Math.round(s.g - g0),
             stock: g.exch().stock };
  });
  ok('with a villager at the steps the grain shipment is bought (+' + trade.df +
     ' food, ' + trade.dg + ' gold)', trade.bought && trade.df === 300 && trade.dg === -180);
  ok('and the shelf is one lighter (' + trade.stock[0] + ' left)', trade.stock[0] === 1);

  // ---- the stock is shared and finite --------------------------------------
  const dry = await page.evaluate(() => {
    const g = window.__IV;
    const second = g.exchBuy(0, 0);
    const third = g.exchBuy(0, 0);
    return { second, third, left: g.exch().stock[0] };
  });
  ok('the shelf sells out (' + dry.left + ' left, third refused)',
     dry.second && !dry.third && dry.left === 0);

  // ---- the restock clock refills it ----------------------------------------
  const restock = await page.evaluate(async () => {
    const g = window.__IV, b2 = g.exchEnt();
    b2.restockT = 0.05;
    await new Promise(r => setTimeout(r, 500));
    return { stock: g.exch().stock, timer: g.exch().restockT };
  });
  ok('the restock refills every shelf (' + restock.stock.join(',') + ')',
     restock.stock.join(',') === '2,2,2,1,1,1' && restock.timer > 100);

  // ---- mercenaries fight for whoever paid ----------------------------------
  const mercs = await page.evaluate(() => {
    const g = window.__IV, s = g.sides()[0];
    s.g = 2000;
    const before = g.ents().filter(e => e.kind === 'unit' && e.type === 'militia' && e.owner === 0 && !e.dead).length;
    const bought = g.exchBuy(0, 5);
    const after = g.ents().filter(e => e.kind === 'unit' && e.type === 'militia' && e.owner === 0 && !e.dead).length;
    return { bought, got: after - before };
  });
  ok('a mercenary company is five swords under the buyer\'s banner (' + mercs.got + ')',
     mercs.bought && mercs.got === 5);

  // ---- the other crowns shop from the same shelves -------------------------
  const rival = await page.evaluate(async () => {
    const g = window.__IV, b2 = g.exchEnt(), s1 = g.sides()[1];
    s1.g = 3000; s1.f = 1000; s1.exchT = 0;
    g.spawn(1, 'scout', b2.x + 40, b2.y + b2.h * 28 * 0.55);
    const stock0 = g.exch().stock.reduce((a, n) => a + n, 0);
    const known0 = g.exch().known.slice();
    for (let i = 0; i < 30; i++) {
      g.exchTick(0.5);
      await new Promise(r => setTimeout(r, 60));
      if (g.exch().stock.reduce((a, n) => a + n, 0) < stock0) break;
    }
    return { known: g.exch().known, stock0, stock1: g.exch().stock.reduce((a, n) => a + n, 0) };
  });
  ok('a rival crown discovers the house and buys from the same shelves (' +
     rival.stock0 + ' -> ' + rival.stock1 + ', known by ' + rival.known.join(',') + ')',
     rival.known.indexOf(1) >= 0 && rival.stock1 < rival.stock0);

  // ---- the ledger survives a save; an old save gains the house -------------
  const saved = await page.evaluate(() => {
    const g = window.__IV, b2 = g.exchEnt();
    b2.stock = [1, 0, 2, 1, 0, 1]; b2.restockT = 123; b2.known = [0, 1];
    const snap = JSON.parse(JSON.stringify(g.snap()));
    g.restore(snap);
    const e2 = g.exch();
    // and a save written before the Exchange existed:
    const old = JSON.parse(JSON.stringify(snap));
    old.ents = old.ents.filter(o2 => o2.t !== 'exchange');   // snapshot rows use short keys
    g.restore(old);
    const e3 = g.exch();
    return { stock: e2.stock.join(','), rst: Math.round(e2.restockT), known: e2.known.join(','),
             migrated: !!e3, fresh: e3 && e3.stock.join(',') };
  });
  ok('the ledger survives a save (' + saved.stock + ' at ' + saved.rst + 's, known ' + saved.known + ')',
     saved.stock === '1,0,2,1,0,1' && saved.rst === 123 && saved.known === '0,1');
  ok('and a save from before the Exchange opens into a valley that has one (' +
     saved.fresh + ')', saved.migrated && saved.fresh === '2,2,2,1,1,1');

  console.log('ERRORS:', errs.length ? errs.slice(0, 4).join('\n') : 'none');
  await b.close();
})();
