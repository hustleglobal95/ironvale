const {chromium, wrap, boot} = require('./harness');
(async()=>{ wrap(); const b=await chromium.launch();
const {page,errs}=await boot(b,{diff:'easy'});
const innerWidthGuess=1440;
const ok=(n,c)=>console.log((c?'PASS':'FAIL')+'  '+n);

// --- log toasts must never eat a click
await page.waitForTimeout(600);
const probe=await page.evaluate(()=>{
  const d=document.querySelector('#log div'), r=d.getBoundingClientRect();
  return {pe:getComputedStyle(d).pointerEvents,
    rect:[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)],
    top:document.elementFromPoint(r.left+r.width/2,r.top+r.height/2).tagName};
});
ok('log toasts are click-through ('+probe.pe+', topmost '+probe.top+')', probe.pe==='none'&&probe.top==='CANVAS');
await page.evaluate(p=>{ const g=window.__IV,c=g.cam();
  const u=g.ents().find(e=>e.kind==='unit'&&e.owner===0&&e.type==='vil');
  u.x=c.x+p[0]+p[2]/2; u.y=c.y+p[1]+p[3]/2; u.task='idle'; u.vx=0; u.vy=0;
  u.target=null; u.resT=null; g.sel().length=0;}, probe.rect);
await page.waitForTimeout(500);
// read where he actually settled: the shoreline may have nudged him
const v=await page.evaluate(()=>{ const g=window.__IV,c=g.cam();
  const u=g.ents().find(e=>e.kind==='unit'&&e.owner===0&&e.type==='vil');
  return {sx:Math.round(u.x-c.x), sy:Math.round(u.y-c.y)};});
await page.mouse.click(v.sx,v.sy); await page.waitForTimeout(200);
ok('a unit under a log message is selectable', await page.evaluate(()=>window.__IV.sel().length>0));

// --- order cards must survive a slow click
await page.mouse.move(150,110); await page.mouse.down(); await page.mouse.move(1150,660,{steps:6}); await page.mouse.up();
await page.waitForTimeout(400);
const stable=await page.evaluate(()=>new Promise(res=>{
  const grid=document.getElementById('cardGrid'), first=grid.firstElementChild;
  let removed=0;
  const mo=new MutationObserver(ms=>{for(const m of ms) removed+=m.removedNodes.length;});
  mo.observe(grid,{childList:true});
  setTimeout(()=>{mo.disconnect(); res({removed, same:grid.firstElementChild===first});},1200);
}));
ok('card buttons are not replaced while idle (removals '+stable.removed+')', stable.same&&stable.removed===0);
for(const hold of [320, 700, 1100]){
  const box=await page.evaluate(()=>{
    const cs=[...document.querySelectorAll('.card')];
    const c=cs.find(x=>/Palisade/.test(x.textContent)).getBoundingClientRect();
    return [c.left+c.width/2, c.top+c.height/2];});
  await page.mouse.move(box[0],box[1]); await page.mouse.down();
  await page.waitForTimeout(hold);
  await page.mouse.up(); await page.waitForTimeout(200);
  const t=await page.evaluate(()=>document.getElementById('selTitle').textContent);
  ok('a '+hold+'ms press on the Palisade card registers', /Placing Palisade/.test(t));
  await page.keyboard.press('Escape'); await page.waitForTimeout(150);
}
// and the click still works when the card set changes underneath (resources crossing a cost)
await page.evaluate(()=>{ const s=window.__IV.sides()[0]; s.w=0; });
await page.waitForTimeout(300);
await page.evaluate(()=>{ const s=window.__IV.sides()[0]; s.w=900; });
await page.waitForTimeout(300);
const box2=await page.evaluate(()=>{
  const cs=[...document.querySelectorAll('.card')];
  const c=cs.find(x=>/Palisade/.test(x.textContent)).getBoundingClientRect();
  return [c.left+c.width/2, c.top+c.height/2];});
await page.mouse.click(box2[0],box2[1]); await page.waitForTimeout(250);
ok('card still clickable after affordability flips', /Placing Palisade/.test(
  await page.evaluate(()=>document.getElementById('selTitle').textContent)));

// --- what the ghost shows is what a single click does
let agree=0, cases=0, greens=0, greenPlaced=0;
for(let i=0;i<14;i++){
  const sx=300+ (i%7)*64, sy=170 + Math.floor(i/7)*70;
  const pre=await page.evaluate(([x,y])=>{
    const g=window.__IV, c=g.cam(), T=28;
    const tx=Math.floor((x+c.x)/T+0.5-0.5), ty=Math.floor((y+c.y)/T+0.5-0.5);
    return {tx,ty,green:g.ghostOk(x,y), n:g.ents().filter(e=>e.type==='palisade').length};
  },[sx,sy]);
  await page.mouse.click(sx,sy); await page.waitForTimeout(150);
  const post=await page.evaluate(()=>window.__IV.ents().filter(e=>e.type==='palisade').length);
  const placed=post>pre.n;
  cases++; if(placed===pre.green) agree++;
  if(pre.green){ greens++; if(placed) greenPlaced++; }
  if(placed!==pre.green) console.log('   mismatch at',sx,sy,'ghost',pre.green?'green':'red','placed',placed);
}
ok('a green ghost always places on the first click ('+greenPlaced+'/'+greens+')', greens>0&&greenPlaced===greens);
ok('a red ghost never places, and nothing else does either ('+agree+'/'+cases+' agree)', agree===cases);
await page.keyboard.press('Escape');

// --- selecting a unit: click anywhere on the figure, with hand jitter
// use a villager spawned alone on open ground so the probe is not disturbed by others
let hits=0, tries=0;
for(const dy of [10,4,0,-6,-12,-18,-22]){
  for(const [jx,jy] of [[0,0],[6,4],[-5,3]]){
    const p=await page.evaluate(()=>{
      const g=window.__IV, d=g.dims();
      g.ents().filter(e=>e.type==='probe').forEach(e=>e.dead=true);
      // find open dry ground with nothing else near it
      const tc=g.ents().find(e=>e.type==='tc'&&e.owner===0);
      let px=0,py=0;
      for(let r=6;r<26;r++){
        for(let a=0;a<24;a++){
          const x=tc.x+Math.cos(a*0.2618)*r*28, y=tc.y+Math.sin(a*0.2618)*r*28;
          if(x<60||y<60||x>d[2]-60||y>d[3]-60) continue;
          if(g.wet((x/28)|0,(y/28)|0)) continue;
          if(g.ents().some(e=>!e.dead&&e.kind!=='res'&&Math.hypot(e.x-x,e.y-y)<70)) continue;
          if(g.ents().some(e=>!e.dead&&e.kind==='res'&&Math.hypot(e.x-x,e.y-y)<34)) continue;
          px=x; py=y; break;
        }
        if(px) break;
      }
      const u=g.spawn(0,'vil',px,py);
      u.task='idle'; u.vx=0; u.vy=0; u.target=null; u.resT=null;
      g.go(u.x,u.y); g.sel().length=0;
      const c=g.cam();
      return [Math.round(u.x-c.x), Math.round(u.y-c.y)];
    });
    await page.waitForTimeout(300);
    await page.mouse.move(p[0],p[1]+dy); await page.mouse.down();
    if(jx||jy) await page.mouse.move(p[0]+jx,p[1]+dy+jy);
    await page.mouse.up(); await page.waitForTimeout(90);
    tries++; if(await page.evaluate(()=>window.__IV.sel().length>0)) hits++;
  }
}
ok('clicking the figure selects it, jitter and all ('+hits+'/'+tries+')', hits===tries);

// --- a real drag still box-selects
await page.evaluate(()=>{ window.__IV.sel().length=0; });
const onScreen=await page.evaluate(()=>{const g=window.__IV,c=g.cam();
  return g.ents().filter(e=>e.kind==='unit'&&e.owner===0&&e.x>c.x+60&&e.x<c.x+innerWidth-60
    &&e.y>c.y+120&&e.y<c.y+innerHeight-240).length;});
await page.mouse.move(60,110); await page.mouse.down();
await page.mouse.move(innerWidthGuess-60,660,{steps:8}); await page.mouse.up();
await page.waitForTimeout(200);
const got=await page.evaluate(()=>window.__IV.sel().length);
ok('a real drag still box-selects ('+got+' of '+onScreen+' on screen)', got>=onScreen&&got>0);

console.log('ERRORS:', errs.length?errs.join('\n'):'none');
await b.close(); })();
