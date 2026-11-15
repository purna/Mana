# MANNA — Changelog

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
