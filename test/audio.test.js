// Ambience and combat audio. Nothing here can be listened to from a test, so
// everything is asserted against the signal itself: the analyser taps the
// master bus and we measure level and spectrum.
const { chromium, wrap, boot } = require('./harness');

(async () => {
  wrap();
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const { page, errs } = await boot(b, { diff: 'easy' });
  const ok = (n, c) => console.log((c ? 'PASS' : 'FAIL') + '  ' + n);

  await page.evaluate(() => {
    const S = window.__IV.sfxObj();
    const an = S.ctx.createAnalyser();
    an.fftSize = 2048; an.smoothingTimeConstant = 0;
    S.master.connect(an);
    const bins = new Uint8Array(an.frequencyBinCount);
    const hz = i => i * S.ctx.sampleRate / 2 / an.frequencyBinCount;
    window.__band = (lo, hi) => {
      an.getByteFrequencyData(bins);
      let s = 0, n = 0;
      for (let i = 0; i < bins.length; i++) { const f = hz(i); if (f >= lo && f < hi) { s += bins[i]; n++; } }
      return n ? Math.round(s / n) : 0;
    };
    window.__rms = () => {
      const d = new Float32Array(an.fftSize);
      an.getFloatTimeDomainData(d);
      let s = 0; for (let i = 0; i < d.length; i++) s += d[i] * d[i];
      return Math.sqrt(s / d.length);
    };
    window.__peakBand = async (lo, hi, ms) => {
      let p = 0; const t0 = performance.now();
      while (performance.now() - t0 < ms) { p = Math.max(p, window.__band(lo, hi)); await new Promise(r => setTimeout(r, 12)); }
      return p;
    };
  });

  const st = await page.evaluate(() => {
    const S = window.__IV.sfxObj();
    return { ctx: !!S.ctx, state: S.ctx && S.ctx.state, amb: !!S.amb, wind: !!S.wind, water: !!S.water };
  });
  ok('the audio context is running', st.ctx && st.state === 'running');
  ok('wind and water beds exist', st.amb && st.wind && st.water);

  await page.waitForTimeout(2500);
  const bedRms = await page.evaluate(() => window.__rms());
  const bedHigh = await page.evaluate(() => window.__band(1800, 4000));
  const bedLow = await page.evaluate(() => window.__band(150, 600));
  console.log('   bed: rms ' + bedRms.toFixed(5) + ', low ' + bedLow + ', high ' + bedHigh);
  ok('the wind bed is audible', bedRms > 0.001);
  ok('and it is a wind, not a hiss (low band over high)', bedLow > bedHigh);

  // water follows what is on screen
  await page.evaluate(() => {
    const g = window.__IV, d = g.dims();
    for (let y = 4; y < d[1] - 4; y++) for (let x = 4; x < d[0] - 4; x++)
      if (g.wet(x, y) && g.wet(x + 3, y) && g.wet(x, y + 3)) { g.go(x * 28, y * 28); return; }
  });
  await page.waitForTimeout(3000);
  const wetFrac = await page.evaluate(() => window.__IV.wet2());
  const wetGain = await page.evaluate(() => window.__IV.sfxObj().water.g.gain.value);
  console.log('   water fills ' + (wetFrac * 100).toFixed(0) + '% of view, bed gain ' + wetGain.toFixed(3));
  ok('water rises over water', wetFrac > 0.2 && wetGain > 0.05);

  await page.evaluate(() => { const g = window.__IV, t = g.ents().find(e => e.type === 'tc' && e.owner === 0); g.go(t.x, t.y); });
  await page.waitForTimeout(3500);
  const dryGain = await page.evaluate(() => window.__IV.sfxObj().water.g.gain.value);
  ok('and falls away inland (' + dryGain.toFixed(3) + ')', dryGain < wetGain * 0.5);

  // A blade is broadband and bright: it must show up where the bed is not.
  // sfx() throttles a named sound to one every 90ms, so a single call made while
  // somebody is actually fighting can be swallowed and the test then measures
  // the bed on its own. Strike a few times, spaced past the throttle.
  const slashHigh = await page.evaluate(async () => {
    let p = 0;
    for (let i = 0; i < 4; i++) {
      window.__IV.play('slash');
      p = Math.max(p, await window.__peakBand(1800, 4000, 200));
    }
    return p;
  });
  console.log('   high band: bed ' + bedHigh + ' -> slash ' + slashHigh);
  ok('a sword stroke cuts through the bed', slashHigh > bedHigh + 25);

  const bowHigh = await page.evaluate(async () => {
    window.__IV.play('bow');
    return window.__peakBand(1000, 2600, 260);
  });
  ok('a bow release is audible (' + bowHigh + ')', bowHigh > 60);

  // a chime is a tone, so it should be narrow and bright, not broadband
  const chimeHigh = await page.evaluate(async () => {
    window.__IV.sfxObj().chime();
    return window.__peakBand(500, 1200, 500);
  });
  ok('a chime rings (' + chimeHigh + ')', chimeHigh > 70);

  // combat drives the heat, which ducks the bed
  // A duel is not a battle - two men trading blows at one swing a second sit
  // below the decay rate on purpose. Stage a real melee.
  await page.evaluate(() => {
    const g = window.__IV, tc = g.ents().find(e => e.type === 'tc' && e.owner === 0);
    g.go(tc.x, tc.y + 90);
    const mine = [], theirs = [];
    for (let i = 0; i < 7; i++) {
      mine.push(g.spawn(0, 'militia', tc.x - 60 + i * 20, tc.y + 84));
      theirs.push(g.spawn(1, 'militia', tc.x - 60 + i * 20, tc.y + 104));
    }
    for (let i = 0; i < mine.length; i++) {
      mine[i].task = 'attack'; mine[i].target = theirs[i]; mine[i].hp = mine[i].maxHp * 40;
      theirs[i].task = 'attack'; theirs[i].target = mine[i]; theirs[i].hp = theirs[i].maxHp * 40;
    }
  });
  await page.waitForTimeout(2500);
  const heat = await page.evaluate(() => window.__IV.heat());
  const ambGain = await page.evaluate(() => window.__IV.sfxObj().amb.gain.value);
  console.log('   battle heat ' + heat.toFixed(2) + ', ambience ducked to ' + ambGain.toFixed(2));
  ok('a melee raises the battle heat', heat > 0.25);
  ok('and the bed steps back for it', ambGain < 0.78);

  // mute means mute
  await page.keyboard.press('m');
  await page.waitForTimeout(1600);
  const muted = await page.evaluate(() => window.__rms());
  ok('mute silences the bed as well as the effects (' + muted.toFixed(5) + ')', muted < bedRms * 0.3);
  await page.keyboard.press('m');

  console.log('ERRORS:', errs.length ? errs.slice(0, 3).join('\n') : 'none');
  await b.close();
})();
