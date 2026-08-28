const {chromium, wrap, boot, hud} = require('./harness');
const fs=require('fs');
const path=require('path');
const TMPSAVE=path.join(__dirname,'..','.tmp','save-roundtrip.json');
fs.mkdirSync(path.dirname(TMPSAVE),{recursive:true});

const HK='QWERTYASDFGZXCVBNJKL';
const place = async (page, name) => {          // returns true when a building was sited
  const cs=await page.evaluate(()=>[...document.querySelectorAll('.card .nm')].map(e=>e.textContent));
  const i=cs.findIndex(c=>c===name);
  if(i<0) return false;
  await page.keyboard.press(HK[i].toLowerCase());
  for(let y=110;y<680;y+=55) for(let x=200;x<1250;x+=55){
    await page.mouse.click(x,y); await page.waitForTimeout(45);
    const t=await page.evaluate(()=>document.getElementById('selTitle').textContent);
    if(!/^Placing/.test(t)) return true;
  }
  await page.keyboard.press('Escape');
  return false;
};

(async()=>{ wrap(); const b=await chromium.launch({downloadsPath:require('path').join(__dirname,'..','.tmp','dl')});
const {page,errs}=await boot(b,{diff:'easy'});
const ok=(n,c)=>console.log((c?'PASS':'FAIL')+'  '+n);

// --- selection and villager cards
await page.mouse.move(150,110); await page.mouse.down(); await page.mouse.move(1150,690,{steps:8}); await page.mouse.up();
await page.waitForTimeout(300);
let h=await hud(page);
ok('drag select picks villagers', /selected/.test(h.sel));
ok('23 order cards offered', h.cards.length===23);

// --- place a house
const sited=await place(page,'House');
ok('house sited', sited);
await page.waitForTimeout(14000);
ok('house finished', await page.evaluate(()=>window.__IV.ents().some(e=>e.kind==='bld'&&e.owner===0&&e.type==='house'&&!e.building)));

// --- control groups
await page.mouse.move(150,110); await page.mouse.down(); await page.mouse.move(1150,690,{steps:6}); await page.mouse.up();
await page.waitForTimeout(200);
await page.keyboard.down('Control'); await page.keyboard.press('1'); await page.keyboard.up('Control');
await page.evaluate(()=>{ document.getElementById('game').dispatchEvent(new MouseEvent('mousedown',{button:0,clientX:5,clientY:400,bubbles:true})); });
await page.mouse.click(700,400); await page.waitForTimeout(150);
await page.keyboard.press('1'); await page.waitForTimeout(250);
ok('control group recalls units', /selected|Villager/.test((await hud(page)).sel));

// --- save / load round trip
const before=await page.evaluate(()=>({t:Math.round(window.__IV.t()), f:Math.round(window.__IV.sides()[0].f)}));
await page.click('#menuBtn'); await page.waitForTimeout(300);
ok('menu opens', (await hud(page)).menu==='grid');
const slotBtns=await page.$$('.slot button');
await slotBtns[2].click();                      // Slot One -> Save
await page.waitForTimeout(400);
const meta=await page.evaluate(()=>document.querySelectorAll('.slot')[1].querySelector('.sm').textContent);
ok('slot one shows metadata', /Dark Age/.test(meta));
await page.click('#resumeBtn'); await page.waitForTimeout(200);
await page.waitForTimeout(20000);               // let the world move on
const mid=await page.evaluate(()=>Math.round(window.__IV.t()));
await page.click('#menuBtn'); await page.waitForTimeout(300);
const btns2=await page.$$('.slot button');
await btns2[3].click();                         // Slot One -> Load
await page.waitForTimeout(600);
const after=await page.evaluate(()=>({t:Math.round(window.__IV.t()), f:Math.round(window.__IV.sides()[0].f),
   ents:window.__IV.ents().length, links:window.__IV.ents().filter(e=>e.kind==='unit'&&e.resT).length}));
ok('load rewinds the clock', mid>before.t+10 && Math.abs(after.t-before.t)<3);
ok('load restores resources', Math.abs(after.f-before.f)<3);
ok('load rebuilt entity links', after.links>0);
ok('menu closed after load', (await hud(page)).menu==='none');

// --- market
await page.evaluate(()=>{ const s=window.__IV.sides()[0]; s.age=1; s.f=900; s.w=900; s.g=900; });
await page.waitForTimeout(400);
await page.mouse.move(150,110); await page.mouse.down(); await page.mouse.move(1150,690,{steps:6}); await page.mouse.up();
await page.waitForTimeout(300);
const mkt=await place(page,'Market');
ok('market sited', mkt);
await page.waitForTimeout(30000);
const mb=await page.evaluate(()=>{
  const m=window.__IV.ents().find(e=>e.type==='market'&&e.owner===0&&!e.building);
  return m?{x:m.x,y:m.y}:null;});
ok('market finished', !!mb);
if(mb){
  await page.evaluate(([x,y])=>window.__IV.go(x,y),[mb.x,mb.y]);
  await page.waitForTimeout(250);
  const cam=await page.evaluate(()=>window.__IV.cam());   // centreOn clamps at map edges
  await page.mouse.click(Math.round(mb.x-cam.x), Math.round(mb.y-cam.y));
  await page.waitForTimeout(300);
  const mh=await hud(page);
  ok('market shows trade cards', mh.cards.some(c=>/Sell Food/.test(c)) && mh.cards.some(c=>/Buy Wood/.test(c)));
  const g0=await page.evaluate(()=>Math.round(window.__IV.sides()[0].g));
  const mc=await page.evaluate(()=>[...document.querySelectorAll('.card .nm')].map(e=>e.textContent));
  await page.keyboard.press(HK[mc.findIndex(c=>/Sell Food/.test(c))].toLowerCase());
  await page.waitForTimeout(300);
  const g1=await page.evaluate(()=>Math.round(window.__IV.sides()[0].g));
  ok('selling food yields gold', g1>g0);
}

// --- toggles
await page.keyboard.press(' '); await page.waitForTimeout(200);
ok('pause works', await page.evaluate(()=>{const a=window.__IV.t(); return new Promise(r=>setTimeout(()=>r(Math.abs(window.__IV.t()-a)<0.05),500));}));
await page.keyboard.press(' '); await page.waitForTimeout(200);
await page.keyboard.press('c'); await page.waitForTimeout(150);
ok('chronicle toggles', await page.evaluate(()=>document.getElementById('chronList').classList.contains('hidden')));
await page.keyboard.press('c');
await page.keyboard.press('m'); await page.waitForTimeout(100);
ok('sound toggles', /Off/.test(await page.textContent('#soundBtn')));
await page.keyboard.press('m');

// --- export / import
const snap=await page.evaluate(()=>JSON.stringify(window.__IV.snap()));
fs.writeFileSync(TMPSAVE, snap);
await page.click('#menuBtn'); await page.waitForTimeout(300);
await page.setInputFiles('#fileIn',TMPSAVE);
await page.waitForTimeout(900);
ok('import restores a save file', (await hud(page)).menu==='none' &&
   await page.evaluate(()=>window.__IV.ents().length>0));
console.log('ERRORS:', errs.length?errs.join('\n'):'none');
await b.close(); })();
