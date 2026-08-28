# Ironvale

A real-time strategy game in one HTML file. No build step, no bundler, no runtime
dependencies — open it in a browser and it runs.

Gather food, wood and gold; raise a town; climb four ages; build an army and take
the valley. Each side has exactly one king: he is the best unit on the field and
the game ends the moment he falls. Or skip the siege entirely — plant your colony
standard in their kingdom and hold it for a minute.

```
git clone <this repo>
cd ironvale
npm run play          # http://localhost:8080
```

Or just open `ironvale.html` in a browser — it is a fragment rather than a full
document (see [Why the file has no `<html>` tag](#why-the-file-has-no-html-tag)),
so `npm run play` is the reliable way in.

## What's in it

**Economy.** Villagers gather from trees, berries, gold seams and farms, and walk
their load back to the nearest drop-off. Placing a lumber camp at the treeline
roughly doubles the timber rate — the walk is the cost.

**Four ages.** Dark, Feudal, Castle, Imperial. Each unlocks buildings, units and
upgrade lines, and each carries its own set of chronicle objectives.

**Military.** Militia, spearmen, archers, skirmishers, scouts, knights, rams and
mangonels, with upgrade lines that retroactively buff units already on the field.
Select, attack-move, patrol, hold ground, garrison, and control groups.

**The king.** One per side, with an aura that strengthens nearby troops. Ctrl+A
deliberately leaves him out of a mass selection so he is never swept into a
charge by accident.

**Two ways to win.** Break their king or their town center — or take the other
road: train a standard bearer, walk him into their kingdom, plant the colony
standard and hold it for sixty seconds. Planting it is not a quiet act. They see
it, they come off their raid clock, and everything they have turns toward the
flag.

**Villager trades.** Beyond the common villager, a mill raises farmhands, a
lumber camp raises woodcutters and a mining camp raises prospectors. Each works
its own resource half again as fast and everything else slower, so the shape of
your population becomes a decision.

**A third faction.** Marauder stockades sit in the middle ground between the two
bases. They owe nothing to either banner and raid both. Burning one stops the
raids from it and pays out what they had taken — and the gold worth expanding
for tends to sit near them.

**Water.** Lakes, shorelines, docks, fishing boats and war galleys. Lakes are
sited off the line between the two bases, so there is always a land road between
them and the water can never cut the map in half.

**University.** Medicine, scholarship and related research that compounds across
the empire.

**Persistence.** Three named save slots plus an autosave, all in `localStorage`,
with export and import to a JSON file.

**Sound, all of it synthesised.** No audio files: a wind bed that gusts on a
slow wander, water that rises and falls with how much of it is on screen, bells
that ring only in quiet, and blades that cut the air. The bed steps back when a
melee starts and returns when it ends.

**Fog of war**, a live minimap, a chronicle of objectives, and a statistics
ledger with charts.

## Running the tests

The suites are Playwright scripts that drive the real game in headless Chromium
and assert on real state. They are not unit tests — they play the game.

```
npm install
npx playwright install chromium
npm test
```

| Suite | What it holds down |
|---|---|
| `click.test.js` | Input reliability: one click selects, a green ghost always places, log toasts never eat a click, cards survive being rebuilt mid-press |
| `economy.test.js` | Selection, placement, the save/load round trip, market trade, menus and toggles |
| `combat.test.js` | Orders: attack, attack-move, hold, stop, minimap orders, double-click type-select |
| `features.test.js` | Patrol, garrison, repair, upgrade lines, the statistics ledger |
| `water.test.js` | Shorelines exist, docks are refused inland and accepted on shore, boats fish, land units stay dry and boats stay wet |
| `factions.test.js` | Marauder camps and raiders, the three villager trades, and the standard: where it can be planted, that it counts, and that holding it wins |
| `audio.test.js` | The ambience: that the beds exist and are audible, that water follows what is on screen, that a blade cuts through the bed in the right frequency band, and that mute means mute |

Individual suites: `npm run test:water`, and so on.

```
npm run check         # parse the script block without running it
npm run perf          # render cost per draw() call
```

`npm run perf` reveals the whole map so nothing is culled, then reports the
median wall time of a `draw()` call at three camera positions. Frame-rate
sampling through `requestAnimationFrame` is dominated by whatever else the
machine is doing and cannot distinguish a 10% rendering change from noise —
this can. Pass a second file to compare against a previous build:

```
node test/perf.js path/to/old.html BEFORE
node test/perf.js                  AFTER
```

## Layout

```
ironvale.html          the entire game — markup, styles, script
test/harness.js        shared Playwright setup, and the debug hook
test/*.test.js         the seven suites
test/perf.js           render-cost benchmark
scripts/serve.js       local server for playing
scripts/check-syntax.js  parses the script block
```

## How it is built

**Everything is baked.** Trees, berries, gold, buildings, ramparts and unit
bodies are drawn once into offscreen canvases keyed by type, owner and damage
state, then blitted. Ground is baked in 8×8-tile chunks behind an LRU cache.
Only what actually moves is drawn live: water, banners, weapon arms, windows,
health.

**Terrain is blended, not tiled.** Tile colours are written one pixel per tile
into a small bitmap and scaled up with smoothing, so grass, dirt and sand melt
into each other instead of meeting at a grid line. Detail and shoreline sand are
stamped on crisply afterwards.

**Surfaces are generated, not shipped.** Tileable value noise is synthesised at
load and used as a fill pattern for turf, plaster, thatch, ashlar and timber. It
costs nothing in page weight.

**Water has depth.** A breadth-first sweep out from every shoreline gives each
water tile its distance from land, and the ramp from shallow to deep is baked
into the ground chunks. The swell and the foam are written one pixel per tile
into a small buffer and scaled up with smoothing — drawn as tile rectangles they
read as stripes, which is the exact grid the depth ramp exists to remove. The
beach is drawn the same way, so a diagonal coast stops staircasing.

**Units walk.** Bodies are baked per type, side and pose: a standing pose, four
walk frames and an attack lunge, with the stride driven off the same phase as
the body's bob so feet and torso agree.

**Sound is synthesised, not sampled.** One looping pink-noise buffer feeds both
the wind and the water through different filters — real wind and real water
share a spectrum and differ mostly in where the energy sits, so this is both
cheaper and more convincing than two generators. Transients get their own white
source: pink noise has almost nothing left up where a blade cutting air lives.
Every parameter moves by ramp, never by assignment, because a step change in a
gain or a filter is audible as a click.

**Entity lists are cached.** `bldCache` / `unitCache` / `liveCache` are
invalidated by `touchLists()` rather than rebuilt per frame, which is what makes
a 148×148 map viable.

### Why the file has no `<html>` tag

The game ships as a fragment because the host that publishes it supplies the
document skeleton. `scripts/serve.js` and the test harness both wrap it before
serving. If you want a standalone file, wrap it yourself:

```html
<!doctype html><html><head><meta charset="utf-8"></head><body>
  <!-- ironvale.html here -->
</body></html>
```

### The debug hook

The shipped file exposes nothing. The test harness splices a `window.__IV`
object into the script at wrap time (`test/harness.js`), giving the suites reach
into module-scope state. Keep it in sync with the game — renaming an internal
without updating the hook produces a failing suite, which is the point.

## Known trade-offs

- **`localStorage` only.** Saves are per-browser and per-origin. Export to a file
  to move them.
- **Not mobile.** The input model assumes a mouse: right-click to order,
  drag to box-select, hover for the placement ghost. Touch would need a real
  redesign, not a media query.
- **One map generator.** Terrain, lakes and resource placement come from a single
  value-noise generator with a difficulty setting; there is no map editor.
