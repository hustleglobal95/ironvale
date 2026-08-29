const {chromium, wrap, boot, hud} = require('./harness');
(async()=>{ wrap(); const b=await chromium.launch();
const {page,errs}=await boot(b,{diff:'easy'});
const ok=(n,c)=>console.log((c?'PASS':'FAIL')+'  '+n);
await page.evaluate(()=>{ const s=window.__IV.sides()[0]; s.f=4000; s.w=4000; s.g=4000; window.__IV.reveal(); });

// --- a dock only goes on the shore
const spot=await page.evaluate(()=>{
  const g=window.__IV, d=g.dims(), tc=g.ents().find(e=>e.type==='tc'&&e.owner===0);
  let best=null, bd=1e9;
  for(let y=2;y<d[1]-4;y++) for(let x=2;x<d[0]-4;x++){
    if(!g.shore(x,y)) continue;
    if(!g.ghostOkTile) {}
    const dd=Math.hypot(x*28-tc.x, y*28-tc.y);
    if(dd<bd){ bd=dd; best=[x,y]; }
  }
  return {shore:best, dist:Math.round(bd)};
});
console.log('   nearest shore to base:', JSON.stringify(spot.shore), spot.dist+'px away');
ok('the map has a usable shoreline', !!spot.shore);

const placed=await page.evaluate(()=>{
  const g=window.__IV, d=g.dims(), tc=g.ents().find(e=>e.type==='tc'&&e.owner===0);
  const inland=g.tryDock(tc.tx+6, tc.ty+6);          // dry inland: must be refused
  let onShore=null, at=null, best=1e9;
  for(let y=1;y<d[1]-4;y++) for(let x=1;x<d[0]-4;x++){
    let land=true, shore=false;
    for(let j=0;j<3;j++) for(let i=0;i<3;i++){
      if(g.wet(x+i,y+j)) land=false;
      if(g.shore(x+i,y+j)) shore=true;
    }
    if(!land||!shore) continue;
    const dd=Math.hypot(x*28-tc.x, y*28-tc.y);
    if(dd<best&&g.free(x,y,3,3,0,'dock')){ best=dd; at=[x,y]; }
  }
  if(at) onShore=g.tryDock(at[0],at[1]);
  return {inland:!!inland, onShore:!!onShore, at, dist:Math.round(best)};
});
console.log('   dock sited at tile', JSON.stringify(placed.at), placed.dist+'px from base');
ok('a dock is refused inland', !placed.inland);
ok('a dock is accepted on the shore', placed.onShore);

// --- fishing boats gather food
await page.evaluate(()=>{ const d=window.__IV.ents().find(e=>e.type==='dock'&&e.owner===0);
  d.building=false; d.hp=d.maxHp; d.prog=d.buildTime; window.__IV.go(d.x,d.y); });
await page.waitForTimeout(300);
const before=await page.evaluate(()=>Math.round(window.__IV.stats().gath.f));
await page.evaluate(()=>{ const d=window.__IV.ents().find(e=>e.type==='dock'&&e.owner===0);
  for(let i=0;i<3;i++) window.__IV.enq(d,'fisher'); });
// Build time scales with how far the dock landed from the base, so wait for the
// first hull rather than a fixed delay.
let boats=0;
for(let i=0;i<30;i++){
  await page.waitForTimeout(1000);
  boats=await page.evaluate(()=>window.__IV.ents().filter(e=>e.type==='fisher'&&e.owner===0).length);
  if(boats>=1) break;
}
ok('the dock launches fishing boats ('+boats+')', boats>=1);
await page.screenshot({path:require('path').join(__dirname,'..','.tmp','w_dock.png')});
await page.waitForTimeout(45000);
// Measure what was landed, not what is in the purse. The purse also pays for
// everything the settlement eats and loses whatever it cannot store, so a boat
// can fish all day and leave the number lower than it found it.
const after=await page.evaluate(()=>Math.round(window.__IV.stats().gath.f));
const onFish=await page.evaluate(()=>window.__IV.ents().filter(e=>e.type==='fisher'&&e.task==='gather').length);
ok('boats fish and land the catch ('+before+' -> '+after+' landed, '+onFish+' working)', after>before);

// --- the waterline holds both ways
const land=await page.evaluate(()=>{
  const g=window.__IV, d=g.dims();
  // pick a lake centre and send a militia at it
  let wx=0,wy=0;
  for(let y=2;y<d[1]-2;y++) for(let x=2;x<d[0]-2;x++)
    if(g.wet(x,y)&&g.wet(x+2,y)&&g.wet(x,y+2)&&g.wet(x-2,y)&&g.wet(x,y-2)){ wx=x; wy=y; }
  // put a soldier on the nearest dry ground and order him into the lake
  let sx=wx,sy=wy;
  for(let r=1;r<20;r++){ let f=false;
    for(let a=0;a<16;a++){ const px=Math.round(wx+Math.cos(a*0.3927)*r), py=Math.round(wy+Math.sin(a*0.3927)*r);
      if(!g.wet(px,py)){ sx=px; sy=py; f=true; break; } }
    if(f) break; }
  const u=g.spawn(0,'militia',sx*28+14,sy*28+14);
  u.task='move'; u.tx=wx*28+14; u.ty=wy*28+14;
  return {id:u.id, wx:wx*28+14, wy:wy*28+14};
});
await page.waitForTimeout(9000);
ok('a land unit cannot walk into the lake', await page.evaluate(i=>{
  const u=window.__IV.ents().find(e=>e.id===i); return u && !window.__IV.wet((u.x/28)|0,(u.y/28)|0);}, land.id));

const ship=await page.evaluate(l=>{
  const g=window.__IV, u=g.ents().find(e=>e.type==='fisher'&&e.owner===0);
  if(!u) return null;
  u.task='move'; u.tx=l.wx+900; u.ty=l.wy;    // aim him at dry land far off
  return u.id;}, land);
await page.waitForTimeout(9000);
ok('a boat cannot sail onto dry land', ship===null || await page.evaluate(i=>{
  const u=window.__IV.ents().find(e=>e.id===i); return !u || window.__IV.wet((u.x/28)|0,(u.y/28)|0);}, ship));
console.log('ERRORS:', errs.length?errs.slice(0,3).join('\n'):'none');
await b.close(); })();
