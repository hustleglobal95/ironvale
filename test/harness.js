// Shared Playwright harness for the Ironvale suites.
//
// The game ships as a bare fragment (no <html>/<head>), because the Artifact
// host wraps it at publish time. For testing we wrap it ourselves into a
// throwaway file next to the source, then drive that.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const GAME = path.join(ROOT, 'ironvale.html');
const TMP = path.join(ROOT, '.tmp');
const WRAPPED = path.join(TMP, 'wrapped.html');

// The shipped game exposes nothing. Rather than carry a debug surface into
// production, the harness splices one in at wrap time: a `window.__IV` object
// that reaches the module-scope state the suites need to assert against.
// Keep this in sync with the game — a rename here is a failing suite, which is
// the point.
const HOOK = `
window.__IV={
  ents:()=>ents, sides:()=>sides, cam:()=>cam, sel:()=>sel, hist:()=>hist,
  stats:()=>stats, ai:()=>AI[ENEMY], placing:()=>placing,
  AI:()=>AI, rel:(a,b)=>rel(a,b), relAll:()=>REL, feed:()=>DISPATCH,
  houses:()=>({SET:SETTLEMENTS, AIS:AI_SIDES}),
  envoy:()=>envoy, answer:(y)=>answerEnvoy(y), courts:openCourts,
  power:(o)=>powerOf(o), foe:(o)=>AI[o]&&AI[o].foe,
  setRel:(a,b,v)=>setRel(a,b,v), talkNow:(o)=>{ if(AI[o]) AI[o].talk=0; },
  sprMem:()=>{ let n=0,b=0,tn=0,tb=0; for(const k in SPRITE){ const c=SPRITE[k].c; const z=c.width*c.height*4; n++; b+=z; if(k.slice(0,4)==='tree'){tn++;tb+=z;} } return {n,mb:+(b/1048576).toFixed(1),tn,tmb:+(tb/1048576).toFixed(1),dpr:SPR_DPR}; },
  pace:()=>PACE, crops:()=>CROP, gap:(n)=>waveGap(n), diff:()=>DIFF,
  units:()=>UNIT, ages:()=>AGES, prod:(b,dt)=>tickProduction(b,dt),
  marauders:(dt)=>tickMarauders(dt), setTime:(v)=>{ gameTime=v; },
  startAge:(o)=>startAge(o),
  usprite:(t,o,p,d)=>unitSprite(t,o,p,d), ugeom:(t)=>unitGeom(t),
  bsprite:(t,o,tr,v)=>bldSprite(t,o,tr,v), bpad:(t)=>bldPad(t),
  sig:(o)=>sigOf(o), roofCol:(t,o)=>roofOf(BLD[t].roof,o), season:()=>seasonNow,
  // Pixels out of a baked sprite, so a suite can ask what a roof is actually
  // painted and whether two figures have the same outline.
  px:(sp)=>{ const c=document.createElement('canvas');
    c.width=sp.c.width; c.height=sp.c.height;
    const g2=c.getContext('2d'); g2.drawImage(sp.c,0,0);
    return Array.from(g2.getImageData(0,0,c.width,c.height).data); },
  slot:(o,x,y)=>fieldSlot(o,x,y), touch:()=>{ touchLists(); rebuildOcc(); }, variant:(b)=>farmVariant(b), lay:(f)=>layBlock(f), slots:(f)=>fieldSlots(f),
  noteKill:noteKill, offer:(o,k)=>{ envoy=null; offerPlayer(o,k); },
  send:(o,k)=>playerSend(o,k), canSend:(o,k)=>playerCanSend(o,k),
  tick:(dt)=>{ for(const o of AI_SIDES) aiUpdate(o,dt); },
  t:()=>gameTime, dims:()=>[MAP_W,MAP_H,WORLD_W,WORLD_H],
  go:centerOn, snap:snapshot, restore:restore, enq:enqueue,
  spawn:makeUnit, mk:makeBuilding,
  move:orderMove, amove:orderAMove, gather:orderGather, atk:uAtk,
  wet:isWater, shore:isShore, king:kingOf,
  reveal:()=>{ vis.fill(2); },
  free:(tx,ty,w,h,pad,type)=>tileFree(tx,ty,w,h,pad,type),
  tryDock:(tx,ty)=>tryPlace('dock',tx,ty,PLAYER,null),
  // Answers the question the player actually asks: is the ghost under this
  // screen point green? Mirrors the placement preview exactly.
  ghostOk:(sx,sy)=>{
    if(!placing) return false;
    const d=BLD[placing];
    const {tx,ty}=ghostTile(sx,sy,d);
    const s=sides[PLAYER];
    return tileFree(tx,ty,d.w,d.h,0,placing) &&
           s.w>=d.cost.w && s.g>=d.cost.g && s.f>=d.cost.f;
  },
  plant:plantStandard, flag:()=>standardOf(PLAYER),
  calm:()=>{ battleHeat=0; },
  sfxObj:()=>SFX, play:(n)=>sfx(n), heat:()=>battleHeat, wet2:()=>visWater,
  sparksN:()=>sparks.length, puffsN:()=>puffs.length, shake:()=>shake,
  scarsN:()=>scarred.reduce((n,b)=>n+((b.scars&&b.scars.length)||0),0),
  pick:(sx,sy)=>{ const w=toWorld(sx,sy); const p=pickAt(w.x,w.y);
    return p?{t:p.type,o:p.owner,k:p.kind,id:p.id}:null; },
  pickH:(sx,sy)=>{ const p=pickHere(sx,sy);
    return p?{t:p.type,o:p.owner,k:p.kind,id:p.id}:null; },
  spriteCount:()=>Object.keys(SPRITE).length,
  chunks:()=>chunkCache.size,
  fallen:()=>fallen, spent:()=>spent,
  sparks:()=>sparks, puffs:()=>puffs, wrecks:()=>wrecks,
  hitFx:(a,b)=>hitDebris(a,b), rubble:(t)=>rubbleSprite(t),
  // the three-dimensional view
  v3:()=>V3, v3on:v3Toggle, orbit:v3Orbit, hAt:heightAt, tw:toWorld,
  // Where a world point lands on screen, by the same matrix the renderer uses.
  // Picking is only correct if this and toWorld are inverses of each other.
  proj:(wx,wz)=>{
    const C=v3Camera(), y=heightAt(wx,wz), M=C.VP;
    const w=M[3]*wx+M[7]*y+M[11]*wz+M[15];
    if(w<=0) return null;
    const cx=(M[0]*wx+M[4]*y+M[8]*wz+M[12])/w, cy=(M[1]*wx+M[5]*y+M[9]*wz+M[13])/w;
    return [(cx*0.5+0.5)*innerWidth, (0.5-cy*0.5)*innerHeight];
  },
  glErr:()=>{ const g=V3.gl; return g?g.getError():-1; },
  // berries, birds, and what the villagers work out for themselves
  bIdx:berryIdx, bName:resName, bRate:resRate, BERRY:()=>BERRY,
  flocks:()=>flocks, spawnFlock:spawnFlock, birdCall:k=>SFX.birdCall(k),
  learn:learnFrom, compounds:compoundState, COMPOUND:()=>COMPOUND,
  panel:()=>updatePanel(),
  // bake a fresh chunk, bypassing the cache, to time the ground
  setSpeed:(v)=>{ speed=v; },
  deposit:deposit, prosperity:prosperity, prosperBuild:prosperBuild, bldCost:bldCost,
  standing:standingTier, treasuryWorth:treasuryWorth, PROJECT:()=>PROJECT,
  fund:fund, canFund:canFund, openTreasury:drawTreasury,
  flags:()=>({running, paused, ended, speed, over:document.getElementById('over').style.display, menu:document.getElementById('menu').style.display, stats:document.getElementById('stats').style.display}),
  // the year, the fields, the larder
  setSeason:(i)=>{ gameTime=i*SEASON_LEN+8; tickSeason(); updateHUD(); },
  season:()=>seasonNow, motes:()=>motes, yearNo:()=>yearNo(),
  CROP:()=>CROP, sow:sowFarm, growRate:growRate, fertOf:fertOf,
  farmVariant:farmVariant, bldTrains:(t)=>BLD[t].trains||null,
  unitOf:(t)=>UNIT[t], place:(t,x,y,bs)=>tryPlace(t,x,y,PLAYER,bs),
  foodCap:foodCap, foodUse:foodUse, tickB:tickFarm, tickL:tickLarder, draw:()=>draw(),
  bake:(a,b)=>{ chunkCache.clear(); return groundChunk(a,b); }
};
`;

const wrap = (src = GAME, out = WRAPPED) => {
  let html = fs.readFileSync(src, 'utf8');
  if (!/window\.__IV=/.test(html)) {
    const at = html.indexOf('\nfunction frame(');
    if (at < 0) throw new Error('harness: could not find an insertion point for the debug hook');
    html = html.slice(0, at) + '\n' + HOOK + html.slice(at);
  }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out,
    '<!doctype html><html><head><meta charset="utf-8"></head><body>' + html + '</body></html>');
  return out;
};

// opts.diff  - difficulty button to click on the title screen ('easy' | ...)
// opts.noStart - stop at the title screen instead of starting a match
async function boot(browser, opts = {}) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message + '\n' + (e.stack || '').split('\n')[1]));
  page.on('console', m => {
    if (m.type() === 'error' && !/ERR_TUNNEL|ERR_NAME|fonts/.test(m.text())) errs.push('CONSOLE: ' + m.text());
  });
  await page.goto('file://' + (opts.file || WRAPPED));
  await page.waitForTimeout(500);
  if (opts.diff) await page.click(`.diff[data-d="${opts.diff}"]`);
  if (!opts.noStart) { await page.click('#startBtn'); await page.waitForTimeout(800); }
  return { page, errs };
}

// Everything the suites need to read off the HUD in one round trip.
const hud = page => page.evaluate(() => ({
  f: document.getElementById('rFood').textContent,
  w: document.getElementById('rWood').textContent,
  g: document.getElementById('rGold').textContent,
  pop: document.getElementById('rPop').textContent,
  age: document.getElementById('ageName').textContent,
  clock: document.getElementById('clock').textContent,
  chron: document.getElementById('chronCount').textContent,
  idle: document.getElementById('idleN').textContent,
  sel: document.getElementById('selTitle').textContent,
  cards: [...document.querySelectorAll('.card')].map(c =>
    (c.disabled ? '-' : '+') + c.querySelector('.nm').textContent),
  over: document.getElementById('over').style.display,
  menu: document.getElementById('menu').style.display
}));

module.exports = { chromium, wrap, boot, hud, ROOT, GAME, TMP, WRAPPED };
