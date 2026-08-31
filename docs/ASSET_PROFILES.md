# Ironvale Asset Profiles — the generation contract

Every painted asset in the game came in through one pipeline: a sheet is
generated, I key out the background, segment the cells, strip the baked
ground shadow, map the views onto the game's compass or facing system,
downscale to twice drawn size, and embed. That half is automated. This
document is the other half: a profile for every remaining asset, written so
a prompt can be pasted into an image generator and the result lands in the
game without rework.

Everything in Part 1 and Part 2 was measured from the sheets already
shipped (the man-at-arms, spearman, knight, wolf, villagers, Town Center,
watchtower, farm, houses, palisade, gold), so a sheet that follows this
contract is by construction consistent with what is already in the valley.

---

## Part 1 — The master style block

Paste this, verbatim, at the front of every prompt:

> Painted miniature realism for a medieval real-time strategy game.
> Grounded, historical, early-medieval European; nothing fantastical.
> Muted palette: umber and chestnut leather, worn steel with soft
> highlights, cream and undyed-linen cloth, dark iron fittings; low
> saturation throughout. Painterly rendering with crisp readable edges,
> single soft key light from the upper left, gentle ambient occlusion.
> Clean solid pale background (white or light checkerboard), small soft
> ground shadow directly beneath the subject. No text, no watermark, no
> border, no props that are not part of the subject.

Rules that ride with it:

- **Team colour.** The game re-dyes saturated cloth-blue into the owner's
  colour at load. Give a subject blue cloth ONLY where the crown's colour
  should appear (banners, caparisons, hangings). Give it NO blue anywhere
  else — soldiers and villagers get their sash painted by the game, so
  their sheets should contain no blue at all.
- **Baked shadows are fine** — the importer strips them. Baked smoke,
  fire or glow is NOT fine unless the profile says so; the game animates
  those live, and a painted still of them reads as frozen.
- **One character.** Every cell of a sheet must show the same individual:
  same face, same kit, same wear marks. Consistency across cells matters
  more than beauty in any single cell.
- **Canvas.** 1536×1024 for every sheet type below.

---

## Part 2 — Layout contracts

### U8 — unit turntable (8 views, 4×2 grid)
The standard for every ground unit. Eight views of the same figure,
standing at rest, arranged:

```
row 1:  front (S)   front-left (SW)   left profile (W)   back-left (NW)
row 2:  back (N)    back-right (NE)   right profile (E)  back-right ¾ (SE)
```

Precisely: row 1 is S, SW, W, NW; row 2 is N, NE, E, SE. The camera is
near eye level with a slight elevation (about 15–20°). The figure fills
roughly 90–97% of its cell's height including any tall weapon; weapons may
extend the bounding box — the importer crops per cell. Figure roughly
centred horizontally.

### B4 — building facings (4 views, 2×2 grid)
Four quarter-turns of the same building, one per quadrant, aerial
three-quarter view at about 30–35° elevation (matching the Town Center and
watchtower sheets). The building fills most of its quadrant. Ground apron
(paving, yard) is welcome and may overhang — the importer lays it over the
game's worn ground.

### S4 — state sheet (4 states, 2×2 grid)
Same object, same camera, four states of its life (the gold seam's
rich/worked/low/dug-out). The FOOTPRINT must not move between cells — the
game anchors all states to one ground point.

### V1 — single view
One render, used for radially symmetric subjects (the farm, the Concord
Exchange) or single-purpose pieces. Centre the subject.

### K — kit sheet (walls)
Pieces of a modular run on one sheet, well separated: a one-tile straight
slice, the two authored corner nubs, a junction, a lone post. The straight
slice must tile seamlessly against itself along the isometric descent.

---

## Part 3 — Unit profiles (U8 unless stated)

### Archer
> A medieval archer, lean build, hooded in muted moss-green and
> undyed-linen cloth over a leather jerkin, tall yew longbow held in the
> left hand, arrow quiver on the back with fletchings visible, bracer on
> the forearm, simple boots and wrapped leggings. No helmet — the hood is
> the silhouette. No blue anywhere.
- Silhouette must-haves: the tall bow (nearly figure height) and the
  quiver. These are what read at gameplay scale.
- Palette accent: moss green (the one unit allowed a green cast — it is
  his identity in the drawn version too).
- Serves the whole archer line (Crossbowman upgrade renames and re-stats
  the same type).

### Skirmisher
> A medieval skirmisher, light irregular troops: no armour beyond a small
> iron cap and a leather vest over earth-brown cloth, a bundle of two or
> three short javelins carried in the off hand and one ready in the right,
> a small round hide buckler slung on the arm. Lighter and scrappier than
> a soldier of the line. No blue.
- Silhouette: the javelin bundle. Must not be mistakable for the
  spearman's single long spear.

### Scout
> A mounted scout on a light, unarmoured horse, rider in plain hood and
> leather over wool, a short sword at the belt, no shield, saddlebags
> and a bedroll behind the saddle. The horse is slighter than a warhorse
> and carries no barding. No blue.
- Layout: U8. Stature: between footman and knight (artH ≈ 3.8).
- Silhouette: bare horse + hooded rider = scout; barded horse + helmed
  rider = knight. Keep them apart.

### King
> A medieval king in gilded scale over rich (but not saturated) robes, a
> gold crown, a heavy fur-trimmed cape falling behind, an ornate sword,
> a commanding stance. The most decorated figure in the army — gold trim
> is allowed and encouraged, but keep the base palette muted. A royal-blue
> cape lining IS wanted here: it is the one unit whose blue should dye to
> the crown's colour.
- Silhouette: crown + cape. He must be unmistakable at 40 px.
- One per side; the game ends when he falls. Worth a second pass if the
  first sheet's silhouette is weak.

### Standard Bearer
> A lightly armoured soldier carrying a tall standard: a long pole
> topped with a hanging banner, held upright in both hands or one hand
> and shoulder. Iron cap, quilted gambeson, no other weapon visible.
> The banner cloth is saturated blue — it is dyed to the crown at load.
- Silhouette: the pole and banner double his height. The banner is the
  point of the unit.

### Marauder
> A lawless raider: mismatched leathers and furs, no livery, a crude
> axe or seax, a round shield with chipped paint, wild hair or a rough
> hood. Poorer and rougher than any crown's soldier. No blue — marauders
> serve nobody.
- Belongs to the neutral faction; sheets must read "brigand", not
  "soldier".

### Ram (S4 optional damage states, else U8 with 4 facings used)
> A covered battering ram: a heavy log slung under a peaked timber
> shelter on four solid wheels, rope lashings, iron ram-head, rough
> planking with gaps. No crew visible — the game provides motion.
- Layout: U8 (the engine turns like any unit). Views with identical
  wheels/frame; log tip must read at small scale.

### Mangonel
> A torsion mangonel: a timber frame on wheels, a throwing arm with a
> sling or spoon, wound rope skeins, a small pile of round stones on the
> frame. Cocked position (arm down) in every view. No crew.
- Layout: U8. Arm-down matters: the game animates the throw itself.

### Fishing Boat (U8, water)
> A small clinker-built fishing boat, single mast unstepped or short,
> nets and creels aboard, weathered planking, no crew. Waterline hull —
> nothing below the waterline visible.
- Cut at the waterline: the game supplies the water. No wake, no
  reflections — those are drawn live.

### War Galley (U8, water)
> A small war galley: clinker hull, a single square-rigged mast with the
> sail furled, a row of shields along the gunwale, a light bolt-thrower
> at the bow, oars shipped. Shield row cloth in saturated blue for the
> crown dye. Waterline hull, no crew, no wake.

### Villager trades (deliberately NOT painted)
The seven trades (farmhand, ploughman, gardener, flaxdresser, ryeman,
woodcutter, prospector) keep their drawn figures: a woodcutter is his axe
at this scale, and the drawn tools carry that. Do not generate these
unless the direction changes.

---

## Part 4 — Building profiles (B4 unless stated)

Shared line for all buildings, after the master block:
> Aerial three-quarter view at about 30 degrees elevation, four
> quarter-turn rotations of the same building arranged 2×2.

### House — Feudal Age (Cottage)
> A modest feudal cottage: timber frame with wattle-and-daub infill,
> steep thatched roof beginning to be dressed, a stone chimney, small
> shuttered windows, a kitchen garden patch and woodpile against the
> wall. A clear step up from a Dark Age hovel, still humble.
- Must sit between the shipped Dark Age house and the Castle Age house
  in wealth. 2×2 footprint. Blue NOWHERE except one small door-cloth if
  any (the house sheet already shipped uses tc:1 dye).

### House — Castle Age (Burgher's house)
> A prosperous burgher's townhouse: two storeys, jettied upper floor,
> half-timbering over a stone ground floor, clay-tile roof, glazed
> windows, a painted sign bracket. Urban and confident.

### House — Imperial Age (Townhouse)
> A wealthy imperial townhouse: stone ground floor, ornate timberwork,
> tall chimneys, a slate or fine tile roof, leaded windows, carved
> bargeboards, a small walled yard. The richest common dwelling.

### Mill
> A watermill-styled grain mill with a large external wooden wheel OR a
> post windmill with four sails — sails/wheel in a fixed position, since
> the game turns them live: render the sail assembly in one clean
> position, clearly separable from the body.
- Note for import: the mill's moving part is animated in-game; a sheet
  whose sails merge into the roof cannot be cut. Keep sails clear of the
  body silhouette.

### Lumber Camp
> A forest work camp: an open-sided timber shelter, a sawpit or trestle
> with a half-cut log, stacked and split cordwood, axes in a stump,
> wood chips on the ground.

### Mining Camp
> A mine head: a timber-framed adit entrance set into a low mound,
> ore carts or baskets, a sorting table with broken stone, picks and
> pit props, a small brazier.

### Barracks
> A military barracks: a long stone-footed hall with a timber upper,
> a weapons rack of spears and shields outside, a training pell (a
> striking post), banners at the door in saturated blue for the crown
> dye, a stout iron-strapped door.

### Archery Range
> An archery range: an open practice ground attached to a small lodge,
> straw butts with painted targets, a rack of bows, arrows stuck in the
> near butt, a rope fence.
- The butts are the silhouette. Keep at least one target face visible
  in every facing.

### Stable
> A stable block: wide barn doors, stalls visible within, hay in a
> loft door above, a paddock rail, a horse's head looking out of one
> stall, a water trough.

### Blacksmith
> A smithy: an open-fronted forge with a stone chimney and hearth glow
> banked low, an anvil on a stump, quench barrel, tools on the wall,
> horseshoes nailed by the door.
- The hearth may glow faintly in the paint; the game adds live light on
  top (same convention as the tower's torches).

### Market
> A market hall: an open timber hall with stalls under its roof, crates,
> sacks and barrels of goods, hanging cloth awnings in saturated blue
> for the crown dye, a set of scales on the counter.

### Siege Workshop
> A siege workshop: a tall open shed with a heavy timber crane or hoist,
> a half-built engine frame inside, great wheels leaning on the wall,
> saw benches, long timbers stacked.

### Granary
> A granary: a raised timber store on staddle stones, a ramp, grain
> sacks at the door, a ladder to a high door, tight shingled roof.
- The game's food ceiling is raised by this building; it should read
  "storage" at a glance — the staddle-stone legs are the tell.

### University
> A university: a stone collegiate hall with tall arched windows, a
> small tower with an observation platform, a sundial or armillary
> sphere in the yard, a heavy studded door.

### Castle
> A small stone castle: a keep with four corner towers, battlements,
> arrow loops, a gatehouse with a raised portcullis, a banner in
> saturated blue from the keep for the crown dye.
- The largest military silhouette in the game. 4×4 footprint.

### Dock
> A timber dock: a plank deck on piles running out from a stone
> abutment, a small crane, bollards, coiled rope, crates and a net
> drying on a rail. Built to meet water on its open side.
- Note: the dock stands half over water; render the piles to a clean
  waterline, no painted water.

### Marauder Camp
> A brigand stockade: a rough ring of sharpened stakes, a watch platform
> on crooked poles, hide tents and a firepit inside, crude trophies on
> the stakes, everything lashed rather than joined. No banner, no blue.

### Stone Wall + Stone Gate (K + V1)
> Stone curtain wall pieces, same kit as the palisade: a one-tile
> straight slice with battlements, two corner nubs, a junction, a lone
> post; and separately a stone gatehouse with an arched passage and
> raised portcullis, rendered along the run.
- The straight slice must tile along the isometric descent exactly as
  the palisade slice does (the importer measures the picket/merlon
  period).

### Colony Standard (V1)
> A tall planted war standard: a banner pole set in a rough cairn of
> stones, guy ropes, the banner cloth large and saturated blue for the
> crown dye.
- This is a victory piece; the banner must read from across the map.

### Crop Plot (S4 ×2 rows if possible, else two S4 sheets)
> A worked field plot seen from the game's aerial angle, same footprint
> every cell: (1) broken dark earth in furrows, (2) green shoots in
> rows, (3) tall ripe wheat gold and heavy, (4) stubble with sheaves
> standing. Row direction identical in every state.
- The harvest is drawn advancing row by row in-game, so the ripe cell's
  rows must be straight and regular enough to cut.

---

## Part 5 — Import notes per layout (what my pipeline does with each)

- U8 → keyed, split 4×2, shadow-stripped, downscaled to ~200 px height
  (mounted: 230), embedded in octant order E,SE,S,SW,W,NW,N,NE = cells
  [6,7,0,1,2,3,4,5]. Wired via `k.art8` + `k.artH` in `unitKit`.
- B4 → keyed, split 2×2, embedded as `ART[type]` with 4 facing slots,
  per-facing pennant anchor measured from the topmost finial; routed via
  `ISOBLD`. About Face and save-carried facing come free.
- S4 → 4 state slots sharing one ground anchor (the gold contract).
- V1 → single slot, `ov`/`lift` tuned on screenshot.
- K → per-piece slots with measured drawn widths (the palisade contract).

Sheets that violate the contract in ways the importer cannot fix: mixed
grid layouts, different characters per cell, background colours that
collide with the subject (pale grey stone on pale grey checker keys
badly — prefer the white checkerboard), and baked animation states
(billowing smoke, mid-swing weapons) where the game animates live.
