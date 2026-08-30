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
Select, attack-move, patrol, hold ground, garrison, and control groups. A
spearman is the quickest thing in the game to raise and a mangonel the slowest,
so the roster is a ladder rather than a menu. Every hall that raises soldiers
musters them in front of its own door the moment it is built, and can be left a
standing order to keep raising whatever it last finished — it stops by itself
the moment the stores or the population run out. A ring over each hall says what
is being made and how much is queued; a hall with nothing to do says so.

**The clock.** Nothing marches for the first five minutes and no stockade lets a
raider out for the first three, because a settlement that has not been raised
cannot be defended. After that the war bands start ninety-six seconds apart and
close to thirty as the war goes on, and a crown sends a band rather than
everything it owns — the rest stay home as a guard. The watch on the top bar
counts the quiet down, then reads your soldiers against the largest band anyone
at war with you has ready to send.

**The king.** One per side, with an aura that strengthens nearby troops. Ctrl+A
deliberately leaves him out of a mass selection so he is never swept into a
charge by accident.

**Two ways to win.** Put down every other crown in the valley — each falls when
its king and its last town center are gone — or take the other road: train a standard bearer, walk him into their kingdom, plant the colony
standard and hold it for sixty seconds. Planting it is not a quiet act. They see
it, they come off their raid clock, and everything they have turns toward the
flag.

**A wood, rather than a pattern of trees.** Foliage is most of what is on
screen and it was the least developed thing in the picture. Three problems, all
of them structural rather than detail. A canopy filled every lobe dark and then
laid a lit cap over two-thirds of it, which left the dark as a thin rim and made
a crown read as one flat bright green — the body is dark now, the sun catches
only the outer upper-left edge, and the deepest tone sits where the lobes pile
up away from the light. Conifers got the same three values. Scale varied by only
half, so a wood tiled; the same eight variants now spread over two and a half
times the range, and there are more lobes, thrown wider, so no two crowns share
a silhouette. And the four tints in each season used to sit within about fifteen
per cent of each other at one hue — they are four kinds of tree now, a deep cool
one, an olive, a yellow-green and a blue-green, which is what gives autumn its
range as much as summer.

**Trees throw shadows, and a wood throws one shadow.** The canopy field that
darkens a forest floor now makes two deposits per tree: the dim under the tree
itself, and the shadow it actually casts, offset along the light. Overlapping
trees merge into one mass rather than a field of separate blots, and because it
all goes into the ground bake it costs nothing per frame — 320 trees on screen
hold the same frame rate they did before any of it, the tree cache is unchanged
at 128 sprites, and a chunk of shaded, decorated ground still bakes in 0.6ms.

**The year turns.** Eight minutes to the year, two to the season. Spring is
pale and full of blossom, summer is the valley at its best, autumn turns the
broadleaves gold and drops leaves across the field, winter greys the grass,
strips the trees, snows, and lies along every ridge in the settlement. It is not
a filter over the top: the ground palette, every tree and — at the two winter
boundaries and no others — every building are rebaked, and the conifers stay
green while everything around them turns, because they would.

**Four ages on the walls.** The last item of the original visual brief and the
one thing the town never showed: you could reach the Imperial Age standing in a
settlement identical to the one you started in. A Dark Age building is making
do — patched plaster that never matched, rain-streaks off the eaves, a panel
where the plaster has gone and the wattle shows. Feudal is the clean baseline
the buildings were drawn at. The Castle Age brings the masons: a dressed stone
footing up the lower wall with a proud string course along the top of it, and
quoins at the corners. Imperial finishes what they started — the quoins run the
full height, the windows take glass (one pale diagonal in each opening, which at
this size is the whole difference between a hole and a pane), and a carved line
runs under the eaves. The age is in the sprite key, so the whole settlement
re-dresses itself the moment the crown advances, and old-age sprites linger in
the cache until the winter purge collects them rather than costing a purge of
their own.

**Buildings can face the other way, and come down on purpose.** Every building
is painted from one side, so "turned round" is a mirror about its own centre —
door, porch, chimney, awning and yard swap sides together, the baked sprite and
the live overlays alike, and the hearth smoke follows the chimney round. Health
bars and lettering draw outside the mirror, so nothing that has to be read is
ever reversed. It is on the card row of any selected building, it is cosmetic,
and it survives a save. Beside it: Tear It Down, also on the Delete key.
Whoever is sheltering inside steps out unhurt first; a building still under
construction refunds 70% of its cost, because the materials are still stacked
on site; a finished one refunds nothing, because the work is the cost. It comes
down with the same collapse a razing gets.

**A settlement keeps dogs.** Three of them, from four breeds told apart the way
the berries are — by silhouette at a glance. A mastiff is a heavy block with a
deep chest, a collie carries pricked ears, a white bib and a plume tail, a
lurcher is all leg and tucked waist, a terrier is a scrap with its stub tail
up. They are decoration with the birds' discipline: not entities, so nothing
can select, order, hurt or path around one; not in the save — a town simply has
its dogs again when it loads; and they stay off the water. Now and then one
barks. It is synthesised like every other sound in the game — two voices and a
noise consonant per syllable, pitched to the breed, a mastiff at 170Hz and a
terrier at 600 — on the birds' own rules: a long uneven interval, only when
there is a dog on screen to have made the sound, and never over a fight.

**An isometric port is underway, behind a flag.** The menu's Renderer row (and
nothing else — the classic view stays the default and untouched) switches the
same running game onto the classic 2:1 diamond: `x' = x−y, y' = (x+y)/2`, exact
both ways, no trigonometry. The port's load-bearing observation is that this
projection is an affine map of the ground plane, which canvas applies natively —
so the terrain chunks, worn sites, farm aprons, paths, canopy shade, fog runs
and placement footprints all land as pixel-correct diamonds through one
`setTransform`, with no re-authoring. Only things with height need new art, and
they convert one type at a time: the house is native — two visible faces, the
south-west lit and the south-east in sky-shade under the same sun as everything
else, a hip roof with two-tone slopes, a foundation course, its cast shadow on
the ground — and units of every human class face where they are going,
continuously: the stride axis, weapon, bow, lance, shield and head are all built
along the projected heading, so a direction change is visible in the figure
rather than picked from eight canned frames. Everything not yet converted stands
as its classic sprite grounded on the projected footprint, the clearly-marked
temporary fallback a port needs. Selection, orders, placement, collision and
picking are exact under the projection — figures are picked in screen space
where they are drawn, the way the 3D view earned first, because a click on a
body maps to ground behind the feet and whatever stands there would steal the
pick. F3 shows the debug overlay: renderer, fps, drawn and culled counts, cache
sizes — in either view.

**The house is the building asset contract.** The port's first native building
was a projection prototype - geometry drawn straight into one bake, owner and
all. It has been rebuilt the way the classic sprite-based engines built theirs:
an invisible gameplay footprint on the tile grid, and above it a stack of
layers that are authored once and only ever blitted - shadow on the ground,
then a construction stage or the main sprite, then the crown as a tint layer,
then damage overlays, then selection. The main sprite is resolved by
architecture set and age, never by owner: five bakes serve every house on the
map, and the crown arrives as cloth by the door and a pennant at the ridge.
Construction is five authored stages driven by real progress - cleared footing,
timber frame, part-raised walls with scaffold, the roof going on, and a
nearly-done house with the ladder still against the wall - and damage is three
overlays driven by health, with smoke and a restrained fire at the worst of it.
Every layer of every state shares exactly the same canvas and the same anchor,
so a state change cannot move, resize or drift the building - an assertion
holds that for all fifty-five sprites there are. The footprint is the
simulation's whole knowledge of the house: the roof overhangs it freely,
blocks nothing, and selection follows the footprint, never the picture. F3
draws the footprints and anchors over the running game. Chasing why it once
drew nothing turned up a real bug: a second `onScreen` declaration, added for
the 3D view, had been shadowing the isometric one and silently mis-culling
the ground pass.

**Four ages, four houses.** Not one house re-dressed: the Dark Age raises a
round wattle-and-daub hovel under a ragged cone of thatch, with a smoke hole,
a woodpile and nothing anyone would call a window. The Feudal Age builds the
timber-framed cottage - limewashed wattle between oak posts, deep thatch that
hangs past the walls, one shuttered window, and a louvre at the ridge because
a chimney is still an age away. The Castle Age raises the two-storey burgher
house: coursed stone below, a jettied floor of close-studded timber standing
proud of it with its soffit in shadow, mullioned windows, and the family's
first chimney. The Imperial Age builds in dressed ashlar - a string course
between the floors, quoins on the near corner, an arched door with voussoirs,
glazed windows, a dormer in the roof, a gilt finial and a brick chimney tall
enough to draw. The crown's roofing material - slate, clay tile and the rest -
takes over from the Castle Age on; before that thatch is thatch whoever grows
old under it, so the early ages fold to a single bake each. Construction
follows the age too: a hovel is not framed square, so it goes up as a stake
ring, bent poles reaching for the apex, the wattle ring rising, and thatch
climbing the poles from the west, while the framed ages raise the materials of
the house that will actually stand there. The pennant is keyed by age as well
as owner, because each roof puts its high point somewhere different and a
pennant has to fly from something.

**The Dark Age house is drawn by a hand.** The first authored artwork in the
game: a pre-rendered thatched cottage in four true facings, imported as the
main-sprite layer of the building asset contract. The images travel inside the
file as compressed WebP data URIs, so the game still runs from a bare `file://`
with nothing next to it. Only the picture is the art: the ground shadow, the
construction stages, the damage overlays and the crown's pennant stay
procedural, layered under and over it by the same contract every drawn
building follows — baked shadows were stripped at import so every state keeps
the same sky. About Face now turns a building through all four facings in the
isometric view (the classic renderer keeps its mirror), the facing rides in
the save, and a village gets a mix of facings by default. Until the image
decodes — a matter of milliseconds — the procedural hovel stands in, and the
swap is a cache key, not a redraw.

The gold seam followed, and its four slots are not facings but the seam's
life: rich, worked, low, and the dug-out pit its final tenth leaves before
the last of it is carried away and the seam goes with it. The picture is
driven by the same number the resource bar reads, so a mine visibly gives
out as it is worked, which no procedural rock in the game ever did.

**The frame is graded.** Split-toned, not tinted: a soft-light gradient warms
what is already bright toward the sun corner and deepens what is already dark
toward the cool one, which adds shape where a flat wash adds milk. The grade
follows the year — spring soft, summer rich, autumn glowing amber, winter a sun
with almost no warmth left in it — and crossfades over the last stretch of each
season, which softens the palette snap at the boundary. And it follows the war:
the vignette pulls in and goes cold with the fighting, so the same valley reads
as a settlement in peace and a battlefield in the middle of one. Two full-screen
fills a frame, exactly what the old static wash paid; gradients are cached and
rebuilt only when the season blend or the battle heat crosses a step. It can be
turned off in the menu, because a grade is an opinion.

**Four crowns that look like four crowns.** Colour alone does not do it: at the
distance this is played from, a blue roof and a purple roof are the same roof.
Ironvale roofs in slate and frames in oak; the Crimson Host roofs in clay tile
over warm sanded plaster and frames sparely; Thornhollow roofs in split shingle
under a heavy near-black frame; Saltmere roofs in reed over limewash and frames
in silvered timber. Each flies its own shape of cloth — a swallowtail, a long
pennon, a gonfalon with two tails, a square banner — and each carries its own
shape of shield: a heater, a planked round, a kite, a steel buckler. None of it
costs cache and none of it is in the save: buildings and figures were already
baked per owner, and a save written before any of this existed opens into a
valley that looks right.

**Farming.** A farm is a steading: it grows nothing itself, it raises the four
hands who do, and it takes in what they bring. A field is a separate thing — a
crop plot a farmer walks out to, breaks and sows. It comes up through sown and
growing to ripe, is harvested by villagers, then goes back to bare earth and
sows itself again out of the seed store.

**Four farmers, one crop each.** A ploughman knows wheat, a gardener
vegetables, a flaxdresser flax, a ryeman rye. A field broken by a hand who knows
its crop comes up sooner and gives half again as much; a field broken by one who
doesn't gives less than a field broken by nobody in particular. That choice is
made once, when the ground is broken, and the field carries it through every
harvest after — including if you change what it sows.

What a field gives you depends on four things: the crop, the soil, the hand that
broke it, and the season it ripens in.

- **A field being cut looks like it.** A ripe field is not a block that
  shrinks: the harvest works down it a row at a time, standing corn giving way
  to stubble, with sheaves stacked on the ground that has already been taken.
- **Wheat** is reliable and best in autumn; **vegetables** are quick, modest and
  kindest to the soil; **flax** is a cash crop that pays a purse of gold at
  harvest and takes the ground apart; **rye** gives less than wheat in a good
  year and is the only one of the four worth sowing before a winter.
- **The soil remembers.** Every harvest costs fertility, and following a crop
  with the same crop costs half again as much. Rotating pays it back a little,
  leaving a field fallow pays it back properly, and a field worked to death
  visibly yields less.
- **Seed.** Every harvest holds some back; every sowing spends it. Run out and
  nothing can be sown. In an emergency the granary will let you eat the seed
  store — it will feed you now and there will be no next harvest from the fields
  that were waiting on it.
- **Somewhere to put it.** Food has a ceiling, raised by granaries and the town
  center. Anything above the ceiling goes bad, slowly, which is a good harvest
  wasted for want of a shed.
- **Everyone eats.** A gentle upkeep per head, so stores can run down, a winter
  can bite, and an empty larder slows every villager until there is food again.
- **The forecast.** A field tells you what is in it, how far along, what the soil
  is like, and what it will be worth *in the season it will actually ripen in*.
  A granary or mill tells you the whole larder: stored against capacity, what is
  eaten per second and by how many, how long the stores last, what is standing
  in the fields and what is still growing.

**Four kinds of berry.** Bramble, bilberry, elderberry and gooseberry, each its
own colour, silhouette and worth: an elder holds 280 food and gives it up
slowly, a gooseberry holds 120 and gives it up fast. Bushes of a kind grow
together, so one stretch of the valley really is a better larder than another,
and it is worth walking a villager past the near patch to reach the right one.

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

**University.** Seven studies — medicine, scholarship, cartography, architecture,
husbandry, chemistry, and Natural Philosophy, which is the one that keeps
working after it is finished. It teaches the settlement to watch what passes
through its hands, and from then on the villagers work out for themselves which
elements combine into something worth having: tallow, pitch, salve, leaven,
alloy and aqua regia, each needing enough of two resources carried home *since
the study finished*. Nothing is clicked. The university keeps the ledger and you
watch it fill while you play.

**Birds.** Flocks cross the valley now and then, wingbeats and glides, shadows
drifting on the ground under them. They call sometimes — on a long uneven
interval, only when there are birds on screen to have made the sound, and never
over a fight.

**Tax and prosperity.** The King takes a share of everything carried home — you
set the rate, and nothing at all is the default answer if you want it. A third
of what he takes is reserved in the Royal Treasury; the rest is spent on the
settlement. What comes back is a kingdom that is cheaper and quicker to run:
five levels of prosperity, each one taking 4% off every building, adding 6% to
how fast things go up and 3% to how fast the work goes. The level is a record of
what has been reinvested and it never falls, even when the balance is spent.

Separately, what the kingdom is *holding right now* — food, timber and the worth
of the reserve — unlocks standing discounts that come and go with your wealth,
and they land hardest on farming: a field costs 15 timber in a poor country and
8 in a flourishing one.

The reinvested share buys four public works, permanently: shared tools, an
irrigation network, a seed bank and public granaries. None of them is paid for
out of the purse. And the reserve can be opened at any time, which is what a
reserve is for. The town center shows the whole account: the rate, what has been
collected, what is reserved, what has been reinvested and what of it is unspent,
and exactly what the next discount needs.

**The standing of the crowns.** Press J and the first thing the Courts show you
is where everybody stands. All four are ranked, always, with a bar for how far
apart they are — that much a rider can carry back from a market or a burnt
village. The figures themselves stay closed until you have actually found the
crown they belong to, which is what keeps a scout worth sending. A fallen crown
drops to the foot of the board rather than holding the place its last score
earned it.

Every crown now keeps its own books. It did not before: `scoreOf()` zeroed the
gathered, killed and razed terms for anyone but you — not by design, but
because nobody else had books to read — so an AI scored on units, buildings,
age and techs alone and came out artificially low. One rule now applies to
everybody, and the same work moves any crown's score by the same amount. Your
own number is unchanged, and a save written before any of this seeds your
tally back out of the stats it already carried, so loading an old game does
not drop your score.

**Four crowns, and a valley with its own politics.** Ironvale, the Crimson Host,
Thornhollow and Saltmere all hold towns and all run themselves. They keep books
on each other: what everyone has done to them, who is strong, who is close, and
who is already busy at somebody else's border. Out of that they pick a target,
declare, sue for terms, swear oaths and break them — and every letter that
passes between them lands in a dispatch feed you can read. Press **J** for the
Courts: your standing at each border, what every other pair has settled between
themselves, and the whole correspondence in order.

You are not a spectator at it. Sue for terms with a house at war with you, offer
an oath to one that isn't, or just send gold; they answer with the same
arithmetic they use on each other. Their envoys come the other way too — terms
when a war is going badly for them, an oath when you share an enemy, tribute
when they think they can ask. An unanswered rider goes home, and going home
counts as a refusal.

A few rules keep it a valley rather than a firing squad: a crown swears to one
other crown and no more, it will not put its name to a second war while one is
running, and nobody piles onto the throat two others are already at. Which means
Thornhollow and Saltmere can spend the whole game tearing at each other while
the Crimson Host works on you — and a standard planted in anyone's ground is a
declaration whether you meant it as one or not.

**They learn how you fight.** Every crown tallies what has been killing its
people — not what is on the map, only what has walked over its own dead. Kill
their spearmen with horse and they start raising spears and stop raising horse;
raze their buildings and they start putting up towers, sooner and more of them.
Pressure earns pressure: a house you have already bled comes off the raid clock
early and comes in bigger bands.

**Persistence.** Three named save slots plus an autosave, all in `localStorage`,
with export and import to a JSON file. Saves carry the oaths, the dispatches and
everything each crown has learned; a save from before the neighbours existed
still opens, and the new crowns get books of their own.

**Sound, all of it synthesised.** No audio files: a wind bed that gusts on a
slow wander, water that rises and falls with how much of it is on screen, bells
that ring only in quiet, blades that cut the air, an axe into a trunk, a pick
ringing off a seam. The bed steps back when a melee starts and returns when it
ends, and separate sliders in the menu set effects and ambience.

**Blows land somewhere.** A hit on a building throws chips of that building's
own colour back along the line of the strike, blooms dust, and leaves a scar
that fades. A ram or a mangonel throws twice as much and shakes the view.

**And what comes off a man tells you what he is wearing.** Mail throws sparks
and almost nothing else — a spark has no weight and no time to fall. A padded
jack throws its own cloth, slower and heavier. A horse kicks dust off the ground
it is standing on, a hull throws water and splinters, a ram throws timber. It is
the fastest way to tell an armoured man from an unarmoured one in a crowd, and it
costs one branch at the moment of the blow.

**Weapons leave the line they took.** A blade sweeps, so its streak is the arc
the point actually travelled about the hand; a spear and a lance do not sweep,
so theirs is the straight line from where the point was drawn back to where it
went in. Both come out of the same arithmetic the figure is drawn with, so the
trail sits on the blade rather than beside it. An arrow casts a shadow that
stays on the ground while the shaft climbs away from it, which is what makes the
arc read as height rather than as a line drawn slightly wrong.

**A razed building comes down.** It does not blink out. It drops through itself,
throws its own wall and roof outward, blooms dust from the footprint, and shakes
the ground in proportion to how big it was — a keep is felt, a hut is not. What
is left is a burnt plot with its stones lying in it, smoking for a few seconds
and then slowly taken back by the grass. The rubble is baked once per building
type, so a settlement burning down costs what one building costs.

**A three-dimensional view.** Press the backtick key, or the View button in the
top bar, and the valley stands up: a rolling height field, a low sun that models
the hills, water with its own surface, and haze that carries the far side of the
map up into the sky. It is a second renderer over the same game — the ground
rolls, the rules do not — so you can play in it, or switch back mid-battle
without losing your place. `[` and `]` swing the camera, PageUp and PageDown
raise and lower it, the wheel pulls in and out.

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
| `features.test.js` | Patrol, garrison, repair, upgrade lines, the statistics ledger, the builder's toolkit — that facing survives a save, that tearing down releases the garrison and refunds only unbuilt work — and that each age re-dresses a house more than the last |
| `water.test.js` | Shorelines exist, docks are refused inland and accepted on shore, boats fish, land units stay dry and boats stay wet |
| `factions.test.js` | Marauder camps and raiders, the three villager trades, and the standard: where it can be planted, that it counts, and that holding it wins |
| `effects.test.js` | The volume sliders, the gathering rhythm and its debris, and what a blow does to a wall — chips, dust, a fading scar, and a ram that shakes the view, and the grade: that the far corner of the frame is cooler and deeper with it than without it, that it follows the year and tightens with the fighting, and that the menu switch is remembered |
| `crown.test.js` | The tax: that the King's share is split the way it says, that a rate of nothing takes nothing, that prosperity climbs and never falls when the balance is spent, that discounts reach the till and not just the card, that public works come out of the reinvested share and not the purse, that the reserve can be opened, and that the whole account survives a save |
| `harvest.test.js` | The year and the fields: that the seasons turn and re-dress the world without leaking sprites, that a field goes from broken ground to a harvest, that tending speeds it, that winter and worn-out soil both take their share, that fallow ground recovers, that granaries cap and food above the cap spoils, that everyone eats, that seed runs out, and that all of it survives a save |
| `valley.test.js` | The four berries and that their yields really differ under a villager, that decorated ground still bakes fast, that birds fly and leave and are not entities, that a call carries over the bed, and that Natural Philosophy discovers its six compounds out of the work and remembers them through a save, and the dogs: that a settlement keeps them, that they wander and stay dry and cannot be selected, and that a bark is synthesised, routed to the ambience bus, and pitched to its breed |
| `paths.test.js` | Getting there: that a march arrives, that nobody stands still against a coastline, that a target in open water is refused rather than ground at, and that no unit ends with broken arithmetic |
| `view.test.js` | The 3D view: that it builds, that a click lands on the pixel it was aimed at, that selecting, ordering and building all work through the camera, and that elevation never reaches the simulation |
| `courts.test.js` | The four crowns: that three settlements really run themselves, that relations read the same from either side, that each one names a foe and they do not all name the same one, that an oath takes a crown off you, that losing spears to horse makes them raise spears and razing their buildings makes them want towers, that letters land in the feed, that envoys can be paid or refused, that you can write back, that a save carries every oath, every dispatch and everything each crown has learned — including one written before the neighbours existed — and, for the standing board: that the same work moves any crown's score by the same amount, that the running order is always shown while the figures stay closed until you have found the crown, that the marauders never count as a crown, and that an old save seeds your books back out of the stats it already carried |
| `audio.test.js` | The ambience: that the beds exist and are audible, that water follows what is on screen, that a blade cuts through the bed in the right frequency band, and that mute means mute |
| `houses.test.js` | The four crowns' faces: that each roofs its whole settlement in one material and no two share it, that the roof in the picture is the roof on the table, that a knight of another house is built differently rather than tinted differently, that a roof carries snow in winter and not in summer, that only the two winter boundaries rebake a settlement, and that none of it is in the save |
| `iso.test.js` | The isometric slice: the projection round-trips exactly, the toggle holds the view centre and is remembered, clicking a figure at its drawn position selects it, an order lands on the pointed ground and the unit arrives, the ghost matches the aimed tile, the drawn box selects what it covers, a figure south of a house draws in front of it, and off means off; and the house contract: twenty-eight state sprites on one canvas and one anchor, construction walking its five stages and holding through a pause, damage walking its thresholds and repair walking them back, one main sprite per architecture set with the crown as a tint layer, an age advance that re-dresses without touching the entity, footprint-true selection that ignores the roof, a villager walking under the roofline, and thirty houses standing together |
| `pace.test.js` | The clock: that a season is longer than a crop, that a soldier is quicker to raise than a villager and a knight slower than a spearman, that war bands start far apart and close up as the war goes on, that nothing walks out of a stockade before the settlement has had its head start, and that a standing order stops without jamming its queue |

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
test/*.test.js         the seventeen suites
test/perf.js           render-cost benchmark
scripts/serve.js       local server for playing
scripts/check-syntax.js  parses the script block
```

## How it is built

**The ground is not empty.** Stones, flowers, tufts, stumps, fallen branches and
reeds at the waterline are chosen from a hash of the tile and baked into the
ground chunk, so a chunk evicted from the cache comes back identical and none of
it costs a frame anything — it is already in the bitmap the ground is drawn
from. It adds about a tenth of a millisecond to baking a chunk and nothing at
all to drawing one.

**Buildings are built, not stamped.** Under the plaster: a rubble footing,
half-timbering with braces in the corners, courses of block, moss at the foot
and dirty water off the eaves. Windows are openings rather than lit rectangles —
a stone surround, a sill that stands proud, a mullion, shutters thrown open —
and only the light inside them is live, each on its own phase so a street does
not blink in unison. Roofs carry bargeboards down both rakes and a crossed pair
of timbers in the gable, which is the join that stops the triangle reading as a
sticker over the box. Towers and castles get battlements instead of a smaller
roof; the mill's sail turns; every door has a lantern beside it.

**Render scale.** One setting decides how many real pixels the game is drawn
into — Fast, Balanced or Sharp, in the menu, remembered between sessions. It
drives the canvas, the baked sprites, the minimap and the generated surface
grain together. Balanced is the default and matches what a Retina display asks
for; Sharp is three times the resolution, and it costs frame time and memory
in proportion.

The ground is the part that changed most. Chunks were baked at one bitmap pixel
per CSS pixel and then stretched by the device ratio, which is where most of the
softness in the picture came from — they are baked at the display's real
resolution now. The generated grain had the same problem and got the same fix,
by way of a pattern transform, so plaster, thatch, turf and timber are sharp
rather than smeared. The ground itself stops at two even in Sharp: it is a soft
organic texture where a third scale buys almost nothing, while the bitmaps it
has to blit every frame grow with the square of it. Hard edges — trees, walls,
figures, lettering — go all the way up, and that is where the difference shows.

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

**The 3D view is hand-written WebGL2.** No engine and no library: the file still
has to run from a `file://` URL with nothing else next to it. A height field is
generated from the map seed, so the same map always gets the same hills and no
save has to carry them. The ground is one mesh; the sky is one triangle with its
view rays worked out on the CPU; every tree, wall, building and figure is one of
six generated primitives drawn instanced, which keeps the whole scene to a
handful of draw calls. Water is a separate sheet with waves along five
directions that share no axis — axis-aligned sines interfere into a plaid, which
is the one pattern the eye will not accept as water.

**Elevation is cosmetic, and enforced as such.** Pathfinding, placement, ranges,
vision and combat all assume a flat tile grid, and the 3D view is not allowed to
change that. What that costs is a picking problem: the game's mouse handling
funnels through one function, `toWorld()`, which in 3D walks the click ray down
onto the height field, so orders land on the ground you are pointing at. Figures
are picked separately, in screen space, because a ground ray at a shallow angle
is accurate to about a tile and a villager is smaller than that.

**There is no pathfinder.** Units steer: they walk at the target and treat what
they hit as a wall to follow. Buildings give a clean face to slide along.
Coastlines do not — a shore is a ragged diagonal, and a normal taken from two
axis probes points into the water about as often as along it — so terrain gets
its own steering, fanning out from the heading the unit wants and taking the
first opening that is genuinely walkable. Which side it turns is then held on to
until that side stops leading anywhere, because a unit that re-decides every
frame steps left, steps right, and covers no ground at all.

**Entity lists are cached.** `bldCache` / `unitCache` / `liveCache` are
invalidated by `touchLists()` rather than rebuilt per frame, which is what makes
a 148×148 map viable.

### Known flaky assertions

The raider flake is fixed. Two assertions used to fail about one run in four
because a marauder wandering over the probe unit won the pick, and a click on a
raider selects nothing — which read as the click failing. The diagnosis was
right and the fix was in the wrong place: the suite cleared hostiles around
where the probe had been and then moved the probe somewhere else. It clears
around where the probe now is.

The 3D picking assertion in `view.test.js` belonged on that list for a related
reason and no longer does. It sampled whichever of your villagers happened to be
on screen and skipped any with something within 26 pixels — but it built that
exclusion list out of units and buildings only, so a tree standing on the same
pixels took the click, which is the correct answer for that click and a failure
for the test. It now places its own probes, chosen in screen space and taken
back into the world so they are inside the view by construction, on ground it
has checked is clear. The sample went from one-to-five figures to a steady five
or six, and it stopped being a coin toss.

What is left is environmental rather than the game's fault. Two assertions
depend on how fast the machine runs rather than on what the game does, and
fail when the whole suite is run on a loaded box while passing on their own:
the mixer assertion in `effects.test.js` and the sword-over-the-bed one in
`audio.test.js` (headless Chromium sometimes never applies a scheduled
parameter change under its null audio sink), and the four-farmhands assertion
in `harvest.test.js`, which waits a fixed number of wall seconds for a fixed
number of game seconds to pass. Run a suite on its own before believing it.

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
