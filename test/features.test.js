const {chromium, wrap, boot, hud} = require('./harness');
(async()=>{ wrap(); const b=await chromium.launch();
const {page,errs}=await boot(b,{diff:'easy'});
const ok=(n,c)=>console.log((c?'PASS':'FAIL')+'  '+n);
const cards=async()=>(await hud(page)).cards;
const hitKey=async name=>{
  const cs=await cards(); const i=cs.findIndex(c=>c.includes(name));
  if(i<0) return false;
  await page.keyboard.press('QWERTYASDFGZXCVBNJKL'[i].toLowerCase());
  await page.waitForTimeout(250); return true;
};
await page.evaluate(()=>{ const s=window.__IV.sides()[0]; s.age=3; s.f=9000; s.w=9000; s.g=9000;
  const tc=window.__IV.ents().find(e=>e.kind==='bld'&&e.owner===0&&e.type==='tc');
  for(let i=0;i<10;i++) window.__IV.spawn(0, i<6?'militia':'archer', tc.x+(i%5)*30-60, tc.y+100+((i/5)|0)*30); });
await page.waitForTimeout(500);

// --- soldier order set now includes patrol
await page.keyboard.down('Control'); await page.keyboard.press('a'); await page.keyboard.up('Control');
await page.waitForTimeout(300);
const sc=await cards();
ok('four soldier orders', sc.slice(0,4).join('|')==='+Attack-move|+Patrol|+Stop|+Hold Ground');
await hitKey('Patrol');
ok('patrol arms', /Patrol/.test((await hud(page)).sel));
await page.mouse.click(760,330); await page.waitForTimeout(400);
ok('units patrol', await page.evaluate(()=>window.__IV.ents().filter(e=>e.task==='patrol').length>=8));
const legA=await page.evaluate(()=>window.__IV.ents().find(e=>e.task==='patrol').leg);
await page.waitForTimeout(16000);
ok('patrol turns around', await page.evaluate(l=>window.__IV.ents().some(e=>e.task==='patrol'&&e.leg!==l),legA));

// --- garrison
await page.keyboard.down('Control'); await page.keyboard.press('a'); await page.keyboard.up('Control');
await page.waitForTimeout(200);
const tc=await page.evaluate(()=>{const t=window.__IV.ents().find(e=>e.type==='tc'&&e.owner===0);
  window.__IV.go(t.x,t.y); return {x:t.x,y:t.y};});
await page.waitForTimeout(300);
const cam=await page.evaluate(()=>window.__IV.cam());
await page.mouse.click(Math.round(tc.x-cam.x), Math.round(tc.y-cam.y), {button:'right'});
await page.waitForTimeout(18000);
const g=await page.evaluate(()=>{const t=window.__IV.ents().find(e=>e.type==='tc'&&e.owner===0);return t.garr.length;});
ok('units shelter in the town center ('+g+')', g>=6);
ok('sheltered units leave the field', await page.evaluate(()=>
  window.__IV.ents().filter(e=>e.kind==='unit'&&e.owner===0&&e.type!=='vil').length<=4));
await page.mouse.click(Math.round(tc.x-cam.x), Math.round(tc.y-cam.y));
await page.waitForTimeout(300);
ok('panel shows the garrison', /Sheltering/.test(await page.evaluate(()=>document.getElementById('selStats').textContent)));
ok('empty-it card offered', (await cards()).some(c=>/Empty It/.test(c)));
await hitKey('Empty It'); await page.waitForTimeout(400);
ok('emptying returns them', await page.evaluate(()=>{
  const t=window.__IV.ents().find(e=>e.type==='tc'&&e.owner===0);
  return t.garr.length===0 && window.__IV.ents().filter(e=>e.kind==='unit'&&e.owner===0&&e.type!=='vil').length>=8;}));

// --- repair
// Marauders reaching the base turn the repair crew into a militia, and then
// nothing gets mended. This section is about repair, not about the raiders.
await page.evaluate(()=>{
  const g=window.__IV, tc=g.ents().find(e=>e.type==='tc'&&e.owner===0);
  for(const r of g.ents()) if(r.type==='raider'&&Math.hypot(r.x-tc.x,r.y-tc.y)<1600) r.dead=true;
  tc.hp=tc.maxHp*0.4;
});
await page.mouse.move(150,110); await page.mouse.down(); await page.mouse.move(1150,660,{steps:6}); await page.mouse.up();
await page.waitForTimeout(300);
await page.evaluate(([x,y])=>window.__IV.go(x,y),[tc.x,tc.y]);   // the drag edge-scrolls; re-centre
await page.waitForTimeout(250);
const camR=await page.evaluate(()=>window.__IV.cam());
await page.mouse.click(Math.round(tc.x-camR.x), Math.round(tc.y-camR.y), {button:'right'});
await page.waitForTimeout(500);
ok('villagers repair', await page.evaluate(()=>window.__IV.ents().some(e=>e.task==='repair')));
const hp0=await page.evaluate(()=>window.__IV.ents().find(e=>e.type==='tc'&&e.owner===0).hp);
const gt0=await page.evaluate(()=>window.__IV.t());
await page.waitForTimeout(9000);
const hp1=await page.evaluate(()=>window.__IV.ents().find(e=>e.type==='tc'&&e.owner===0).hp);
const gt1=await page.evaluate(()=>window.__IV.t());
if(hp1<=hp0+100) console.log('   (game time moved '+(gt1-gt0).toFixed(1)+'s over 9s of wall; flags '+
  JSON.stringify(await page.evaluate(()=>window.__IV.flags())) + ')');
ok('repair restores health ('+Math.round(hp0)+'→'+Math.round(hp1)+')', hp1>hp0+100);

// --- upgrade line
await page.evaluate(()=>{
  const g=window.__IV, tc=g.ents().find(e=>e.type==='tc'&&e.owner===0);
  g.mk(0,'barracks', tc.tx+5, tc.ty, true);
});
await page.waitForTimeout(400);
const br=await page.evaluate(()=>{const x=window.__IV.ents().find(e=>e.type==='barracks'&&e.owner===0);
  window.__IV.go(x.x,x.y); return {x:x.x,y:x.y};});
await page.waitForTimeout(300);
// Anything standing on the barracks wins the click, and a marauder that wanders
// onto it while the suite is aiming takes the whole section down with it. Clear
// the ones in reach: this is about the upgrade line, not about the raiders.
await page.evaluate(()=>{
  const g=window.__IV, b=g.ents().find(e=>e.type==='barracks'&&e.owner===0&&!e.dead);
  if(b) for(const r of g.ents()) if(r.type==='raider'&&Math.hypot(r.x-b.x,r.y-b.y)<900) r.dead=true;
});
const cam2=await page.evaluate(()=>window.__IV.cam());
// Units win a left-click over the building they are standing on, which is the
// behaviour we want in play. Try a few points inside the footprint until one
// lands on bare wall.
let picked=false;
for(const [dx,dy] of [[0,-26],[0,0],[-30,-26],[30,-26],[-30,10],[30,10]]){
  await page.mouse.click(Math.round(br.x-cam2.x+dx), Math.round(br.y-cam2.y+dy));
  await page.waitForTimeout(250);
  if(/Barracks/.test((await hud(page)).sel)){ picked=true; break; }
}
if(!picked) console.log('   could not select the barracks:',
  JSON.stringify(await page.evaluate(()=>({sel:document.getElementById('selTitle').textContent,
    alive:!!window.__IV.ents().find(e=>e.type==='barracks'&&e.owner===0&&!e.dead),
    building:(window.__IV.ents().find(e=>e.type==='barracks'&&e.owner===0)||{}).building,
    cam:window.__IV.cam()}))));
const bc=await cards();
ok('barracks offers the upgrade line', bc.some(c=>/Man-at-Arms/.test(c)) && bc.some(c=>/Long Swordsman/.test(c)));
ok('long swordsman is gated on man-at-arms',
  await page.evaluate(()=>[...document.querySelectorAll('.card')].some(c=>
    /Long Swordsman/.test(c.textContent) && /needs Man-at-Arms/.test(c.textContent))));
await page.evaluate(()=>{ const tc=window.__IV.ents().find(e=>e.type==='tc'&&e.owner===0);
  for(let i=0;i<3;i++) window.__IV.spawn(0,'militia',tc.x-70+i*24,tc.y+70); });
await page.waitForTimeout(300);
const hp2=await page.evaluate(()=>window.__IV.ents().find(e=>e.type==='militia'&&e.owner===0).maxHp);
await hitKey('Man-at-Arms');
// The research has to have actually started: a card press that lands on a
// disabled card, or on a side already researching something, waits 31 seconds
// and proves nothing.
const teching=await page.evaluate(()=>window.__IV.sides()[0].teching);
if(teching!=='manatarms') console.log('   (Man-at-Arms did not start: teching='+teching+')');
await page.waitForTimeout(31000);
const hp3=await page.evaluate(()=>window.__IV.ents().find(e=>e.type==='militia'&&e.owner===0).maxHp);
ok('upgrade buffs units already on the field ('+hp2+'→'+hp3+')', hp3===hp2+20);
ok('upgraded units are renamed', await page.evaluate(()=>{
  const u=window.__IV.ents().find(e=>e.type==='militia'&&e.owner===0);
  return window.__IV.sides()[0].up.militia.name==='Man-at-Arms';}));

// --- statistics
await page.keyboard.press('Tab'); await page.waitForTimeout(600);
ok('ledger opens', await page.evaluate(()=>document.getElementById('stats').style.display==='grid'));
ok('four charts drawn', await page.evaluate(()=>document.querySelectorAll('#statCharts .chart svg').length===4));
ok('stat tiles rendered', await page.evaluate(()=>document.querySelectorAll('.tile').length>=8));
ok('enemy series hidden mid-game', await page.evaluate(()=>
  !/C2453D/i.test(document.querySelector('#statCharts .chart svg').innerHTML)));
await page.screenshot({path:require('path').join(__dirname,'..','.tmp','s_stats.png')});
await page.click('#tableBtn'); await page.waitForTimeout(400);
ok('table view renders', await page.evaluate(()=>document.querySelectorAll('#statTable tbody tr').length>0));
await page.click('#tableBtn');
await page.keyboard.press('Escape'); await page.waitForTimeout(300);
ok('ledger closes and unpauses', await page.evaluate(()=>document.getElementById('stats').style.display==='none'));

// --- save round trip with the new state
const snap=await page.evaluate(()=>JSON.stringify(window.__IV.snap()));
await page.evaluate(j=>window.__IV.restore(JSON.parse(j)),snap);
await page.waitForTimeout(400);
ok('save keeps history', await page.evaluate(()=>window.__IV.hist().length>0));
ok('save keeps upgrades', await page.evaluate(()=>window.__IV.sides()[0].up.militia));
// ---- the builder's toolkit --------------------------------------------------
// Facing is cosmetic and survives a save; tearing down is voluntary and polite:
// shelterers step out, a cancelled frame refunds most of its materials, a
// finished building refunds nothing.
const kit = await page.evaluate(() => {
  const g = window.__IV, s = g.sides()[0];
  s.f = s.w = s.g = 9e5;
  const tc = g.ents().find(e => e.type === 'tc' && e.owner === 0);
  const h = g.mk(0, 'house', tc.tx + 7, tc.ty + 6, true);
  h.flip = true;
  g.restore(JSON.parse(JSON.stringify(g.snap())));
  const h2 = g.ents().filter(e => e.type === 'house' && e.owner === 0).pop();
  const kept = !!(h2 && h2.flip);
  const s2 = g.sides()[0];
  s2.f = s2.w = s2.g = 9e5;
  const tc2 = g.ents().find(e => e.type === 'tc' && e.owner === 0);
  const b = g.mk(0, 'barracks', tc2.tx + 7, tc2.ty + 10, true);
  const v = g.spawn(0, 'vil', b.x, b.y);
  b.garr.push(v); v.inside = b;
  const w0 = s2.w, wr0 = g.wrecks().length;
  g.raze(b);
  const doneRefund = s2.w - w0, alive = !v.dead;
  const c = g.mk(0, 'house', tc2.tx + 11, tc2.ty + 10, false);
  const w1 = s2.w;
  g.raze(c);
  return { kept, doneRefund, alive, wreck: g.wrecks().length > wr0,
           gone: b.dead && c.dead, back: s2.w - w1 };
});
ok('a building turned about stays turned through a save', kit.kept);
ok('torn down means gone, and it comes down like a razing', kit.gone && kit.wreck);
ok('a finished building refunds nothing (' + kit.doneRefund + ')', kit.doneRefund === 0);
ok('whoever was sheltering steps out alive first', kit.alive);
ok('a cancelled construction returns most of its materials (' + kit.back + ' W)', kit.back > 0);

// ---- the ages reach the walls -----------------------------------------------
// The one item of the original brief the town never showed: it looked the same
// in Imperial as it did in Dark. Each age re-dresses every building through the
// sprite key, and each is a bigger change than the last.
const ages = await page.evaluate(() => {
  const g = window.__IV, s = g.sides()[0];
  const diff = (A, B) => { let n = 0;
    for (let i = 0; i < A.length; i += 4)
      if (Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]) > 40) n++;
    return n; };
  const at = a => { s.age = a; return g.px(g.bsprite('house', 0, 0, 0)); };
  const d0 = at(0), d1 = at(1), d2 = at(2), d3 = at(3);
  s.age = 1;
  return { d01: diff(d0, d1), d12: diff(d1, d2), d13: diff(d1, d3) };
});
ok('a Dark Age house is rougher than a Feudal one (' + ages.d01 + ' px)', ages.d01 > 60);
ok('the Castle Age brings the masons (' + ages.d12 + ' px)', ages.d12 > 80);
ok('and the Imperial Age finishes what they started (' + ages.d13 + ' px)', ages.d13 > ages.d12);


// ================= the wolf pack ============================================
// Bred in threes at the barracks: one order, one price, three wolves. The
// population gate counts the whole litter at the queue, spears treat them as
// the horses they run like, and a save carries them as ordinary units.
const pack = await page.evaluate(async () => {
  const g = window.__IV, s = g.sides()[0];
  s.f = s.w = s.g = 9e5; s.age = 1;
  // the suite has been raising soldiers for two minutes: make room for a litter
  for (const e of g.ents())
    if (e.kind === 'unit' && e.owner === 0 && e.type !== 'king' && e.cls !== 'vil') e.dead = true;
  await new Promise(r => setTimeout(r, 300));
  const tc = g.ents().find(e => e.type === 'tc' && e.owner === 0);
  const b2 = g.mk(0, 'barracks', tc.tx + 9, tc.ty - 8, true);
  const qBefore = g.queued(0);
  const before = g.ents().filter(e => e.kind === 'unit' && e.type === 'wolf' && e.owner === 0 && !e.dead).length;
  const took = g.enq(b2, 'wolf');
  const litterQueued = g.queued(0) - qBefore;
  b2.qt = 1e9;                                   // the litter is due
  await new Promise(r => setTimeout(r, 600));
  const after = g.ents().filter(e => e.kind === 'unit' && e.type === 'wolf' && e.owner === 0 && !e.dead).length;
  return { took, litterQueued, born: after - before };
});
ok('one order at the barracks is a litter of three (' + pack.born + ' born, counted as ' +
   pack.litterQueued + ' at the queue)', pack.took && pack.born === 3 && pack.litterQueued === 3);

const counter = await page.evaluate(() => {
  const g = window.__IV;
  const wolf = g.ents().find(e => e.kind === 'unit' && e.type === 'wolf' && !e.dead);
  if (!wolf) return { vsWolf: -1, vsMil: -1, wolfVsVil: -1 };
  const spear = g.spawn(0, 'spear', wolf.x + 60, wolf.y);
  const vsWolf = g.dmg(spear, wolf);
  const militia = g.spawn(0, 'militia', wolf.x + 90, wolf.y);
  const vsMil = g.dmg(spear, militia);
  const v = g.spawn(0, 'vil', wolf.x + 120, wolf.y);
  const wolfVsVil = g.dmg(wolf, v);
  spear.dead = true; militia.dead = true; v.dead = true;
  return { vsWolf, vsMil, wolfVsVil };
});
ok('a braced spear treats a wolf like a horse (' + counter.vsWolf + ', ' + counter.vsMil +
   ' against militia)', counter.vsWolf >= counter.vsMil * 2);
ok('and a wolf is murder on a villager caught alone (' + counter.wolfVsVil + ')',
   counter.wolfVsVil > 6);

const wolfSave = await page.evaluate(() => {
  const g = window.__IV;
  const n0 = g.ents().filter(e => e.kind === 'unit' && e.type === 'wolf' && !e.dead).length;
  const snap = JSON.parse(JSON.stringify(g.snap()));
  g.restore(snap);
  const n1 = g.ents().filter(e => e.kind === 'unit' && e.type === 'wolf' && !e.dead).length;
  return { n0, n1 };
});
ok('the pack survives a save (' + wolfSave.n0 + ' -> ' + wolfSave.n1 + ')',
   wolfSave.n0 > 0 && wolfSave.n1 === wolfSave.n0);

// ---- the wolves are the painting, in five coats ---------------------------
await page.waitForFunction(() => [0, 1, 2, 3, 4].every(v => window.__IV.wArt(v)),
                           null, { timeout: 8000 });
const coats = await page.evaluate(() => {
  const g = window.__IV;
  const s0 = g.uSpr('wolf', 0, 1, 1, 0), s3 = g.uSpr('wolf', 0, 1, 1, 3);
  const cached = s0 === g.uSpr('wolf', 0, 1, 1, 0);
  const p0 = g.px(s0), p3 = g.px(s3);
  let diff = 0, ink = 0;
  for (let i = 0; i < Math.min(p0.length, p3.length); i += 4) {
    if (p0[i + 3] > 60) ink++;
    if (Math.abs(p0[i] - p3[i]) + Math.abs(p0[i + 1] - p3[i + 1]) +
        Math.abs(p0[i + 2] - p3[i + 2]) + Math.abs(p0[i + 3] - p3[i + 3]) > 40) diff++;
  }
  return { cached, diff, ink };
});
ok('two wolves of one litter wear different coats (' + coats.diff + ' px differ, ' +
   coats.ink + ' drawn)', coats.cached && coats.diff > 150 && coats.ink > 200);

console.log('ERRORS:', errs.length?errs.join('\n'):'none');
await b.close(); })();
