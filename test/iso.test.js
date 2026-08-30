// The isometric port's vertical slice, held down where it can break: the
// projection and its inverse are exact, the flag round-trips the camera and
// the save-independent preference, clicking a figure selects that figure,
// a movement order lands where the mouse pointed and the unit walks there,
// placement puts the building on the tile the ghost showed, the drawn box
// selects what it covers, depth keys order ground contact correctly, and the
// classic renderer is untouched when the flag is off.
const { chromium, wrap, boot } = require('./harness');

(async () => {
  wrap();
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const { page, errs } = await boot(b, { diff: 'easy' });
  const ok = (n, c) => console.log((c ? 'PASS' : 'FAIL') + '  ' + n);

  // ---- the projection is exact, both ways ---------------------------------
  const proj = await page.evaluate(() => {
    const g = window.__IV;
    let worst = 0;
    for (const [x, y] of [[0, 0], [406, 3682], [1234.5, 987.25], [4000, 4000]]) {
      const p = g.isoP(x, y);
      const w = { x: p.y + p.x / 2, y: p.y - p.x / 2 };
      worst = Math.max(worst, Math.abs(w.x - x), Math.abs(w.y - y));
    }
    return worst;
  });
  ok('world -> screen -> world round-trips exactly (worst ' + proj + ')', proj < 1e-9);

  // ---- toggle: held view centre, remembered preference --------------------
  const tog = await page.evaluate(() => {
    const g = window.__IV;
    const before = g.tw(innerWidth / 2, innerHeight / 2);
    g.isoToggle(true);
    const mid = g.tw(innerWidth / 2, innerHeight / 2);
    const kept = Math.hypot(mid.x - before.x, mid.y - before.y);
    let stored = null;
    try { stored = localStorage.getItem('ironvale.v3.iso'); } catch (e) {}
    return { on: g.iso(), kept, stored };
  });
  ok('the toggle holds the view centre (' + Math.round(tog.kept) + 'px of drift)',
     tog.on && tog.kept < 60);
  ok('and the choice is remembered (' + tog.stored + ')', tog.stored === '1');

  // ---- clicking a figure selects that figure ------------------------------
  await page.evaluate(() => {
    const g = window.__IV, s = g.sides()[0];
    g.reveal(); s.f = s.w = s.g = 9e5;
    const tc = g.ents().find(e => e.type === 'tc' && e.owner === 0);
    // clear ground south of the tc, park a probe there
    for (const e of g.ents())
      if (e.owner === 2 && e.kind === 'unit' && Math.hypot(e.x - tc.x, e.y - tc.y) < 400) e.dead = true;
    const u = g.spawn(0, 'militia', tc.x + 120, tc.y + 160);
    u.task = 'hold';        // or it chases a passing raider off the measured spot
    window.__P = u.id;
    const p = g.isoP(tc.x, tc.y);
    g.cam().x = p.x - innerWidth / 2; g.cam().y = p.y - innerHeight / 2;
  });
  await page.waitForTimeout(400);
  const clickAt = await page.evaluate(() => {
    const g = window.__IV, u = g.ents().find(e => e.id === window.__P);
    // The marauders wander, and a hostile standing on the probe wins the pick
    // - the game behaving correctly, the test hardening against it the same
    // way combat.test.js does: clear them around where the probe IS, now.
    for (const e of g.ents())
      if (e.owner === 2 && e.kind === 'unit' && Math.hypot(e.x - u.x, e.y - u.y) < 300) e.dead = true;
    const S = g.scr(u.x, u.y);
    return { x: Math.round(S.x), y: Math.round(S.y) - 8 };
  });
  await page.mouse.move(700, 80);
  await page.mouse.click(clickAt.x, clickAt.y);
  await page.waitForTimeout(150);
  ok('clicking a figure at its projected position selects it', await page.evaluate(() =>
    window.__IV.sel().length === 1 && window.__IV.sel()[0].id === window.__P));

  // ---- a movement order lands where the mouse pointed ---------------------
  const move = await page.evaluate(async () => {
    const g = window.__IV, u = g.ents().find(e => e.id === window.__P);
    const wx = u.x - 140, wy = u.y - 60;
    const p = g.isoP(wx, wy);
    const sx = p.x - g.cam().x, sy = p.y - g.cam().y;
    const back = g.tw(sx, sy);
    const inv = Math.hypot(back.x - wx, back.y - wy);
    g.order(sx, sy);                        // right-click through the projection
    await new Promise(r => setTimeout(r, 3200));
    return { inv, off: Math.hypot(u.x - wx, u.y - wy) };
  });
  ok('screen-to-world under the projection is exact (' + move.inv.toFixed(6) + 'px)', move.inv < 1e-6);
  ok('and the unit walks to the pointed ground (' + Math.round(move.off) + 'px off)', move.off < 34);

  // ---- placement lands on the tile the ghost showed -----------------------
  const place = await page.evaluate(() => {
    const g = window.__IV, tc = g.ents().find(e => e.type === 'tc' && e.owner === 0);
    // a spot we know is free
    const tx = tc.tx + 6, ty = tc.ty + 6;
    const wx = (tx + 1) * 28, wy = (ty + 1) * 28;   // house is 2x2; aim its centre
    const p = g.isoP(wx, wy);
    const gh = g.ghost(p.x - g.cam().x, p.y - g.cam().y, 'house');
    const okFree = g.free(tx, ty, 2, 2, 0, 'house');
    const h = g.mk(0, 'house', gh.tx, gh.ty, true);
    return { aimTx: tx, aimTy: ty, gotTx: gh.tx, gotTy: gh.ty, built: !!h, okFree };
  });
  ok('the ghost under the projected mouse is the tile that was aimed at (' +
     place.gotTx + ',' + place.gotTy + ' for ' + place.aimTx + ',' + place.aimTy + ')',
     Math.abs(place.gotTx - place.aimTx) <= 1 && Math.abs(place.gotTy - place.aimTy) <= 1 && place.built);

  // ---- the drawn box selects what it covers -------------------------------
  await page.evaluate(() => {
    const g = window.__IV, tc = g.ents().find(e => e.type === 'tc' && e.owner === 0);
    window.__B = [];
    for (let i = 0; i < 3; i++)
      window.__B.push(g.spawn(0, 'archer', tc.x + 60 + i * 30, tc.y + 220).id);
  });
  await page.waitForTimeout(250);
  const box = await page.evaluate(() => {
    const g = window.__IV;
    const pts = window.__B.map(id => { const u = g.ents().find(e => e.id === id); return g.scr(u.x, u.y); });
    const x0 = Math.min(...pts.map(p => p.x)) - 30, x1 = Math.max(...pts.map(p => p.x)) + 30;
    const y0 = Math.min(...pts.map(p => p.y)) - 40, y1 = Math.max(...pts.map(p => p.y)) + 20;
    return { x0, y0, x1, y1 };
  });
  await page.mouse.move(box.x0, box.y0);
  await page.mouse.down();
  await page.mouse.move(box.x1, box.y1, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(150);
  ok('the drawn rectangle selects the figures it covers', await page.evaluate(() => {
    const g = window.__IV, got = g.sel().map(u => u.id);
    return window.__B.every(id => got.includes(id));
  }));

  // ---- depth keys order ground contact ------------------------------------
  const depth = await page.evaluate(() => {
    const g = window.__IV, tc = g.ents().find(e => e.type === 'tc' && e.owner === 0);
    const h = g.ents().find(e => e.type === 'house' && e.owner === 0);
    const north = g.spawn(0, 'vil', h.x, (h.ty - 1) * 28);        // behind
    const south = g.spawn(0, 'vil', h.x, (h.ty + h.h + 1) * 28);  // in front
    const key = e => e.kind === 'bld' ? ((e.tx + e.w) + (e.ty + e.h)) * 28 - 0.01 : e.x + e.y;
    const r = { behind: key(north) < key(h), front: key(south) > key(h) };
    north.dead = true; south.dead = true;
    return r;
  });
  ok('a figure north of a house sorts behind it, one south sorts in front',
     depth.behind && depth.front);

  // ---- the frame still runs, and the classic view is untouched ------------
  const fps = await page.evaluate(() => new Promise(res => {
    let n = 0; const t0 = performance.now();
    const t = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(t);
                      else res(Math.round(n / ((performance.now() - t0) / 1000))); };
    requestAnimationFrame(t);
  }));
  ok('the isometric frame holds a playable rate (' + fps + ' fps)', fps > 24);
  const off = await page.evaluate(() => {
    const g = window.__IV;
    g.isoToggle(false);
    const w = g.tw(100, 100);
    return { on: g.iso(), ident: Math.abs(w.x - (100 + g.cam().x)) < 1e-9 && Math.abs(w.y - (100 + g.cam().y)) < 1e-9 };
  });
  ok('off means off: classic picking is the identity again', !off.on && off.ident);

  // ================= the master house: the building asset contract ==========
  // One entity in simulation; its appearance resolved by architecture set,
  // age, construction state, damage state and owner tint - through layers
  // that all share one canvas and one anchor, so no state change can ever
  // move the building.
  await page.evaluate(() => window.__IV.isoToggle(true));

  // ---- every state shares the canvas and the anchor ------------------------
  const contract = await page.evaluate(() => {
    const g = window.__IV, sizes = [];
    for (const a of [0, 1, 2, 3]) for (const set of [0, 1, 3, 4]) sizes.push(g.hMain(a, set));
    for (let st = 0; st < 5; st++) sizes.push(g.hStage(st));
    for (let d2 = 1; d2 <= 3; d2++) sizes.push(g.hDmg(d2));
    for (const o of [0, 1, 3, 4]) sizes.push(g.hTint(o));
    const w0 = sizes[0].w, h0 = sizes[0].h, ox0 = sizes[0].ox, oy0 = sizes[0].oy;
    return { n: sizes.length,
             same: sizes.every(sp => sp.w === w0 && sp.h === h0 && sp.ox === ox0 && sp.oy === oy0) };
  });
  ok('all ' + contract.n + ' state sprites share one canvas and one anchor', contract.same);

  // ---- construction is driven by progress, in five authored stages ---------
  const build = await page.evaluate(async () => {
    const g = window.__IV, s = g.sides()[0];
    s.f = s.w = s.g = 9e5;
    const tc = g.ents().find(e => e.type === 'tc' && e.owner === 0);
    const h = g.mk(0, 'house', tc.tx + 9, tc.ty + 9, false);
    const stages = [];
    for (const pgs of [0.05, 0.2, 0.5, 0.75, 0.95]) {
      h.prog = h.buildTime * pgs;
      stages.push(g.hBuildStage(h));
    }
    // pausing changes nothing; resuming picks up the same stage
    h.prog = h.buildTime * 0.5;
    const before = g.hBuildStage(h);
    await new Promise(r => setTimeout(r, 300));
    const after = g.hBuildStage(h);
    h.prog = h.buildTime; h.building = false; h.hp = h.maxHp;
    return { stages, held: before === after && before === 2 };
  });
  ok('progress walks the five authored stages (' + build.stages.join(',') + ')',
     build.stages.join(',') === '0,1,2,3,4');
  ok('a paused construction holds its stage', build.held);

  // ---- damage responds to health, and repair undoes it ---------------------
  const dmg = await page.evaluate(() => {
    const g = window.__IV;
    const h = g.ents().filter(e => e.type === 'house' && e.owner === 0).pop();
    const at = f => { h.hp = h.maxHp * f; return g.hDmgState(h); };
    const states = [at(1), at(0.55), at(0.25), at(0.08)];
    const repaired = at(0.95);
    return { states, repaired };
  });
  ok('health walks the damage states (' + dmg.states.join(',') + ')',
     dmg.states.join(',') === '0,1,2,3');
  ok('and repair walks them back (' + dmg.repaired + ')', dmg.repaired === 0);

  // ---- the crown is a layer, not a bake ------------------------------------
  const tint = await page.evaluate(() => {
    const g = window.__IV;
    const sameMain = g.hMain(1, 0) === g.hMain(1, 0);
    const t0 = g.px(g.hTint(0)), t1 = g.px(g.hTint(1));
    let diff = 0;
    for (let i = 0; i < t0.length; i += 4)
      if (t0[i + 3] > 60 && Math.abs(t0[i] - t1[i]) + Math.abs(t0[i + 2] - t1[i + 2]) > 40) diff++;
    return { sameMain, diff };
  });
  ok('one main sprite serves a whole architecture set', tint.sameMain);
  ok('and the crown arrives as its own tint layer (' + tint.diff + ' px differ)', tint.diff > 20);

  // ---- the age changes the picture, never the entity -----------------------
  const age = await page.evaluate(() => {
    const g = window.__IV, s = g.sides()[0];
    const h = g.ents().filter(e => e.type === 'house' && e.owner === 0).pop();
    const before = { id: h.id, tx: h.tx, ty: h.ty, hpf: h.hp / h.maxHp };
    const p1 = g.px(g.hMain(1, 0));
    s.age = 3;
    const p3 = g.px(g.hMain(3, 0));
    s.age = 1;
    let diff = 0;
    for (let i = 0; i < p1.length; i += 4)
      if (Math.abs(p1[i] - p3[i]) + Math.abs(p1[i + 1] - p3[i + 1]) + Math.abs(p1[i + 2] - p3[i + 2]) > 40) diff++;
    return { same: h.id === before.id && h.tx === before.tx && Math.abs(h.hp / h.maxHp - before.hpf) < 1e-9, diff };
  });
  ok('advancing the age re-dresses the house without touching the entity (' +
     age.diff + ' px change)', age.same && age.diff > 60);

  // ---- selection follows the footprint, not the roof -----------------------
  const selTest = await page.evaluate(() => {
    const g = window.__IV;
    const h = g.ents().filter(e => e.type === 'house' && e.owner === 0).pop();
    const centre = g.scr((h.tx + h.w / 2) * 28, (h.ty + h.h / 2) * 28);
    const roof = { x: centre.x, y: centre.y - 74 };        // in the picture, above the footprint
    const pickC = g.pickH(centre.x, centre.y);
    const pickR = g.pickH(roof.x, roof.y);
    return { onFoot: pickC && pickC.k === 'bld' && pickC.id === h.id,
             offRoof: !(pickR && pickR.k === 'bld' && pickR.id === h.id) };
  });
  ok('clicking the footprint selects the house', selTest.onFoot);
  ok('clicking the roof overhang does not - the footprint is the truth', selTest.offRoof);

  // ---- roof overhangs do not block movement --------------------------------
  const walk = await page.evaluate(async () => {
    const g = window.__IV;
    const h = g.ents().filter(e => e.type === 'house' && e.owner === 0).pop();
    const u = g.spawn(0, 'vil', (h.tx - 2) * 28, (h.ty + h.h + 1) * 28 + 14);
    u.task = 'move'; u.tx = (h.tx + h.w + 2) * 28; u.ty = (h.ty + h.h + 1) * 28 + 14;
    await new Promise(r => setTimeout(r, 3600));
    const off = Math.hypot(u.x - u.tx, u.y - u.ty);
    u.dead = true;
    return off;
  });
  ok('a villager walks under the roofline past the house (' + Math.round(walk) + 'px off)', walk < 40);

  // ---- thirty houses together, sorted and playable -------------------------
  const town = await page.evaluate(async () => {
    const g = window.__IV, s = g.sides()[0];
    s.f = s.w = s.g = 9e6;
    const tc = g.ents().find(e => e.type === 'tc' && e.owner === 0);
    let n = 0;
    for (let gy = 0; gy < 5; gy++) for (let gx = 0; gx < 6; gx++) {
      const h = g.mk(0, 'house', tc.tx - 10 + gx * 3, tc.ty + 4 + gy * 3, true);
      if (h) n++;
    }
    const p = g.isoP(tc.x, (tc.ty + 10) * 28);
    g.cam().x = p.x - innerWidth / 2; g.cam().y = p.y - innerHeight / 2;
    const fps = await new Promise(res => {
      let f = 0; const t0 = performance.now();
      const t = () => { f++; if (performance.now() - t0 < 2000) requestAnimationFrame(t);
                        else res(Math.round(f / ((performance.now() - t0) / 1000))); };
      requestAnimationFrame(t);
    });
    return { n, fps };
  });
  ok(town.n + ' houses stand together and the frame holds (' + town.fps + ' fps)',
     town.n >= 28 && town.fps > 20);
  await page.evaluate(() => window.__IV.isoToggle(false));

  console.log('ERRORS:', errs.length ? errs.slice(0, 4).join('\n') : 'none');
  await b.close();
})();
