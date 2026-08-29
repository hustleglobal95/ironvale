const {chromium, wrap, boot, hud} = require('./harness');
(async()=>{ wrap(); const b=await chromium.launch();
const {page,errs}=await boot(b,{diff:'easy'});
const ok=(n,c)=>console.log((c?'PASS':'FAIL')+'  '+n);
// hand the player an army to command
await page.evaluate(()=>{
  const g=window.__IV; const s=g.sides()[0]; s.age=3; s.f=9000; s.w=9000; s.g=9000;
  const tc=g.ents().find(e=>e.kind==='bld'&&e.owner===0&&e.type==='tc');
  for(let i=0;i<8;i++) g.spawn(0, i<5?'militia':'archer', tc.x+(i%4)*30-45, tc.y+90+((i/4)|0)*30);
});
await page.waitForTimeout(500);

// --- select every soldier
await page.keyboard.down('Control'); await page.keyboard.press('a'); await page.keyboard.up('Control');
await page.waitForTimeout(300);
let h=await hud(page);
ok('Ctrl+A selects the army without the king', /8 selected/.test(h.sel));
ok('soldier order cards appear', h.cards.slice(0,4).join('|')==='+Attack-move|+Patrol|+Stop|+Hold Ground');

// --- attack-move via the card
await page.keyboard.press('q'); await page.waitForTimeout(200);
ok('attack-move arms', /Attack-move/.test((await hud(page)).sel));
await page.mouse.click(900,300); await page.waitForTimeout(400);
let st=await page.evaluate(()=>window.__IV.ents().filter(e=>e.kind==='unit'&&e.owner===0&&e.type!=='vil')
  .reduce((m,u)=>(m[u.task]=(m[u.task]||0)+1,m),{}));
ok('soldiers are advancing', (st.amove||0)>=6);
ok('destination remembered', await page.evaluate(()=>window.__IV.ents().filter(e=>e.am).length>=6));

// --- Ctrl + right-click does it without the card
await page.keyboard.down('Control'); await page.keyboard.press('a'); await page.keyboard.up('Control');
await page.waitForTimeout(200);
await page.keyboard.down('Control');
await page.mouse.click(400,600,{button:'right'});
await page.keyboard.up('Control');
await page.waitForTimeout(300);
st=await page.evaluate(()=>window.__IV.ents().filter(e=>e.kind==='unit'&&e.owner===0&&e.type!=='vil')
  .reduce((m,u)=>(m[u.task]=(m[u.task]||0)+1,m),{}));
ok('ctrl right-click attack-moves', (st.amove||0)>=6);

// --- they actually engage something placed in their path
const killed=await page.evaluate(async()=>{
  const g=window.__IV;
  const sold=g.ents().filter(e=>e.kind==='unit'&&e.owner===0&&e.type!=='vil');
  const cx=sold[0].x, cy=sold[0].y;
  const foe=g.spawn(1,'spear',cx+120,cy);
  sold.forEach(u=>g.amove(u,cx+400,cy));
  return new Promise(r=>setTimeout(()=>r(foe.dead||foe.hp<foe.maxHp),4000));
});
ok('advance engages an enemy on the way', killed);

// --- hold ground and stop
await page.keyboard.down('Control'); await page.keyboard.press('a'); await page.keyboard.up('Control');
await page.waitForTimeout(200);
await page.keyboard.press('r'); await page.waitForTimeout(300);   // Hold Ground
ok('hold ground order lands', await page.evaluate(()=>
  window.__IV.ents().filter(e=>e.task==='hold'&&e.owner===0).length>=6));
await page.waitForTimeout(1500);
const posA=await page.evaluate(()=>{const u=window.__IV.ents().find(e=>e.task==='hold');return [u.x,u.y];});
await page.waitForTimeout(2500);
const posB=await page.evaluate(()=>{const u=window.__IV.ents().find(e=>e.task==='hold');return [u.x,u.y];});
ok('holding units stay put', Math.hypot(posA[0]-posB[0],posA[1]-posB[1])<25);
await page.keyboard.press('e'); await page.waitForTimeout(250);   // Stop
ok('stop clears the order', await page.evaluate(()=>
  window.__IV.ents().filter(e=>e.owner===0&&e.type!=='vil'&&e.task==='idle').length>=6));

// --- minimap right-click sends them across the map
await page.keyboard.down('Control'); await page.keyboard.press('a'); await page.keyboard.up('Control');
await page.waitForTimeout(200);
const mmBox=await page.evaluate(()=>{const r=document.getElementById('minimap').getBoundingClientRect();
  return [r.left+r.width*0.72, r.top+r.height*0.3];});
await page.keyboard.down('Control');
await page.mouse.click(mmBox[0],mmBox[1],{button:'right'});
await page.keyboard.up('Control');
await page.waitForTimeout(300);
const far=await page.evaluate(()=>{
  const us=window.__IV.ents().filter(e=>e.kind==='unit'&&e.owner===0&&e.type!=='vil'&&e.type!=='king');
  return us.length>0 && us.filter(u=>u.task==='amove'&&u.tx>900).length>=us.length-1;});
ok('minimap right-click orders an advance', far);

// --- double click selects the type on screen
await page.evaluate(()=>{ const g=window.__IV;
  // The step above marched these archers clear across the valley on an
  // attack-move, and the valley now holds four crowns and a marauder camp, so
  // a good few of them do not come back. Whether they survive that trip is a
  // question about the map, not about whether a double click selects a type,
  // so make the group up to strength and clear what is standing over them
  // before measuring the click.
  const k=g.ents().find(e=>e.owner===0&&e.type==='king');
  let have=g.ents().filter(e=>e.type==='archer'&&e.owner===0&&!e.dead).length;
  while(have<6){ g.spawn(0,'archer',k.x+40,k.y+40); have++; }
  const alive=g.ents().filter(e=>e.type==='archer'&&e.owner===0&&!e.dead);
  const c0=alive[0];
  g.ents().forEach(e=>{ if(e.kind==='unit'&&e.owner!==0&&Math.hypot(e.x-c0.x,e.y-c0.y)<260) e.dead=true; });
  alive.forEach(u=>{ u.hp=u.maxHp; });
  g.touch();
  // hold the archers still and put them together, then double-click one
  const a=g.ents().filter(e=>e.type==='archer'&&e.owner===0&&!e.dead);
  const c=a[0];
  a.forEach((u,i)=>{ u.x=c.x+(i%3)*26; u.y=c.y+Math.floor(i/3)*26; u.task='idle'; u.target=null; u.am=null; });
  g.go(c.x,c.y); g.sel().length=0; });
await page.waitForTimeout(500);
const sp=await page.evaluate(()=>{
  const g=window.__IV, c=g.cam(), u=g.ents().find(e=>e.type==='archer'&&e.owner===0);
  return [Math.round(u.x-c.x), Math.round(u.y-c.y)];});
await page.mouse.click(sp[0],sp[1]); await page.waitForTimeout(120);
await page.mouse.click(sp[0],sp[1]); await page.waitForTimeout(300);
const dbl=await page.evaluate(()=>window.__IV.sel().length);
ok('double click grabs all of that type ('+dbl+')', dbl>=3);

// --- save round trip keeps the advance
await page.evaluate(()=>{ const g=window.__IV;
  g.ents().filter(e=>e.kind==='unit'&&e.owner===0&&e.type!=='vil').forEach(u=>g.amove(u,1200,1200)); });
await page.waitForTimeout(300);
const snap=await page.evaluate(()=>JSON.stringify(window.__IV.snap()));
await page.evaluate(j=>window.__IV.restore(JSON.parse(j)), snap);
await page.waitForTimeout(300);
ok('attack-move survives save and load', await page.evaluate(()=>
  window.__IV.ents().filter(e=>e.task==='amove'&&e.am).length>=6));

console.log('ERRORS:', errs.length?errs.join('\n'):'none');
await b.close(); })();
