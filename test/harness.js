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
  stats:()=>stats, ai:()=>aiState, placing:()=>placing,
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
    const tx=Math.floor((sx+cam.x)/TILE-d.w/2+0.5);
    const ty=Math.floor((sy+cam.y)/TILE-d.h/2+0.5);
    const s=sides[PLAYER];
    return tileFree(tx,ty,d.w,d.h,0,placing) &&
           s.w>=d.cost.w && s.g>=d.cost.g && s.f>=d.cost.f;
  },
  plant:plantStandard, flag:()=>standardOf(PLAYER),
  pick:(sx,sy)=>{ const w=toWorld(sx,sy); const p=pickAt(w.x,w.y);
    return p?{t:p.type,o:p.owner,k:p.kind,id:p.id}:null; },
  spriteCount:()=>Object.keys(SPRITE).length,
  chunks:()=>chunkCache.size,
  fallen:()=>fallen, spent:()=>spent
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
