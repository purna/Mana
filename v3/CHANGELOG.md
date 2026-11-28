# MANNA — Changelog

## Unreleased — Moses un-stuck, Walk refocus, camera fixes

- **Moses could not walk at all**: every spawn path placed him on the camp centre tile, which is inside the blocked Tabernacle footprint (`K_TAB` around `CAMP`), so `canStep()` failed in all eight directions. A new `placePlayerAtCamp()` helper spots him just south of the tabernacle fence (nearest free tile via `findWalk`) and is used by new games, shared journeys, save loads (only when the saved tile is blocked), camp migrations and boot.
- **Camera refocus on Walk**: selecting the Walk tool now clears the drag-pan offset and glides the camera in close on Moses (zoom target 1.7), like the player-following camera of the previous version. Zoom now animates toward its target (`zoomT3` lerped in `cam3`) instead of snapping, and wheel/panel zooms glide too.
- **Load camera fix**: loading a save set stale tile-space pan maths (`camX = (x-y)*HW`), throwing the camera target far off the map and leaving Moses off-screen; the load now recentres the camera on him.
- Tests: **40 passing** (`npm test`), build passes.

## Unreleased — Desert Outpost world engine migration

- **WebGL world engine replaces the 2D tilemap** (from `examples/Desert Outpost_v5.html`): the game world now renders through a Three.js orthographic camera on a new `#gl` canvas layered under the existing overlay `#c`. The old `HT/WATER/TRAIL/TCOLOR/TYPE` grids, `GROUND[]` WFC ladder, `buildTerrainCanvas()`/tile textures and `renderWorld()` blitter are gone; the frame is a single `draw(dt)` path that renders the 3D scene and then draws the legacy overlay HUD (minimap, labels, pops, weather) on `#c`.
- **Procedural desert**: a 48×48 WFC-desert terrain (dune ridges, gravel flats, oases, ponds with grass and reed rings) generated per world seed, with the camp site flattened and blended into a vertex-colour ground mesh (`rebuildGround`). Station landmarks (Sinai massif, Rephidim rock, sea shore waves) stand in the world; wood/stone nodes, palms, acacias and tufts are placed as 3D meshes.
- **Graph-grammar camp build**: `build()` re-pitches the camp each month/arrival — the Tabernacle court with gold pillars, hangings and bronze altar, a tribal quarter layout (Levi inner ring, Judah/Joseph/Reuben/Dan quadrants) solved by WFC into quarter tents and merged long tents with tribe pennants and tent fires, sentry walls and watchtowers at the compass points, livestock pens with flocks, market stalls, crates and dune piles. Player-built tents/sentries/towers and layout moves call `markRebuild()` so the camp rebuilds from `structures`.
- **Living entities**: pooled 3D people (Moses, camp crowds, raiders, foes), flocks that graze and drift, manna flakes, pillar of cloud/fire, campfire/tent fires with real lights, sky keyframes over the 24-hour day (dawn glow, noon sun, dusk, star night with moon), and the pillar igniting tent fires at night.
- **Input**: click-to-walk and build targeting now raycast through the orthographic camera (`screenToWorld`); camera yaw is a quarter-turn rotation of the scene; WASD stays screen-relative; minimap colors remapped to the new terrain palette.
- **Persistence unchanged**: the save key, schema and share codes are untouched (`manna-iso-save-v2`); load re-flattens the camp site, re-runs `buildDecor` and rebuilds the ground. Save/load round-trip, layout editor move/undo, journey map, build flow and day/night cycle verified in a live browser session.
- Tests: **40 passing** (`npm test`), build passes (three.min.js added to the vite copy list and the service-worker shell).

## Unreleased — view system, muster redesign, build variants, remappable keys

- **Isometric view system** (from the Desert Outpost example): the camera yaw turns in smooth quarter steps (**Q**/**X** or the new bottom-right camera panel), the wheel and panel buttons zoom, and dragging the ground pans the view (a drag past 6px suppresses the click so walking and building still work). The whole world — terrain bitmap included — rotates and scales through one canvas transform, and WASD keeps moving screen-relative while the view is turned.
- **Muster redesign**: the overview is now a full-width table with no side rail; clicking a tribe row opens its page, which carries the left-hand tribe rail, the deploy slider and per-role cells that are labelled, larger, and drawn with hand-drawn two-tone icons (manna, water, wood, camp, watch).
- **Top buttons redesigned** as icon + label pills (Pause / Map / Sound / Setup / About) that no longer clip; on coarse pointers and narrow screens they collapse back to circles.
- **Build & nature variants** (from the example): seven tent shapes (striped, fringed, peaked, awning, yurt, beehive, A-frame), three sentry-post and three watchtower designs chosen per spot; four rock shapes, rock nodes in four forms, and wilderness acacias and tamarisks alongside palms.
- **Ground texture softened** toward the example's look: smooth value noise dominates the tile dither, speckle is a light garnish, and cliff strata are fainter.
- **Remappable controls**: keys moved out of the Camp's Controls tab into Settings, where each action can be rebound (tap the action, press a key; bindings steal and persist in app settings) with a defaults reset; the action-bar keycaps update live.
- **Update prompt hardened**: the Reload handler is bound outside service-worker registration timing with a fallback skip-waiting, and the banner is a plain top toast instead of a HUD-shaped overlay.
- Tests: **40 passing** (`npm test`), build passes.

## Unreleased — update prompt, resource flights, raid intel, determinism

- **PWA update prompt**: a new build now waits instead of silently restarting. When an updated service worker is installed, a “A new build of the wilderness is ready” banner offers **Reload**; the worker only takes over once the player accepts.
- **Resource flights**: gathered manna and wood now visibly arc from where they were collected to the camp stores, with a small sparkle on arrival and `+N` pops at the basket. Honouring reduced motion, flights degrade to the old text pops.
- **Camp layout editor polish**: structure moves snap to a half-tile grid; a dashed footprint ellipse previews the true 1-unit separation on the grid, with the blocking reason shown live in the banner; added a **Redo move** button (mirrored undo/redo stacks, including blueprint restores).
- **Raid intel**: the night-raid scout panel now shows the raiders’ approach quadrants (marked “exposed” when uncovered), an “If the defense fails” expected-loss line, and per-option failure costs on the Moses/watchtower buttons. Coverage state is also always visible in the HUD (“Cover: no cover / N/4 sides / all sides”) and in the Camp defense summary.
- **Determinism**: raid rolls moved into `MannaCore.rollRaid` (same seed stream, same outcome). New `tests/determinism.test.mjs` verifies terrain heights across fresh sessions, save/load round-trips, migration idempotence and raid-roll determinism.
- **Mobile share sheet**: exporting a save now uses the Web Share sheet when the device can share files, falling back to the JSON download elsewhere.
- Tests: **40 passing** (`npm test`), build passes.

## Unreleased — story events and year scaling

- Added scripted Moses story events:
  - Rephidim: strike the rock and bring water to the camp.
  - Mount Sinai: receive the Ten Commandments, then face the Golden Calf with confront/intercede/allow choices.
  - Plains of Moab: cross the Jordan into Israel as the campaign finale.
- Added per-year difficulty scaling: the monthly manna quota rises every four years, camp water demand rises every five, station requirements rise every six, and raids grow in number and toughness.
- Story events persist in saves and integrate with the monthly reports and station flow.


## Unreleased — discipline choices

- Monthly discipline now offers **Punish**, **Counsel**, **Assign** (lazy citizens) and **Forgive**, with different effects on order, faith, health and the offender.
- Resolved cases show the outcome in the report instead of repeating the buttons.
- Added a short explanation of the discipline options to the monthly report.


## Unreleased — sentry posts replace walls

- Replaced wall panels with **Sentry posts** (4 wood). Sentries damage nearby raiders and reduce theft; watchtowers remain the heavy ranged defense.
- Existing saved wall structures migrate to sentry posts automatically.
- Camp defense summaries, build menu, tutorial and fix-next advice now reference sentry posts.


## Unreleased — guided start and monthly leadership report

- Added an in-game tutorial panel with six guided steps: manna, water, camp leadership, station travel, defenses and the monthly report. Steps auto-advance on completion, can be skipped, and can be restarted from About.
- Added pulsing gold guidance rings around the current tutorial target (nearest manna, spring, murmurer, station or camp).
- Added a monthly leadership report after every month: successes, failures, a prioritised "Fix Next" list, and a Discipline section naming offending citizens by name and tribe.
- Offenders can be punished directly from the report; punishment restores order and clears their offence.
- Added named citizens and annual summaries at the end of month 12.
- Enlarged the Camp tribe cards and trait text for readability.


## Unreleased — raider direction and markers

- Raid warnings now name the direction and count: "2 raiders at the perimeter — SW!"
- Added a pulsing red raider indicator with count, distance and cardinal direction; it tracks the nearest raider and points toward off-screen threats.
- Raiders now have a pulsing red ring and exclamation marker in the scene.
- The initial raid log explains the response: move toward them and press E to strike, or rely on watchtowers.


## Unreleased — monthly turns, real pressure and growth

- Calendar is now month-based: each round is a month, twelve months make a year, with Hebrew month names and a 40-year cap. HUD and journey panel show Year/Month; saves migrate from the old year-per-round format.
- Camp water now affects Moses directly: when the shared store is empty, hydration and wellbeing drain, and a neglected camp ends the run. An idle ×4 test ended in Year 1, Month 4.
- Stations now require manna, camp water and faith to enter; current requirements are shown in the pillar panel and a warning is logged if the camp is not ready.
- Raised the monthly camp quota to 22 and capped each citizen to one gathered manna per month, so the player must gather and manage stores.
- Added per-tribe population and livestock growth/decline. Fed, watered and faithful tribes grow; neglected tribes lose people and flocks. Live values appear in the Camp panel and About stats.
- Personal vitals remain alert-only; Camp water is included as a critical resource row.


## Unreleased — atmosphere and alert-only vitals

- Added a scene vignette and a lightweight particle layer: drifting dust, a volumetric Pillar of Cloud by day, a fire/ember column by night, and campfire embers.
- The six personal vitals are now alert-only: hidden while healthy and shown with numeric values only when low or critical.
- Added a Camp water alert row so dwindling shared water appears beside personal needs; the HUD camp-water value also turns red when low.
- Clarified the difficulty read: the current sandbox is intentionally forgiving, with food/wood largely automated and stations not yet gated by resources.


## Unreleased — dual-grid terrain polish

- Added a dual-grid overlay pass for terrain-type boundaries: water, rock, trail and sand edges receive blended half-offset patches instead of hard tile borders.
- Replaced visible vertical cliff faces with textured slope quads on the dual pass, producing ramps/embankments between height levels.
- Broadened sand colour regions to reduce the per-tile checkerboard while keeping grain, pebbles, dry grass and rock cracks.
- Kept bevel highlights on raised/water tiles and softened flat-sand grid lines.


## Unreleased — per-tribe camp stats and detailed tile textures

- Camp panel now shows a per-tribe breakdown for all twelve tribes: canonical population, represented agents, sickness, hoarded manna and trait counts (greedy/lazy/murmurer/devout/ordinary).
- Camp return button is sticky so it stays reachable while scrolling the expanded tribe list.
- Terrain tiles now use generated top/side textures with grain, stone strata, pebbles, dry grass, rock cracks and water ripples instead of flat fills.
- Reduced the hard per-tile grid on flat sand while keeping bevels and cliff faces on raised or water tiles.


## Unreleased — colony-sim slice

- Replaced the decorative crowd with 28 citizen agents carrying traits: greedy, lazy, murmurer, devout and ordinary. Citizens gather manna and acacia wood, deposit stores at camp, hoard manna, murmur, fall sick and can be counselled with `E`.
- Added an Obedience model (Optimal Order / Growing Unrest / Secret Idolatry / Open Rebellion) driven by faith, murmurers, lazy citizens and hoarded manna.
- Added hoarding → rot → disease at midnight, plague events, calf-building progress, and manna spoilage (with Sabbath preservation).
- Added acacia wood nodes, a wood resource, and modular construction for tents, wall panels and watchtowers.
- Added the Camp overlay (`C`): trait counts, stores, health, build buttons, structure/defense summary.
- Added night raids from Year 2 with raiders, tower fire, palisade protection, stolen manna and player retaliation with `E`.
- Added camp/colony fields to saves.


## Unreleased — Twelve Tribes population stats

- Added the canonical populations of the twelve tribes to the About panel as read-only campaign statistics, with the total souls of Israel.
- The isometric edition has no tribe selection; the populations are informational only.

## Unreleased — isometric edition, v1-style HUD and menus

- Added `index.html`: a self-contained 2D isometric adaptation of the v1 journey, with screen-relative movement, click/tap-to-walk, a fixed isometric camera, eight stations, camp quota, springs, market, Sabbath, and win/loss.
- Ported the v1 HUD language: parchment MANNA/YEAR/silver/camp-water panel, dark survival vitals, pillar guidance panel with a gold compass rose, and circular parchment icon buttons for pause, map, audio, credits and about.
- Added About and Credits overlays plus separate SFX/music toggles; music button state reflects the ambient track.
- Added the explored wilderness map, station story modals, market trading, pause/save/continue and a static build path.
- Kept `example.html` as the earlier standalone canvas prototype and the inherited `js/` Three.js source as reference.

## Unreleased — explored map, real basemap & JSON cache

- Added a slowly-revealed wilderness map (`M` / map button) with fog-of-war, player heading, pillar target and camp marker.
- Explored sections now display real **Esri World Imagery** satellite tiles, with the abstract relief map as a fallback.
- Added `js/MapManager.js` and `GameState.map`; explored sections persist in save v3.
- Added `js/TerrainStore.js`: each 1 km section is cached as a JSON-serializable record in IndexedDB via localForage, loaded on demand automatically.
- Terrain streamer checks JSON cache → real DEM → procedural fallback, and writes each result back.
- Re-grounded static scenery when terrain heights update, fixing floating rocks, people and landmarks.
- Moved the Red Sea Shore water behind the monument, anchored station stones/water to local terrain, and excluded vegetation, rocks and pickups from all station springs and the oasis.
- Grounded tents, market stalls, campfire and station props at their own terrain heights and added contact shadows.
- Station stones, altar, ring, sea and shoreline now store local anchors and recompute them whenever the station is re-grounded.
- Pinned the opening 3×3 terrain ring so the camp and all eight station landmarks keep their ground when the player travels far away.
- Rebuilt Moses with a layered robe, mantle, sash, headwrap, beard, sandals, articulated arms and a detailed staff; feet now sit on the surface.
- Added `tests/map.test.mjs`; suite now 32 tests.
- Evening choices are now one-per-crisis per night, with a sticky “Rest until Dawn” action and a clear hint, fixing the loop where the night screen kept reappearing after a response.
- The map X is now in the top-right, the JSON export button was removed, and exploration auto-saves in the browser.
- Added map panning (drag), zooming (wheel/pinch), zoom controls and recenter; the map view now follows the panned location instead of always the player.

## Unreleased — terrain streaming pilot

- Added `js/TerrainStreamer.js`: streams 1 km Wadi Rum sections around the player, grounds terrain, cameras, stations and pickups.
- Added real elevation adapter for Mapzen Terrarium/SRTM tiles (AWS Open Data) with `auto` fallback to a deterministic Wadi Rum model.
- Added carved dry wadis, sandstone massifs, dunes, an oasis, date palms, acacias, tamarisk, desert shrubs, boulders and layered rock outcrops.
- Terrain is normalised around `baseElevation` and compressed into the existing 96-unit tile scale.
- Initial 3×3 terrain ring is awaited before landmarks/player creation to avoid floating scenery.
- Added `tests/terrain.test.mjs`; suite now 26 tests.

## Unreleased — “Forty Years” overhaul

### Campaign
- Reworked the game around a 40-year Exodus journey. Each day is a year; the HUD tracks Year 1–40.
- Added eight story stations (Red Sea Shore, Marah, Elim, Wilderness of Sin, Rephidim, Mount Sinai, Kadesh-Barnea, Plains of Moab) with scripture, narrative, trial and blessing.
- Added victory at the final station and a fortieth-year ending if the journey is unfinished.
- Added `JourneyManager` and `PillarManager`; the pillar glides between stations and drives a compass HUD.

### Survival
- Added fed, warmth, stamina and faith alongside wellbeing and water.
- Added starvation, dehydration and cold damage; rest and good provisions recover wellbeing.
- Added eat manna (`F`), drink (`R`), draw water/warm (`E`) and sprint (`Shift`), with mobile buttons.
- Added a three-charge waterskin; springs and the rock at Rephidim refill it.
- Reduced movement health drain and added passive recovery while safe and rested.

### Presentation
- New “MANNA — Forty Years in the Wilderness” menu, prologue, station, victory and ending modals.
- New journey HUD, rotating pillar compass, survival vitals panel and responsive mobile layout (`styles/journey.css`).
- Pillar of Cloud by day and Fire by night, with a fog-ignoring light shaft, halo and point light.
- Added a living camp crowd of Israelites, night stars, improved player model (robe, headwrap, beard, staff) and walk animation.
- Year terminology across HUD, day-end and messages; station/camp reports remain.

### Technical
- `GameState` v2 adds journey/vitals/waterskin fields; `SaveManager` merges older saves forward.
- Manna now spawns around the camp’s current position and relocates when the camp moves on.
- Added `tests/journey.test.mjs` (journey, pillar, survival tuning) and an `npm test` script.
- Updated docs and build; all 21 Node tests pass and `npm run build` succeeds.

## Earlier
- Added wilderness economy (tithe, Sabbath, Golden Calf, Bronze Serpent), camp needs and evening choices.
- Added save/load, audio, credits, tribes/households, weather, day/night, post-processing.
- Created Blender model sources and GLB exports (not yet runtime-loaded).
