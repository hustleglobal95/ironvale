// Four crowns, and what passes between them.
//
// The point of this suite is that the neighbours are a system and not a
// decoration: three settlements really run, they really pick each other as
// targets, oaths really change who marches on whom, and what they lose really
// changes what they build. Every assertion below is measured off the running
// game rather than off the tables the game was written from.
const { chromium, wrap, boot, hud } = require('./harness');

(async () => {
  wrap();
  const b = await chromium.launch();
  const { page, errs } = await boot(b, { diff: 'easy' });
  const ok = (n, c) => console.log((c ? 'PASS' : 'FAIL') + '  ' + n);

  await page.evaluate(() => window.__IV.reveal());

  // ---- there are four of them, and three of them think
  const seats = await page.evaluate(() => {
    const g = window.__IV, h = g.houses();
    const tcs = {};
    for (const o of h.SET) tcs[o] = g.ents().filter(e => e.kind === 'bld' && e.type === 'tc' && e.owner === o).length;
    return { set: h.SET, ais: h.AIS, tcs, books: Object.keys(g.AI()).map(Number) };
  });
  ok('four crowns hold the valley (' + seats.set.join(',') + ')', seats.set.length === 4);
  ok('each one starts with a town center', seats.set.every(o => seats.tcs[o] === 1));
  ok('three of them keep a book (' + seats.books.join(',') + ')', seats.books.length === 3);

  // ---- their towns are far enough apart to be separate places
  const spread = await page.evaluate(() => {
    const g = window.__IV, h = g.houses();
    const tc = {}; for (const o of h.SET) tc[o] = g.ents().find(e => e.kind === 'bld' && e.type === 'tc' && e.owner === o);
    let min = 1e9;
    for (let i = 0; i < h.SET.length; i++) for (let j = i + 1; j < h.SET.length; j++) {
      const a = tc[h.SET[i]], c = tc[h.SET[j]];
      min = Math.min(min, Math.hypot(a.x - c.x, a.y - c.y));
    }
    return Math.round(min);
  });
  ok('no two towns are on top of each other (' + spread + 'px apart at closest)', spread > 500);

  // ---- relations are symmetric and the Crimson Host still starts hostile
  const rel0 = await page.evaluate(() => {
    const g = window.__IV;
    return { pe: g.rel(0, 1), sym: g.rel(1, 0) === g.rel(0, 1) && g.rel(3, 4) === g.rel(4, 3) };
  });
  ok('the Crimson Host starts against you (' + rel0.pe + ')', rel0.pe <= -35);
  ok('relations are the same read from either side', rel0.sym);

  // ---- everyone builds. Not just the one that always did.
  const grew = await page.evaluate(async () => {
    const g = window.__IV, h = g.houses();
    const before = {}; for (const o of h.AIS) before[o] = g.ents().filter(e => e.owner === o && !e.dead).length;
    g.setSpeed(8);
    await new Promise(r => setTimeout(r, 22000));
    g.setSpeed(1);
    const after = {}, res = {};
    for (const o of h.AIS) {
      after[o] = g.ents().filter(e => e.owner === o && !e.dead).length;
      res[o] = Math.round(g.sides()[o].f + g.sides()[o].w);
    }
    return { before, after, res, ais: h.AIS };
  });
  for (const o of grew.ais)
    ok('house ' + o + ' is running its own settlement (' + grew.before[o] + ' -> ' + grew.after[o] + ' things, ' + grew.res[o] + ' held)',
       grew.after[o] > grew.before[o]);

  // ---- each one has picked somebody, and it is never itself or a sworn friend
  const foes = await page.evaluate(() => {
    const g = window.__IV, h = g.houses();
    const m = {}; for (const o of h.AIS) m[o] = g.foe(o);
    return m;
  });
  ok('every crown is pointed at somebody (' + JSON.stringify(foes) + ')',
     Object.keys(foes).every(o => foes[o] !== undefined && foes[o] !== null && +foes[o] !== +o));
  // Three crowns at one throat is not a valley, it is a firing squad. They are
  // meant to weigh each other as well as you.
  ok('they do not all pick the same throat',
     new Set(Object.values(foes)).size > 1 || Object.values(foes).every(v => v !== 0));

  // ---- an oath takes a crown off you
  const pact = await page.evaluate(() => {
    const g = window.__IV;
    g.setRel(0, 1, 80);                       // sworn to the Crimson Host
    const before = g.foe(1);
    g.AI()[1].foeT = -999;                    // make it re-read the valley now
    // one think, without waiting a real second
    g.tick(1.2);
    return { before, after: g.foe(1), band: g.rel(0, 1) };
  });
  ok('a sworn crown stops naming you its enemy (' + pact.before + ' -> ' + pact.after + ')', pact.after !== 0);

  // ---- what kills them changes what they raise
  const learn = await page.evaluate(() => {
    const g = window.__IV, A = g.AI()[1];
    const m0 = JSON.parse(JSON.stringify(A.mix));
    const horse = { owner: 0, kind: 'unit', type: 'knight' };
    const foot = { owner: 1, kind: 'unit', type: 'spear' };
    for (let i = 0; i < 12; i++) g.noteKill(horse, foot);
    return { before: m0, after: JSON.parse(JSON.stringify(A.mix)), hurt: A.hurt[0] };
  });
  ok('losing spears to horse makes them want spears (' + learn.before.inf + ' -> ' + learn.after.inf.toFixed(2) + ')',
     learn.after.inf > learn.before.inf);
  ok('and want less horse of their own (' + learn.after.cav.toFixed(2) + ')', learn.after.cav < learn.before.cav);
  ok('they remember who did it (' + learn.hurt + ' marks against you)', learn.hurt >= 12);

  // ---- razing their buildings makes them want towers
  const walls = await page.evaluate(() => {
    const g = window.__IV, A = g.AI()[1], w0 = A.wall;
    for (let i = 0; i < 6; i++) g.noteKill({ owner: 0, kind: 'unit', type: 'ram' }, { owner: 1, kind: 'bld', type: 'house' });
    return { before: w0, after: A.wall };
  });
  ok('razing their buildings makes them want towers (' + walls.before + ' -> ' + walls.after.toFixed(1) + ')',
     walls.after > walls.before);

  // ---- letters, and the feed the player reads them in
  const letters = await page.evaluate(async () => {
    const g = window.__IV, h = g.houses();
    const n0 = g.feed().length;
    g.setSpeed(8);
    for (let i = 0; i < 26; i++) { for (const o of h.AIS) g.talkNow(o); await new Promise(r => setTimeout(r, 400)); }
    g.setSpeed(1);
    const f = g.feed();
    return { n0, n: f.length, kinds: [...new Set(f.map(d => d.kind))], last: f.slice(-3).map(d => d.text) };
  });
  ok('the crowns write to each other (' + letters.n0 + ' -> ' + letters.n + ' dispatches)', letters.n > letters.n0);
  ok('the dispatches say something (' + JSON.stringify(letters.last[letters.last.length - 1] || '') + ')',
     letters.n === 0 || letters.last.every(t => typeof t === 'string' && t.length > 10));

  // ---- the courts sheet renders what the feed holds
  const sheet = await page.evaluate(() => {
    window.__IV.courts();
    const rows = document.querySelectorAll('#relGrid .relrow').length;
    const items = document.querySelectorAll('#feedList .dsp').length;
    const shown = document.getElementById('courts').style.display;
    document.getElementById('courtsClose').click();
    return { rows, items, shown, closed: document.getElementById('courts').style.display };
  });
  ok('the courts sheet lists every pairing (' + sheet.rows + ' rows)', sheet.rows === 6);
  ok('and the dispatches under them (' + sheet.items + ')', sheet.items > 0);
  ok('it opens and closes', sheet.shown === 'grid' && sheet.closed === 'none');

  // ---- an envoy can be answered, and the answer costs or pays
  const envoy = await page.evaluate(() => {
    const g = window.__IV, s = g.sides()[0];
    s.g = 500;
    g.offer(1, 'demand');
    const shown = document.getElementById('envoy').style.display;
    const text = document.getElementById('envoyText').textContent;
    const g0 = s.g, r0 = g.rel(0, 1);
    document.getElementById('envoyYes').click();
    return { shown, text, paid: Math.round(g0 - s.g), warmer: g.rel(0, 1) > r0,
             gone: document.getElementById('envoy').style.display, pending: !!g.envoy() };
  });
  ok('an envoy comes to the gate (' + JSON.stringify(envoy.text.slice(0, 40)) + ')', envoy.shown !== 'none' && envoy.text.length > 10);
  ok('paying tribute costs gold (' + envoy.paid + ')', envoy.paid > 0);
  ok('and buys goodwill', envoy.warmer);
  ok('the envoy leaves once answered', envoy.gone === 'none' && !envoy.pending);

  const refuse = await page.evaluate(() => {
    const g = window.__IV, s = g.sides()[0];
    s.g = 500;
    g.offer(1, 'demand');
    const g0 = s.g, r0 = g.rel(0, 1);
    document.getElementById('envoyNo').click();
    return { kept: Math.round(s.g - g0), colder: g.rel(0, 1) < r0 };
  });
  ok('refusing keeps the gold (' + refuse.kept + ')', refuse.kept === 0);
  ok('and costs the goodwill', refuse.colder);

  // ---- a save carries the whole diplomatic position
  const round = await page.evaluate(() => {
    const g = window.__IV;
    g.setRel(1, 3, 71);
    g.AI()[1].wall = 4.5; g.AI()[1].mix.cav = 2.75; g.AI()[1].wave = 6;
    const snap = g.snap();
    g.setRel(1, 3, -80); g.AI()[1].wall = 0; g.AI()[1].mix.cav = 1; g.AI()[1].wave = 0;
    g.restore(snap);
    const A = g.AI()[1];
    return { rel: g.rel(1, 3), wall: A.wall, cav: A.mix.cav, wave: A.wave, feed: g.feed().length };
  });
  ok('a save remembers the oaths (' + round.rel + ')', round.rel === 71);
  ok('and what each crown has learned (wall ' + round.wall + ', horse ' + round.cav + ', ' + round.wave + ' raids)',
     round.wall === 4.5 && round.cav === 2.75 && round.wave === 6);
  ok('and the dispatches', round.feed > 0);

  // ---- an old save, from when there was one neighbour, still opens
  const legacy = await page.evaluate(() => {
    const g = window.__IV;
    const snap = g.snap();
    snap.ai = { t: 0, wave: 9, waveSize: 7, attacking: false, lastAttack: 0, camps: 2, harass: false };
    delete snap.rel; delete snap.feed;
    g.restore(snap);
    const A = g.AI();
    // A fresh crown has a book but has not made up its mind yet — deciding is
    // the first think's job, not the constructor's.
    return { wave: A[1].wave, three: Object.keys(A).length,
             book: !!(A[3] && A[3].mix && A[3].hurt && A[3].pactT) };
  });
  ok('a save from before the neighbours still loads (wave ' + legacy.wave + ')', legacy.wave === 9);
  ok('and the new crowns get books of their own', legacy.three === 3 && legacy.book);

  // ---- you can write to them too
  const mine = await page.evaluate(() => {
    const g = window.__IV;
    g.sides()[0].g = 900; g.sides()[0].f = 900;
    g.setRel(0, 1, -70);                    // at war with the Crimson Host
    g.setRel(0, 3, 10);                     // and merely wary of Thornhollow
    g.courts();
    const cards = document.querySelectorAll('#myCourts .mine').length;
    const btn = n => document.querySelector('.sbtn[data-o="' + n + '"][data-k="terms"]');
    const oath = n => document.querySelector('.sbtn[data-o="' + n + '"][data-k="oath"]');
    return { cards, termsAtWar: !btn(1).disabled, termsAtPeace: !!btn(3).disabled,
             oathAtWar: !!oath(1).disabled, oathAtPeace: !oath(3).disabled };
  });
  ok('your borders are listed (' + mine.cards + ')', mine.cards === 3);
  ok('you can sue for terms only with a house at war', mine.termsAtWar && mine.termsAtPeace);
  ok('and offer an oath only to one that is not', mine.oathAtWar && mine.oathAtPeace);

  const gift = await page.evaluate(() => {
    const g = window.__IV, s = g.sides()[0];
    s.g = 900;
    const r0 = g.rel(0, 3), g0 = s.g, n0 = g.feed().length;
    g.send(3, 'gift');
    return { cost: Math.round(g0 - s.g), warmer: g.rel(0, 3) - r0, wrote: g.feed().length - n0 };
  });
  ok('a gift costs gold (' + gift.cost + ')', gift.cost === 80);
  ok('and is never refused (+' + gift.warmer + ')', gift.warmer > 0);
  ok('and it goes in the dispatches', gift.wrote === 1);

  const poor = await page.evaluate(() => {
    const g = window.__IV;
    g.sides()[0].g = 10;
    return { blocked: !g.canSend(3, 'gift') };
  });
  ok('a letter you cannot pay for cannot be sent', poor.blocked);

  const terms = await page.evaluate(() => {
    const g = window.__IV, out = { yes: 0, no: 0 };
    // sue over and over from a strong position: it should land more often than not
    for (let i = 0; i < 40; i++) {
      g.sides()[0].g = 900;
      g.setRel(0, 1, -70);
      g.send(1, 'terms');
      if (g.rel(0, 1) > -35) out.yes++; else out.no++;
    }
    return out;
  });
  ok('terms are sometimes accepted and sometimes not (' + terms.yes + ' of 40)',
     terms.yes > 0 && terms.no > 0);

  // ---- pressure earns pressure
  const press = await page.evaluate(() => {
    const g = window.__IV, A = g.AI()[1];
    A.hurt[0] = 0;
    const calm = A.hurt[0];
    for (let i = 0; i < 30; i++) g.noteKill({ owner: 0, kind: 'unit', type: 'militia' }, { owner: 1, kind: 'unit', type: 'spear' });
    return { calm, bled: A.hurt[0] };
  });
  ok('they count what you have taken from them (' + press.bled + ')', press.bled >= 30);

  const h = await hud(page);
  ok('the game is still running', h.over === 'none');
  console.log('ERRORS:', errs.length ? errs.slice(0, 3).join('\n') : 'none');
  await b.close();
})();
