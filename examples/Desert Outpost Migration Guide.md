# Desert Outpost: Migration Guide

How to move the Desert Outpost builder into another game. The source is one HTML file (desert-outpost.html) using three.js r128 with no other dependencies. It also contains a rule book as a comment at the top of the script.

## 1. What you are migrating

- A 32x32 tile desert map with an oasis, small grass patches, palms, rocks and dunes.
- Builder tools: tent, sentry wall, watch tower, erase, fell tree, collect rocks, pan.
- Resources: wood and stone, with build costs and refunds.
- Procedural looks from a wave-function-collapse style solver (tents and tower faces) plus a graph grammar that adds fires, sheep folds, gates, beacons and chief tents.
- A fixed Tabernacle at the centre, four flock pens, four roaming flocks with a daily routine.
- A 100 second day with a sky, sun and moon cycle.
- A JSON export of every piece.

## 2. Architecture in one page

Everything is data in tile grids. After each edit the whole scene of pieces is rebuilt from the data (the ground and flocks are not). Nothing is stored in the meshes.

| Layer | Contents |
| --- | --- |
| Data | kind\[x\]\[z\], lvl\[x\]\[z\], gtype\[x\]\[z\], palm\[x\]\[z\], felled, mined, inv, pens, shore, tcache, scache |
| Generation (once per new map) | ground colours and heights, oasis, grass, pens, starter camp, flocks |
| build() (every edit) | solvers, merge, graph, grammar, then draw all pieces, Tabernacle, pens, dressing, HUD, export list |
| Per frame | camera, flocks, smoke, day clock, sky, label |

### Constants

| Name | Value | Meaning |
| --- | --- | --- |
| N | 32 | grid size |
| G | 0.3 | ground top height; everything stands on this |
| TL | 0.7 | tower storey height |
| MAXL | 4 | tower storeys |
| tent and wall levels | 1 to 3 | size and strength |
| DAY | 100 s | one day |
| tile size | 1 unit | W(i) = i - N/2 + 0.5 gives a tile centre |

### Deterministic helpers

- rng(seed): mulberry32 style generator, used only for fresh solver choices and flock spawning.
- hash(x,z): ((x*73856093) xor (z*19349663) xor (seed\*83492791)) as unsigned, mod 1000, divided by 1000. Every variant (tent style, tower material, wall style, palms, rocks, dunes, props) comes from this, so looks are stable between rebuilds. Keep this function exactly, or your variants will move.

## 3. Data model

- kind\[x\]\[z\]: 0 empty, t tent, s sentry wall, w watch tower, T Tabernacle tile, W pond tile, P pen tile. Any non-zero value blocks building, tent doors and flock walking.
- lvl\[x\]\[z\]: tent 1-3, wall 1-3, tower 1-4. Starter pieces may be 0, treat 0 as 1.
- gtype\[x\]\[z\]: 0 sand, 1 grass, 2 pond.
- palm\[x\]\[z\]: a palm stands (or a stump if the cell key is in felled).
- felled and mined: sets of x,z keys for cut palms and collected rocks.
- inv: wood and stone. Start 8 wood and 10 stone.
- pens: list of x0, z0, cx, cz, sgn (gate side). shore: pond-edge land tiles.
- tcache: per tent, last door, colour and a signature of the 3x3 kinds around it. scache: per tower face, last value. These stop the look changing when you edit elsewhere.

## 4. build() order

1. Tent WFC (reuse cached tents whose 3x3 signature is unchanged).
2. Merge touching tents into rectangles up to 2x3.
3. Make graph nodes: tent cells, wall, tower, fire (from facing doors).
4. Run the graph grammar until nothing matches (max 8 passes).
5. Draw tents, fires, sheep folds.
6. Draw sentry walls.
7. Tower WFC (cached), draw towers and rope bridges.
8. Draw the Tabernacle and the pens.
9. Draw dressing on free tiles.
10. Produce the export list and HUD text.

## 5. Systems

### 5.1 Input, camera, pan

- Isometric orthographic camera, elevation 0.6155 rad, yaw steps of 90 degrees with smoothing. A camera target (tgt) is clamped to the map. Zoom 0.35 to 2.2.
- Drag with any tool pans (ground moves with the pointer: tgt += -right*dx + forward*dy/0.577, scaled by world units per pixel). A drag of more than 6 px suppresses the click. W A S D also pan. The Pan tool just makes a click do nothing.
- Click = raycast to the plane y = G, floor to a tile.

### 5.2 Resources and costs

- Costs per level: tent 1 wood, sentry wall 2 stone, tower 1 wood and 2 stone. Raising a level costs the same again.
- Fell tree: +3 wood, leaves a stump. Collect rock: +3 stone, leaves pebbles. Neither regrows.
- Erase lowers one level or removes the piece and refunds half of one level (rounded down).
- Not enough materials: refuse with a message.
- Rocks are tiles where hash is 0.12 to 0.2 on sand. Palms are hash under 0.04 on sand, plus 40 percent of oasis ring tiles.

### 5.3 Tent solver (WFC style)

Each tent cell has a domain of door direction (4) and shade (4: black, dark brown, mid brown, undyed wool).

- Remove any door direction that faces an occupied cell (relax if all are blocked).
- Pick the lowest entropy cell (domain sizes multiplied, plus small noise), collapse randomly, propagate:
  - same shade removed from touching tents (including diagonals) while they keep one shade;
  - a tent two cells ahead is forced to face back (courtyard);
  - a tent beside it is forced to the same door direction (so they can join).
- Cache the result with a signature of the 3x3 kinds. Reuse it while the signature is unchanged. Pinned tents also remove their shade from unsettled neighbours.
- No backtracking, no tile sockets. It is WFC style propagation only.

### 5.4 Large tents

- Scan tents in x then z order. For each unused tent try rectangles in this order: 2x3, 3x2, 2x2, 1x3, 3x1, 2x1, 1x2, 1x1 (width along x, length along z). First fit wins. Maximum is 2x3 tiles.
- The group uses the anchor tent shade. Its door is the anchor door if every outer tile on that side is free, else the first free of 0,1,2,3.
- Height scale = 1 + 0.2 per extra size level + 0.08 per extra tile (+0.1 chief), capped 1.7. Depth = tiles deep - 0.2 + 0.07 per extra level. Footprint scale 0.7 to 1.0 (large tents nearer 1) with a small offset inside the tile.
- Variants from hash of the anchor: 0 flat striped roof, 1 fringed valance, 2 peaked two-slope roof, 3 awning, 4 round yurt, 5 beehive dome, 6 closed pitched A-frame. Door-side prop from another hash: jar, sacks, hide, or none. Size 3 or chief gets a banner pole.

### 5.5 Graph grammar

Nodes: tent (one per cell), wall, tower, fire, fold. Distance is Chebyshev. Rules, in order, repeated until none fire:

| Rule | Match | Effect |
| --- | --- | --- |
| clan-chief | 3 or more touching tent cells, none a chief | most connected becomes chief (larger, banner) |
| hearth | tent with another tent within 2, no fire within 2 | add fire on the free cell nearest the centroid |
| council-ring | fire with 3 or more tents within 2 | ring of stones |
| sheepfold | tent touching a wall, once per tent | add a fold (fence and sheep) on a free cell next to both |
| gatehouse | tower touching 2 or more wall cells | role gate: arched door and pennant |
| signal-beacon | tower of 2+ storeys, no wall or tower within 2 | fire basket instead of canopy |

Also, a fire is added when 2 or more tent doors face the same empty cell. Log how often each rule fired (shown in the HUD).

### 5.6 Sentry walls

- Each wall cell draws its own pillar (width 0.38 to 0.5), constant whatever its neighbours, plus a half segment (thickness 0.3, from pillar to tile edge) toward every neighbouring wall or tower. Joining never resizes a pillar.
- Style by hash of the cell: 0 square stone pillar, 1 round cairn tower, 2 timber lookout posts with a pitched roof and palisade segments.
- Strength 1 / 2 / 3: courses with tops at 0.29 / 0.54 / 0.76. Level 1 has thorn brush on top; level 2 has stakes; level 3 has merlons. Thin dimensions grow 10 percent per extra level.
- Outward = away from the camp centre (average of all non-wall pieces). If there is no link on the outward side, add a thin shield slab there. Thorn brush sits on the outer side of segments and a low step on the inner side.
- Pennant on a pillar with 0 or 1 links, lamp (emissive) with 3 or more.

### 5.7 Watch towers

- Per storey and face, a WFC value: slit (weight 2), beam ends (1), plain (1). Placing a value removes it from the face directly above and below, so patterns alternate. Cache per face so adding a storey only collapses the new faces.
- Hash variants: material (mudbrick, pale limestone, whitewashed with timber bands and buttresses), 40 percent round (cylinder, ring of 8 merlons, cone roof), footprint 0.8 to 1.0, crown (flat reed canopy, pyramid thatch with tall turrets, timber hoarding, pitched ridge roof).
- Ladder on the first free side. Gate role: arched door on the wall side. Beacon role: fire basket. Two towers of equal height in line with exactly one empty tile between get a rope bridge.

### 5.8 Tabernacle

Reserved 8x3 tiles at x 12 to 19, z 15 to 17 (centred on the map). Layout from the design sketch:

```
@@@@@@
@+++-%-@
@@@@@@
```

@ fence, + tent (3 tiles), - court, % fire. A linen fence on posts runs round a 7 by 2 unit loop, with one tile gate in the east fence opposite the tent (gold pillars, blue, purple and scarlet valances). The tent fills three interior tiles at the west end (red walls, dark roof ridge along x, gold pillars and coloured hangings at its east face). Then one court tile, a bronze altar fire with five rising smoke spheres, one more court tile. A text label floats above it (project the world position to screen each frame).

### 5.9 World generation and ground

- Oasis: pond centre 11 to 13 tiles from the middle, radius 1.7 to 2.3, ringed by grass 1.8 tiles wide. Up to three small grass patches (radius 1.1 to 2.0) away from the centre and pond.
- Ground is one mesh, not tiles. Each tile has its own colour at its centre; the four corner colours and heights are the average of the up to four tiles sharing that corner. Build each tile as four triangles fanned from the centre. Pond top is 0.06 lower. Add a sand skirt round the edge. Tile centres on land stay at G so buildings sit flush.
- Tile colours: sand (three tones), grass (two), pond (two blues), Tabernacle court pale sand, pen straw.

### 5.10 Pens and flocks

- Four pens, 3x2 reserved tiles, placed away from the centre and starter camp. Gate in the middle of the long side facing the map centre. Low rail fence, trough with water, hay.
- Four flocks of 5 to 8 sheep and goats (a flock is mostly one kind). Flock n lives at pen n. The flock centre moves; each animal drifts to a slot around it. Animals never enter built, pond, Tabernacle or pen tiles (pens only at night).

Flock state machine:

| State | Behaviour |
| --- | --- |
| rest | wait 2 to 6 s, then pick a grazing spot 2 to 5 tiles away |
| move | walk at 0.3 tiles per second; every 8 to 18 s go to stop |
| stop | 3 to 7 s, most animals graze (head down), some gaze (head up, turning) |
| water | once per day, after a random point between 0.25 and 0.75 of the day: walk to the nearest free pond shore tile |
| drink | 6 to 9 s head down, then rest |
| tohome, enter, sleep, leave | from dusk (day fraction 0.8) to dawn (0.06): go to the gate, enter, settle into slots (body scaled to 0.6 height, head low, slow breathing), leave at dawn |

If a route is blocked, snap the flock into the pen (night) or cancel the trip (day).

### 5.11 Day, sky, light

- Day fraction fr = (dayT mod 100) / 100. Phases: dawn under 0.08, morning 0.3, midday 0.55, afternoon 0.75, dusk 0.88, night after. dayT starts at 12.
- Keyframes (fr: sky, hemisphere sky, hemisphere ground, sun colour, sun intensity, hemisphere intensity): 0 peach, 0.12 warm cream, 0.4 pale, 0.7 sand, 0.82 orange dusk, 0.92 deep blue night (sun 0), 0.97 pre-dawn, 1.0 peach again. Linearly blend colours between keys.
- Sun intensity is multiplied by a horizon fade (in over 0.02 to 0.1, out over 0.78 to 0.88). Sun position follows an arc over fr 0.02 to 0.88 (x = cos*22, y = 4 + sin*15, z = 9). A blue moon light (max 0.34) fades in over 0.8 to 0.9 and out by 0.08. Only the sun casts shadows.

### 5.12 Export JSON

One list of pieces: kind, x, z, role, door direction, shade, levels, wall links, tent span \[width, length\]. Use it as the save format in your game.

## 6. Geometry recipes (all primitives)

Every piece is boxes, cylinders, cones, flattened spheres and a four sided cone (pyramid). A helper takes geometry, scale, colour, position and a YXZ rotation (yaw then pitch then roll); a local-frame helper places parts relative to a tent so one set of offsets works for all four door directions. Diamond ridge roofs are boxes rotated 45 degrees about the ridge axis, half sunk into the walls. All colours are flat; the look comes from flat shading and shadows. If your engine has meshes or prefabs, replace each recipe with a prefab and keep the placement rules.

## 7. Migration steps

1. Port the helpers: tile centre W(), hash(), rng(), grid arrays.
2. Port world generation and the blended ground mesh. Check land tiles sit at G.
3. Port the piece data and tools (place, upgrade, erase, costs) with no visuals; print the export JSON to test.
4. Port the tent solver, cache and merge. Test: place two tents side by side and they merge; edit elsewhere and they do not change.
5. Port the grammar. Test each rule with a small layout.
6. Port walls, then towers, then rope bridges.
7. Port visuals piece by piece (prefabs or primitives).
8. Port the Tabernacle, pens and dressing.
9. Port flocks, then the day clock and sky.
10. Replace the HUD, buttons and inventory chips with your UI.

### Engine mapping

| Source | Unity | Godot | Notes |
| --- | --- | --- | --- |
| box, cylinder, cone | primitive meshes or prefabs | MeshInstance3D | keep the same scale numbers |
| ground mesh | procedural Mesh with vertex colours | ArrayMesh with vertex colour | non-indexed is fine |
| directional light and shadow | Directional Light | DirectionalLight3D | one sun, one moon without shadow |
| orthographic camera | Orthographic Camera | Camera3D orthogonal | 35 degree elevation |
| label overlay | world to screen point | unproject |  |

## 8. Pitfalls

- The world uses x right, z toward the viewer, y up. Flip handedness carefully (the local-frame helper uses a yaw of d times 90 degrees where d=0 faces +z).
- Keep rebuild cost in mind: the source rebuilds about 600 meshes per click. Use pooling or instancing if your engine needs it.
- Never let the solver use hash for the cache signature, only the kinds in the 3x3.
- Rocks, palms and stumps are driven by felled and mined sets, not by deleting objects.
- Flock walkability reads kind and gtype each frame, so building under a flock safely re-routes it.

## 9. Test checklist

- New map: Tabernacle centred, pond not on any reserved tile, four pens placed with free gate tiles.
- Place tents in a 2x3 block: one large tent. Add a seventh: it starts a new rectangle.
- Joining walls: pillar size unchanged. Wall beside the Tabernacle or a pen: no overlap.
- Fell a palm: +3 wood, stump stays after rebuild. Collect a rock: +3 stone, pebbles stay.
- Let a day pass: flocks drink once, go to pens at dusk, lie down, leave at dawn.
- Export JSON: contains every piece with roles and spans.

## 10. Extension points

- New grammar rule: add a name and a function that returns how many rewrites it made.
- New variants: widen the hash modulo and add a branch.
- Real tiled WFC: replace the domain objects with tile lists and the neighbour deletions with socket checks; keep the cache idea.
